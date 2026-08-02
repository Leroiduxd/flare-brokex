require('dotenv').config();
const { ethers } = require('ethers');
const path = require('path');
const EventEmitter = require('events');

const priceEmitter = new EventEmitter();
let latestPriceData = null;

// Import FTSO v2 ABI from abi/ folder
const ftsoAbi = require(path.join(__dirname, '../abi/FtsoV2.json'));

// Strict usage of .env variables
const provider = new ethers.JsonRpcProvider(process.env.COSTON2_RPC_URL);
const ftsoContract = new ethers.Contract(process.env.FTSO_V2_ADDRESS, ftsoAbi, provider);

/**
 * Fetches feed price via FTSO v2 (100% based on process.env)
 * @param {string} feedId - Feed ID in bytes21 format (default process.env.GOLD_FEED_ID)
 */
async function getFeedPrice(feedId = process.env.GOLD_FEED_ID) {
    try {
        const [value, decimals, timestamp] = await ftsoContract.getFeedById(feedId);
        const priceUSD = Number(value) / Math.pow(10, Number(decimals));

        const data = {
            feedId,
            symbol: 'XAU/USD',
            value: value.toString(),
            decimals: Number(decimals),
            timestamp: Number(timestamp),
            priceUSD
        };

        latestPriceData = data;
        priceEmitter.emit('priceUpdate', data);

        return data;
    } catch (error) {
        console.error(`[FTSO Service] Error reading feed (${feedId}):`, error.message);
        throw error;
    }
}

/**
 * Continuous price monitoring / polling
 * @param {string} feedId - Feed ID
 * @param {number} intervalMs - Polling interval in ms
 * @param {function} callback - Callback function executed with updated price data
 */
function watchFeedPrice(feedId = process.env.GOLD_FEED_ID, intervalMs = 2000, callback) {
    console.log(`[WSS/FTSO Service] Starting monitoring (Interval: ${intervalMs}ms)...`);

    // Initial fetch
    getFeedPrice(feedId).then(data => {
        if (callback && typeof callback === 'function') callback(data);
    }).catch(() => {});

    const interval = setInterval(async () => {
        try {
            const data = await getFeedPrice(feedId);
            if (callback && typeof callback === 'function') {
                callback(data);
            }
        } catch (err) {
            // Errors are handled inside getFeedPrice
        }
    }, intervalMs);

    return () => clearInterval(interval);
}

function getLatestPriceData() {
    return latestPriceData;
}

module.exports = {
    getFeedPrice,
    watchFeedPrice,
    priceEmitter,
    getLatestPriceData
};
