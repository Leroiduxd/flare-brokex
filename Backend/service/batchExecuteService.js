require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexCoreAbi = require('../abi/BrokexCore.json');

// Configuration from .env
const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const coreAddress = process.env.BROKEX_CORE_ADDRESS;

const provider = new ethers.JsonRpcProvider(rpcUrl);

function getWalletAndContract() {
    const pk = process.env.PRIVATE_KEY;
    if (!pk || pk === 'your_private_key_here') {
        throw new Error("PRIVATE_KEY is not properly configured in .env file");
    }

    const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
    const wallet = new ethers.Wallet(formattedPk, provider);
    const coreContract = new ethers.Contract(
        coreAddress,
        brokexCoreAbi.abi || brokexCoreAbi,
        wallet
    );

    return { wallet, coreContract };
}

/**
 * Calls batchExecute on BrokexCore contract to execute or cancel multiple trades.
 * 
 * @param {Array<number|string|bigint>} tradeIds - List of trade IDs to process
 * @param {Array<number>} reasons - Execution reason codes
 * @param {Array<Object>} riskProofs - Array of RiskProof structs signed by KMS/Signer
 * @param {Object} [overrides={}] - Optional transaction overrides
 * @returns {Promise<Object>} Transaction receipt
 */
async function batchExecute(tradeIds, reasons, riskProofs, overrides = {}) {
    if (!tradeIds || tradeIds.length === 0) {
        throw new Error("tradeIds array cannot be empty");
    }
    if (!reasons || reasons.length !== tradeIds.length) {
        throw new Error("reasons array length must match tradeIds length");
    }
    if (!riskProofs || riskProofs.length === 0) {
        throw new Error("riskProofs array cannot be empty");
    }

    const { coreContract } = getWalletAndContract();

    console.log(`[BatchExecuteService] Executing batch for ${tradeIds.length} trade(s)...`);

    try {
        await coreContract.batchExecute.staticCall(tradeIds, reasons, riskProofs, overrides);
    } catch (callErr) {
        console.error(`[BatchExecuteService] staticCall Simulation Failed! Revert reason:`, callErr.reason || callErr.message);
        if (callErr.data) {
            console.error(`[BatchExecuteService] Revert data:`, callErr.data);
        }
    }

    const tx = await coreContract.batchExecute(tradeIds, reasons, riskProofs, overrides);
    console.log(`[BatchExecuteService] Transaction submitted. Hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[BatchExecuteService] Transaction confirmed in block: ${receipt.blockNumber}`);

    return receipt;
}

// CLI execution example: `node service/batchExecuteService.js`
if (require.main === module) {
    (async () => {
        try {
            const { wallet } = getWalletAndContract();
            console.log('[BatchExecuteService] Service initialized. Wallet address:', wallet.address);
        } catch (error) {
            console.error('[BatchExecuteService] Error:', error.message);
        }
    })();
}

module.exports = {
    batchExecute,
    getWalletAndContract
};
