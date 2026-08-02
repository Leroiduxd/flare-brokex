const db = require('../db');
const { ethers } = require('ethers');

const rpcUrl = process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const USDC_ADDRESS = process.env.USDC_ADDRESS || '0xfDA686186510208C4E91028Fed671Dd9c35111d3';

// ABI minimal ERC20 pour transfer & balanceOf & decimals
const minErc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

/**
 * Vérifie si l'adresse a déjà réclamé le faucet.
 * @param {string} address 
 * @returns {Promise<Object|null>}
 */
function getFaucetClaim(address) {
    return new Promise((resolve, reject) => {
        const normalizedAddr = address.toLowerCase();
        db.get('SELECT * FROM faucet_claims WHERE LOWER(address) = ?', [normalizedAddr], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

/**
 * Enregistre la réclamation d'un wallet.
 * @param {string} address 
 * @param {string} txHash 
 * @param {string} amount 
 * @returns {Promise<void>}
 */
function recordFaucetClaim(address, txHash, amount) {
    return new Promise((resolve, reject) => {
        const normalizedAddr = address.toLowerCase();
        const now = Math.floor(Date.now() / 1000);
        db.run(
            'INSERT INTO faucet_claims (address, timestamp, txHash, amount) VALUES (?, ?, ?, ?)',
            [normalizedAddr, now, txHash, amount],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

/**
 * Distribue 1000 USDC à l'adresse spécifiée (1 seule fois par adresse).
 * @param {string} targetAddress 
 * @returns {Promise<Object>} Détails de la transaction (txHash, amount)
 */
async function claimFaucet(targetAddress) {
    if (!targetAddress || !ethers.isAddress(targetAddress)) {
        throw new Error('Adresse EVM invalide.');
    }

    const normalizedAddress = targetAddress.toLowerCase();

    // 1. Vérifier si l'adresse a déjà réclamé
    const existingClaim = await getFaucetClaim(normalizedAddress);
    if (existingClaim) {
        throw new Error('Ce wallet a déjà réclamé ses 1000 USDC Faucet.');
    }

    // 2. Initialiser le wallet / provider
    const pk = process.env.PRIVATE_KEY;
    if (!pk || pk === 'your_private_key_here') {
        throw new Error('PRIVATE_KEY non configurée sur le serveur.');
    }

    const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(formattedPk, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, minErc20Abi, wallet);

    // 3. Récupérer les décimales (défaut 6 décimales pour USDC)
    let decimals = 6;
    try {
        decimals = Number(await usdcContract.decimals());
    } catch (e) {
        console.warn('[Faucet] Impossible de lire les décimales USDC, fallback sur 6:', e.message);
    }

    const amountFormatted = "1000";
    const amountBigInt = ethers.parseUnits(amountFormatted, decimals);

    // 4. Vérifier le solde du Faucet (portefeuille du serveur)
    const balance = await usdcContract.balanceOf(wallet.address);
    if (balance < amountBigInt) {
        throw new Error('Le réservoir Faucet du serveur n\'a plus assez d\'USDC.');
    }

    // 5. Exécuter le transfert on-chain
    console.log(`[Faucet] Envoi de 1000 USDC à ${targetAddress}...`);
    const tx = await usdcContract.transfer(targetAddress, amountBigInt);
    const receipt = await tx.wait();

    // 6. Enregistrer dans SQLite
    await recordFaucetClaim(normalizedAddress, tx.hash, amountFormatted);

    console.log(`[Faucet] Succès ! TxHash: ${tx.hash}`);

    return {
        success: true,
        address: targetAddress,
        amount: amountFormatted,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
    };
}

module.exports = {
    claimFaucet,
    getFaucetClaim
};
