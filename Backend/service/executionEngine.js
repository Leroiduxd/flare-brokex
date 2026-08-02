require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const { getActiveTradesFromDb, fetchAndSaveTradesByIds } = require('./tradeService');
const { batchExecute, getWalletAndContract } = require('./batchExecuteService');

// Trade Constants
const STATE_ORDER      = 0;
const STATE_OPEN       = 1;
const STATE_CLOSED     = 2;
const STATE_CANCELLED  = 3;
const STATE_LIQUIDATED = 4;
const STATE_EMERGENCY  = 5;
const STATE_LIQ_POS    = 6;

const DIR_SHORT = 0;
const DIR_LONG  = 1;

const ORDER_MARKET = 0;
const ORDER_LIMIT  = 1;
const ORDER_STOP   = 2;

const REASON_MARKET     = 0;
const REASON_SL         = 1;
const REASON_TP         = 2;
const REASON_LIQ        = 3;
const REASON_EMERGENCY  = 4;
const REASON_CANCEL     = 5;
const REASON_PROFIT_CAP = 6;

// Smart contract price decimals precision (6 decimals = 1e6)
const TARGET_CONTRACT_DECIMALS = 6;

/**
 * Normalizes price from FTSO decimals (e.g. 3) to Smart Contract 6-decimals precision (1e6).
 * @param {bigint|string|number} rawValue 
 * @param {number} decimals 
 * @returns {bigint} Normalized price in 6 decimals precision
 */
function normalizeToContractPrice(rawValue, decimals) {
    const valBig = BigInt(rawValue.toString());
    const dec = Number(decimals || 3);

    if (dec < TARGET_CONTRACT_DECIMALS) {
        return valBig * (10n ** BigInt(TARGET_CONTRACT_DECIMALS - dec));
    } else if (dec > TARGET_CONTRACT_DECIMALS) {
        return valBig / (10n ** BigInt(dec - TARGET_CONTRACT_DECIMALS));
    }
    return valBig;
}

// Flag to prevent overlapping execution runs
let isProcessingExecution = false;

/**
 * Generates EIP-191 signed Risk Proof for BrokexCore using the configured Wallet (teeSigner).
 * @param {string} assetHash 
 * @returns {Promise<Object>} Formatted RiskProof struct
 */
async function fetchTeeRiskProof(assetHash) {
    try {
        const { wallet } = getWalletAndContract();

        const timestamp = Math.floor(Date.now() / 1000);
        const maxOILong = ethers.parseUnits("10000000", 6);
        const maxOIShort = ethers.parseUnits("10000000", 6);
        const spreadLong = 10;  // 0.001%
        const spreadShort = 10; // 0.001%

        const targetAssetHash = assetHash || process.env.GOLD_FEED_ID;

        const hash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256"],
                [targetAssetHash, maxOILong, maxOIShort, spreadLong, spreadShort, timestamp]
            )
        );

        const sig = await wallet.signMessage(ethers.getBytes(hash));

        return {
            assetHash: targetAssetHash,
            maxOILong,
            maxOIShort,
            spreadLong,
            spreadShort,
            timestamp,
            sig
        };
    } catch (err) {
        console.error('[ExecutionEngine] Error generating TEE Risk Proof:', err.message);
        throw err;
    }
}

/**
 * Evaluates active trades against new price update and executes pending orders / SL / TP / liquidations.
 * Normalizes incoming FTSO price to 6 decimals (1e6) to match smart contract stored prices.
 * @param {Object} priceData - Price object from WSS / FTSO (contains value, decimals, priceUSD)
 */
