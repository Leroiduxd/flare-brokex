require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexLensAbi = require('../abi/BrokexLens.json');

// Configuration from .env
const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const lensAddress = process.env.BROKEX_LENS_ADDRESS;

if (!lensAddress || lensAddress === '0x0000000000000000000000000000000000000000') {
    console.warn("Warning: BROKEX_LENS_ADDRESS is not properly configured in .env file");
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const lensContract = new ethers.Contract(
    lensAddress,
    brokexLensAbi.abi || brokexLensAbi,
    provider
);

/**
 * Fetches asset snapshot from BrokexLens contract for a given assetHash (bytes32).
 * @param {string} assetHash - The bytes32 asset hash (e.g., process.env.GOLD_FEED_ID)
 * @returns {Promise<Object>} Formatted asset snapshot data
 */
async function getAssetSnapshot(assetHash) {
    if (!assetHash) {
        throw new Error("Asset hash (bytes32) parameter is required");
    }

    // Ensure assetHash is formatted as a 32-byte hex string
    let formattedHash = assetHash;
    if (!assetHash.startsWith('0x')) {
        formattedHash = ethers.id(assetHash);
    } else if (assetHash.length < 66) {
        formattedHash = ethers.zeroPadValue(assetHash, 32);
    }

    console.log(`[AssetService] Fetching asset snapshot for hash: ${formattedHash}...`);

    const snapshot = await lensContract.getAssetSnapshot(formattedHash);

    // Format BigInt values for easier serialization/readability
    const formattedSnapshot = {
        assetHash: snapshot.assetHash,
        openInterestLong: snapshot.openInterestLong.toString(),
        openInterestShort: snapshot.openInterestShort.toString(),
        totalOpenInterest: snapshot.totalOpenInterest.toString(),
        avgEntryPriceLong: snapshot.avgEntryPriceLong.toString(),
        avgEntryPriceShort: snapshot.avgEntryPriceShort.toString(),
        config: {
            ftsoFeedId: snapshot.config.ftsoFeedId,
            minLeverage: snapshot.config.minLeverage.toString(),
            maxLeverage: snapshot.config.maxLeverage.toString(),
            minTradeSize: snapshot.config.minTradeSize.toString(),
            commissionBps: snapshot.config.commissionBps.toString(),
            borrowRateHourly: snapshot.config.borrowRateHourly.toString(),
            profitCap: snapshot.config.profitCap.toString(),
            executionTolerance: snapshot.config.executionTolerance.toString(),
            maxProofAge: snapshot.config.maxProofAge.toString(),
            maxTraderOI: snapshot.config.maxTraderOI.toString(),
            maxGlobalOI: snapshot.config.maxGlobalOI.toString(),
            lockedCapitalBps: snapshot.config.lockedCapitalBps.toString(),
            liqThresholdBps: snapshot.config.liqThresholdBps.toString(),
            listed: snapshot.config.listed,
            frozen: snapshot.config.frozen
        }
    };

    return formattedSnapshot;
}

// CLI execution example: `node service/assetService.js`
if (require.main === module) {
    (async () => {
        try {
            const targetFeed = process.env.GOLD_FEED_ID || '0x0000000000000000000000000000000000000000000000000000000000000000';
            const snapshot = await getAssetSnapshot(targetFeed);
            console.log('Asset Snapshot:', JSON.stringify(snapshot, null, 2));
        } catch (error) {
            console.error('[AssetService] Error:', error.message);
        }
    })();
}

module.exports = {
    getAssetSnapshot
};
