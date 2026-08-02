const db = require('../db');

// Constantes d'états
const STATE_ORDER     = 0;
const STATE_OPEN      = 1;
const STATE_CLOSED    = 2;
const STATE_CANCELLED = 3;

// Constantes de direction
const DIR_SHORT = 0;
const DIR_LONG  = 1;

/**
 * Calcule les métriques de volume sur les trades récupérés de la DB
 * @param {Array} trades 
 * @param {number} startTimeSec - Timestamp Unix minimal (0 pour all-time)
 */
function calculateVolumeForPeriod(trades, startTimeSec = 0) {
    let totalLongVolume = 0n;
    let totalShortVolume = 0n;

    for (const trade of trades) {
        const state = Number(trade.state);
        
        // On ignore les simples ordres non exécutés (STATE_ORDER) et annulés (STATE_CANCELLED)
        if (state === STATE_ORDER || state === STATE_CANCELLED) {
            continue;
        }

        const openTime = Number(trade.openTimestamp);
        const closeTime = Number(trade.closeTimestamp);
        const direction = Number(trade.direction);

        const margin = BigInt(trade.margin || '0');
        const leverage = BigInt(trade.leverage || '0');

        // Taille d'une position unitaire en 10^6 (margin * leverage / 1e6)
        const singlePositionVolume = (margin * leverage) / 1000000n;

        // 1. Vérification de l'OUVERTURE (si openTimestamp >= startTimeSec)
        if (openTime >= startTimeSec) {
            if (direction === DIR_LONG) {
                totalLongVolume += singlePositionVolume;
            } else if (direction === DIR_SHORT) {
                totalShortVolume += singlePositionVolume;
            }
        }

        // 2. Vérification de la FERMETURE (si l'état est un état fermé et closeTimestamp >= startTimeSec)
        if (state >= STATE_CLOSED && closeTime >= startTimeSec) {
            if (direction === DIR_LONG) {
                totalLongVolume += singlePositionVolume;
            } else if (direction === DIR_SHORT) {
                totalShortVolume += singlePositionVolume;
            }
        }
    }

    const totalVolume = totalLongVolume + totalShortVolume;

    return {
        longVolume: totalLongVolume.toString(),
        shortVolume: totalShortVolume.toString(),
        totalVolume: totalVolume.toString()
    };
}

/**
 * Récupère tous les volumes (24h, 7d, All-Time) pour un trader spécifique
 * @param {string} traderAddress 
 */
function getTraderVolumes(traderAddress) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT state, direction, margin, leverage, openTimestamp, closeTimestamp FROM trades WHERE LOWER(trader) = LOWER(?)`;

        db.all(sql, [traderAddress], (err, rows) => {
            if (err) return reject(err);

            const now = Math.floor(Date.now() / 1000);
            const time24hAgo = now - (24 * 60 * 60);
            const time7dAgo = now - (7 * 24 * 60 * 60);

            const volume24h = calculateVolumeForPeriod(rows, time24hAgo);
            const volume7d  = calculateVolumeForPeriod(rows, time7dAgo);
            const volumeAllTime = calculateVolumeForPeriod(rows, 0);

            resolve({
                trader: traderAddress,
                v24h: volume24h,
                v7d: volume7d,
                allTime: volumeAllTime
            });
        });
    });
}

/**
 * Récupère tous les volumes du protocole (24h, 7d, All-Time) ainsi que les statistiques globales.
 */
/**
 * Calcule les métriques de Borrow Fees pour une période donnée basées sur closeTimestamp.
 * @param {Array} trades 
 * @param {number} startTimeSec 
 */
function calculateBorrowFeesForPeriod(trades, startTimeSec = 0) {
    let totalBorrowFees = 0n;
    let closedTradesCount = 0;

    for (const r of trades) {
        const state = Number(r.state);
        const closeTime = Number(r.closeTimestamp || '0');
        const borrowFee = BigInt(r.borrowFee || '0');

        // Seuls les trades fermés (STATE_CLOSED = 2, LIQUIDATED = 4, etc.) ont leurs frais de prêt déduits/comptabilisés
        if (state >= STATE_CLOSED && closeTime >= startTimeSec) {
            totalBorrowFees += borrowFee;
            closedTradesCount++;
        }
    }

    return {
        totalBorrowFee: totalBorrowFees.toString(),
        closedTradesCount
    };
}

/**
 * Génère des bougies/points temporels de Borrow Fees agrégés (par heure : 3600s).
 * @param {string|number} timeframe - '1h', '4h', '1d' ou intervalle en secondes (défaut '1h')
 */
function getBorrowFeeChart(timeframe = '1h') {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, state, closeTimestamp, borrowFee FROM trades WHERE state >= 2 AND CAST(closeTimestamp AS INTEGER) > 0 ORDER BY CAST(closeTimestamp AS INTEGER) ASC`;

        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);

            let intervalSec = 3600; // 1 heure par défaut
            const tfStr = timeframe.toString().toLowerCase();
            if (tfStr === '4h' || tfStr === '240') intervalSec = 4 * 3600;
            else if (tfStr === '1d' || tfStr === '1440' || tfStr === 'd') intervalSec = 24 * 3600;

            if (!rows || rows.length === 0) {
                return resolve([]);
            }

            const bucketsMap = new Map();

            for (const r of rows) {
                const closeTime = Number(r.closeTimestamp || '0');
                if (closeTime <= 0) continue;

                const bucketTime = Math.floor(closeTime / intervalSec) * intervalSec;
                const fee = BigInt(r.borrowFee || '0');

                if (!bucketsMap.has(bucketTime)) {
                    bucketsMap.set(bucketTime, {
                        timestamp: bucketTime,
                        feesBig: fee,
                        count: 1
                    });
                } else {
                    const b = bucketsMap.get(bucketTime);
                    b.feesBig += fee;
                    b.count += 1;
                }
            }

            // Convertir en tableau trié avec cumulatif
            const result = [];
            let cumulativeFeesBig = 0n;

            for (const [timestamp, b] of Array.from(bucketsMap.entries()).sort((a, b) => a[0] - b[0])) {
                cumulativeFeesBig += b.feesBig;
                result.push({
                    timestamp: b.timestamp,
                    periodFee: b.feesBig.toString(),
                    cumulativeFee: cumulativeFeesBig.toString(),
                    tradesCount: b.count
                });
            }

            resolve(result);
        });
    });
}

