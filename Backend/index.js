require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { 
    syncMissingTradesOnStartup, 
    updateActiveTradesJob,
    getTradeByIdFromDb,
    getTradesByTrader,
    getHighestTradeIdFromDb,
    getTradesByRangeFromDb,
    fetchAndSaveTradeById
} = require('./service/tradeService');
const { listenTradeEvents } = require('./service/listenTradeEvents');
const { watchFeedPrice, priceEmitter, getLatestPriceData } = require('./service/wss');
const { evaluateAndExecuteTrades } = require('./service/executionEngine');
const chartSyncService = require('./chart/chartSyncService');
const chartConfig = require('./chart/config');
const { getProtocolVolumes, getTraderVolumes } = require('./service/volumeService');
const { startSnapshotCron, getCachedSnapshot, fetchAndCacheAllSnapshots } = require('./service/snapshotService');
const { startPythBenchmarkCron, getSavedPriceDifferences, fetchAndSavePriceDifferences } = require('./service/pythBenchmarkService');
const { startWithdrawalCron, checkAndProcessWithdrawals } = require('./service/withdrawalService');
const { startVaultMetricsCron, getVaultMetricsHistory } = require('./service/vaultMetricsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Helper to map resolution strings (e.g. "1m", "15m", "1h", "4h", "1d", "1D") to minutes string
 */
function mapResolutionToMinutes(res) {
    if (!res) return '15';
    const r = res.toString().toLowerCase();
    if (r === '1d' || r === 'd' || r === '1440') return '1440';
    if (r === '4h' || r === '240') return '240';
    if (r === '1h' || r === '60') return '60';
    if (r === '30m' || r === '30') return '30';
    if (r === '15m' || r === '15') return '15';
    if (r === '5m' || r === '5') return '5';
    if (r === '1m' || r === '1') return '1';
    return r.replace(/\D/g, '') || '15';
}

/**
 * GET /v1/shims/tradingview/streaming
 * GET /api/v1/shims/tradingview/streaming
 * GET /streaming
 * GET /api/price/stream
 * HTTP Server-Sent Events (SSE) streaming endpoint matching Pyth TradingView shim format.
 * Streams real-time price updates for XAU/USD (Gold).
 */
const handlePriceStream = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const formatPayload = (priceData) => {
        const symbol = req.query.symbol || chartConfig.symbols[0];
        return {
            id: symbol,
            p: priceData.priceUSD,
            t: priceData.timestamp || Math.floor(Date.now() / 1000),
            v: 1,
            symbol: symbol,
            priceUSD: priceData.priceUSD,
            value: priceData.value ? priceData.value.toString() : '0',
            decimals: priceData.decimals,
            timestamp: priceData.timestamp
        };
    };

    // Send latest price data immediately if available
    const currentPrice = getLatestPriceData();
    if (currentPrice) {
        res.write(`data: ${JSON.stringify(formatPayload(currentPrice))}\n\n`);
    }

    // Listener for new price updates
    const onPriceUpdate = (data) => {
        res.write(`data: ${JSON.stringify(formatPayload(data))}\n\n`);
    };

    priceEmitter.on('priceUpdate', onPriceUpdate);

    // Clean up when client disconnects
    req.on('close', () => {
        priceEmitter.off('priceUpdate', onPriceUpdate);
        res.end();
    });
};

app.get('/v1/shims/tradingview/streaming', handlePriceStream);
app.get('/api/v1/shims/tradingview/streaming', handlePriceStream);
app.get('/streaming', handlePriceStream);
app.get('/api/price/stream', handlePriceStream);

/**
 * GET /v1/shims/tradingview/config
 * TradingView UDF config endpoint.
 */
app.get('/v1/shims/tradingview/config', (req, res) => {
    res.json({
        supports_search: true,
        supports_group_request: false,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D']
    });
});

/**
 * GET /v1/shims/tradingview/symbols
 * TradingView UDF symbols info endpoint.
 */
