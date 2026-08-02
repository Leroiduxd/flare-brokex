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
 * Updates the state column in SQLite database for a list of TradeState objects.
 * @param {Array<{id: bigint|number|string, state: number}>} statesList 
 */
function saveStatesToDb(statesList) {
    return new Promise((resolve, reject) => {
        if (!statesList || statesList.length === 0) {
            return resolve([]);
        }

        const sql = `UPDATE trades SET state = ? WHERE id = ?;`;

        db.serialize(() => {
            const stmt = db.prepare(sql);
            const updatedIds = [];

            for (const item of statesList) {
                const tradeId = item.id.toString();
                const state = Number(item.state);

                stmt.run([state, tradeId], (err) => {
                    if (err) {
                        console.error(`[StateService] Error updating state for trade ${tradeId}:`, err.message);
                    }
                });

                updatedIds.push(tradeId);
            }

            stmt.finalize((err) => {
                if (err) return reject(err);
                console.log(`[StateService] ${updatedIds.length} trade state(s) updated in database.`);
                resolve(updatedIds);
            });
        });
    });
}

/**
 * Fetches state range from Lens contract and updates the database.
 * @param {number|string} startId 
 * @param {number} length 
 */
async function updateStatesByRange(startId, length) {
    console.log(`[StateService] Fetching state range (startId: ${startId}, length: ${length})...`);
    const states = await lensContract.getStateRange(startId, length);
    await saveStatesToDb(states);
    return states;
}

/**
 * Fetches states by IDs from Lens contract and updates the database.
 * @param {Array<number|string>} ids 
 */
async function updateStatesByIds(ids) {
    console.log(`[StateService] Fetching states for ${ids.length} trade ID(s)...`);
    const states = await lensContract.getStatesByIds(ids);
    await saveStatesToDb(states);
    return states;
}

// CLI execution example: `node service/stateService.js`
if (require.main === module) {
    (async () => {
        try {
            await updateStatesByRange(1, 5);
        } catch (error) {
            console.error('[StateService] Error:', error.message);
        }
    })();
}

module.exports = {
    saveStatesToDb,
    updateStatesByRange,
    updateStatesByIds
};
