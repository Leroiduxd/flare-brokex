require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const db = require('../db');
const brokexVaultAbi = require('../abi/BrokexVault.json');
const brokexCoreAbi = require('../abi/BrokexCore.json');
const brokexLensAbi = require('../abi/BrokexLens.json');
const erc20Abi = ['function balanceOf(address) external view returns (uint256)'];

const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const provider = new ethers.JsonRpcProvider(rpcUrl);

const vaultAddress = process.env.BROKEX_VAULT_ADDRESS;
const coreAddress = process.env.BROKEX_CORE_ADDRESS;
const lensAddress = process.env.BROKEX_LENS_ADDRESS;

const vaultContract = (vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000')
    ? new ethers.Contract(vaultAddress, brokexVaultAbi.abi || brokexVaultAbi, provider)
    : null;

const coreContract = (coreAddress && coreAddress !== '0x0000000000000000000000000000000000000000')
    ? new ethers.Contract(coreAddress, brokexCoreAbi.abi || brokexCoreAbi, provider)
    : null;

const lensContract = (lensAddress && lensAddress !== '0x0000000000000000000000000000000000000000')
    ? new ethers.Contract(lensAddress, brokexLensAbi.abi || brokexLensAbi, provider)
    : null;

let isFetchingMetrics = false;

/**
 * Fetches all LP Vault metrics from RPC smart contracts and saves a snapshot to SQLite `vault_metrics` table.
 */
async function fetchAndSaveVaultMetrics() {
    if (isFetchingMetrics) return;
    isFetchingMetrics = true;

    try {
        if (!vaultContract || !coreContract) {
            console.warn('[VaultMetricsService] Vault or Core contract address not configured.');
            return null;
        }

        const now = Math.floor(Date.now() / 1000);

        // 1. Fetch values from BrokexVault & BrokexCore
        const [
            lastKnownPrice,
            totalSupply,
            usdcAddress,
            totalPendingLP,
            requiredFreeUSDC,
            queueHead,
            queueTail,
            freeCapital,
            totalLockedCapital
        ] = await Promise.all([
            vaultContract.lastKnownPrice().catch(() => 0n),
            vaultContract.totalSupply().catch(() => 0n),
            vaultContract.USDC().catch(() => '0x0000000000000000000000000000000000000000'),
            vaultContract.totalPendingLP().catch(() => 0n),
            vaultContract.getRequiredFreeUSDC().catch(() => 0n),
            vaultContract.queueHead().catch(() => 0n),
            vaultContract.queueTail().catch(() => 0n),
            coreContract.getFreeCapital().catch(() => 0n),
            coreContract.totalLockedCapital().catch(() => 0n)
        ]);

        // 2. Fetch Vault total USDC physical balance
        let totalVaultUSDC = 0n;
        if (usdcAddress && usdcAddress !== '0x0000000000000000000000000000000000000000') {
            const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);
            totalVaultUSDC = await usdcContract.balanceOf(vaultAddress).catch(() => 0n);
        }

        let unrealizedPnL = 0n;
        let openInterestLong = 0n;
        let openInterestShort = 0n;
        let avgEntryPriceLong = 0n;
        let avgEntryPriceShort = 0n;

        let goldOpenInterestLong = 0n;
        let goldOpenInterestShort = 0n;
        let xrpOpenInterestLong = 0n;
        let xrpOpenInterestShort = 0n;

        const { getLatestPriceData, getFeedPrice } = require('./wss');
        const { normalizeToContractPrice } = require('./executionEngine');

        // Assets list to track
        const assetsToTrack = [
            {
                key: 'GOLD',
                hash: (process.env.GOLD_ASSET_HASH || '').split('#')[0].trim() || (process.env.GOLD_FEED_ID || '').split('#')[0].trim(),
                feedId: process.env.GOLD_FEED_ID,
                symbol: process.env.PYTH_GOLD_SYMBOL || 'Metal.XAU/USD'
            },
            {
                key: 'XRP',
                hash: '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298',
                hashAlt: '0x0aa350274fca23e3884be19de980198b13f2ea293ea26921055ab6a20770c7f2',
                feedId: process.env.XRP_FEED_ID,
                symbol: process.env.PYTH_XRP_SYMBOL || 'Crypto.XRP/USD'
            }
        ];

        if (lensContract) {
            for (const asset of assetsToTrack) {
                try {
                    let snapshot = null;
                    if (asset.hash) {
                        snapshot = await lensContract.getAssetSnapshot(asset.hash).catch(() => null);
                    }
                    if (!snapshot && asset.hashAlt) {
                        snapshot = await lensContract.getAssetSnapshot(asset.hashAlt).catch(() => null);
                    }

                    if (snapshot) {
                        const oiLong = BigInt(snapshot.openInterestLong !== undefined ? snapshot.openInterestLong : (snapshot[1] || '0'));
                        const oiShort = BigInt(snapshot.openInterestShort !== undefined ? snapshot.openInterestShort : (snapshot[2] || '0'));
                        const avgLong = BigInt(snapshot.avgEntryPriceLong !== undefined ? snapshot.avgEntryPriceLong : (snapshot[4] || '0'));
                        const avgShort = BigInt(snapshot.avgEntryPriceShort !== undefined ? snapshot.avgEntryPriceShort : (snapshot[5] || '0'));

                        if (asset.key === 'GOLD') {
                            goldOpenInterestLong = oiLong;
                            goldOpenInterestShort = oiShort;
                        } else if (asset.key === 'XRP') {
                            xrpOpenInterestLong = oiLong;
                            xrpOpenInterestShort = oiShort;
                        }

                        openInterestLong += oiLong;
                        openInterestShort += oiShort;

                        // Calculate PnL for this asset
                        let latestPriceObj = getLatestPriceData(asset.symbol) || getLatestPriceData(asset.feedId);
                        if (!latestPriceObj || !latestPriceObj.value) {
                            try {
                                latestPriceObj = await getFeedPrice(asset.feedId, asset.symbol);
                            } catch (e) {}
                        }

                        if (latestPriceObj && latestPriceObj.value) {
                            const currentPriceBig = normalizeToContractPrice(latestPriceObj.value, latestPriceObj.decimals);

                            let pnlLong = 0n;
                            if (oiLong > 0n && avgLong > 0n) {
                                pnlLong = (oiLong * (currentPriceBig - avgLong)) / avgLong;
                            }

                            let pnlShort = 0n;
                            if (oiShort > 0n && avgShort > 0n) {
                                pnlShort = (oiShort * (avgShort - currentPriceBig)) / avgShort;
                            }

                            unrealizedPnL += (pnlLong + pnlShort);
                        }
                    }
                } catch (assetErr) {
                    console.warn(`[VaultMetricsService] Error fetching snapshot for ${asset.key}:`, assetErr.message);
                }
            }
        }

        // Fetch cumulative total borrow fees from trades DB
        let totalBorrowFees = 0n;
        try {
            await new Promise((res) => {
                db.all(`SELECT borrowFee FROM trades`, [], (err, rows) => {
                    if (!err && rows) {
                        for (const r of rows) {
                            if (r.borrowFee) {
                                totalBorrowFees += BigInt(r.borrowFee.toString());
                            }
                        }
                    }
                    res();
                });
            });
        } catch (e) {}

        let vaultUsageBps = 0n;
        if (lensContract && typeof lensContract.getProtocolSnapshot === 'function') {
            try {
                const protoSnap = await lensContract.getProtocolSnapshot();
                if (protoSnap) {
                    vaultUsageBps = protoSnap.vaultUsageBps || 0n;
                }
            } catch (e) {}
        }

        const pendingRequestsCount = queueTail >= queueHead ? Number(queueTail - queueHead) : 0;

        let calculatedLpPrice = 1000000n; // Default 1.000000 (1e6)
        if (totalSupply > 0n) {
            const vaultNetAssets = totalVaultUSDC - unrealizedPnL;
            const positiveNetAssets = vaultNetAssets > 0n ? vaultNetAssets : 0n;
            calculatedLpPrice = (positiveNetAssets * 1000000n) / totalSupply;
        }

        const metricsData = {
            timestamp: now,
            lastKnownPrice: lastKnownPrice.toString(),
            totalSupply: totalSupply.toString(),
            totalVaultUSDC: totalVaultUSDC.toString(),
            totalLockedCapital: totalLockedCapital.toString(),
            freeCapital: freeCapital.toString(),
            totalPendingLP: totalPendingLP.toString(),
            requiredFreeUSDC: requiredFreeUSDC.toString(),
            pendingRequestsCount,
            unrealizedPnL: unrealizedPnL.toString(),
            vaultUsageBps: vaultUsageBps.toString(),
            openInterestLong: openInterestLong.toString(),
            openInterestShort: openInterestShort.toString(),
            avgEntryPriceLong: avgEntryPriceLong.toString(),
            avgEntryPriceShort: avgEntryPriceShort.toString(),
            goldOpenInterestLong: goldOpenInterestLong.toString(),
            goldOpenInterestShort: goldOpenInterestShort.toString(),
            xrpOpenInterestLong: xrpOpenInterestLong.toString(),
            xrpOpenInterestShort: xrpOpenInterestShort.toString(),
            totalBorrowFees: totalBorrowFees.toString(),
            lpTokenPrice: calculatedLpPrice.toString()
        };

        // 4. Save metrics into SQLite database
        await new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO vault_metrics (
                    timestamp, lastKnownPrice, totalSupply, totalVaultUSDC, totalLockedCapital,
                    freeCapital, totalPendingLP, requiredFreeUSDC, pendingRequestsCount, unrealizedPnL, vaultUsageBps,
                    openInterestLong, openInterestShort, avgEntryPriceLong, avgEntryPriceShort,
                    goldOpenInterestLong, goldOpenInterestShort, xrpOpenInterestLong, xrpOpenInterestShort, totalBorrowFees, lpTokenPrice
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(sql, [
                metricsData.timestamp,
                metricsData.lastKnownPrice,
                metricsData.totalSupply,
                metricsData.totalVaultUSDC,
                metricsData.totalLockedCapital,
                metricsData.freeCapital,
                metricsData.totalPendingLP,
                metricsData.requiredFreeUSDC,
                metricsData.pendingRequestsCount,
                metricsData.unrealizedPnL,
                metricsData.vaultUsageBps,
                metricsData.openInterestLong,
                metricsData.openInterestShort,
                metricsData.avgEntryPriceLong,
                metricsData.avgEntryPriceShort,
                metricsData.goldOpenInterestLong,
                metricsData.goldOpenInterestShort,
                metricsData.xrpOpenInterestLong,
                metricsData.xrpOpenInterestShort,
                metricsData.totalBorrowFees,
                metricsData.lpTokenPrice
            ], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        return metricsData;
    } catch (err) {
        console.error('[VaultMetricsService] Error capturing vault metrics:', err.message);
        return null;
    } finally {
        isFetchingMetrics = false;
    }
}

/**
 * Reads historical vault metrics with timeframe aggregation and optional start date filter.
 * @param {string|number} timeframe - '1m', '5m', '15m', '1h', '4h', '1d' or seconds
 * @param {number} fromTimestampSec - Unix timestamp in seconds (0 for all history)
 */
function getVaultMetricsHistory(timeframe = '1m', fromTimestampSec = 0) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT * FROM vault_metrics WHERE timestamp >= ? ORDER BY timestamp ASC`;
        const params = [Number(fromTimestampSec || 0)];

        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);

            if (!rows || rows.length === 0) {
                return resolve([]);
            }

            // Convert timeframe string to interval seconds
            let intervalSec = 60; // Default 1m = 60s
            const tfStr = timeframe.toString().toLowerCase();
            if (tfStr === '5m' || tfStr === '5') intervalSec = 5 * 60;
            else if (tfStr === '15m' || tfStr === '15') intervalSec = 15 * 60;
            else if (tfStr === '1h' || tfStr === '60') intervalSec = 60 * 60;
            else if (tfStr === '4h' || tfStr === '240') intervalSec = 4 * 60 * 60;
            else if (tfStr === '1d' || tfStr === '1440' || tfStr === 'd') intervalSec = 24 * 60 * 60;

            if (intervalSec <= 60) {
                return resolve(rows);
            }

            // Sample / Group rows by timeframe interval
            const aggregated = [];
            let currentBucket = null;

            for (const r of rows) {
                const bucketTime = Math.floor(r.timestamp / intervalSec) * intervalSec;
                if (!currentBucket || currentBucket.timestamp !== bucketTime) {
                    currentBucket = {
                        ...r,
                        timestamp: bucketTime
                    };
                    aggregated.push(currentBucket);
                } else {
                    // Update latest values for the bucket
                    currentBucket.lastKnownPrice = r.lastKnownPrice;
                    currentBucket.totalSupply = r.totalSupply;
                    currentBucket.totalVaultUSDC = r.totalVaultUSDC;
                    currentBucket.totalLockedCapital = r.totalLockedCapital;
                    currentBucket.freeCapital = r.freeCapital;
                    currentBucket.totalPendingLP = r.totalPendingLP;
                    currentBucket.requiredFreeUSDC = r.requiredFreeUSDC;
                    currentBucket.pendingRequestsCount = r.pendingRequestsCount;
                    currentBucket.unrealizedPnL = r.unrealizedPnL;
                    currentBucket.vaultUsageBps = r.vaultUsageBps;
                    currentBucket.openInterestLong = r.openInterestLong;
                    currentBucket.openInterestShort = r.openInterestShort;
                    currentBucket.avgEntryPriceLong = r.avgEntryPriceLong;
                    currentBucket.avgEntryPriceShort = r.avgEntryPriceShort;
                    currentBucket.lpTokenPrice = r.lpTokenPrice;
                }
            }

            resolve(aggregated);
        });
    });
}

/**
 * Starts 1-minute cron job to poll RPC and save vault metrics snapshot to database
 */
function startVaultMetricsCron(intervalMs = 60 * 1000) {
    // Initial fetch
    fetchAndSaveVaultMetrics();

    // 1-minute loop
    setInterval(() => {
        fetchAndSaveVaultMetrics();
    }, intervalMs);
}

module.exports = {
    fetchAndSaveVaultMetrics,
    getVaultMetricsHistory,
    startVaultMetricsCron
};