app.get('/v1/shims/tradingview/symbols', (req, res) => {
    const symbol = req.query.symbol || chartConfig.symbols[0];
    res.json({
        name: symbol,
        ticker: symbol,
        description: 'Gold / US Dollar',
        type: 'metal',
        session: '24x7',
        exchange: 'Brokex',
        listed_exchange: 'Brokex',
        timezone: 'Etc/UTC',
        has_intraday: true,
        has_daily: true,
        supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D'],
        pricescale: 100,
        minmov: 1
    });
});

/**
 * GET /v1/shims/tradingview/time
 * TradingView server time endpoint.
 */
app.get('/v1/shims/tradingview/time', (req, res) => {
    res.send(Math.floor(Date.now() / 1000).toString());
});

/**
 * GET /v1/shims/tradingview/history
 * GET /api/chart/history
 * Returns OHLC candles in TradingView UDF history format.
 * Parameters: symbol, resolution (1, 5, 15, 30, 60, 240, 1D), from, to
 */
const handleChartHistory = async (req, res) => {
    try {
        const symbol = req.query.symbol || chartConfig.symbols[0];
        const resolution = mapResolutionToMinutes(req.query.resolution);

        const from = req.query.from ? Number(req.query.from) : 0;
        const to = req.query.to ? Number(req.query.to) : Math.floor(Date.now() / 1000);

        let candles = await chartSyncService.getCandles(symbol, resolution);

        if (from > 0 || to > 0) {
            candles = candles.filter(c => c.time >= from && c.time <= to);
        }

        if (!candles || candles.length === 0) {
            return res.json({ s: 'no_data' });
        }

        const t = [], o = [], h = [], l = [], c = [], v = [];
        candles.forEach(candle => {
            t.push(candle.time);
            o.push(candle.open);
            h.push(candle.high);
            l.push(candle.low);
            c.push(candle.close);
            v.push(candle.volume || 0);
        });

        res.json({ s: 'ok', t, o, h, l, c, v });
    } catch (err) {
        console.error('[API] Error fetching chart history:', err.message);
        res.status(500).json({ s: 'error', errmsg: err.message });
    }
};

app.get('/v1/shims/tradingview/history', handleChartHistory);
app.get('/api/chart/history', handleChartHistory);

/**
 * GET /api/chart/candles
 * Returns OHLC candles as an array of objects for a given resolution.
 * Parameters: symbol, resolution (1, 5, 15, 30, 60, 240, 1440 or 1m, 5m, 15m, 1h, 4h, 1d)
 */
