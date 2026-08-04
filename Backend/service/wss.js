require('dotenv').config();
const { ethers } = require('ethers');
const path = require('path');
const EventEmitter = require('events');

const priceEmitter = new EventEmitter();
const latestPricesMap = new Map();

// Import FTSO v2 ABI from abi/ folder
const ftsoAbi = require(path.join(__dirname, '../abi/FtsoV2.json'));

const provider = new ethers.JsonRpcProvider(process.env.COSTON2_RPC_URL);
const ftsoContract = new ethers.Contract(process.env.FTSO_V2_ADDRESS, ftsoAbi, provider);

// Map of configured assets
function getConfiguredFeeds() {
    const feeds = [];
    if (process.env.GOLD_FEED_ID) {
        feeds.push({
            symbol: process.env.PYTH_GOLD_SYMBOL || 'Metal.XAU/USD',
            feedId: process.env.GOLD_FEED_ID,
            assetHash: process.env.GOLD_ASSET_HASH
        });
    }
    if (process.env.XRP_FEED_ID) {
        feeds.push({
            symbol: process.env.PYTH_XRP_SYMBOL || 'Crypto.XRP/USD',
            feedId: process.env.XRP_FEED_ID,
            assetHash: process.env.XRP_ASSET_HASH
        });
    }
    return feeds;
}

/**
 * Fetches feed price via FTSO v2 for a given feedId
 */
async function getFeedPrice(feedId = process.env.GOLD_FEED_ID, symbolOverride = null) {
    try {
        const [value, decimals, timestamp] = await ftsoContract.getFeedById(feedId);
        const priceUSD = Number(value) / Math.pow(10, Number(decimals));

        let symbol = symbolOverride;
        if (!symbol) {
            const found = getConfiguredFeeds().find(f => f.feedId.toLowerCase() === feedId.toLowerCase());
            symbol = found ? found.symbol : 'Metal.XAU/USD';
        }

        const data = {
            feedId,
            symbol,
            value: value.toString(),
            decimals: Number(decimals),
            timestamp: Number(timestamp),
            priceUSD
        };

        latestPricesMap.set(feedId.toLowerCase(), data);
        latestPricesMap.set(symbol.toLowerCase(), data);
        priceEmitter.emit('priceUpdate', data);

        return data;
    } catch (error) {
        console.error(`[FTSO Service] Error reading feed (${feedId}):`, error.message);
        throw error;
    }
}

/**
 * Surveillance continue de tous les flux configurés (GOLD, XRP, etc.)
 */
function watchAllFeeds(intervalMs = 2000, callback) {
    const feeds = getConfiguredFeeds();
    console.log(`[WSS/FTSO Service] Starting monitoring for ${feeds.length} asset(s) (Interval: ${intervalMs}ms)...`);

    // Dynamic initial fetches
    for (const feed of feeds) {
        getFeedPrice(feed.feedId, feed.symbol).then(data => {
            if (callback && typeof callback === 'function') callback(data);
        }).catch(() => {});
    }

    const interval = setInterval(async () => {
        for (const feed of feeds) {
            try {
                const data = await getFeedPrice(feed.feedId, feed.symbol);
                if (callback && typeof callback === 'function') {
                    callback(data);
                }
            } catch (err) {
                // Handled inside getFeedPrice
            }
        }
    }, intervalMs);

    return () => clearInterval(interval);
}

function watchFeedPrice(feedId = process.env.GOLD_FEED_ID, intervalMs = 2000, callback) {
    return watchAllFeeds(intervalMs, callback);
}

function getLatestPriceData(feedIdOrSymbol = null) {
    if (!feedIdOrSymbol) {
        // Return latest GOLD or first entry by default
        return latestPricesMap.get(process.env.GOLD_FEED_ID?.toLowerCase()) || 
               latestPricesMap.get('metal.xau/usd') || 
               Array.from(latestPricesMap.values())[0] || null;
    }
    return latestPricesMap.get(feedIdOrSymbol.toLowerCase()) || null;
}

module.exports = {
    getFeedPrice,
    watchFeedPrice,
    watchAllFeeds,
    priceEmitter,
    getLatestPriceData,
    getConfiguredFeeds
};
