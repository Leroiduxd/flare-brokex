require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const db = require('../db');
const brokexLensAbi = require('../abi/BrokexLens.json');
const brokexCoreAbi = require('../abi/BrokexCore.json');
const { saveStopsToDb } = require('./stopsService');

// RPC Provider initialization
const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Contracts initialization
const lensAddress = process.env.BROKEX_LENS_ADDRESS;
const coreAddress = process.env.BROKEX_CORE_ADDRESS;

const lensContract = (lensAddress && lensAddress !== '0x0000000000000000000000000000000000000000')
    ? new ethers.Contract(lensAddress, brokexLensAbi.abi || brokexLensAbi, provider)
    : null;

const coreContract = (coreAddress && coreAddress !== '0x0000000000000000000000000000000000000000')
    ? new ethers.Contract(coreAddress, brokexCoreAbi.abi || brokexCoreAbi, provider)
    : null;

/**
 * Calculates liquidation price using the exact BrokexCore contract formula.
 * move = (openPrice * liqThresholdBps) / (leverage * 1e6)
 * Long:  openPrice - move
 * Short: openPrice + move
 */
function calculateLiquidationPrice(direction, openPriceStr, leverageStr, liqThresholdBps = 950000n) {
    try {
        const openPrice = BigInt(openPriceStr || '0');
        const leverage = BigInt(leverageStr || '0');

        if (openPrice === 0n || leverage === 0n) return '0';

        const PRECISION = 1000000n;
        const move = (openPrice * liqThresholdBps) / (leverage * PRECISION);

        const dir = Number(direction);
        let liqPrice = 0n;

        if (dir === 1) { // LONG
            liqPrice = openPrice > move ? openPrice - move : 0n;
        } else { // SHORT
            liqPrice = openPrice + move;
        }

        return liqPrice.toString();
    } catch (err) {
        return '0';
    }
}

/**
 * Inserts or updates a list of trades in the SQLite database in a single serialized batch.
 * @param {Array} trades 
 */
function saveTradesToDb(trades) {
    return new Promise((resolve, reject) => {
        if (!trades || trades.length === 0) {
            return resolve([]);
        }

        const sql = `
            INSERT INTO trades (
                id, trader, assetHash, state, direction, orderType, margin, leverage,
                targetPrice, openPrice, closePrice, stopLoss, takeProfit, openTimestamp, closeTimestamp, borrowFee, liquidationPrice
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                trader=excluded.trader,
                assetHash=excluded.assetHash,
                state=excluded.state,
                direction=excluded.direction,
                orderType=excluded.orderType,
                margin=excluded.margin,
                leverage=excluded.leverage,
                targetPrice=excluded.targetPrice,
                openPrice=excluded.openPrice,
                closePrice=excluded.closePrice,
                stopLoss=excluded.stopLoss,
                takeProfit=excluded.takeProfit,
                openTimestamp=excluded.openTimestamp,
                closeTimestamp=excluded.closeTimestamp,
                borrowFee=excluded.borrowFee,
                liquidationPrice = CASE 
                    WHEN trades.liquidationPrice IS NOT NULL AND trades.liquidationPrice != '0' THEN trades.liquidationPrice 
                    ELSE excluded.liquidationPrice 
                END;
        `;

        db.serialize(() => {
            const stmt = db.prepare(sql);
            const savedCount = [];

            for (const t of trades) {
                const tradeId = (t.id !== undefined) ? t.id.toString() : '0';
                const trader = t.trader || '0x0000000000000000000000000000000000000000';

                // Skip invalid or uninitialized trades
                if (tradeId === '0' && trader === '0x0000000000000000000000000000000000000000') {
                    continue;
                }

                const assetHash = (t.assetId !== undefined) ? t.assetId.toString() : (t.assetHash ? t.assetHash.toString() : '0');
                const state = Number(t.state || 0);
                const direction = Number(t.direction || 0);
                const orderType = Number(t.orderType || 0);
                const margin = (t.margin || 0).toString();
                const leverage = (t.leverage || 0).toString();
                const targetPrice = (t.targetPrice || 0).toString();
                const openPrice = (t.openPrice || 0).toString();
                const closePrice = (t.closePrice || 0).toString();
                const stopLoss = (t.stopLoss || 0).toString();
                const takeProfit = (t.takeProfit || 0).toString();
                const openTimestamp = (t.openTimestamp || 0).toString();
                const closeTimestamp = (t.closeTimestamp || 0).toString();
                const borrowFee = (t.borrowFee || 0).toString();

                // Calculate liquidationPrice for any trade that has been active (state != 0 ORDER and state != 3 CANCELLED)
                let liqPrice = (t.liquidationPrice && t.liquidationPrice !== '0') ? t.liquidationPrice.toString() : '0';
                if (liqPrice === '0' && state !== 0 && state !== 3 && openPrice !== '0') {
                    liqPrice = calculateLiquidationPrice(direction, openPrice, leverage);
                }

                stmt.run([
                    tradeId, trader, assetHash, state, direction, orderType,
                    margin, leverage, targetPrice, openPrice, closePrice,
                    stopLoss, takeProfit, openTimestamp, closeTimestamp, borrowFee, liqPrice
                ], (err) => {
                    if (err) {
                        console.error(`[TradeService] Error inserting trade ${tradeId}:`, err.message);
                    }
                });

                savedCount.push(tradeId);
            }

            stmt.finalize((err) => {
                if (err) return reject(err);
                console.log(`[TradeService] ${savedCount.length} trade(s) saved/updated in database.`);
                resolve(savedCount);
            });
        });
    });
}

