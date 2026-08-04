const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("==================================================");
  console.log("    BROKEX PROTOCOL DIRECT DEPLOYMENT ON COSTON2");
  console.log("==================================================");
  console.log("Deployer Address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "CFLR");

  const FTSO_V2_COSTON2 = "0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d";
  const TEE_EXTENSION_REGISTRY_COSTON2 = "0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE";
  const usdcAddress = "0xfDA686186510208C4E91028Fed671Dd9c35111d3";

  // Read artifacts
  const vaultArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/BrokexVault.sol/BrokexVault.json"));
  const coreArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/BrokexCore.sol/BrokexCore.json"));
  const lensArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/BrokexLens.sol/BrokexLens.json"));

  // 1. Vault
  console.log("\n1. Deploying BrokexVault...");
  const VaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const vault = await VaultFactory.deploy(usdcAddress, "Brokex LP USDC", "bUSDC");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("--> BrokexVault Deployed at:", vaultAddress);

  // 2. Core
  console.log("\n2. Deploying BrokexCore...");
  const CoreFactory = new ethers.ContractFactory(coreArtifact.abi, coreArtifact.bytecode, wallet);
  const core = await CoreFactory.deploy(
    usdcAddress,
    vaultAddress,
    FTSO_V2_COSTON2,
    TEE_EXTENSION_REGISTRY_COSTON2,
    wallet.address,
    wallet.address
  );
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log("--> BrokexCore Deployed at:", coreAddress);

  // 3. Lens
  console.log("\n3. Deploying BrokexLens...");
  const LensFactory = new ethers.ContractFactory(lensArtifact.abi, lensArtifact.bytecode, wallet);
  const lens = await LensFactory.deploy(coreAddress, vaultAddress);
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();
  console.log("--> BrokexLens Deployed at:", lensAddress);

  // 4. Link Vault -> Core
  console.log("\n4. Linking Vault to Core...");
  const txLink = await vault.setCoreContract(coreAddress);
  await txLink.wait();
  console.log("--> Vault linked to Core successfully.");

  console.log("\n==================================================");
  console.log("       DEPLOYMENT SUCCESSFUL!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
