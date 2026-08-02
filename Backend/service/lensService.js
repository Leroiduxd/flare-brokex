require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexCoreAbi = require('../abi/BrokexCore.json');

// Retrieve configuration from .env
const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const coreAddress = process.env.BROKEX_CORE_ADDRESS;

if (!coreAddress || coreAddress === '0x0000000000000000000000000000000000000000') {
    console.warn("Warning: BROKEX_CORE_ADDRESS is not properly configured in .env file");
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const coreContract = new ethers.Contract(
    coreAddress,
    brokexCoreAbi.abi || brokexCoreAbi,
    provider
);

/**
 * Fetches the highest Trade ID that exists on the BrokexCore contract.
 * @returns {Promise<bigint>} Highest existing trade ID (e.g. 10n, or 0n if no trades exist)
 */
async function getHighestTradeId() {
    // nextTradeId returns the next ID to be assigned (e.g., if 10 trades exist, nextTradeId = 11)
    const nextId = await coreContract.nextTradeId();
    const nextIdBig = BigInt(nextId.toString());
    
    // The highest existing trade ID is (nextTradeId - 1)
    return nextIdBig > 0n ? nextIdBig - 1n : 0n;
}

// Direct CLI execution: `node service/lensService.js`
if (require.main === module) {
    (async () => {
        try {
            const highestId = await getHighestTradeId();
            console.log(`Highest existing Trade ID: ${highestId.toString()}`);
        } catch (error) {
            console.error('Error:', error.message);
        }
    })();
}

module.exports = {
    getHighestTradeId,
    getLastTradeId: getHighestTradeId // Alias
};