function getProtocolVolumes() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT trader, state, direction, margin, leverage, openTimestamp, closeTimestamp, borrowFee FROM trades`;

        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);

            const now = Math.floor(Date.now() / 1000);
            const time24hAgo = now - (24 * 60 * 60);
            const time7dAgo = now - (7 * 24 * 60 * 60);
            const time30dAgo = now - (30 * 24 * 60 * 60);

            const volume24h = calculateVolumeForPeriod(rows, time24hAgo);
            const volume7d  = calculateVolumeForPeriod(rows, time7dAgo);
            const volumeAllTime = calculateVolumeForPeriod(rows, 0);

            // Borrow Fees par périodes (closeTimestamp)
            const borrowFees24h = calculateBorrowFeesForPeriod(rows, time24hAgo);
            const borrowFees7d  = calculateBorrowFeesForPeriod(rows, time7dAgo);
            const borrowFees30d = calculateBorrowFeesForPeriod(rows, time30dAgo);
            const borrowFeesAllTime = calculateBorrowFeesForPeriod(rows, 0);

            // 1. Nombre total de trades uniques depuis le début
            const totalTradesCount = rows.length;

            // 2. Nombre de traders uniques depuis le début
            const uniqueTradersSet = new Set();
            
            // Stats de leviers et ordres
            let activeTradesCount = 0;
            let pendingOrdersCount = 0;

            let openLongLeverageSum = 0n;
            let openLongCount = 0;

            let openShortLeverageSum = 0n;
            let openShortCount = 0;

            let totalBorrowFeeSum = 0n;

            for (const r of rows) {
                if (r.trader && r.trader !== '0x0000000000000000000000000000000000000000') {
                    uniqueTradersSet.add(r.trader.toLowerCase());
                }

                const state = Number(r.state);
                const direction = Number(r.direction);
                const leverage = BigInt(r.leverage || '0');
                const borrowFee = BigInt(r.borrowFee || '0');

                // Somme de tous les borrow fees (en 10^6)
                totalBorrowFeeSum += borrowFee;

                // Ordres en attente (state == 0)
                if (state === STATE_ORDER) {
                    pendingOrdersCount++;
                }

                // Trades actifs / ouverts (state == 1)
                if (state === STATE_OPEN) {
                    activeTradesCount++;
                    if (direction === DIR_LONG) {
                        openLongLeverageSum += leverage;
                        openLongCount++;
                    } else if (direction === DIR_SHORT) {
                        openShortLeverageSum += leverage;
                        openShortCount++;
                    }
                }
            }

            // Calcul des leviers moyens pour les positions ouvertes (en 10^6)
            const avgLeverageLong = openLongCount > 0 ? (openLongLeverageSum / BigInt(openLongCount)).toString() : '0';
            const avgLeverageShort = openShortCount > 0 ? (openShortLeverageSum / BigInt(openShortCount)).toString() : '0';

            resolve({
                v24h: volume24h,
                v7d: volume7d,
                allTime: volumeAllTime,
                borrowFees: {
                    f24h: borrowFees24h,
                    f7d: borrowFees7d,
                    f30d: borrowFees30d,
                    allTime: borrowFeesAllTime
                },
                stats: {
                    totalTradesCount,
                    totalUniqueTraders: uniqueTradersSet.size,
                    activeTradesCount,
                    pendingOrdersCount,
                    avgLeverageLong,
                    avgLeverageShort,
                    totalBorrowFee: totalBorrowFeeSum.toString()
                }
            });
        });
    });
}

// Exécution directe si exécuté avec node volumeService.js
if (require.main === module) {
    getProtocolVolumes().then(res => {
        console.log("=== VOLUMES DU PROTOCOLE (Unités en 10^6 / USDT avec 6 décimales) ===");
        console.log("\n--- 24 Heures ---");
        console.log(`Long:  ${res.v24h.longVolume}`);
        console.log(`Short: ${res.v24h.shortVolume}`);
        console.log(`Total: ${res.v24h.totalVolume}`);

        console.log("\n--- 7 Jours ---");
        console.log(`Long:  ${res.v7d.longVolume}`);
        console.log(`Short: ${res.v7d.shortVolume}`);
        console.log(`Total: ${res.v7d.totalVolume}`);

        console.log("\n--- All Time ---");
        console.log(`Long:  ${res.allTime.longVolume}`);
        console.log(`Short: ${res.allTime.shortVolume}`);
        console.log(`Total: ${res.allTime.totalVolume}`);
        
        process.exit(0);
    }).catch(err => {
        console.error("Erreur calcul volume:", err);
        process.exit(1);
    });
}

module.exports = { getProtocolVolumes, getTraderVolumes, calculateVolumeForPeriod, calculateBorrowFeesForPeriod, getBorrowFeeChart };
