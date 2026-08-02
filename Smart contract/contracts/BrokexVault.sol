// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// =============================================================
// Interfaces
// =============================================================

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IBrokexCore {
    function verifyAndComputeUnrealizedPnL()
        external view returns (int256 totalUnrealizedPnL);
    function totalLockedCapital() external view returns (uint256);
}

// =============================================================
// BrokexVault
// =============================================================

/// @title BrokexVault V4 - LP Liquidity Pool & Token (bUSDC)
/// @notice LP liquidity pool + LP share token (bUSDC) + FIFO withdrawal settlement.
/// @dev CORE ARCHITECTURE, UNITS & LIQUIDITY RULES:
///
///      =================================================================================
///      1. UNITS & NUMERICAL SCALINGS (1e6 PRECISION):
///      =================================================================================
///         - Base Precision: 1,000,000 = 1.0 (100.0000%)
///         - USDC Token Precision (`decimals = 6`): 1,000,000 = 1.000000 USDC
///         - LP Token (`bUSDC`) Precision (`decimals = 6`): 1,000,000 = 1.000000 bUSDC
///         - LP Token Price (`lastKnownPrice` / Exact Price): 1,000,000 = $1.000000 USD per bUSDC share
///
///      =================================================================================
///      2. MARGIN SEGREGATION & FREE LIQUIDITY:
///      =================================================================================
///         - Active trader margin lives ENTIRELY in BrokexCore, never inside this Vault.
///         - This Vault holds LP capital, trading commissions received from Core, and net PnL settlements.
///         - `getFreeLiquidity()` returns the raw USDC balance of this contract without netting trader collateral.
///
///      =================================================================================
///      3. MINTING LP TOKENS (`deposit` / `depositLP`):
///      =================================================================================
///         - Requires a fresh, verified FTSO on-chain prices containing prices for ALL listed assets.
///         - The exact LP price is recomputed from the Vault NAV:
///             NAV = Vault USDC Balance - Net Protocol Unrealized PnL
///             Exact LP Price = (NAV * 1e6) / totalSupply
///         - LP shares minted: `lpMinted = (usdcAmount * 1e6) / Exact LP Price`.
///         - `lastKnownPrice` is updated to this fresh exact price at the end of the transaction.
///
///      =================================================================================
///      4. TWO-STEP FIFO WITHDRAWAL QUEUE (`requestWithdrawLP` & `processWithdrawalQueue`):
///      =================================================================================
///         - STEP 1 (`requestWithdrawLP`): Proof-less & free of oracle fees for the user.
///           User specifies `lpAmount`. LP tokens are immediately locked on Vault contract.
///           A unique `requestId` is assigned at `queueTail`. `totalPendingLP` is incremented.
///           LP tokens are NOT burned yet.
///         - STEP 2 (`processWithdrawalQueue`): Processed FIFO (`queueHead` -> `queueTail`) by a Keeper
///           providing a fresh FTSO on-chain prices.
///           The exact LP price is recomputed. USDC payout is calculated:
///             usdcPaid = (lpAmount * Exact LP Price) / 1e6
///           LP tokens are ONLY NOW permanently burned (`_burn`). `totalPendingLP` is decremented.
///           USDC is paid out to user. `queueHead` advances.
///
///      =================================================================================
///      5. SOLVENCY & CACHED `lastKnownPrice`:
///      =================================================================================
///         - `lastKnownPrice` stores the last verified exact LP price computed on-chain.
///         - `getRequiredFreeUSDC()` uses `lastKnownPrice` to provide a fast, proof-less estimate of USDC
///           needed to fulfill all pending withdrawal requests in the queue:
///             Required Free USDC = (totalPendingLP * lastKnownPrice) / 1e6
///         - BrokexCore uses this value to deduct pending withdrawals from Free Capital before allowing new trades.
contract BrokexVault {

    uint256 public constant DEFAULT_PROCESS_LIMIT = 20;
    uint8   public constant decimals = 6;

    // =========================================================
    // ERC20 STATE VARIABLES (LP Token: bUSDC)
    // =========================================================
    string public name;
    string public symbol;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // =========================================================
    // VAULT STATE VARIABLES
    // =========================================================
    IERC20  public immutable USDC;
    address public owner;
    address public pendingOwner;
    address public coreContract;
    bool    private locked;

    uint256 public lastKnownPrice = 1e6;

    struct WithdrawalRequest {
        address user;
        uint256 lpAmountRemaining;
    }

    mapping(uint256 => WithdrawalRequest) public withdrawalQueue;
    uint256 public queueHead;
    uint256 public queueTail;
    uint256 public totalPendingLP;

    // =========================================================
    // EVENTS
    // =========================================================
    event LPDeposited(address indexed user, uint256 usdcAmount, uint256 lpMinted, uint256 price);
    event WithdrawalRequested(uint256 indexed requestId, address indexed user, uint256 lpAmount);
    event WithdrawalPaid(uint256 indexed requestId, address indexed user, uint256 lpBurned, uint256 usdcPaid, uint256 price);

    // =========================================================
    // ERRORS
    // =========================================================
    error NotOwner();
    error NotPendingOwner();
    error NotCoreContract();
    error Reentrancy();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroLPMinted();
    error InsufficientLPBalance();
    error InsufficientVaultBalance();
    error TransferFailed();

    // =========================================================
    // MODIFIERS
    // =========================================================
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyCore() {
        if (msg.sender != coreContract) revert NotCoreContract();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    // =========================================================
    // CONSTRUCTOR
    // =========================================================
    constructor(address usdc, string memory _name, string memory _symbol) {
        if (usdc == address(0)) revert ZeroAddress();
        USDC   = IERC20(usdc);
        name   = _name;
        symbol = _symbol;
        owner  = msg.sender;
    }

    // =========================================================
    // ADMIN
    // =========================================================

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    function setCoreContract(address _coreContract) external onlyOwner {
        if (_coreContract == address(0)) revert ZeroAddress();
        coreContract = _coreContract;
    }

    // =========================================================
    // ERC20 FUNCTIONS
    // =========================================================

    function transfer(address to, uint256 value) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < value) revert InsufficientLPBalance();
        balanceOf[msg.sender] -= value;
        balanceOf[to]         += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < value) revert InsufficientLPBalance();

        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientLPBalance();
            allowance[from][msg.sender] = allowed - value;
        }

        balanceOf[from] -= value;
        balanceOf[to]   += value;
        emit Transfer(from, to, value);
        return true;
    }

    // =========================================================
    // LP PRICE & PnL
    // =========================================================

    function _getLPPriceAndPnL()
        internal view returns (uint256 price, int256 totalUnrealizedPnL)
    {
        if (totalSupply == 0 || coreContract == address(0)) {
            return (1e6, 0);
        }

        totalUnrealizedPnL = IBrokexCore(coreContract).verifyAndComputeUnrealizedPnL();
        int256 netAssets = int256(getFreeLiquidity()) - totalUnrealizedPnL;

        if (netAssets <= 0) {
            price = 1e6;
        } else {
            price = (uint256(netAssets) * 1e6) / totalSupply;
        }
    }

    function getLPPrice()
        external view returns (uint256 price)
    {
        (price, ) = _getLPPriceAndPnL();
    }

    // =========================================================
    // LP DEPOSIT — instant, two modes
    // =========================================================

    function deposit(uint256 usdcAmount)
        external nonReentrant returns (uint256 lpMinted)
    {
        if (usdcAmount == 0) revert ZeroAmount();

        (uint256 price, ) = _getLPPriceAndPnL();
        lpMinted = (usdcAmount * 1e6) / price;
        if (lpMinted == 0) revert ZeroLPMinted();

        _pull(msg.sender, usdcAmount);

        totalSupply           += lpMinted;
        balanceOf[msg.sender] += lpMinted;
        lastKnownPrice = price;

        emit Transfer(address(0), msg.sender, lpMinted);
        emit LPDeposited(msg.sender, usdcAmount, lpMinted, price);
    }

    function depositLP(uint256 lpAmount)
        external nonReentrant returns (uint256 usdcRequired)
    {
        if (lpAmount == 0) revert ZeroAmount();

        (uint256 price, ) = _getLPPriceAndPnL();
        usdcRequired = (lpAmount * price) / 1e6;
        if (usdcRequired == 0) revert ZeroAmount();

        _pull(msg.sender, usdcRequired);

        totalSupply           += lpAmount;
        balanceOf[msg.sender] += lpAmount;
        lastKnownPrice = price;

        emit Transfer(address(0), msg.sender, lpAmount);
        emit LPDeposited(msg.sender, usdcRequired, lpAmount, price);
    }

    function requestWithdraw(uint256 lpAmount) external nonReentrant returns (uint256 requestId) {
        if (lpAmount == 0) revert ZeroAmount();
        if (balanceOf[msg.sender] < lpAmount) revert InsufficientLPBalance();

        balanceOf[msg.sender]    -= lpAmount;
        balanceOf[address(this)] += lpAmount;
        emit Transfer(msg.sender, address(this), lpAmount);

        requestId = queueTail++;
        withdrawalQueue[requestId] = WithdrawalRequest({
            user: msg.sender,
            lpAmountRemaining: lpAmount
        });

        totalPendingLP += lpAmount;
        emit WithdrawalRequested(requestId, msg.sender, lpAmount);
    }

    // =========================================================
    // LP WITHDRAWAL — STEP 2: PROCESS QUEUE (public, fresh proof)
    // =========================================================

    function processWithdrawalQueue() external nonReentrant {
        this.processWithdrawalQueue(DEFAULT_PROCESS_LIMIT);
    }

    function processWithdrawalQueue(uint256 limit) external nonReentrant {
        (uint256 price, ) = _getLPPriceAndPnL();
        lastKnownPrice = price;

        uint256 vaultBal = USDC.balanceOf(address(this));
        uint256 coreLocked = coreContract != address(0) ? IBrokexCore(coreContract).totalLockedCapital() : 0;
        uint256 safeFreeUSDC = vaultBal > coreLocked ? vaultBal - coreLocked : 0;

        uint256 count = 0;

        while (queueHead < queueTail && count < limit) {
            if (safeFreeUSDC == 0) break;

            WithdrawalRequest storage req = withdrawalQueue[queueHead];
            if (req.lpAmountRemaining == 0) {
                queueHead++;
                count++;
                continue;
            }

            uint256 valueOwedUSDC = (req.lpAmountRemaining * price) / 1e6;
            uint256 toPayUSDC = valueOwedUSDC < safeFreeUSDC ? valueOwedUSDC : safeFreeUSDC;

            if (toPayUSDC == 0) {
                if (req.lpAmountRemaining < 1e1) {
                    uint256 dust = req.lpAmountRemaining;
                    balanceOf[address(this)] -= dust;
                    totalSupply               -= dust;
                    emit Transfer(address(this), address(0), dust);
                    req.lpAmountRemaining = 0;
                    totalPendingLP        -= dust;
                    queueHead++;
                    count++;
                    continue;
                }
                break;
            }

            uint256 lpToSettle = (toPayUSDC * 1e6) / price;
            if (lpToSettle > req.lpAmountRemaining || req.lpAmountRemaining - lpToSettle < 1e1) {
                lpToSettle = req.lpAmountRemaining;
            }

            req.lpAmountRemaining    -= lpToSettle;
            totalPendingLP           -= lpToSettle;
            balanceOf[address(this)] -= lpToSettle;
            totalSupply               -= lpToSettle;
            emit Transfer(address(this), address(0), lpToSettle);

            safeFreeUSDC -= toPayUSDC;
            _send(req.user, toPayUSDC);

            emit WithdrawalPaid(queueHead, req.user, lpToSettle, toPayUSDC, price);

            if (req.lpAmountRemaining == 0) {
                queueHead++;
            }
            count++;
        }
    }

    // =========================================================
    // CORE INTEGRATION — TRADER PROFIT PAYOUT
    // =========================================================

    function payTrader(address trader, uint256 amount) external onlyCore {
        if (amount == 0) return;
        uint256 vaultBalance = USDC.balanceOf(address(this));
        if (vaultBalance < amount) revert InsufficientVaultBalance();
        _send(trader, amount);
    }

    // =========================================================
    // VIEW FUNCTIONS
    // =========================================================

    function getFreeLiquidity() public view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    function getRequiredFreeUSDC() external view returns (uint256) {
        if (totalPendingLP == 0) return 0;
        return (totalPendingLP * lastKnownPrice) / 1e6;
    }

    // =========================================================
    // HELPERS — Safe transfers
    // =========================================================

    function _pull(address from, uint256 amount) internal {
        if (amount == 0) return;
        if (!USDC.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _send(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (!USDC.transfer(to, amount)) revert TransferFailed();
    }
}
