const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("==================================================");
  console.log("    BROKEX LENS REDEPLOYMENT ON COSTON2");
  console.log("==================================================");
  console.log("Deployer Address:", deployer ? deployer.address : "N/A");

  // Adresses déjà déployées et actives sur Coston2 Testnet
  const CORE_ADDRESS  = "0xE9B049FDb273195D6078A58247bA9f05cd8258C0";
  const VAULT_ADDRESS = "0x7D61DcFbD134a3D780d20FC561c17cD95205CD84";

  console.log("Target Core Address :", CORE_ADDRESS);
  console.log("Target Vault Address:", VAULT_ADDRESS);

  // Déploiement de la version complète de BrokexLens
  const BrokexLens = await hre.ethers.getContractFactory("BrokexLens");
  const lens = await BrokexLens.deploy(CORE_ADDRESS, VAULT_ADDRESS);
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();

  console.log("==================================================");
  console.log(" BrokexLens DEPLOYED SUCCESSFULLY AT:");
  console.log(" Address:", lensAddress);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
