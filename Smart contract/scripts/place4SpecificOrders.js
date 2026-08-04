const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const coreAddress = process.env.BROKEX_CORE_ADDRESS;
  const usdcAddress = "0xfDA686186510208C4E91028Fed671Dd9c35111d3";

  // ABI du Smart Contract BrokexCore
  const coreArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/BrokexCore.sol/BrokexCore.json"));
  const core = new ethers.Contract(coreAddress, coreArtifact.abi, wallet);

  // ABI ERC20 minimal pour le mock USDC
  const usdcAbi = ["function approve(address spender, uint256 amount) external returns (bool)"];
  const usdc = new ethers.Contract(usdcAddress, usdcAbi, wallet);

  const xrpHash = "0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298";
  
  const collateral = ethers.parseUnits("10", 6); // 10 USDC (6 décimales)
  const leverage = 5n;                           // Levier 5x

  // Constantes du protocole Brokex
  const DIR_SHORT = 0;
  const DIR_LONG  = 1;
  const ORDER_LIMIT = 1;
  const ORDER_STOP  = 2;

  // 1. Approbation du collateral USDC (40 USDC pour 4 ordres)
  console.log("1. Approbation des USDC pour BrokexCore...");
  const txApp = await usdc.approve(coreAddress, collateral * 4n);
  await txApp.wait();
  console.log("   --> Approbation confirmée !");

  // Définition des 4 ordres souhaités
  const orders = [
    { name: "LIMIT LONG @ $2.00",  dir: DIR_LONG,  type: ORDER_LIMIT, price: 2000000n },
    { name: "LIMIT SHORT @ $1.00", dir: DIR_SHORT, type: ORDER_LIMIT, price: 1000000n },
    { name: "STOP LONG @ $1.00",   dir: DIR_LONG,  type: ORDER_STOP,  price: 1000000n },
    { name: "STOP SHORT @ $2.00",  dir: DIR_SHORT, type: ORDER_STOP,  price: 2000000n }
  ];

  // 2. Création des ordres sur le smart contract
  console.log("\n2. Envoi des 4 ordres sur XRP...");
  for (const o of orders) {
    console.log(`   Placements de : ${o.name}...`);
    const tx = await core.createLimitOrStopOrder(
      xrpHash,    // assetHash
      o.dir,      // direction (0: SHORT, 1: LONG)
      o.type,     // orderType (1: LIMIT, 2: STOP)
      o.price,    // targetPrice (en 1e6)
      collateral, // collateral (USDC)
      leverage,   // levier
      0,          // stopLoss (0 si pas défini)
      0           // takeProfit (0 si pas défini)
    );
    console.log(`   Transaction envoyée (${o.name}):`, tx.hash);
    await tx.wait();
    console.log(`   --> ${o.name} placé avec succès !`);
  }

  console.log("\n==================================================");
  console.log("    LES 4 ORDRES ONT ÉTÉ CRÉÉS SUR LA BLOCKCHAIN  ");
  console.log("==================================================");
}

main().catch(err => {
  console.error("Erreur lors de la création des ordres :", err);
  process.exit(1);
});
