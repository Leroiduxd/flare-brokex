require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');

module.exports = {
  symbols: [
    process.env.PYTH_GOLD_SYMBOL || "Metal.XAU/USD",
    process.env.PYTH_XRP_SYMBOL || "Crypto.XRP/USD"
  ],

  pythFeedId: process.env.PYTH_GOLD_FEED_ID || "0x765d2ba906dbc32ca17cc11f5310a4386b00731867d60e4144d9f8e5ee5d5060",
  baseUrl: process.env.PYTH_BENCHMARKS_URL || "https://benchmarks.pyth.network",

  historyStartDate: "2025-01-01",

  generatedTimeframes: ["5", "15", "30", "60", "240", "1440"],

  apiResponse: {
    defaultDays: 7,
    maxDays: 365
  },

  // Pyth API Rate Limits & Retries
  api: {
    maxRequests: 1,
    windowSeconds: 10,
    retry429DelayMs: 20000
  },

  storage: {
    basePath: path.resolve(__dirname, '../data/chart')
  }
};
