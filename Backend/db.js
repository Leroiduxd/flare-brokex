const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connection / creation of local SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening SQLite DB:', err.message);
    } else {
        console.log('[DB] Connected to SQLite database (database.sqlite)');
    }
});

// Initialization of trades table matching Trade struct
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY,
            trader TEXT NOT NULL,
            assetHash TEXT NOT NULL,
            state INTEGER NOT NULL,
            direction INTEGER NOT NULL,
            orderType INTEGER NOT NULL,
            margin TEXT NOT NULL,
            leverage TEXT NOT NULL,
            targetPrice TEXT NOT NULL,
            openPrice TEXT NOT NULL,
            closePrice TEXT NOT NULL,
            stopLoss TEXT NOT NULL,
            takeProfit TEXT NOT NULL,
            openTimestamp TEXT NOT NULL,
            closeTimestamp TEXT NOT NULL,
            borrowFee TEXT NOT NULL,
            liquidationPrice TEXT DEFAULT '0'
        )
    `, (err) => {
        if (err) {
            console.error('Error creating trades table:', err.message);
        } else {
            console.log('[DB] "trades" table initialized successfully.');
        }
    });

    // Ensure migration for existing databases
    db.run(`ALTER TABLE trades ADD COLUMN liquidationPrice TEXT DEFAULT '0'`, (err) => {
        // Ignore error if column already exists
    });

    // Initialization of vault_metrics table
    db.run(`
        CREATE TABLE IF NOT EXISTS vault_metrics (
            timestamp INTEGER PRIMARY KEY,
            lastKnownPrice TEXT NOT NULL,
            totalSupply TEXT NOT NULL,
            totalVaultUSDC TEXT NOT NULL,
            totalLockedCapital TEXT NOT NULL,
            freeCapital TEXT NOT NULL,
            totalPendingLP TEXT NOT NULL,
            requiredFreeUSDC TEXT NOT NULL,
            pendingRequestsCount INTEGER NOT NULL,
            unrealizedPnL TEXT NOT NULL,
            vaultUsageBps TEXT NOT NULL,
            openInterestLong TEXT DEFAULT '0',
            openInterestShort TEXT DEFAULT '0',
            avgEntryPriceLong TEXT DEFAULT '0',
            avgEntryPriceShort TEXT DEFAULT '0',
            goldOpenInterestLong TEXT DEFAULT '0',
            goldOpenInterestShort TEXT DEFAULT '0',
            xrpOpenInterestLong TEXT DEFAULT '0',
            xrpOpenInterestShort TEXT DEFAULT '0',
            totalBorrowFees TEXT DEFAULT '0',
            lpTokenPrice TEXT DEFAULT '1000000'
        )
    `, (err) => {
        if (err) {
            console.error('Error creating vault_metrics table:', err.message);
        } else {
            console.log('[DB] "vault_metrics" table initialized successfully.');
        }
    });

    // Ensure migrations for vault_metrics table
    db.run(`ALTER TABLE vault_metrics ADD COLUMN openInterestLong TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN openInterestShort TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN avgEntryPriceLong TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN avgEntryPriceShort TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN goldOpenInterestLong TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN goldOpenInterestShort TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN xrpOpenInterestLong TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN xrpOpenInterestShort TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN totalBorrowFees TEXT DEFAULT '0'`, () => {});
    db.run(`ALTER TABLE vault_metrics ADD COLUMN lpTokenPrice TEXT DEFAULT '1000000'`, () => {});

    // Initialization of faucet_claims table
    db.run(`
        CREATE TABLE IF NOT EXISTS faucet_claims (
            address TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            txHash TEXT NOT NULL,
            amount TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Error creating faucet_claims table:', err.message);
        } else {
            console.log('[DB] "faucet_claims" table initialized successfully.');
        }
    });
});

module.exports = db;
