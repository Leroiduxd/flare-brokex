require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexVaultAbi = require('../abi/BrokexVault.json');
const brokexCoreAbi = require('../abi/BrokexCore.json');

const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const provider = new ethers.JsonRpcProvider(rpcUrl);

const vaultAddress = process.env.BROKEX_VAULT_ADDRESS;
const coreAddress = process.env.BROKEX_CORE_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

let wallet = null;
let vaultContract = null;
let coreContract = null;

if (privateKey && privateKey !== 'your_private_key_here' && vaultAddress && coreAddress) {
    const formattedPk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    wallet = new ethers.Wallet(formattedPk, provider);
    vaultContract = new ethers.Contract(vaultAddress, brokexVaultAbi.abi || brokexVaultAbi, wallet);
    coreContract = new ethers.Contract(coreAddress, brokexCoreAbi.abi || brokexCoreAbi, provider);
}

let isProcessing = false;

/**
 * Checks pending LP withdrawal queue and processes them on-chain if free capital is available.
 */
async function checkAndProcessWithdrawals() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        if (!vaultContract || !coreContract) {
            console.warn('[WithdrawalService] Contracts or Wallet not properly configured in .env');
            return;
        }

        // 1. Check if there are pending LP tokens waiting in the withdrawal queue
        const totalPendingLP = await vaultContract.totalPendingLP();
        if (totalPendingLP === 0n) {
            return;
        }

        console.log(`[WithdrawalService] Pending LP withdrawal detected (${ethers.formatUnits(totalPendingLP, 6)} bUSDC). Checking free capital...`);

        // 2. Check available free capital on BrokexCore and required USDC for pending withdrawals
        const freeCapital = await coreContract.getFreeCapital();
        const requiredFreeUSDC = await vaultContract.getRequiredFreeUSDC();

        console.log(`[WithdrawalService] Free Capital: ${ethers.formatUnits(freeCapital, 6)} USDC | Required: ${ethers.formatUnits(requiredFreeUSDC, 6)} USDC`);

        // 3. If there is free capital available, execute processWithdrawalQueue()
        if (freeCapital > 0n) {
            console.log('[WithdrawalService] Free capital available! Calling processWithdrawalQueue()...');
            
            // Execute batch process (process up to 10 requests at a time)
            const tx = await vaultContract['processWithdrawalQueue(uint256)'](10);
            console.log(`[WithdrawalService] Transaction sent: ${tx.hash}. Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            console.log(`[WithdrawalService] Withdrawal queue processed successfully in block ${receipt.blockNumber}`);
        } else {
            console.log('[WithdrawalService] Insufficient free capital to process withdrawals at this moment.');
        }
    } catch (err) {
        console.error('[WithdrawalService] Error processing withdrawal queue:', err.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Starts 10-minute cron interval for withdrawal checking
 */
function startWithdrawalCron(intervalMs = 10 * 60 * 1000) {
    // Initial check
    checkAndProcessWithdrawals();

    // 10-minute interval
    setInterval(() => {
        checkAndProcessWithdrawals();
    }, intervalMs);
}

module.exports = {
    checkAndProcessWithdrawals,
    startWithdrawalCron
};
