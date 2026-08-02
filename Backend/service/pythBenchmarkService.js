const fs = require('fs');
const path = require('path');
const https = require('https');

// Target file path for local persistence
const DATA_FILE_PATH = path.join(__dirname, '../data/pyth_price_differences.json');

// Exact list of requested target Pyth symbols
const TARGET_SYMBOLS = [
    'Crypto.BTC/USD',         // BTC
    'Crypto.ETH/USD',         // ETH
    'Crypto.XRP/USD',         // XRP
    'FX.EUR/USD',             // EUR/USD
    'FX.GBP/USD',             // GBP/USD
    'FX.USD/JPY',             // JPY/USD (USD/JPY)
    'Commodities.USOILSPOT',   // Pétrole (Oil)
    'Metal.XAU/USD',          // Or (Gold / XAU)
    'Metal.XAG/USD',          // Argent (Silver / XAG)
    'Equity.US.AAPL/USD',     // Apple
    'Equity.US.TSLA/USD',     // Tesla
    'Equity.US.META/USD',     // Meta
    'Equity.US.NVDA/USD',     // Nvidia
    'Equity.US.GOOG/USD',     // Google
    'Equity.US.AMZN/USD',     // Amazon
    'Equity.US.MSFT/USD',     // Microsoft
    'Crypto.SOL/USD'          // Solana
];

// Friendly alias mapping
const SYMBOL_ALIASES = {
    'Crypto.BTC/USD': 'BTC',
    'Crypto.ETH/USD': 'ETH',
    'Crypto.XRP/USD': 'XRP',
    'FX.EUR/USD': 'EURUSD',
    'FX.GBP/USD': 'GBPUSD',
    'FX.USD/JPY': 'JPYUSD',
    'Commodities.USOILSPOT': 'PETROLE',
    'Metal.XAU/USD': 'GOLD',
    'Metal.XAG/USD': 'SILVER',
    'Equity.US.AAPL/USD': 'APPLE',
    'Equity.US.TSLA/USD': 'TESLA',
    'Equity.US.META/USD': 'META',
    'Equity.US.NVDA/USD': 'NVIDIA',
    'Equity.US.GOOG/USD': 'GOOGLE',
    'Equity.US.AMZN/USD': 'AMAZON',
    'Equity.US.MSFT/USD': 'MICROSOFT',
    'Crypto.SOL/USD': 'SOLANA'
};

/**
 * Fetches price differences from Pyth API, filters target assets, and writes directly to file.
 */
function fetchAndSavePriceDifferences() {
    return new Promise((resolve, reject) => {
        const url = 'https://benchmarks.pyth.network/v1/price_differences/';

        https.get(url, (res) => {
            let body = '';

            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        throw new Error(`HTTP Error Status: ${res.statusCode}`);
                    }

                    const json = JSON.parse(body);

                    // Filter only requested symbols
                    const filteredData = json
                        .filter(item => TARGET_SYMBOLS.includes(item.symbol))
                        .map(item => ({
                            alias: SYMBOL_ALIASES[item.symbol] || item.symbol,
                            symbol: item.symbol,
                            hour_price_diff_decimal: item.hour_price_diff_decimal,
                            day_price_diff_decimal: item.day_price_diff_decimal,
                            week_price_diff_decimal: item.week_price_diff_decimal,
                            sparkline: item.sparkline
                        }));

                    const payload = {
                        fetchedAt: Math.floor(Date.now() / 1000),
                        count: filteredData.length,
                        data: filteredData
                    };

                    // Ensure directory exists
                    const dir = path.dirname(DATA_FILE_PATH);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    // Save directly to disk (file)
                    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
                    console.log(`[PythBenchmarkService] Saved ${filteredData.length} price differences to file: ${DATA_FILE_PATH}`);
                    
                    resolve(payload);
                } catch (err) {
                    console.error('[PythBenchmarkService] Failed to process API data:', err.message);
                    reject(err);
                }
            });
        }).on('error', (err) => {
            console.error('[PythBenchmarkService] HTTP request error:', err.message);
            reject(err);
        });
    });
}

/**
 * Reads saved data file from disk.
 */
function getSavedPriceDifferences() {
    try {
        if (!fs.existsSync(DATA_FILE_PATH)) {
            return null;
        }
        const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf8');
        return JSON.parse(fileContent);
    } catch (err) {
        console.error('[PythBenchmarkService] Error reading file from disk:', err.message);
        return null;
    }
}

/**
 * Starts periodic cron to fetch and save to file every X minutes (default 5 mins)
 */
function startPythBenchmarkCron(intervalMs = 5 * 60 * 1000) {
    // Initial fetch
    fetchAndSavePriceDifferences().catch(() => {});

    // Periodic loop
    setInterval(() => {
        fetchAndSavePriceDifferences().catch(() => {});
    }, intervalMs);
}

module.exports = {
    fetchAndSavePriceDifferences,
    getSavedPriceDifferences,
    startPythBenchmarkCron,
    DATA_FILE_PATH
};
