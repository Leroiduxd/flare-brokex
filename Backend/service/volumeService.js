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
function getProtocolVolumes() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT trader, state, direction, margin, leverage, openTimestamp, closeTimestamp, borrowFee FROM trades`;

        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);

            const now = Math.floor(Date.now() / 1000);
            const time24hAgo = now - (24 * 60 * 60);
            const time7dAgo = now - (7 * 24 * 60 * 60);

            const volume24h = calculateVolumeForPeriod(rows, time24hAgo);
            const volume7d  = calculateVolumeForPeriod(rows, time7dAgo);
            const volumeAllTime = calculateVolumeForPeriod(rows, 0);

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

module.exports = { getProtocolVolumes, getTraderVolumes, calculateVolumeForPeriod };
