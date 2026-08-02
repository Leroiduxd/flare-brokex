require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexLensAbi = require('../abi/BrokexLens.json');

// Memory cache for asset snapshot
let snapshotCache = null;
let lastUpdated = 0;

// Dynamic detection of all asset hashes & feed IDs configured in .env
function getEnvFeedIds() {
    const assets = [];
    for (const [key, value] of Object.entries(process.env)) {
        if (key.endsWith('_FEED_ID') && !key.startsWith('PYTH_') && value && value.startsWith('0x')) {
            const symbol = key.replace('_FEED_ID', '');
            const explicitHash = process.env[`${symbol}_ASSET_HASH`];
            assets.push({ symbol, feedId: value, explicitHash });
        }
    }
    if (assets.length === 0 && process.env.GOLD_FEED_ID) {
        assets.push({ symbol: 'GOLD', feedId: process.env.GOLD_FEED_ID, explicitHash: process.env.GOLD_ASSET_HASH });
    }
    return assets;
}

const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const provider = new ethers.JsonRpcProvider(rpcUrl);

const lensAddress = process.env.BROKEX_LENS_ADDRESS;
const lensContract = (lensAddress && lensAddress !== '0x0000000000000000000000000000000000000000')
    ? new ethers.Contract(lensAddress, brokexLensAbi.abi || brokexLensAbi, provider)
    : null;

/**
 * Formats Ethers Result / Struct into a clean, key-value JSON object without description fields.
 */
function formatSnapshotData(s) {
    if (!s) return null;
    return {
        assetHash: s.assetHash ? s.assetHash.toString() : (s[0] ? s[0].toString() : ''),
        openInterestLong: s.openInterestLong ? s.openInterestLong.toString() : (s[1] ? s[1].toString() : '0'),
        openInterestShort: s.openInterestShort ? s.openInterestShort.toString() : (s[2] ? s[2].toString() : '0'),
        totalOpenInterest: s.totalOpenInterest ? s.totalOpenInterest.toString() : (s[3] ? s[3].toString() : '0'),
        avgEntryPriceLong: s.avgEntryPriceLong ? s.avgEntryPriceLong.toString() : (s[4] ? s[4].toString() : '0'),
        avgEntryPriceShort: s.avgEntryPriceShort ? s.avgEntryPriceShort.toString() : (s[5] ? s[5].toString() : '0'),
        config: s.config ? {
            ftsoFeedId: s.config.ftsoFeedId ? s.config.ftsoFeedId.toString() : (s[6] && s[6][0] ? s[6][0].toString() : ''),
            minLeverage: s.config.minLeverage ? s.config.minLeverage.toString() : (s[6] && s[6][1] ? s[6][1].toString() : '0'),
            maxLeverage: s.config.maxLeverage ? s.config.maxLeverage.toString() : (s[6] && s[6][2] ? s[6][2].toString() : '0'),
            minTradeSize: s.config.minTradeSize ? s.config.minTradeSize.toString() : (s[6] && s[6][3] ? s[6][3].toString() : '0'),
            commissionBps: s.config.commissionBps ? s.config.commissionBps.toString() : (s[6] && s[6][4] ? s[6][4].toString() : '0'),
            borrowRateHourly: s.config.borrowRateHourly ? s.config.borrowRateHourly.toString() : (s[6] && s[6][5] ? s[6][5].toString() : '0'),
            profitCap: s.config.profitCap ? s.config.profitCap.toString() : (s[6] && s[6][6] ? s[6][6].toString() : '0'),
            executionTolerance: s.config.executionTolerance ? s.config.executionTolerance.toString() : (s[6] && s[6][7] ? s[6][7].toString() : '0'),
            maxProofAge: s.config.maxProofAge ? s.config.maxProofAge.toString() : (s[6] && s[6][8] ? s[6][8].toString() : '0'),
            maxTraderOI: s.config.maxTraderOI ? s.config.maxTraderOI.toString() : (s[6] && s[6][9] ? s[6][9].toString() : '0'),
            maxGlobalOI: s.config.maxGlobalOI ? s.config.maxGlobalOI.toString() : (s[6] && s[6][10] ? s[6][10].toString() : '0'),
            lockedCapitalBps: s.config.lockedCapitalBps ? s.config.lockedCapitalBps.toString() : (s[6] && s[6][11] ? s[6][11].toString() : '0'),
            liqThresholdBps: s.config.liqThresholdBps ? s.config.liqThresholdBps.toString() : (s[6] && s[6][12] ? s[6][12].toString() : '0'),
            listed: s.config.listed !== undefined ? Boolean(s.config.listed) : (s[6] ? Boolean(s[6][13]) : false),
            frozen: s.config.frozen !== undefined ? Boolean(s.config.frozen) : (s[6] ? Boolean(s[6][14]) : false)
        } : null
    };
}

/**
 * Ensures assetHash is a valid 32-byte hex string (bytes32).
 * If feedId is bytes21 (44 chars), keccak256 or zeroPadValue is applied.
 */
function normalizeBytes32(hash) {
    if (!hash) return ethers.ZeroHash;
    let hex = hash.toString().trim();
    if (!hex.startsWith('0x')) hex = '0x' + hex;
    
    if (hex.length === 44) {
        return ethers.keccak256(hex);
    }

    if (hex.length < 66) {
        return ethers.zeroPadValue(hex, 32);
    }
    if (hex.length > 66) {
        return hex.substring(0, 66);
    }
    return hex;
}

/**
 * Calls `getAssetSnapshot` on-chain for all feeds configured in .env and caches them in memory
 */
async function fetchAndCacheAllSnapshots() {
    try {
        if (!lensContract) {
            console.warn('[SnapshotService] BrokexLens contract address not configured.');
            return null;
        }

        const envFeeds = getEnvFeedIds();
        const results = {};

        for (const item of envFeeds) {
            const assetHash = item.explicitHash ? normalizeBytes32(item.explicitHash) : normalizeBytes32(item.feedId);
            try {
                const rawSnapshot = await lensContract.getAssetSnapshot(assetHash);
                results[item.symbol] = {
                    feedId: item.feedId,
                    assetHash,
                    snapshot: formatSnapshotData(rawSnapshot)
                };
            } catch (err) {
                console.error(`[SnapshotService] Error fetching snapshot for ${item.symbol}:`, err.message);
            }
        }

        snapshotCache = {
            updatedAt: Math.floor(Date.now() / 1000),
            assets: results
        };
        lastUpdated = Date.now();

        return snapshotCache;
    } catch (err) {
        console.error('[SnapshotService] Error fetching asset snapshots:', err.message);
        return snapshotCache;
    }
}

/**
 * Starts periodic fetching of asset snapshots in RAM
 * @param {number} intervalMs - Default 10000ms (10 seconds)
 */
function startSnapshotCron(intervalMs = 10000) {
    fetchAndCacheAllSnapshots();
    setInterval(() => {
        fetchAndCacheAllSnapshots();
    }, intervalMs);
}

/**
 * Returns current snapshots stored in RAM
 */
function getCachedSnapshot() {
    return snapshotCache;
}

module.exports = {
    fetchAndCacheAllSnapshots,
    startSnapshotCron,
    getCachedSnapshot
};
