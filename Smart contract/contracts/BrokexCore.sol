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

interface IBrokexVault {
    function payTrader(address trader, uint256 amount) external;
    function getRequiredFreeUSDC() external view returns (uint256);
}

interface IFtsoV2 {
    function getFeedById(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp);
}

interface ITeeExtensionRegistry {
    struct TeeInstructionParams {
        bytes32 opType;
        bytes32 opCommand;
        bytes message;
        address[] cosigners;
        uint64 cosignersThreshold;
        address claimBackAddress;
    }
    function sendInstructions(
        address[] calldata _teeIds,
        TeeInstructionParams calldata _instructionParams
    ) external payable returns (bytes32 _instructionId);
    function nextPublicExtensionId() external view returns (uint256);
    function getTeeExtensionInstructionsSender(uint256 _extensionId) external view returns (address);
}

interface ITeeMachineRegistry {
    function getRandomTeeIds(uint256 _extensionId, uint256 _count) external view returns (address[] memory);
}

// =============================================================
// BrokexCore
// =============================================================

/// @title BrokexCore V4 - Perpetual Trading & Risk Engine
/// @notice Core protocol engine responsible for trade execution, position management, asset exposure,
///         and protocol risk management.
/// @dev CORE ARCHITECTURE, UNITS & LIQUIDITY PRINCIPLES:
///
///      =================================================================================
///      1. UNITS & NUMERICAL SCALINGS (1e6 PRECISION):
///      =================================================================================
///         - Base Precision (`PRECISION`): 1,000,000 = 100.0000% = 1.0
///         - Percentage & Basis Point Conversions:
///             * 100%       = 1,000,000
///             * 10%        = 100,000   (e.g., profitCap = 100,000 for 10% max profit)
///             * 5%         = 50,000    (e.g., lockedCapitalBps = 50,000 for 5% locked capital)
///             * 1%         = 10,000    (e.g., MAX_COMMISSION_ALLOWED = 10_000)
///             * 0.10%      = 1,000     (e.g., 10 bps spread = 1,000)
///             * 0.01%      = 100       (1 bps = 100)
///         - Monetary Amounts (USDC / Margin / OI / Borrow Fee / PnL): 6 decimals (1,000,000 = 1.000000 USDC)
///         - Asset Spot Prices (FTSO Native): 6 decimals (2,350,500,000 = $2350.500000 USD)
///
///      =================================================================================
///      2. OI-WEIGHTED AVERAGE ENTRY PRICE & PRO-RATA LOGIC:
///      =================================================================================
///         - `avgEntryPriceLong` and `avgEntryPriceShort` track the OI-weighted average entry price per asset per side.
///         - On Trade Open (Pro-Rata Formula):
///             newAvg = ((oldOI * oldAvg) + (tradeOI * tradeEntryPrice)) / (oldOI + tradeOI)
///         - On Trade Close: Position size is subtracted from side OI. The average price remains unchanged.
///         - Zero-OI Safety Reset: When a side's OI reaches 0, `avgEntryPrice` is hard-reset to 0 to eliminate price drift.
///
///      =================================================================================
///      3. FTSO NATIVE ORACLE (NO EXTERNAL PROOF):
///      =================================================================================
///         - Prices are read directly from Flare FTSO v2 via `getFeedById(bytes21)`.
///         - No signed oracle proof required — `view` function, minimal gas, no stale proof risk.
///         - FTSO prices are normalized to 1e6 decimals on read.
///
///      =================================================================================
///      4. ROLE SEPARATION & SOLVENCY (`getFreeCapital()`):
///      =================================================================================
///         - Active trader collateral stays in BrokexCore; BrokexVault holds LP capital & net settlements.
///         - Dominant OI: dominantOI = max(openInterestLong, openInterestShort).
///         - Locked Capital: (dominantOI * lockedCapitalBps) / 1e6 (5% of dominant OI).
///         - Free Capital = Vault USDC Balance - totalLockedCapital - Pending LP Withdrawal Queue.
///         - Trades increasing dominant OI check Free Capital; non-dominant trades (e.g. SHORT when LONGs dominate)
///           do not increase locked capital and bring in commissions, pushing the pool toward delta-neutrality.
///
///      =================================================================================
///      5. PROFIT CAP & POSITIVE LIQUIDATION (AUTO TAKE-PROFIT):
///      =================================================================================
///         - Trader max profit is capped at `profitCap` (100,000 / 1e6 = 10% of OI).
///         - Keepers execute batch triggers (`REASON_PROFIT_CAP = 6`) when trade gain reaches `profitCap`,
///           closing the position under `STATE_LIQ_POS = 6`. Loss is bounded by initial margin (`t.margin`).
///
///      =================================================================================
///      6. SPREAD FORMULAS (ENTRY & EXIT SPREADS):
///      =================================================================================
///         - Entry Spread:
///             * LONG Entry:  entryPrice = oraclePrice + (oraclePrice * spreadLong) / 1e6 (buys at ask)
///             * SHORT Entry: entryPrice = oraclePrice - (oraclePrice * spreadShort) / 1e6 (sells at bid)
///         - Exit Spread:
///             * LONG Exit:  exitPrice = oraclePrice - (oraclePrice * spreadShort) / 1e6 (sells at bid)
///             * SHORT Exit: exitPrice = oraclePrice + (oraclePrice * spreadLong) / 1e6 (buys back at ask)
///
///      =================================================================================
///      7. BORROW FEE FORMULA:
///      =================================================================================
///         - Hourly rate per asset: `cfg.borrowRateHourly` (1e6 precision).
///         - Hours Elapsed: hoursElapsed = max(1, (block.timestamp - openTimestamp) / 3600).
///         - Borrow Fee: borrowFee = (margin * leverage * borrowRateHourly * hoursElapsed) / 1e6.
///         - Borrow fee is deducted from gross PnL upon position closure.
///
///      =================================================================================
///      8. PNL & LIQUIDATION TYPES:
///      =================================================================================
///         - Gross PnL Formula:
///             * LONG:  grossPnl = (oi * (closePrice - openPrice)) / openPrice
///             * SHORT: grossPnl = (oi * (openPrice - closePrice)) / openPrice
///         - Net Realized PnL = grossPnl - borrowFee.
///         - Standard Liquidation (`REASON_LIQ = 3`, `STATE_LIQUIDATED = 4`):
///             * Triggered when lossAmt >= (margin * liqThresholdBps) / 1e6 (e.g. 90% loss).
///             * Entire margin transferred to Vault.
///         - Positive Liquidation (`REASON_PROFIT_CAP = 6`, `STATE_LIQ_POS = 6`):
///             * Triggered when grossPnl >= (oi * profitCap) / 1e6.
///             * Trader profit capped at maxProfit; margin + maxProfit returned to trader.
///
///      =================================================================================
///      9. TRADING COMMISSION FORMULA & FUND FLOW:
///      =================================================================================
///         - Asset Commission Bps: `cfg.commissionBps` (capped at MAX_COMMISSION_ALLOWED = 10,000 / 1.0%).
///         - Gross Position OI: grossOI = collateral * leverage.
///         - Open Commission: commission = (grossOI * commissionBps) / 1e6.
///         - Net Position Margin: margin = collateral - commission.
///         - Net Position OI: oi = margin * leverage.
///         - Fund Flow: Full collateral is pulled from trader. Commission is immediately transferred to Vault,
///           enriching LP pool balance, while net margin is retained in Core as active trading collateral.
contract BrokexCore {

    uint256 public constant PRECISION          = 1e6;
    uint256 public constant HOUR               = 1 hours;

    // =========================================================================================
    // GARDE-FOUS ET SECURITE ADMINISTRATEUR (OWNER IMMUTABILITY & HARD CAPS)
    // =========================================================================================

    uint256 public constant MAX_LEVERAGE_HARD_CAP = 100;
    uint256 public constant MAX_SPREAD_ALLOWED = 1_000;
    uint256 public constant MAX_COMMISSION_ALLOWED = 10_000;
    uint256 public constant MAX_BORROW_RATE_ALLOWED = 1_000;

    bytes32 public constant OP_TYPE_RISK = bytes32("RISK");
    bytes32 public constant OP_COMMAND_CALCULATE = bytes32("CALCULATE");
    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000;

    uint8 public constant STATE_ORDER      = 0;
    uint8 public constant STATE_OPEN       = 1;
    uint8 public constant STATE_CLOSED     = 2;
    uint8 public constant STATE_CANCELLED  = 3;
    uint8 public constant STATE_LIQUIDATED = 4;
    uint8 public constant STATE_EMERGENCY  = 5;
    uint8 public constant STATE_LIQ_POS    = 6;

    uint8 public constant DIR_LONG  = 1;
    uint8 public constant DIR_SHORT = 0;

    uint8 public constant ORDER_MARKET = 0;
    uint8 public constant ORDER_LIMIT  = 1;
    uint8 public constant ORDER_STOP   = 2;

    uint8 public constant REASON_MARKET     = 0;
    uint8 public constant REASON_SL         = 1;
    uint8 public constant REASON_TP         = 2;
    uint8 public constant REASON_LIQ        = 3;
    uint8 public constant REASON_EMERGENCY  = 4;
    uint8 public constant REASON_CANCEL     = 5;
    uint8 public constant REASON_PROFIT_CAP = 6;

    // =========================================================
    // Structs
    // =========================================================

    struct AssetConfig {
        bytes21 ftsoFeedId;
        uint256 minLeverage;
        uint256 maxLeverage;
        uint256 minTradeSize;
        uint256 commissionBps;
        uint256 borrowRateHourly;
        uint256 profitCap;
        uint256 executionTolerance;
        uint256 maxProofAge;
        uint256 maxTraderOI;
        uint256 maxGlobalOI;
        uint256 lockedCapitalBps;
        uint256 liqThresholdBps;
        bool listed;
        bool frozen;
    }

    struct Trade {
        uint256 id;
        address trader;
        bytes32 assetHash;
        uint8 state;
        uint8 direction;
        uint8 orderType;
        uint256 margin;
        uint256 leverage;
        uint256 targetPrice;
        uint256 openPrice;
        uint256 closePrice;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 openTimestamp;
        uint256 closeTimestamp;
        uint256 borrowFee;
    }

    struct RiskProof {
        bytes32 assetHash;
        uint256 maxOILong;
        uint256 maxOIShort;
        uint256 spreadLong;
        uint256 spreadShort;
        uint256 timestamp;
        bytes   sig;
    }

    struct TradeInit {
        bytes32 assetHash;
        uint8   direction;
        uint8   orderType;
        uint256 margin;
        uint256 leverage;
        uint256 targetPrice;
        uint256 openPrice;
        uint256 slPrice;
        uint256 tpPrice;
    }

    // =========================================================
    // Storage
    // =========================================================

    address public owner;
    address public pendingOwner;
    bool    private locked;

    IERC20       public immutable USDC;
    IBrokexVault public immutable vault;
    IFtsoV2      public immutable FTSO;

    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    ITeeMachineRegistry   public immutable TEE_MACHINE_REGISTRY;
    uint256               private _extensionId;

    address public teeSigner;

    mapping(bytes32 => AssetConfig) public assets;
    bytes32[] public listedAssetHashes;

    bool public paused;
    bool public emergencyMode;

    mapping(bytes32 => uint256) public openInterestLong;
    mapping(bytes32 => uint256) public openInterestShort;
    mapping(bytes32 => uint256) public avgEntryPriceLong;
    mapping(bytes32 => uint256) public avgEntryPriceShort;

    uint256 public totalLockedCapital;

    mapping(bytes32 => mapping(address => uint256)) public traderOpenInterest;
    mapping(uint256 => Trade)     public trades;

    uint256 public nextTradeId = 1;

    // =========================================================
    // Events & Errors
    // =========================================================

    event TradeEvent(uint256 indexed tradeId);
    event OwnershipTransferStarted(address indexed old, address indexed pending);
    event OwnershipTransferred(address indexed old, address indexed next);
    event ConfigUpdated();
    event TeeSignerUpdated(address indexed signer);
    event TradingPaused();
    event TradingUnpaused();
    event EmergencyEnabled();
    event EmergencyDisabled();
    event InsolvencyWarning(uint256 indexed tradeId, uint256 owed, uint256 paid);
    event InstructionSent(bytes32 indexed instructionId, address indexed sender, bytes payload);

    error NotOwner();
    error NotPendingOwner();
    error Reentrancy();
    error ZeroAddress();
    error BadParameter();
    error ProtocolPaused();
    error NotPausedError();
    error EmergencyOnly();
    error NotTrader();
    error BadDirection();
    error BadOrderType();
    error BadLeverage();
    error BadMargin();
    error BadPrice();
    error BadSLTP();
    error DelayNotPassed();
    error InvalidState();
    error OIExceeded();
    error TraderOIExceeded();
    error GlobalOIExceeded();
    error InsufficientVaultCapital();
    error PriceZero();
    error IncompleteBatchProof();
    error InvalidTeeProof();
    error TeeProofExpired();
    error SpreadExceedsMaxAllowed();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    modifier notPaused() {
        if (paused) revert ProtocolPaused();
        _;
    }

    constructor(
        address usdc,
        address vaultAddress,
        address ftsoAddress,
        address teeExtensionRegistry,
        address teeMachineRegistry,
        address teeSignerAddress
    ) {
        if (usdc                    == address(0)) revert ZeroAddress();
        if (vaultAddress            == address(0)) revert ZeroAddress();
        if (ftsoAddress             == address(0)) revert ZeroAddress();
        if (teeExtensionRegistry    == address(0)) revert ZeroAddress();
        if (teeMachineRegistry      == address(0)) revert ZeroAddress();
        if (teeSignerAddress        == address(0)) revert ZeroAddress();

        owner     = msg.sender;
        USDC      = IERC20(usdc);
        vault     = IBrokexVault(vaultAddress);
        FTSO      = IFtsoV2(ftsoAddress);
        TEE_EXTENSION_REGISTRY = ITeeExtensionRegistry(teeExtensionRegistry);
        TEE_MACHINE_REGISTRY   = ITeeMachineRegistry(teeMachineRegistry);
        teeSigner = teeSignerAddress;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    // =========================================================
    // TEE Extension Registry
    // =========================================================

    function setExtensionIdExplicit(uint256 id) external onlyOwner {
        _extensionId = id;
    }

    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");
        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    function getExtensionId() public view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }

    function sendTeeInstruction(bytes calldata _payload) external payable returns (bytes32 instructionId) {
        address[] memory teeNodes = TEE_MACHINE_REGISTRY.getRandomTeeIds(getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_RISK,
            opCommand: OP_COMMAND_CALCULATE,
            message: _payload,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(
            teeNodes,
            params
        );

        emit InstructionSent(instructionId, msg.sender, _payload);
    }

    // =========================================================
    // Ownership
    // =========================================================

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address old  = owner;
        owner        = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(old, owner);
    }

    // =========================================================
    // Admin
    // =========================================================

    event AssetListed(bytes32 indexed assetHash);
    event AssetUpdated(bytes32 indexed assetHash);
    event AssetFrozen(bytes32 indexed assetHash);
    event AssetUnfrozen(bytes32 indexed assetHash);
    event AssetDelisted(bytes32 indexed assetHash);

    function listAsset(bytes32 assetHash, bytes21 ftsoFeedId, AssetConfig calldata cfg) external onlyOwner {
        if (assets[assetHash].listed) revert BadParameter();
        _validateConfig(cfg);
        AssetConfig memory newCfg = cfg;
        newCfg.ftsoFeedId = ftsoFeedId;
        newCfg.listed = true;
        newCfg.frozen = false;
        assets[assetHash] = newCfg;
        listedAssetHashes.push(assetHash);
        emit AssetListed(assetHash);
    }

    function updateAsset(bytes32 assetHash, AssetConfig calldata cfg) external onlyOwner {
        if (!assets[assetHash].listed) revert BadParameter();
        _validateConfig(cfg);
        AssetConfig memory newCfg = cfg;
        newCfg.profitCap = assets[assetHash].profitCap;
        newCfg.borrowRateHourly = assets[assetHash].borrowRateHourly;
        newCfg.lockedCapitalBps = assets[assetHash].lockedCapitalBps;
        newCfg.liqThresholdBps = assets[assetHash].liqThresholdBps;
        newCfg.ftsoFeedId = assets[assetHash].ftsoFeedId;
        newCfg.listed = true;
        newCfg.frozen = assets[assetHash].frozen;
        assets[assetHash] = newCfg;
        emit AssetUpdated(assetHash);
    }

    function freezeAsset(bytes32 assetHash) external onlyOwner {
        if (!assets[assetHash].listed) revert BadParameter();
        assets[assetHash].frozen = true;
        emit AssetFrozen(assetHash);
    }

    function unfreezeAsset(bytes32 assetHash) external onlyOwner {
        if (!assets[assetHash].listed) revert BadParameter();
        assets[assetHash].frozen = false;
        emit AssetUnfrozen(assetHash);
    }

    function delistAsset(bytes32 assetHash) external onlyOwner {
        if (!assets[assetHash].listed) revert BadParameter();
        if (openInterestLong[assetHash] != 0 || openInterestShort[assetHash] != 0) revert BadParameter();
        assets[assetHash].listed = false;
        emit AssetDelisted(assetHash);
    }

    function setTeeSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert ZeroAddress();
        teeSigner = signer;
        emit TeeSignerUpdated(signer);
    }

    function pause() external onlyOwner {
        if (paused) revert ProtocolPaused();
        paused = true;
        emit TradingPaused();
    }

    function unpause() external onlyOwner {
        if (!paused) revert NotPausedError();
        paused = false;
        emit TradingUnpaused();
    }

    function enableEmergencyMode() external onlyOwner {
        paused        = true;
        emergencyMode = true;
        emit EmergencyEnabled();
    }

    function disableEmergencyMode() external onlyOwner {
        emergencyMode = false;
        emit EmergencyDisabled();
    }

    // =========================================================
    // User — Open Market Position
    // =========================================================

    function openMarketPosition(
        bytes32 assetHash,
        uint8   direction,
        uint256 collateral,
        uint256 leverage,
        uint256 slPrice,
        uint256 tpPrice,
        RiskProof calldata riskProof
    ) external nonReentrant notPaused returns (uint256 tradeId) {
        AssetConfig storage cfg = assets[assetHash];
        if (!cfg.listed) revert BadParameter();
        if (cfg.frozen) revert BadParameter();
        if (riskProof.assetHash != assetHash) revert BadParameter();
        if (direction != DIR_LONG && direction != DIR_SHORT) revert BadDirection();

        _verifyTeeProof(riskProof);
        _validateSpreadCap(riskProof.spreadLong, riskProof.spreadShort);

        (uint256 margin, uint256 oi) = _pullFundsAndCommission(assetHash, collateral, leverage);

        uint256 oraclePrice = _getPrice(assetHash);
        uint256 entryPrice = _applyEntrySpread(oraclePrice, direction, riskProof);
        uint256 liqP = _liqPrice(entryPrice, leverage, direction, cfg.liqThresholdBps);

        if (slPrice != 0 || tpPrice != 0) _validateSLTP(direction, entryPrice, liqP, slPrice, tpPrice);

        _applyRisk(assetHash, direction, oi, entryPrice, riskProof);

        tradeId = _storeTrade(TradeInit({
            assetHash:   assetHash,
            direction:   direction,
            orderType:   ORDER_MARKET,
            margin:      margin,
            leverage:    leverage,
            targetPrice: 0,
            openPrice:   entryPrice,
            slPrice:     slPrice,
            tpPrice:     tpPrice
        }));

        emit TradeEvent(tradeId);
    }

    // =========================================================
    // User — Create Limit / Stop Order
    // =========================================================

    function createLimitOrStopOrder(
        bytes32 assetHash,
        uint8   direction,
        uint8   orderType,
        uint256 targetPrice,
        uint256 collateral,
        uint256 leverage,
        uint256 slPrice,
        uint256 tpPrice
    ) external nonReentrant notPaused returns (uint256 tradeId) {
        if (direction != DIR_LONG && direction != DIR_SHORT)             revert BadDirection();
        if (orderType != ORDER_LIMIT && orderType != ORDER_STOP)         revert BadOrderType();
        if (targetPrice == 0) revert BadPrice();

        AssetConfig storage cfg = assets[assetHash];
        if (!cfg.listed) revert BadParameter();
        if (cfg.frozen) revert BadParameter();
        if (collateral < cfg.minTradeSize)                              revert BadMargin();
        if (leverage < cfg.minLeverage || leverage > cfg.maxLeverage || leverage > MAX_LEVERAGE_HARD_CAP) revert BadLeverage();

        uint256 approxLiq  = _liqPrice(targetPrice, leverage, direction, cfg.liqThresholdBps);
        if (slPrice != 0 || tpPrice != 0) _validateSLTP(direction, targetPrice, approxLiq, slPrice, tpPrice);

        _pull(msg.sender, collateral);

        tradeId = _storeTrade(TradeInit({
            assetHash:   assetHash,
            direction:   direction,
            orderType:   orderType,
            margin:      collateral,
            leverage:    leverage,
            targetPrice: targetPrice,
            openPrice:   0,
            slPrice:     slPrice,
            tpPrice:     tpPrice
        }));

        emit TradeEvent(tradeId);
    }

    // =========================================================
    // User — Cancel Order
    // =========================================================

    function cancelOrder(uint256 tradeId) external nonReentrant {
        Trade storage t = trades[tradeId];
        if (t.trader != msg.sender)  revert NotTrader();
        if (t.state  != STATE_ORDER) revert InvalidState();
        if (block.timestamp < t.openTimestamp + 1 minutes) revert DelayNotPassed();

        t.state          = STATE_CANCELLED;
        t.closeTimestamp = block.timestamp;
        _send(msg.sender, t.margin);
        emit TradeEvent(tradeId);
    }

    // =========================================================
    // User — Modify SL / TP
    // =========================================================

    function modifyStops(uint256 tradeId, uint256 newSL, uint256 newTP) external {
        Trade storage t = trades[tradeId];
        if (t.trader != msg.sender) revert NotTrader();
        if (t.state != STATE_OPEN && t.state != STATE_ORDER) revert InvalidState();

        if (newSL != 0 || newTP != 0) {
            uint256 refPrice = t.state == STATE_OPEN ? t.openPrice   : t.targetPrice;
            uint256 liqP     = t.state == STATE_OPEN
                ? _liqPrice(t.openPrice, t.leverage, t.direction, assets[t.assetHash].liqThresholdBps)
                : _liqPrice(t.targetPrice, t.leverage, t.direction, assets[t.assetHash].liqThresholdBps);
            _validateSLTP(t.direction, refPrice, liqP, newSL, newTP);
        }

        t.stopLoss   = newSL;
        t.takeProfit = newTP;
        emit TradeEvent(tradeId);
    }

    // =========================================================
    // User — Close Market
    // =========================================================

    function closePositionMarket(
        bytes32 assetHash,
        uint256 tradeId,
        RiskProof calldata riskProof
    ) external nonReentrant {
        Trade storage t = trades[tradeId];
        if (t.trader != msg.sender) revert NotTrader();
        if (t.state  != STATE_OPEN) revert InvalidState();
        if (t.assetHash != assetHash) revert BadParameter();
        if (riskProof.assetHash != assetHash) revert BadParameter();

        AssetConfig storage cfg = assets[assetHash];
        if (!cfg.listed) revert BadParameter();

        _verifyTeeProof(riskProof);
        _validateSpreadCap(riskProof.spreadLong, riskProof.spreadShort);

        uint256 oraclePrice = _getPrice(assetHash);
        _closeTrade(tradeId, oraclePrice, REASON_MARKET, riskProof);
    }

    // =========================================================
    // User — Emergency Close
    // =========================================================

    function emergencyClose(uint256 tradeId) external nonReentrant {
        if (!emergencyMode) revert EmergencyOnly();

        Trade storage t = trades[tradeId];
        if (t.trader != msg.sender) revert NotTrader();

        if (t.state == STATE_ORDER) {
            t.state          = STATE_EMERGENCY;
            t.closeTimestamp = block.timestamp;
            _send(t.trader, t.margin);
        } else if (t.state == STATE_OPEN) {
            _releaseExposure(tradeId);
            t.state          = STATE_EMERGENCY;
            t.closeTimestamp = block.timestamp;
            _send(t.trader, t.margin);
        } else {
            revert InvalidState();
        }

        emit TradeEvent(tradeId);
    }

    // =========================================================
    // Keeper — Batch Execute
    // =========================================================

    function batchExecute(
        uint256[] calldata tradeIds,
        uint8[]   calldata reasons,
        RiskProof[] calldata riskProofs
    ) external nonReentrant returns (
        uint256[] memory executedIds,
        uint256[] memory skippedIds
    ) {
        if (tradeIds.length != reasons.length)    revert BadParameter();
        if (tradeIds.length != riskProofs.length) revert BadParameter();

        uint256 len = tradeIds.length;
        uint256[] memory execTmp = new uint256[](len);
        uint256[] memory skipTmp = new uint256[](len);
        uint256 execCount;
        uint256 skipCount;

        for (uint256 i = 0; i < len; i++) {
            uint256 oraclePrice = _getPrice(trades[tradeIds[i]].assetHash);
            bool ok = _executeTriggered(tradeIds[i], oraclePrice, reasons[i], riskProofs[i]);
            if (ok) { execTmp[execCount++] = tradeIds[i]; }
            else    { skipTmp[skipCount++] = tradeIds[i]; }
        }

        executedIds = _trim(execTmp, execCount);
        skippedIds  = _trim(skipTmp, skipCount);
    }

    // =========================================================
    // INTERNAL — Keeper trigger dispatch
    // =========================================================

    function _executeTriggered(
        uint256 tradeId,
        uint256 oraclePrice,
        uint8   reason,
        RiskProof calldata rp
    ) internal returns (bool) {
        Trade storage t = trades[tradeId];
        if (t.assetHash != rp.assetHash) return false;

        AssetConfig storage cfg = assets[rp.assetHash];
        if (!cfg.listed) return false;

        if (!_checkTeeProof(rp)) return false;
        if (rp.spreadLong  > MAX_SPREAD_ALLOWED)               return false;
        if (rp.spreadShort > MAX_SPREAD_ALLOWED)               return false;

        if (t.state == STATE_ORDER) {
            if (paused || cfg.frozen) return false;
            bool ok;
            uint256 tol = (t.targetPrice * cfg.executionTolerance) / PRECISION;
            if (t.orderType == ORDER_LIMIT) {
                ok = t.direction == DIR_LONG
                    ? oraclePrice <= t.targetPrice + tol
                    : oraclePrice + tol >= t.targetPrice;
            } else if (t.orderType == ORDER_STOP) {
                ok = t.direction == DIR_LONG
                    ? oraclePrice + tol >= t.targetPrice
                    : oraclePrice <= t.targetPrice + tol;
            }
            if (!ok) return false;
            return _executeOrder(tradeId, oraclePrice, rp);
        }

        if (t.state == STATE_OPEN) {
            bool ok;
            if (reason == REASON_LIQ) {
                uint256 liqPrice = _liqPrice(t.openPrice, t.leverage, t.direction, cfg.liqThresholdBps);
                uint256 tol = (liqPrice * cfg.executionTolerance) / PRECISION;
                ok = t.direction == DIR_LONG
                    ? oraclePrice <= liqPrice + tol
                    : oraclePrice + tol >= liqPrice;
            } else if (reason == REASON_SL) {
                uint256 tol = (t.stopLoss * cfg.executionTolerance) / PRECISION;
                ok = t.stopLoss != 0 && (
                    t.direction == DIR_LONG
                        ? oraclePrice <= t.stopLoss + tol
                        : oraclePrice + tol >= t.stopLoss
                );
            } else if (reason == REASON_TP) {
                uint256 tol = (t.takeProfit * cfg.executionTolerance) / PRECISION;
                ok = t.takeProfit != 0 && (
                    t.direction == DIR_LONG
                        ? oraclePrice + tol >= t.takeProfit
                        : oraclePrice <= t.takeProfit + tol
                );
            } else if (reason == REASON_PROFIT_CAP) {
                uint256 exitPrice = t.direction == DIR_LONG
                    ? (oraclePrice * (PRECISION - rp.spreadShort)) / PRECISION
                    : (oraclePrice * (PRECISION + rp.spreadLong)) / PRECISION;
                uint256 oi = t.margin * t.leverage;
                uint256 grossPnl = 0;
                if (t.direction == DIR_LONG && exitPrice > t.openPrice) {
                    grossPnl = (oi * (exitPrice - t.openPrice)) / t.openPrice;
                } else if (t.direction == DIR_SHORT && t.openPrice > exitPrice) {
                    grossPnl = (oi * (t.openPrice - exitPrice)) / t.openPrice;
                }
                uint256 maxProfit = (oi * cfg.profitCap) / PRECISION;
                uint256 tol = (maxProfit * cfg.executionTolerance) / PRECISION;
                ok = grossPnl + tol >= maxProfit;
            }
            if (!ok) return false;
            _closeTrade(tradeId, oraclePrice, reason, rp);
            return true;
        }

        return false;
    }

    // =========================================================
    // INTERNAL — Execute a pending limit/stop order
    // =========================================================

    function _executeOrder(uint256 tradeId, uint256 oraclePrice, RiskProof calldata rp)
        internal returns (bool)
    {
        Trade storage t    = trades[tradeId];
        AssetConfig storage cfg = assets[t.assetHash];

        uint256 grossOI = t.margin * t.leverage;
        uint256 commission = (grossOI * cfg.commissionBps) / PRECISION;
        uint256 margin     = t.margin - commission;
        uint256 oi         = margin * t.leverage;

        uint256 entryPrice = _applyEntrySpread(oraclePrice, t.direction, rp);

        uint256 newLong  = openInterestLong[t.assetHash]  + (t.direction == DIR_LONG  ? oi : 0);
        uint256 newShort = openInterestShort[t.assetHash] + (t.direction == DIR_SHORT ? oi : 0);

        if (newLong  > rp.maxOILong)  return false;
        if (newShort > rp.maxOIShort) return false;
        if (newLong  > cfg.maxGlobalOI) return false;
        if (newShort > cfg.maxGlobalOI) return false;
        if (traderOpenInterest[t.assetHash][t.trader] + oi > cfg.maxTraderOI) return false;

        int256 longDelta = t.direction == DIR_LONG ? int256(oi) : int256(0);
        int256 shortDelta = t.direction == DIR_SHORT ? int256(oi) : int256(0);
        uint256 newTotalLockedCapital = _getNewTotalLocked(t.assetHash, longDelta, shortDelta);

        uint256 deltaLocked = newTotalLockedCapital > totalLockedCapital 
            ? newTotalLockedCapital - totalLockedCapital 
            : 0;

        if (deltaLocked > getFreeCapital()) return false;

        if (commission > 0) _sendToVault(commission);

        _recordEntryPrice(t.assetHash, t.direction, oi, entryPrice);
        _updateExposure(t.assetHash, longDelta, shortDelta, newTotalLockedCapital);
        traderOpenInterest[t.assetHash][t.trader] += oi;

        t.margin        = margin;
        t.state         = STATE_OPEN;
        t.openPrice     = entryPrice;
        t.openTimestamp = block.timestamp;

        uint256 liqP = _liqPrice(entryPrice, t.leverage, t.direction, cfg.liqThresholdBps);
        (bool slValid, bool tpValid) = _checkSLTP(t.direction, entryPrice, liqP, t.stopLoss, t.takeProfit);
        if (!slValid) {
            t.stopLoss = 0;
        }
        if (!tpValid) {
            t.takeProfit = 0;
        }

        emit TradeEvent(tradeId);
        return true;
    }

    // =========================================================
    // INTERNAL — Close trade (all reasons share this path)
    // =========================================================

    function _closeTrade(
        uint256 tradeId,
        uint256 oraclePrice,
        uint8   reason,
        RiskProof calldata rp
    ) internal {
        Trade storage t = trades[tradeId];
        if (t.state != STATE_OPEN) revert InvalidState();

        AssetConfig storage cfg = assets[t.assetHash];

        uint256 duration = block.timestamp > t.openTimestamp ? block.timestamp - t.openTimestamp : 0;

        uint256 oi = t.margin * t.leverage;
        uint256 spread = _getExitSpread(t.direction, rp);
        uint256 amount = (oraclePrice * spread) / PRECISION;
        uint256 closePrice;
        if (t.direction == DIR_LONG) {
            closePrice = oraclePrice > amount ? oraclePrice - amount : 0;
        } else {
            closePrice = oraclePrice + amount;
        }

        int256 rawPnl = _pnl(oi, t.openPrice, closePrice, t.direction);
        uint256 borrowFee = (oi * cfg.borrowRateHourly * duration) / (HOUR * PRECISION);
        int256 netPnl = rawPnl - int256(borrowFee);

        uint256 maxProfit = (oi * cfg.profitCap) / PRECISION;
        if (netPnl > int256(maxProfit)) netPnl = int256(maxProfit);

        uint256 lossAmt = netPnl < 0 ? uint256(-netPnl) : 0;
        if (lossAmt >= (t.margin * cfg.liqThresholdBps) / PRECISION) {
            reason = REASON_LIQ;
        }

        t.state          = reason == REASON_LIQ ? STATE_LIQUIDATED : (reason == REASON_PROFIT_CAP ? STATE_LIQ_POS : STATE_CLOSED);
        t.closePrice     = closePrice;
        t.closeTimestamp = block.timestamp;
        t.borrowFee      = borrowFee;

        _releaseExposure(tradeId);
        _settle(t, netPnl, reason);

        emit TradeEvent(tradeId);
    }

    // =========================================================
    // INTERNAL — Pull collateral + take commission
    // =========================================================

    function _pullFundsAndCommission(bytes32 assetHash, uint256 collateral, uint256 leverage)
        internal returns (uint256 margin, uint256 oi)
    {
        AssetConfig storage cfg = assets[assetHash];
        if (collateral < cfg.minTradeSize) revert BadMargin();
        if (leverage < cfg.minLeverage || leverage > cfg.maxLeverage || leverage > MAX_LEVERAGE_HARD_CAP) revert BadLeverage();

        uint256 grossOI = collateral * leverage;
        uint256 commission = (grossOI * cfg.commissionBps) / PRECISION;
        margin = collateral - commission;
        oi = margin * leverage;

        _pull(msg.sender, collateral);
        if (commission > 0) _sendToVault(commission);
    }

    // =========================================================
    // INTERNAL — Verify TEE proof, update OI, lock delta (revert path)
    // =========================================================

    function _applyRisk(
        bytes32    assetHash,
        uint8      direction,
        uint256    oi,
        uint256    entryPrice,
        RiskProof calldata rp
    ) internal {
        AssetConfig storage cfg = assets[assetHash];

        uint256 newLong  = openInterestLong[assetHash]  + (direction == DIR_LONG  ? oi : 0);
        uint256 newShort = openInterestShort[assetHash] + (direction == DIR_SHORT ? oi : 0);

        if (newLong  > rp.maxOILong)  revert OIExceeded();
        if (newShort > rp.maxOIShort) revert OIExceeded();
        if (newLong  > cfg.maxGlobalOI) revert GlobalOIExceeded();
        if (newShort > cfg.maxGlobalOI) revert GlobalOIExceeded();

        uint256 totalTraderOI = traderOpenInterest[assetHash][msg.sender] + oi;
        if (totalTraderOI > cfg.maxTraderOI) revert TraderOIExceeded();

        int256 longDelta = direction == DIR_LONG ? int256(oi) : int256(0);
        int256 shortDelta = direction == DIR_SHORT ? int256(oi) : int256(0);
        uint256 newTotalLockedCapital = _getNewTotalLocked(assetHash, longDelta, shortDelta);

        uint256 deltaLocked = newTotalLockedCapital > totalLockedCapital 
            ? newTotalLockedCapital - totalLockedCapital 
            : 0;

        if (deltaLocked > getFreeCapital()) revert InsufficientVaultCapital();

        _recordEntryPrice(assetHash, direction, oi, entryPrice);
        _updateExposure(assetHash, longDelta, shortDelta, newTotalLockedCapital);

        traderOpenInterest[assetHash][msg.sender] = totalTraderOI;
    }

    // =========================================================
    // INTERNAL — Release OI + unlock capital delta on close
    // =========================================================

    function _getNewTotalLocked(
        bytes32 assetHash,
        int256 longDelta,
        int256 shortDelta
    ) internal view returns (uint256) {
        AssetConfig storage cfg = assets[assetHash];
        uint256 oldLong = openInterestLong[assetHash];
        uint256 oldShort = openInterestShort[assetHash];
        uint256 oldDominant = oldLong > oldShort ? oldLong : oldShort;
        uint256 oldLocked = (oldDominant * cfg.lockedCapitalBps) / PRECISION;

        uint256 newLong = longDelta >= 0
            ? oldLong + uint256(longDelta)
            : (oldLong > uint256(-longDelta) ? oldLong - uint256(-longDelta) : 0);

        uint256 newShort = shortDelta >= 0
            ? oldShort + uint256(shortDelta)
            : (oldShort > uint256(-shortDelta) ? oldShort - uint256(-shortDelta) : 0);

        uint256 newDominant = newLong > newShort ? newLong : newShort;
        uint256 newLocked = (newDominant * cfg.lockedCapitalBps) / PRECISION;

        uint256 baseLocked = totalLockedCapital > oldLocked ? totalLockedCapital - oldLocked : 0;
        return baseLocked + newLocked;
    }

    function _updateExposure(
        bytes32 assetHash,
        int256 longDelta,
        int256 shortDelta,
        uint256 newTotalLocked
    ) internal {
        AssetConfig memory cfg = assets[assetHash];
        if (!cfg.listed) revert BadParameter();

        if (longDelta > 0) {
            openInterestLong[assetHash] += uint256(longDelta);
        } else if (longDelta < 0) {
            uint256 sub = uint256(-longDelta);
            openInterestLong[assetHash] = openInterestLong[assetHash] > sub ? openInterestLong[assetHash] - sub : 0;
            if (openInterestLong[assetHash] == 0) avgEntryPriceLong[assetHash] = 0;
        }

        if (shortDelta > 0) {
            openInterestShort[assetHash] += uint256(shortDelta);
        } else if (shortDelta < 0) {
            uint256 sub = uint256(-shortDelta);
            openInterestShort[assetHash] = openInterestShort[assetHash] > sub ? openInterestShort[assetHash] - sub : 0;
            if (openInterestShort[assetHash] == 0) avgEntryPriceShort[assetHash] = 0;
        }

        totalLockedCapital = newTotalLocked;
    }

    function _releaseExposure(uint256 tradeId) internal {
        Trade storage t = trades[tradeId];
        uint256 oi = t.margin * t.leverage;

        _removeEntryPriceContribution(t.assetHash, t.direction, oi, t.openPrice);

        int256 longDelta = t.direction == DIR_LONG ? -int256(oi) : int256(0);
        int256 shortDelta = t.direction == DIR_SHORT ? -int256(oi) : int256(0);
        uint256 newTotalLockedCapital = _getNewTotalLocked(t.assetHash, longDelta, shortDelta);

        _updateExposure(t.assetHash, longDelta, shortDelta, newTotalLockedCapital);

        traderOpenInterest[t.assetHash][t.trader] = traderOpenInterest[t.assetHash][t.trader] > oi
            ? traderOpenInterest[t.assetHash][t.trader] - oi : 0;
    }

    // =========================================================
    // HELPERS — Average entry price tracking
    // =========================================================

    function _recordEntryPrice(bytes32 assetHash, uint8 direction, uint256 oi, uint256 price) internal {
        if (direction == DIR_LONG) {
            uint256 oldOI = openInterestLong[assetHash];
            avgEntryPriceLong[assetHash] = oldOI == 0
                ? price
                : (avgEntryPriceLong[assetHash] * oldOI + price * oi) / (oldOI + oi);
        } else {
            uint256 oldOI = openInterestShort[assetHash];
            avgEntryPriceShort[assetHash] = oldOI == 0
                ? price
                : (avgEntryPriceShort[assetHash] * oldOI + price * oi) / (oldOI + oi);
        }
    }

    function _removeEntryPriceContribution(bytes32 assetHash, uint8 direction, uint256 oi, uint256 price) internal {
        if (direction == DIR_LONG) {
            uint256 oldOI = openInterestLong[assetHash];
            if (oldOI <= oi) {
                avgEntryPriceLong[assetHash] = 0;
            } else {
                uint256 newOI = oldOI - oi;
                uint256 oldTotalVal = avgEntryPriceLong[assetHash] * oldOI;
                uint256 tradeVal = price * oi;
                avgEntryPriceLong[assetHash] = oldTotalVal > tradeVal ? (oldTotalVal - tradeVal) / newOI : 0;
            }
        } else {
            uint256 oldOI = openInterestShort[assetHash];
            if (oldOI <= oi) {
                avgEntryPriceShort[assetHash] = 0;
            } else {
                uint256 newOI = oldOI - oi;
                uint256 oldTotalVal = avgEntryPriceShort[assetHash] * oldOI;
                uint256 tradeVal = price * oi;
                avgEntryPriceShort[assetHash] = oldTotalVal > tradeVal ? (oldTotalVal - tradeVal) / newOI : 0;
            }
        }
    }

    // =========================================================
    // Vault-wide unrealized PnL
    // =========================================================

    function verifyAndComputeUnrealizedPnL()
        external view returns (int256 totalUnrealizedPnL)
    {
        uint256 len = listedAssetHashes.length;

        for (uint256 i = 0; i < len; i++) {
            bytes32 assetHash = listedAssetHashes[i];
            AssetConfig storage cfg = assets[assetHash];

            if (!cfg.listed) continue;

            uint256 price = _getPrice(assetHash);
            uint256 oiLong = openInterestLong[assetHash];
            uint256 oiShort = openInterestShort[assetHash];

            if (oiLong > 0 && avgEntryPriceLong[assetHash] > 0) {
                uint256 avg = avgEntryPriceLong[assetHash];
                if (price >= avg) {
                    totalUnrealizedPnL += int256((oiLong * (price - avg)) / avg);
                } else {
                    totalUnrealizedPnL -= int256((oiLong * (avg - price)) / avg);
                }
            }

            if (oiShort > 0 && avgEntryPriceShort[assetHash] > 0) {
                uint256 avg = avgEntryPriceShort[assetHash];
                if (avg >= price) {
                    totalUnrealizedPnL += int256((oiShort * (avg - price)) / avg);
                } else {
                    totalUnrealizedPnL -= int256((oiShort * (price - avg)) / avg);
                }
            }
        }
    }

    // =========================================================
    // INTERNAL — Settle funds after close
    // =========================================================

    function _settle(
        Trade storage t,
        int256  pnl,
        uint8   reason
    ) internal {
        if (reason == REASON_LIQ) {
            if (t.margin > 0) _sendToVault(t.margin);
            return;
        }

        if (t.margin == 0) return;

        if (pnl >= 0) {
            _send(t.trader, t.margin);
            uint256 profit = uint256(pnl);
            if (profit > 0) {
                uint256 available = USDC.balanceOf(address(vault));
                uint256 toPay     = available >= profit ? profit : available;
                if (toPay > 0) vault.payTrader(t.trader, toPay);
                if (toPay < profit) emit InsolvencyWarning(t.id, profit, toPay);
            }
        } else {
            uint256 loss = uint256(-pnl);
            if (loss >= t.margin) {
                _sendToVault(t.margin);
            } else {
                _sendToVault(loss);
                _send(t.trader, t.margin - loss);
            }
        }
    }

    // =========================================================
    // INTERNAL — Store trade
    // =========================================================

    function _storeTrade(TradeInit memory init) internal returns (uint256 tradeId) {
        tradeId = nextTradeId++;
        Trade storage t = trades[tradeId];

        t.id            = tradeId;
        t.trader        = msg.sender;
        t.assetHash     = init.assetHash;
        t.direction     = init.direction;
        t.orderType     = init.orderType;
        t.margin        = init.margin;
        t.leverage      = init.leverage;
        t.targetPrice   = init.targetPrice;
        t.openPrice     = init.openPrice;
        t.stopLoss      = init.slPrice;
        t.takeProfit    = init.tpPrice;
        t.openTimestamp = block.timestamp;
        t.state         = init.orderType == ORDER_MARKET ? STATE_OPEN : STATE_ORDER;
    }

    // =========================================================
    // HELPERS — Spread (TEE-controlled, constant hard cap)
    // =========================================================

    function _getEntrySpread(uint8 direction, RiskProof calldata rp)
        internal pure returns (uint256)
    {
        return direction == DIR_LONG ? rp.spreadLong : rp.spreadShort;
    }

    function _getExitSpread(uint8 direction, RiskProof calldata rp)
        internal pure returns (uint256)
    {
        return direction == DIR_LONG ? rp.spreadShort : rp.spreadLong;
    }

    function _applyEntrySpread(uint256 oraclePrice, uint8 direction, RiskProof calldata rp)
        internal pure returns (uint256)
    {
        uint256 spread = _getEntrySpread(direction, rp);
        uint256 amount = (oraclePrice * spread) / PRECISION;
        if (direction == DIR_LONG) return oraclePrice + amount;
        return oraclePrice > amount ? oraclePrice - amount : 0;
    }

    function _validateSpreadCap(uint256 spreadLong, uint256 spreadShort) internal pure {
        if (spreadLong  > MAX_SPREAD_ALLOWED) revert SpreadExceedsMaxAllowed();
        if (spreadShort > MAX_SPREAD_ALLOWED) revert SpreadExceedsMaxAllowed();
    }

    // =========================================================
    // HELPERS — FTSO Oracle price (normalized to 1e6)
    // =========================================================

    function _getPrice(bytes32 assetHash) internal view returns (uint256) {
        AssetConfig storage cfg = assets[assetHash];
        if (!cfg.listed) revert BadParameter();

        (uint256 value, int8 decimals, ) = FTSO.getFeedById(cfg.ftsoFeedId);
        if (value == 0) revert PriceZero();
        return _normalizeFtsoPrice(value, decimals >= 0 ? uint256(int256(decimals)) : 0);
    }

    function _normalizeFtsoPrice(uint256 price, uint256 decimals) internal pure returns (uint256) {
        if (decimals == 6) return price;
        if (decimals > 6) return price / (10 ** (decimals - 6));
        return price * (10 ** (6 - decimals));
    }

    // =========================================================
    // HELPERS — Liquidation price
    // =========================================================

    function _liqPrice(uint256 openPrice, uint256 leverage, uint8 direction, uint256 liqThresholdBps)
        internal pure returns (uint256)
    {
        uint256 move = (openPrice * liqThresholdBps) / (leverage * PRECISION);
        if (direction == DIR_LONG) return openPrice > move ? openPrice - move : 0;
        return openPrice + move;
    }

    // =========================================================
    // HELPERS — PnL
    // =========================================================

    function _pnl(uint256 oi, uint256 openPrice, uint256 closePrice, uint8 direction)
        internal pure returns (int256)
    {
        if (openPrice == 0) return 0;
        if (direction == DIR_LONG) {
            if (closePrice >= openPrice) return  int256((oi * (closePrice - openPrice)) / openPrice);
            return -int256((oi * (openPrice - closePrice)) / openPrice);
        } else {
            if (closePrice <= openPrice) return  int256((oi * (openPrice - closePrice)) / openPrice);
            return -int256((oi * (closePrice - openPrice)) / openPrice);
        }
    }

    // =========================================================
    // HELPERS — TEE proof verification (ECDSA)
    // =========================================================

    function _verifyTeeProof(RiskProof calldata rp) internal view {
        AssetConfig storage cfg = assets[rp.assetHash];
        if (!cfg.listed) revert BadParameter();

        if (rp.timestamp > block.timestamp) {
            if (rp.timestamp - block.timestamp > 15)           revert InvalidTeeProof();
        } else {
            if (block.timestamp - rp.timestamp > cfg.maxProofAge) revert TeeProofExpired();
        }

        bytes32 hash    = keccak256(abi.encode(
            rp.assetHash, rp.maxOILong, rp.maxOIShort, rp.spreadLong, rp.spreadShort, rp.timestamp
        ));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));

        (bytes32 r, bytes32 s, uint8 v) = _splitSig(rp.sig);
        address recovered = ecrecover(ethHash, v, r, s);

        if (recovered == address(0) || recovered != teeSigner) revert InvalidTeeProof();
    }

    function _checkTeeProof(RiskProof calldata rp) internal view returns (bool) {
        AssetConfig storage cfg = assets[rp.assetHash];
        if (!cfg.listed) return false;

        if (rp.timestamp > block.timestamp) {
            if (rp.timestamp - block.timestamp > 15)           return false;
        } else {
            if (block.timestamp - rp.timestamp > cfg.maxProofAge) return false;
        }

        bytes32 hash    = keccak256(abi.encode(
            rp.assetHash, rp.maxOILong, rp.maxOIShort, rp.spreadLong, rp.spreadShort, rp.timestamp
        ));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));

        if (rp.sig.length != 65) return false;
        (bytes32 r, bytes32 s, uint8 v) = _splitSigNoRevert(rp.sig);
        address recovered = ecrecover(ethHash, v, r, s);

        return recovered != address(0) && recovered == teeSigner;
    }

    function _splitSig(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        if (sig.length != 65) revert InvalidTeeProof();
        return _splitSigNoRevert(sig);
    }

    function _splitSigNoRevert(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }

    // =========================================================
    // HELPERS — SL/TP validation
    // =========================================================

    function _checkSLTP(
        uint8   direction,
        uint256 entryPrice,
        uint256 liqP,
        uint256 slPrice,
        uint256 tpPrice
    ) internal pure returns (bool slValid, bool tpValid) {
        slValid = true;
        tpValid = true;
        if (direction == DIR_LONG) {
            if (slPrice != 0) {
                if (slPrice >= entryPrice || slPrice < liqP) slValid = false;
            }
            if (tpPrice != 0 && tpPrice <= entryPrice) tpValid = false;
        } else {
            if (slPrice != 0) {
                if (slPrice <= entryPrice || slPrice > liqP) slValid = false;
            }
            if (tpPrice != 0 && tpPrice >= entryPrice) tpValid = false;
        }
    }

    function _validateSLTP(
        uint8   direction,
        uint256 entryPrice,
        uint256 liqP,
        uint256 slPrice,
        uint256 tpPrice
    ) internal pure {
        (bool slValid, bool tpValid) = _checkSLTP(direction, entryPrice, liqP, slPrice, tpPrice);
        if (!slValid || !tpValid) revert BadSLTP();
    }

    // =========================================================
    // HELPERS — Config validation
    // =========================================================

    function _validateConfig(AssetConfig memory cfg) internal pure {
        if (cfg.minLeverage == 0 || cfg.maxLeverage < cfg.minLeverage) revert BadParameter();
        if (cfg.maxLeverage > MAX_LEVERAGE_HARD_CAP) revert BadParameter();
        if (cfg.minTradeSize      == 0)          revert BadParameter();
        if (cfg.commissionBps      > MAX_COMMISSION_ALLOWED) revert BadParameter();
        if (cfg.profitCap == 0 || cfg.profitCap > PRECISION) revert BadParameter();
        if (cfg.executionTolerance == 0 || cfg.executionTolerance > 10_000) revert BadParameter();
        if (cfg.maxProofAge == 0 || cfg.maxProofAge > 60) revert BadParameter();
        if (cfg.borrowRateHourly  > MAX_BORROW_RATE_ALLOWED) revert BadParameter();
        if (cfg.maxTraderOI == 0)                revert BadParameter();
        if (cfg.maxGlobalOI == 0)                revert BadParameter();
        if (cfg.lockedCapitalBps  > 100_000)    revert BadParameter();
        if (cfg.liqThresholdBps < 900_000 || cfg.liqThresholdBps > 980_000) revert BadParameter();
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

    function _sendToVault(uint256 amount) internal {
        if (amount == 0) return;
        if (!USDC.transfer(address(vault), amount)) revert TransferFailed();
    }

    // =========================================================
    // HELPERS — Array trim
    // =========================================================

    function _trim(uint256[] memory arr, uint256 len) internal pure returns (uint256[] memory out) {
        out = new uint256[](len);
        for (uint256 i = 0; i < len; i++) out[i] = arr[i];
    }

    // =========================================================
    // Views
    // =========================================================

    function getFreeCapital() public view returns (uint256) {
        uint256 vaultBal = USDC.balanceOf(address(vault));
        uint256 reservedWithdrawals = vault.getRequiredFreeUSDC();
        uint256 totalDeductions = totalLockedCapital + reservedWithdrawals;
        if (vaultBal <= totalDeductions) return 0;
        return vaultBal - totalDeductions;
    }

    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }

    function getListedAssetHashes() external view returns (bytes32[] memory) {
        return listedAssetHashes;
    }
}
