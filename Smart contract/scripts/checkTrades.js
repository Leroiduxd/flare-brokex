const hre = require("hardhat");

async function main() {
  const coreAddress = "0x8E8D9a9CeF5da78F92152CA7E3a193e0fdE636b3";
  const core = await hre.ethers.getContractAt("BrokexCore", coreAddress);
  const nextId = await core.nextTradeId();
  console.log("Total Trades Created on BrokexCore:", nextId.toString());
}

main().catch(console.error);
