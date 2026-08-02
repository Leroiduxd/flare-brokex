require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const db = require('../db');
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
 * Updates stopLoss and takeProfit columns in SQLite database for a list of TradeStops objects.
 * @param {Array<{id: bigint|number|string, stopLoss: bigint|number|string, takeProfit: bigint|number|string}>} stopsList 
 */
function saveStopsToDb(stopsList) {
    return new Promise((resolve, reject) => {
        if (!stopsList || stopsList.length === 0) {
            return resolve([]);
        }

        const sql = `UPDATE trades SET stopLoss = ?, takeProfit = ? WHERE id = ?;`;

        db.serialize(() => {
            const stmt = db.prepare(sql);
            const updatedIds = [];

            for (const item of stopsList) {
                const tradeId = item.id.toString();
                const stopLoss = (item.stopLoss || 0).toString();
                const takeProfit = (item.takeProfit || 0).toString();

                stmt.run([stopLoss, takeProfit, tradeId], (err) => {
                    if (err) {
                        console.error(`[StopsService] Error updating stops for trade ${tradeId}:`, err.message);
                    }
                });

                updatedIds.push(tradeId);
            }

            stmt.finalize((err) => {
                if (err) return reject(err);
                console.log(`[StopsService] ${updatedIds.length} trade stops updated in database.`);
                resolve(updatedIds);
            });
        });
    });
}

/**
 * Fetches stops range (stopLoss / takeProfit) from Lens contract and updates the database.
 * @param {number|string} startId 
 * @param {number} length 
 */
async function updateStopsByRange(startId, length) {
    console.log(`[StopsService] Fetching stops range (startId: ${startId}, length: ${length})...`);
    const stops = await lensContract.getStopsRange(startId, length);
    await saveStopsToDb(stops);
    return stops;
}

/**
 * Fetches stops (stopLoss / takeProfit) by IDs from Lens contract and updates the database.
 * @param {Array<number|string>} ids 
 */
async function updateStopsByIds(ids) {
    console.log(`[StopsService] Fetching stops for ${ids.length} trade ID(s)...`);
    const stops = await lensContract.getStopsByIds(ids);
    await saveStopsToDb(stops);
    return stops;
}

// CLI execution example: `node service/stopsService.js`
if (require.main === module) {
    (async () => {
        try {
            await updateStopsByRange(1, 5);
        } catch (error) {
            console.error('[StopsService] Error:', error.message);
        }
    })();
}

module.exports = {
    saveStopsToDb,
    updateStopsByRange,
    updateStopsByIds
};
