const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("==================================================");
  console.log("    BROKEX PROTOCOL DEPLOYMENT ON COSTON2");
  console.log("==================================================");
  console.log("Deployer Address:", deployer ? deployer.address : "N/A");

  // Adresses canoniques Flare Coston2 (Testnet)
  const FTSO_V2_COSTON2 = "0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d";
  const TEE_EXTENSION_REGISTRY_COSTON2 = "0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE";

  // 1. Déploiement de MockUSDC (6 décimales)
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("1. MockUSDC Deployed at:", usdcAddress);

  // 2. Déploiement de BrokexVault (bUSDC)
  const BrokexVault = await hre.ethers.getContractFactory("BrokexVault");
  const vault = await BrokexVault.deploy(usdcAddress, "Brokex LP USDC", "bUSDC");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("2. BrokexVault Deployed at:", vaultAddress);

  // 3. Déploiement de BrokexCore
  const BrokexCore = await hre.ethers.getContractFactory("BrokexCore");
  const core = await BrokexCore.deploy(
    usdcAddress,
    vaultAddress,
    FTSO_V2_COSTON2,
    TEE_EXTENSION_REGISTRY_COSTON2,
    deployer.address, // Registre TEE temporaire
    deployer.address  // TEE Signer initial
  );
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log("3. BrokexCore Deployed at:", coreAddress);

  // 4. Déploiement de BrokexLens (Agrégateur Read-Only)
  const BrokexLens = await hre.ethers.getContractFactory("BrokexLens");
  const lens = await BrokexLens.deploy(coreAddress, vaultAddress);
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();
  console.log("4. BrokexLens Deployed at:", lensAddress);

  // 5. Liaison Vault -> Core
  const txLink = await vault.setCoreContract(coreAddress);
  await txLink.wait();
  console.log("5. Vault linked to Core successfully.");

  // 6. Listing de l'Actif OR (GOLD/USD)
  const goldAssetHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD/USD"));
  const goldFtsoFeedId = "0x01504158472f555344000000000000000000000000";

  const goldConfig = {
    ftsoFeedId:         goldFtsoFeedId,
    minLeverage:        1,
    maxLeverage:        100,                 // Levier Max 100x
    minTradeSize:       1000000,             // 1 USDC
    commissionBps:      1000,                // 0.1%
    borrowRateHourly:   20,                  // 0.002% par heure
    profitCap:          100000,              // Max Profit 10%
    executionTolerance: 500,                 // 0.05%
    maxProofAge:        60,                  // 60s
    maxTraderOI:        "1000000000000",     // 1,000,000 USDC
    maxGlobalOI:        "10000000000000",    // 10,000,000 USDC
    lockedCapitalBps:   50000,               // Locked Capital 5%
    liqThresholdBps:    950000,              // Seuil Liquidation 95%
    listed:             true,
    frozen:             false
  };

  const txList = await core.listAsset(goldAssetHash, goldFtsoFeedId, goldConfig);
  await txList.wait();
  console.log("6. Asset GOLD/USD (XAU/USD) listed successfully:");
  console.log("   - Max Leverage: 100x");
  console.log("   - Liquidation Threshold: 95%");
  console.log("   - Borrow Fee: 0.002% / heure");
  console.log("   - Locked Capital Bps: 5%");
  console.log("   - Profit Cap: 10%");

  // 7. Dépôt de 10,000 USDC dans le Vault
  const depositAmount = hre.ethers.parseUnits("10000", 6); // 10,000 USDC (6 décimales)
  const txApprove = await usdc.approve(vaultAddress, depositAmount);
  await txApprove.wait();
  console.log("7a. Approved 10,000 USDC for Vault.");

  const txDeposit = await vault.deposit(depositAmount);
  await txDeposit.wait();
  console.log("7b. Deposited 10,000 USDC into BrokexVault successfully.");

  const lpBalance = await vault.balanceOf(deployer.address);
  console.log("   - Deployer bUSDC LP Balance:", hre.ethers.formatUnits(lpBalance, 6));

  console.log("==================================================");
  console.log("       PROTOCOL DEPLOYMENT COMPLETED!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

