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

  // USDC fourni
  const usdcAddress = "0xfDA686186510208C4E91028Fed671Dd9c35111d3";
  console.log("Using USDC at:", usdcAddress);

  // 1. Déploiement de BrokexVault (bUSDC)
  const BrokexVault = await hre.ethers.getContractFactory("BrokexVault");
  const vault = await BrokexVault.deploy(usdcAddress, "Brokex LP USDC", "bUSDC");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("1. BrokexVault Deployed at:", vaultAddress);

  // 2. Déploiement de BrokexCore
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
  console.log("2. BrokexCore Deployed at:", coreAddress);

  // 3. Déploiement de BrokexLens (Agrégateur Read-Only)
  const BrokexLens = await hre.ethers.getContractFactory("BrokexLens");
  const lens = await BrokexLens.deploy(coreAddress, vaultAddress);
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();
  console.log("3. BrokexLens Deployed at:", lensAddress);

  // 4. Liaison Vault -> Core
  const txLink = await vault.setCoreContract(coreAddress);
  await txLink.wait();
  console.log("4. Vault linked to Core successfully.");

  console.log("==================================================");
  console.log("       PROTOCOL DEPLOYMENT COMPLETED!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
