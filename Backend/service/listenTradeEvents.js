require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexCoreAbi = require('../abi/BrokexCore.json');
const { fetchAndSaveTradeById } = require('./tradeService');

// Configuration from .env
const wssUrl = process.env.COSTON2_WSS_URL || 'wss://coston2-api.flare.network/ext/C/ws';
const coreAddress = process.env.BROKEX_CORE_ADDRESS;

if (!coreAddress || coreAddress === '0x0000000000000000000000000000000000000000') {
    console.warn("Warning: BROKEX_CORE_ADDRESS is not properly configured in .env file");
}

let isReconnecting = false;
let activeProvider = null;
let activeContract = null;

/**
 * Listens for TradeEvent on BrokexCore using WebSocketProvider with automatic reconnection on disconnect or error.
 */
function listenTradeEvents() {
    if (isReconnecting) return;

    console.log(`[TradeListener] Connecting to WebSocket RPC: ${wssUrl}...`);

    try {
        activeProvider = new ethers.WebSocketProvider(wssUrl);
        activeContract = new ethers.Contract(
            coreAddress,
            brokexCoreAbi.abi || brokexCoreAbi,
            activeProvider
        );

        console.log(`[TradeListener] Listening for TradeEvent on contract: ${coreAddress}...`);

        activeContract.on('TradeEvent', async (tradeId, event) => {
            const idStr = tradeId.toString();
            console.log(`[TradeListener] TradeEvent detected for Trade ID: ${idStr}`);
            
            try {
                // Automatically fetch full trade details and save to SQLite DB
                await fetchAndSaveTradeById(idStr);
                
                // Refresh RAM asset snapshots immediately when a trade changes state (open, close, execute)
                const { fetchAndCacheAllSnapshots } = require('./snapshotService');
                fetchAndCacheAllSnapshots().catch(() => {});
            } catch (err) {
                console.error(`[TradeListener] Error processing Trade ID ${idStr}:`, err.message);
            }
        });

        // Function to handle socket disconnect and auto-reconnect
        const handleDisconnect = (reason) => {
            if (isReconnecting) return;
            isReconnecting = true;

            console.warn(`[TradeListener] WebSocket connection lost (${reason}). Reconnecting in 3 seconds...`);

            try {
                if (activeContract) activeContract.removeAllListeners();
                if (activeProvider) activeProvider.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }

            setTimeout(() => {
                isReconnecting = false;
                listenTradeEvents();
            }, 3000);
        };

        // Attach event listeners for socket closing or errors
        if (activeProvider.websocket) {
            activeProvider.websocket.on('close', () => handleDisconnect('Socket Closed'));
            activeProvider.websocket.on('error', (err) => handleDisconnect(`Socket Error: ${err.message}`));
        }

        activeProvider.on('error', (err) => {
            handleDisconnect(`Provider Error: ${err.message}`);
        });

    } catch (err) {
        console.error('[TradeListener] Failed to initialize WebSocketProvider:', err.message);
        setTimeout(() => {
            isReconnecting = false;
            listenTradeEvents();
        }, 5000);
    }
}

// CLI execution example: `node service/listenTradeEvents.js`
if (require.main === module) {
    listenTradeEvents();
}

module.exports = {
    listenTradeEvents
};