/**
 * Returns all trade IDs currently stored in SQLite database.
 * @returns {Promise<Set<string>>}
 */
function getStoredTradeIds() {
    return new Promise((resolve, reject) => {
        db.all('SELECT id FROM trades', [], (err, rows) => {
            if (err) return reject(err);
            const idSet = new Set(rows.map(r => r.id.toString()));
            resolve(idSet);
        });
    });
}

/**
 * Returns active trades (state = 0: ORDER or 1: OPEN) currently stored in SQLite database.
 * @returns {Promise<Array<Object>>}
 */
function getActiveTradesFromDb() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM trades WHERE state IN (0, 1)', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Returns a trade by ID from SQLite database.
 * @param {string|number} tradeId 
 * @returns {Promise<Object|null>}
 */
function getTradeByIdFromDb(tradeId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM trades WHERE id = ?', [tradeId.toString()], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

/**
 * Returns trades for a specific trader address, optionally filtered by state.
 * @param {string} traderAddress 
 * @param {number|string|null} stateFilter 
 * @returns {Promise<Array<Object>>}
 */
function getTradesByTrader(traderAddress, stateFilter = null) {
    return new Promise((resolve, reject) => {
        let sql = 'SELECT * FROM trades WHERE LOWER(trader) = LOWER(?)';
        const params = [traderAddress];

        if (stateFilter !== null && stateFilter !== undefined && stateFilter !== '') {
            sql += ' AND state = ?';
            params.push(Number(stateFilter));
        }

        sql += ' ORDER BY CAST(id AS INTEGER) DESC';

        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Returns the highest trade ID stored in the SQLite database.
 * @returns {Promise<string>} Highest trade ID or '0'
 */
function getHighestTradeIdFromDb() {
    return new Promise((resolve, reject) => {
        db.get('SELECT MAX(CAST(id AS INTEGER)) as maxId FROM trades', [], (err, row) => {
            if (err) return reject(err);
            resolve((row && row.maxId !== null) ? row.maxId.toString() : '0');
        });
    });
}

/**
 * Returns a range of trades by ID from startId to endId inclusive from SQLite database.
 * @param {number|string} startId 
 * @param {number|string} endId 
 * @returns {Promise<Array<Object>>}
 */
function getTradesByRangeFromDb(startId, endId) {
    return new Promise((resolve, reject) => {
        const start = Number(startId || 1);
        const end = Number(endId || start);
        const sql = 'SELECT * FROM trades WHERE CAST(id AS INTEGER) >= ? AND CAST(id AS INTEGER) <= ? ORDER BY CAST(id AS INTEGER) ASC';

        db.all(sql, [start, end], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Fetches a single trade by ID from the blockchain.
 * @param {number|string|BigInt} tradeId 
 */
async function fetchTradeFromChain(tradeId) {
    let trade = null;
    if (lensContract && typeof lensContract.getTradesByIds === 'function') {
        const result = await lensContract.getTradesByIds([tradeId]);
        if (result && result.length > 0) trade = result[0];
    } else if (lensContract && typeof lensContract.getTradeRange === 'function') {
        const result = await lensContract.getTradeRange(tradeId, 1);
        if (result && result.length > 0) trade = result[0];
    } else if (coreContract) {
        trade = await coreContract.getTrade(tradeId);
    }
    return trade;
}

/**
 * Fetches a trade by ID from the blockchain and saves it to the database.
 * @param {number|string|BigInt} tradeId 
 */
async function fetchAndSaveTradeById(tradeId) {
    console.log(`[TradeService] Fetching trade ID: ${tradeId}...`);
    const trade = await fetchTradeFromChain(tradeId);

    if (!trade || (trade.trader === '0x0000000000000000000000000000000000000000' && trade.id.toString() === '0')) {
        console.log(`[TradeService] Trade ID ${tradeId} does not exist or is empty.`);
        return null;
    }

    await saveTradesToDb([trade]);
    return trade;
}

/**
 * Fetches a list of trades by their IDs and saves them to the database.
 * Batching calls in chunks of maxChunkSize (default 500).
 * @param {Array<number|string>} ids 
 * @param {number} maxChunkSize 
 */
async function fetchAndSaveTradesByIds(ids, maxChunkSize = 500) {
    if (!ids || ids.length === 0) return [];
    console.log(`[TradeService] Fetching ${ids.length} trade(s) by IDs...`);
    let allSaved = [];

    for (let i = 0; i < ids.length; i += maxChunkSize) {
        const chunk = ids.slice(i, i + maxChunkSize);
        let rawTrades = [];

        if (lensContract && typeof lensContract.getTradesByIds === 'function') {
            rawTrades = await lensContract.getTradesByIds(chunk);
        } else {
            for (const id of chunk) {
                const t = await fetchTradeFromChain(id);
                if (t && t.trader !== '0x0000000000000000000000000000000000000000') {
                    rawTrades.push(t);
                }
            }
        }

        const saved = await saveTradesToDb(rawTrades);
        allSaved = allSaved.concat(saved);
    }

    return allSaved;
}

/**
 * Fetches a range of trades (startId -> startId + length - 1) and saves them to the database.
 * @param {number|string} startId 
 * @param {number} length 
 */
async function fetchAndSaveTradesByRange(startId, length) {
    console.log(`[TradeService] Fetching trade range (startId: ${startId}, length: ${length})...`);
    let rawTrades = [];

    if (lensContract && typeof lensContract.getTradeRange === 'function') {
        rawTrades = await lensContract.getTradeRange(startId, length);
    } else if (coreContract) {
        const start = Number(startId);
        for (let i = 0; i < length; i++) {
            const t = await coreContract.getTrade(start + i);
            rawTrades.push(t);
        }
    } else {
        throw new Error("Neither BROKEX_LENS_ADDRESS nor BROKEX_CORE_ADDRESS is properly configured in .env");
    }

    await saveTradesToDb(rawTrades);
    return rawTrades;
}

const { getHighestTradeId } = require('./lensService');

/**
 * Startup Sync: compares highest on-chain trade ID with DB stored IDs and fetches missing trades by ID.
 */
async function syncMissingTradesOnStartup() {
    try {
        console.log('[StartupSync] Checking on-chain highest trade ID...');
        const highestOnChainIdBig = await getHighestTradeId();
        const maxOnChainId = Number(highestOnChainIdBig);

        if (maxOnChainId === 0) {
            console.log('[StartupSync] No trades exist on-chain.');
            return;
        }

        const storedIdsSet = await getStoredTradeIds();
        const missingIds = [];

        for (let id = 1; id <= maxOnChainId; id++) {
            if (!storedIdsSet.has(id.toString())) {
                missingIds.push(id);
            }
        }

        if (missingIds.length > 0) {
            console.log(`[StartupSync] Found ${missingIds.length} missing trade(s) out of ${maxOnChainId}. Syncing by ID...`);
            await fetchAndSaveTradesByIds(missingIds, 500);
            console.log('[StartupSync] Missing trades successfully synced.');
        } else {
            console.log(`[StartupSync] Database is fully up to date (${maxOnChainId} trades).`);
        }
    } catch (err) {
        console.error('[StartupSync] Error during startup sync:', err.message);
    }
}

/**
 * 10-Minute Job:
 * 1. Checks active trades (state 0: ORDER, state 1: OPEN).
 * 2. If state changed (e.g. executed or closed), fetches full trade struct for full row update.
 * 3. For trades whose state did NOT change, checks if SL or TP changed and queues stops update.
 * 4. Executes batch updates at the end in single database operations.
 */
async function updateActiveTradesJob() {
    try {
        console.log('[Cron10m] Checking active trades (state 0: ORDER, state 1: OPEN)...');
        const activeTradesDb = await getActiveTradesFromDb();

        if (activeTradesDb.length === 0) {
            console.log('[Cron10m] No active trades to update.');
            return;
        }

        console.log(`[Cron10m] Monitoring ${activeTradesDb.length} active trade(s)...`);
        
        const fullTradeUpdatesBatch = [];
        const stopsToUpdateBatch = [];
        const batchChunkSize = 500;

        for (let i = 0; i < activeTradesDb.length; i += batchChunkSize) {
            const chunk = activeTradesDb.slice(i, i + batchChunkSize);

            for (const dbTrade of chunk) {
                const chainTrade = await fetchTradeFromChain(dbTrade.id);
                if (!chainTrade) continue;

                const newState = Number(chainTrade.state || 0);
                const dbState = Number(dbTrade.state);

                // Step 1: Check if state changed
                if (newState !== dbState) {
                    console.log(`[Cron10m] Trade ID ${dbTrade.id} state changed (${dbState} -> ${newState}). Queueing full struct update.`);
                    fullTradeUpdatesBatch.push(chainTrade);
                    continue; // Skip SL/TP update since full struct will update the entire row
                }

                // Step 2: State did NOT change -> check if SL or TP changed
                const newStopLoss = (chainTrade.stopLoss || 0).toString();
                const newTakeProfit = (chainTrade.takeProfit || 0).toString();
                const dbStopLoss = (dbTrade.stopLoss || '0').toString();
                const dbTakeProfit = (dbTrade.takeProfit || '0').toString();

                if (newStopLoss !== dbStopLoss || newTakeProfit !== dbTakeProfit) {
                    console.log(`[Cron10m] Trade ID ${dbTrade.id} SL/TP changed (SL: ${dbStopLoss}->${newStopLoss}, TP: ${dbTakeProfit}->${newTakeProfit}). Queueing stops update.`);
                    stopsToUpdateBatch.push({
                        id: dbTrade.id.toString(),
                        stopLoss: newStopLoss,
                        takeProfit: newTakeProfit
                    });
                }
            }
        }

        // Step 3: Execute batch database updates
        if (fullTradeUpdatesBatch.length > 0) {
            console.log(`[Cron10m] Saving batch of ${fullTradeUpdatesBatch.length} full trade struct update(s) to DB...`);
            await saveTradesToDb(fullTradeUpdatesBatch);
        }

        if (stopsToUpdateBatch.length > 0) {
            console.log(`[Cron10m] Saving batch of ${stopsToUpdateBatch.length} SL/TP update(s) to DB...`);
            await saveStopsToDb(stopsToUpdateBatch);
        }

        if (fullTradeUpdatesBatch.length === 0 && stopsToUpdateBatch.length === 0) {
            console.log('[Cron10m] All active trades are up to date. No changes detected.');
        }
    } catch (err) {
        console.error('[Cron10m] Error during active trades update job:', err.message);
    }
}

/**
 * Backfills liquidationPrice for existing trades in SQLite database that were active/closed but missing liquidationPrice.
 */
function backfillExistingTradesLiquidationPrice() {
    db.all(`SELECT id, direction, openPrice, leverage, state, liquidationPrice FROM trades WHERE (liquidationPrice IS NULL OR liquidationPrice = '0') AND state != 0 AND state != 3 AND openPrice != '0'`, [], (err, rows) => {
        if (err || !rows || rows.length === 0) return;
        
        console.log(`[TradeService] Backfilling liquidationPrice for ${rows.length} existing active/closed trade(s)...`);
        db.serialize(() => {
            const stmt = db.prepare(`UPDATE trades SET liquidationPrice = ? WHERE id = ?`);
            for (const r of rows) {
                const liqPrice = calculateLiquidationPrice(r.direction, r.openPrice, r.leverage);
                if (liqPrice !== '0') {
                    stmt.run([liqPrice, r.id.toString()]);
                }
            }
            stmt.finalize();
        });
    });
}

// Run backfill once on module load
backfillExistingTradesLiquidationPrice();

module.exports = {
    saveTradesToDb,
    getStoredTradeIds,
    getActiveTradesFromDb,
    getTradeByIdFromDb,
    getTradesByTrader,
    getHighestTradeIdFromDb,
    getTradesByRangeFromDb,
    fetchAndSaveTradeById,
    fetchAndSaveTradesByIds,
    fetchAndSaveTradesByRange,
    getHighestTradeId,
    syncMissingTradesOnStartup,
    updateActiveTradesJob
};