app.get('/api/chart/candles', async (req, res) => {
    try {
        const symbol = req.query.symbol || chartConfig.symbols[0];
        const resolution = mapResolutionToMinutes(req.query.resolution);

        const candles = await chartSyncService.getCandles(symbol, resolution);
        res.json(candles);
    } catch (err) {
        console.error('[API] Error fetching candles:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/price
 * Returns latest Gold price snapshot.
 */
app.get('/api/price', (req, res) => {
    const currentPrice = getLatestPriceData();
    if (!currentPrice) {
        return res.status(503).json({ error: 'Price data not available yet' });
    }
    res.json(currentPrice);
});

/**
 * GET /api/trades/trader/:traderAddress
 * Returns all trade IDs and full trade details for a specific trader address.
 * Optional query parameter: ?state=0 (0: ORDER, 1: OPEN, 2: CLOSED, 3: CANCELLED, 4: LIQUIDATED, 5: EMERGENCY, 6: LIQ_POS)
 */
app.get('/api/trades/trader/:traderAddress', async (req, res) => {
    try {
        const { traderAddress } = req.params;
        const { state } = req.query;

        const trades = await getTradesByTrader(traderAddress, state);

        // Categorize trade IDs by state
        const categorized = {
            orders: [],     // state 0
            open: [],       // state 1
            closed: [],     // state 2
            cancelled: [],  // state 3
            liquidated: [], // state 4
            emergency: [],  // state 5
            liqPos: []      // state 6
        };

        trades.forEach((t) => {
            const tradeId = t.id.toString();
            const s = Number(t.state);

            if (s === 0) categorized.orders.push(tradeId);
            else if (s === 1) categorized.open.push(tradeId);
            else if (s === 2) categorized.closed.push(tradeId);
            else if (s === 3) categorized.cancelled.push(tradeId);
            else if (s === 4) categorized.liquidated.push(tradeId);
            else if (s === 5) categorized.emergency.push(tradeId);
            else if (s === 6) categorized.liqPos.push(tradeId);
        });

        res.json({
            trader: traderAddress,
            total: trades.length,
            categorized,
            trades
        });
    } catch (err) {
        console.error('[API] Error fetching trader trades:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/trades/max-id
 * GET /api/trades/highest-id
 * Returns the highest trade ID stored in SQLite database.
 */
app.get('/api/trades/max-id', async (req, res) => {
    try {
        const highestId = await getHighestTradeIdFromDb();
        res.json({ maxTradeId: highestId });
    } catch (err) {
        console.error('[API] Error fetching max trade ID:', err.message);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/trades/highest-id', async (req, res) => {
    try {
        const highestId = await getHighestTradeIdFromDb();
        res.json({ maxTradeId: highestId });
    } catch (err) {
        console.error('[API] Error fetching max trade ID:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/trades/range
 * Returns all trade details for a specific ID range (from start to end inclusive).
 * Query parameters: ?from=200&to=300 (or ?start=200&end=300)
 */
app.get('/api/trades/range', async (req, res) => {
    try {
        const startId = req.query.from || req.query.start || 1;
        const endId = req.query.to || req.query.end || startId;

        const trades = await getTradesByRangeFromDb(startId, endId);
        res.json({
            from: Number(startId),
            to: Number(endId),
            count: trades.length,
            trades
        });
    } catch (err) {
        console.error('[API] Error fetching trades range:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/trades/:tradeId
 * Returns detailed info for a specific trade by ID.
 * Checks SQLite DB first; if missing, falls back to fetching from blockchain.
 */
app.get('/api/trades/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        let trade = await getTradeByIdFromDb(tradeId);

        if (!trade) {
            console.log(`[API] Trade ID ${tradeId} not in DB. Attempting on-chain fetch...`);
            trade = await fetchAndSaveTradeById(tradeId);
            if (trade) {
                trade = await getTradeByIdFromDb(tradeId);
            }
        }

        if (!trade) {
            return res.status(404).json({ error: `Trade ID ${tradeId} not found` });
        }

        res.json(trade);
    } catch (err) {
        console.error('[API] Error fetching trade by ID:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/volume
 * GET /api/protocol/volume
 * Returns protocol volume stats for 24h, 7d, and All-Time (longs, shorts, total in 10^6 units).
 */
const handleProtocolVolume = async (req, res) => {
    try {
        const volumes = await getProtocolVolumes();
        res.json(volumes);
    } catch (err) {
        console.error('[API] Error fetching protocol volume:', err.message);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/volume', handleProtocolVolume);
app.get('/api/protocol/volume', handleProtocolVolume);

/**
 * GET /api/volume/trader/:traderAddress
 * GET /api/trader/volume/:traderAddress
 * Returns 24h, 7d, and All-Time volume metrics for a specific trader.
 */
const handleTraderVolume = async (req, res) => {
    try {
        const { traderAddress } = req.params;
        const volumes = await getTraderVolumes(traderAddress);
        res.json(volumes);
    } catch (err) {
        console.error('[API] Error fetching trader volume:', err.message);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/volume/trader/:traderAddress', handleTraderVolume);
app.get('/api/trader/volume/:traderAddress', handleTraderVolume);

/**
 * GET /api/snapshot
 * GET /api/asset/snapshot
 * Returns latest AssetSnapshot cached in RAM.
 */
app.get('/api/snapshot', async (req, res) => {
    let snapshot = getCachedSnapshot();
    if (!snapshot) {
        snapshot = await fetchAndCacheAllSnapshots();
    }
    if (!snapshot) {
        return res.status(503).json({ error: 'Asset snapshots not cached or unavailable yet' });
    }
    res.json(snapshot);
});
app.get('/api/asset/snapshot', async (req, res) => {
    let snapshot = getCachedSnapshot();
    if (!snapshot) {
        snapshot = await fetchAndCacheAllSnapshots();
    }
    if (!snapshot) {
        return res.status(503).json({ error: 'Asset snapshots not cached or unavailable yet' });
    }
    res.json(snapshot);
});

/**
 * GET /api/pyth/price-differences
 * GET /api/price-differences
 * Reads and sends the saved Pyth price differences JSON file directly from disk.
 */
const handlePriceDifferences = async (req, res) => {
    try {
        let fileData = getSavedPriceDifferences();
        if (!fileData) {
            fileData = await fetchAndSavePriceDifferences();
        }
        if (!fileData) {
            return res.status(503).json({ error: 'Pyth price differences data not available yet' });
        }
        res.json(fileData);
    } catch (err) {
        console.error('[API] Error serving price differences file:', err.message);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/pyth/price-differences', handlePriceDifferences);
app.get('/api/price-differences', handlePriceDifferences);

/**
 * GET /api/vault/metrics
 * GET /api/lp/metrics
 * Returns historical LP Vault metrics from SQLite database.
 * Query Parameters:
 *   - timeframe: '1m', '5m', '15m', '1h', '4h', '1d' (default '1m')
 *   - from: Unix timestamp in seconds (default 0 for all history)
 */
const handleVaultMetricsHistory = async (req, res) => {
    try {
        const timeframe = req.query.timeframe || req.query.resolution || '1m';
        const fromTimestamp = req.query.from ? Number(req.query.from) : 0;

        const history = await getVaultMetricsHistory(timeframe, fromTimestamp);
        res.json({
            count: history.length,
            timeframe,
            from: fromTimestamp,
            data: history
        });
    } catch (err) {
        console.error('[API] Error fetching vault metrics history:', err.message);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/vault/metrics', handleVaultMetricsHistory);
app.get('/api/lp/metrics', handleVaultMetricsHistory);

/**
 * GET /api/tee-proof
 * GET /api/proof
 * GET /proof
 * Returns signed EIP-191 RiskProof struct for BrokexCore openMarketPosition contract call
 */
const { fetchTeeRiskProof } = require('./service/executionEngine');
const handleTeeProof = async (req, res) => {
    try {
        const assetHash = req.query.assetHash || process.env.GOLD_ASSET_HASH || process.env.GOLD_FEED_ID;
        const proof = await fetchTeeRiskProof(assetHash);
        res.json({
            assetHash: proof.assetHash,
            maxOILong: proof.maxOILong.toString(),
            maxOIShort: proof.maxOIShort.toString(),
            spreadLong: proof.spreadLong.toString(),
            spreadShort: proof.spreadShort.toString(),
            timestamp: proof.timestamp.toString(),
            sig: proof.sig
        });
    } catch (err) {
        console.error('[API] Error generating TEE proof:', err.message);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/tee-proof', handleTeeProof);
app.get('/api/proof', handleTeeProof);
app.get('/proof', handleTeeProof);

/**
 * GET /api/tee-info
 * GET /info
 * Proxy vers https://tee.brokex.trade/info
 */
const handleTeeInfo = async (req, res) => {
    try {
        const response = await fetch('https://tee.brokex.trade/info');
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error('[API] Error fetching TEE info:', err.message);
        res.status(500).json({ error: err.message });
    }
};

app.get('/api/tee-info', handleTeeInfo);
app.get('/info', handleTeeInfo);

/**
 * GET /
 * GET /api
 * Page d'accueil / Root documentation endpoint
 */
const fs = require('fs');
const path = require('path');
const docPath = path.resolve(__dirname, 'api_endpoints_doc.md');

app.get(['/', '/api'], (req, res) => {
    try {
        let markdown = '';
        if (fs.existsSync(docPath)) {
            markdown = fs.readFileSync(docPath, 'utf8');
        }

        // Remplacer le host par la vraie URL d'accès si disponible
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // Si la requête provient d'un navigateur web (Accept: text/html)
        if (req.accepts('html')) {
            const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brokex API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-dark.min.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
        }
        @media (max-width: 767px) {
            body {
                padding: 15px;
            }
        }
        .header-banner {
            background: linear-gradient(135deg, #1f6beb 0%, #0969da 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .header-banner h1 {
            margin: 0 0 8px 0;
            font-size: 28px;
            border: none;
        }
        .header-banner p {
            margin: 0;
            opacity: 0.9;
            font-size: 15px;
        }
    </style>
</head>
<body>
    <div class="header-banner">
        <h1>Brokex X Flare API</h1>
        <p>Base URL: <code>${baseUrl}</code></p>
    </div>
    <div id="content" class="markdown-body"></div>
    <script>
        const rawMarkdown = ${JSON.stringify(markdown)};
        document.getElementById('content').innerHTML = marked.parse(rawMarkdown);
    </script>
</body>
</html>`;
            return res.send(htmlContent);
        }

        // Sinon renvoyer au format JSON (pour curl / appels API)
        res.json({
            title: "Brokex Backend API",
            baseUrl: baseUrl,
            documentation: markdown,
            endpoints: [
                { method: "GET", path: "/info", description: "Proxy TEE info (https://tee.brokex.trade/info)" },
                { method: "GET", path: "/api/volume", description: "Métriques de volume 24h, 7d et All-time" },
                { method: "GET", path: "/api/volume/trader/:address", description: "Volume par trader" },
                { method: "GET", path: "/api/snapshot", description: "Snapshot RAM des actifs (BrokexLens)" },
                { method: "GET", path: "/api/chart/candles", description: "Bougies OHLC" },
                { method: "GET", path: "/v1/shims/tradingview/history", description: "Historique UDF TradingView" },
                { method: "GET", path: "/v1/shims/tradingview/streaming", description: "Flux temps réel SSE prix" },
                { method: "GET", path: "/api/price-differences", description: "Variations de prix Pyth Benchmarks" },
                { method: "GET", path: "/api/trades/trader/:address", description: "Liste des trades d'un trader" },
                { method: "GET", path: "/api/trades/:id", description: "Détails d'un trade" },
                { method: "GET", path: "/api/proof", description: "Signatures EIP-191 RiskProof TEE" },
                { method: "GET", path: "/api/vault/metrics", description: "Métriques historiques du Vault/LP" }
            ]
        });
    } catch (err) {
        console.error('[API] Error rendering root documentation:', err.message);
        res.status(500).json({ error: err.message });
    }
});



async function main() {
    console.log('[Backend] Starting Brokex Backend Service...');

    // Start background RAM polling for Asset Snapshot (every 10s)
    startSnapshotCron(10000);

    // Start background cron for Pyth Price Differences (saved to disk every 5 minutes)
    startPythBenchmarkCron(5 * 60 * 1000);

    // Start background cron for LP withdrawal queue (checks every 10 minutes)
    startWithdrawalCron(10 * 60 * 1000);

    // Start background cron for LP Vault metrics (saved to DB every 1 minute)
    startVaultMetricsCron(60 * 1000);

    // 1. Start HTTP API Server
    app.listen(PORT, () => {
        console.log(`[Backend] HTTP REST, Streaming & Chart API listening on port ${PORT}`);
    });

    // 2. Perform startup sync for missing trades by ID
    await syncMissingTradesOnStartup();

    // 3. Start Pyth Chart Sync Service (historical OHLC candles & multi-timeframe generation)
    chartSyncService.start().catch(err => {
        console.error('[Backend] ChartSync error:', err.message);
    });

    // 4. Start WSS price watching (FTSO v2) and automated trade execution engine
    watchFeedPrice(process.env.GOLD_FEED_ID, 2000, async (priceData) => {
        await evaluateAndExecuteTrades(priceData);
    });

    // 5. Start WSS live event listener for TradeEvent
    listenTradeEvents();

    // 6. Set up 10-minute recurring job to update active trades, refresh snapshots & process LP withdrawals
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    setInterval(async () => {
        await updateActiveTradesJob();
        await fetchAndCacheAllSnapshots();
        await checkAndProcessWithdrawals();
    }, TEN_MINUTES_MS);

    console.log('[Backend] All services running successfully.');
}

process.on('uncaughtException', (err) => {
    console.error('[Backend] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Backend] Unhandled Rejection at:', promise, 'reason:', reason);
});

main();
