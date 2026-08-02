require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const brokexVaultAbi = require('../abi/BrokexVault.json');
const brokexCoreAbi = require('../abi/BrokexCore.json');

const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const provider = new ethers.JsonRpcProvider(rpcUrl);

const vaultAddress = process.env.BROKEX_VAULT_ADDRESS;
const coreAddress = process.env.BROKEX_CORE_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

let wallet = null;
let vaultContract = null;
let coreContract = null;

if (vaultAddress && coreAddress) {
    const abi = brokexVaultAbi.abi || brokexVaultAbi;
    if (privateKey && privateKey !== 'your_private_key_here') {
        const formattedPk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        wallet = new ethers.Wallet(formattedPk, provider);
        vaultContract = new ethers.Contract(vaultAddress, abi, wallet);
    } else {
        vaultContract = new ethers.Contract(vaultAddress, abi, provider);
    }
    const coreAbi = brokexCoreAbi.abi || brokexCoreAbi;
    coreContract = new ethers.Contract(coreAddress, coreAbi, provider);
}

// In-memory cache for withdrawal requests
let requestsCache = [];
let queueHeadVal = 0;
let queueTailVal = 0;
let biggestPendingRequest = null;
let isSyncing = false;
let isProcessing = false;

/**
 * Synchronise les demandes de retrait depuis la blockchain.
 * Ne relit qu'à partir de `queueHead` (les précédentes ayant été traitées) jusqu'à `queueTail`.
 */
async function syncWithdrawalQueue() {
    if (isSyncing) return;
    isSyncing = true;

    try {
        if (!vaultContract) return;

        const [head, tail] = await Promise.all([
            vaultContract.queueHead().catch(() => 0n),
            vaultContract.queueTail().catch(() => 0n)
        ]);

        queueHeadVal = Number(head);
        queueTailVal = Number(tail);

        if (queueTailVal === 0) {
            requestsCache = [];
            biggestPendingRequest = null;
            return;
        }

        const newCache = [];
        let maxLp = 0n;
        let maxReq = null;

        // Lecture par lots de 20 depuis queueHead jusqu'à queueTail
        const batchSize = 20;
        for (let i = queueHeadVal; i < queueTailVal; i += batchSize) {
            const promises = [];
            const end = Math.min(i + batchSize, queueTailVal);

            for (let id = i; id < end; id++) {
                promises.push(
                    vaultContract.withdrawalQueue(id).then(req => ({
                        id: id,
                        user: req.user,
                        userLower: req.user.toLowerCase(),
                        lpAmountRemaining: req.lpAmountRemaining.toString(),
                        lpAmountRaw: req.lpAmountRemaining,
                        isPending: id >= queueHeadVal && req.lpAmountRemaining > 0n
                    })).catch(() => null)
                );
            }

            const batch = await Promise.all(promises);
            for (const item of batch) {
                if (item) {
                    newCache.push(item);
                    if (item.isPending && item.lpAmountRaw > maxLp) {
                        maxLp = item.lpAmountRaw;
                        maxReq = item;
                    }
                }
            }
        }

        requestsCache = newCache;
        biggestPendingRequest = maxReq;

        console.log(`[WithdrawalService] Queue sync complete: ${requestsCache.length} pending request(s) cached. (Head: ${queueHeadVal}, Tail: ${queueTailVal})`);
    } catch (err) {
        console.error('[WithdrawalService] Error syncing queue:', err.message);
    } finally {
        isSyncing = false;
    }
}

/**
 * Checks pending LP withdrawal queue and processes them on-chain if free capital is available.
 * Reli la queue immédiatement après le traitement.
 */
async function checkAndProcessWithdrawals() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        if (!vaultContract || !coreContract) {
            console.warn('[WithdrawalService] Contracts or Wallet not properly configured in .env');
            return;
        }

        // Toujours synchroniser la queue en début de vérification
        await syncWithdrawalQueue();

        const totalPendingLP = await vaultContract.totalPendingLP();
        if (totalPendingLP === 0n) {
            return;
        }

        console.log(`[WithdrawalService] Pending LP withdrawal detected (${ethers.formatUnits(totalPendingLP, 6)} bUSDC). Checking free capital...`);

        const freeCapital = await coreContract.getFreeCapital();
        const requiredFreeUSDC = await vaultContract.getRequiredFreeUSDC();

        console.log(`[WithdrawalService] Free Capital: ${ethers.formatUnits(freeCapital, 6)} USDC | Required: ${ethers.formatUnits(requiredFreeUSDC, 6)} USDC`);

        if (freeCapital > 0n && wallet) {
            console.log('[WithdrawalService] Free capital available! Calling processWithdrawalQueue()...');
            
            const tx = await vaultContract['processWithdrawalQueue(uint256)'](10);
            console.log(`[WithdrawalService] Transaction sent: ${tx.hash}. Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            console.log(`[WithdrawalService] Withdrawal queue processed successfully in block ${receipt.blockNumber}`);

            // Resynchroniser immédiatement après l'exécution pour mettre à jour la liste
            await syncWithdrawalQueue();
        } else if (!wallet) {
            console.warn('[WithdrawalService] Read-only mode: PRIVATE_KEY non configurée pour exécuter processWithdrawalQueue()');
        } else {
            console.log('[WithdrawalService] Insufficient free capital to process withdrawals at this moment.');
        }
    } catch (err) {
        console.error('[WithdrawalService] Error processing withdrawal queue:', err.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Recherche des demandes de retrait actives pour une adresse de wallet.
 */
function getWithdrawalsByWallet(address) {
    if (!address) return { hasPending: false, requests: [] };
    const normalized = address.toLowerCase();
    const userRequests = requestsCache.filter(r => r.userLower === normalized && r.isPending);

    return {
        address,
        hasPending: userRequests.length > 0,
        count: userRequests.length,
        requests: userRequests
    };
}

/**
 * Retourne l'état complet de la queue de retrait.
 */
function getWithdrawalQueueState() {
    return {
        queueHead: queueHeadVal,
        queueTail: queueTailVal,
        pendingCount: requestsCache.length,
        biggestPendingRequest: biggestPendingRequest ? {
            id: biggestPendingRequest.id,
            user: biggestPendingRequest.user,
            lpAmountRemaining: biggestPendingRequest.lpAmountRemaining
        } : null,
        requests: requestsCache
    };
}

/**
 * Starts 10-minute cron interval for withdrawal checking
 */
function startWithdrawalCron(intervalMs = 10 * 60 * 1000) {
    checkAndProcessWithdrawals();

    setInterval(() => {
        checkAndProcessWithdrawals();
    }, intervalMs);
}

module.exports = {
    checkAndProcessWithdrawals,
    startWithdrawalCron,
    syncWithdrawalQueue,
    getWithdrawalsByWallet,
    getWithdrawalQueueState
};