async function evaluateAndExecuteTrades(priceData) {
    if (isProcessingExecution) return;
    if (!priceData || !priceData.value) return;

    isProcessingExecution = true;

    try {
        const activeTrades = await getActiveTradesFromDb();
        if (activeTrades.length === 0) {
            isProcessingExecution = false;
            return;
        }

        // Convert FTSO price (decimals = 3) to Smart Contract 6-decimals format (1e6)
        const currentPriceBig = normalizeToContractPrice(priceData.value, priceData.decimals);

        const executableTradeIds = [];
        const executionReasons = [];
        const riskProofs = [];

        for (const t of activeTrades) {
            const tradeId = t.id.toString();
            const state = Number(t.state);
            const direction = Number(t.direction);
            const orderType = Number(t.orderType);

            const targetPrice = BigInt(t.targetPrice || '0');
            const openPrice = BigInt(t.openPrice || '0');
            const stopLoss = BigInt(t.stopLoss || '0');
            const takeProfit = BigInt(t.takeProfit || '0');

            let triggeredReason = null;

            // 1. Pending Orders (state = 0: STATE_ORDER)
            if (state === STATE_ORDER) {
                if (orderType === ORDER_MARKET) {
                    triggeredReason = REASON_MARKET;
                } else if (orderType === ORDER_LIMIT) {
                    if (direction === DIR_LONG && currentPriceBig <= targetPrice) {
                        triggeredReason = REASON_MARKET;
                    } else if (direction === DIR_SHORT && currentPriceBig >= targetPrice) {
                        triggeredReason = REASON_MARKET;
                    }
                } else if (orderType === ORDER_STOP) {
                    if (direction === DIR_LONG && currentPriceBig >= targetPrice) {
                        triggeredReason = REASON_MARKET;
                    } else if (direction === DIR_SHORT && currentPriceBig <= targetPrice) {
                        triggeredReason = REASON_MARKET;
                    }
                }
            }

            // 2. Open Positions (state = 1: STATE_OPEN)
            else if (state === STATE_OPEN) {
                const liqPrice = BigInt(t.liquidationPrice || '0');

                // Check Liquidation FIRST (highest priority)
                if (liqPrice > 0n) {
                    if (direction === DIR_LONG && currentPriceBig <= liqPrice) {
                        triggeredReason = REASON_LIQ;
                    } else if (direction === DIR_SHORT && currentPriceBig >= liqPrice) {
                        triggeredReason = REASON_LIQ;
                    }
                }

                // Check Take Profit (if liquidation not triggered)
                if (triggeredReason === null && takeProfit > 0n) {
                    if (direction === DIR_LONG && currentPriceBig >= takeProfit) {
                        triggeredReason = REASON_TP;
                    } else if (direction === DIR_SHORT && currentPriceBig <= takeProfit) {
                        triggeredReason = REASON_TP;
                    }
                }

                // Check Stop Loss (if liquidation and TP not triggered)
                if (triggeredReason === null && stopLoss > 0n) {
                    if (direction === DIR_LONG && currentPriceBig <= stopLoss) {
                        triggeredReason = REASON_SL;
                    } else if (direction === DIR_SHORT && currentPriceBig >= stopLoss) {
                        triggeredReason = REASON_SL;
                    }
                }
            }

            // If trade triggered for execution
            if (triggeredReason !== null) {
                console.log(`[ExecutionEngine] Trade ID ${tradeId} triggered! Reason code: ${triggeredReason}`);
                executableTradeIds.push(tradeId);
                executionReasons.push(triggeredReason);

                const proof = await fetchTeeRiskProof(t.assetHash);
                riskProofs.push(proof);
            }
        }

        // Execute batch if trades triggered
        if (executableTradeIds.length > 0) {
            console.log(`[ExecutionEngine] Executing batch of ${executableTradeIds.length} trade(s)...`);
            const receipt = await batchExecute(executableTradeIds, executionReasons, riskProofs);
            console.log(`[ExecutionEngine] Batch executed successfully in block ${receipt.blockNumber}`);

            // IMMEDIATELY update SQLite DB for executed trades so their new on-chain state (STATE_OPEN = 1 or CLOSED = 2) is stored!
            await fetchAndSaveTradesByIds(executableTradeIds);

            // Trigger withdrawal processing in case free capital was released by closing positions!
            const { checkAndProcessWithdrawals } = require('./withdrawalService');
            checkAndProcessWithdrawals().catch(() => {});
        }
    } catch (err) {
        console.error('[ExecutionEngine] Error during evaluation and execution:', err.message);
    } finally {
        isProcessingExecution = false;
    }
}

module.exports = {
    evaluateAndExecuteTrades,
    normalizeToContractPrice,
    fetchTeeRiskProof,
    STATE_ORDER,
    STATE_OPEN,
    STATE_CLOSED,
    STATE_CANCELLED,
    STATE_LIQUIDATED,
    STATE_EMERGENCY,
    STATE_LIQ_POS,
    DIR_SHORT,
    DIR_LONG,
    ORDER_MARKET,
    ORDER_LIMIT,
    ORDER_STOP,
    REASON_MARKET,
    REASON_SL,
    REASON_TP,
    REASON_LIQ,
    REASON_EMERGENCY,
    REASON_CANCEL,
    REASON_PROFIT_CAP
};
