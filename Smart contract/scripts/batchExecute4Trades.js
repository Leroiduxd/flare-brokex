const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("==================================================");
  console.log("   BATCH EXECUTING 4 TRADES IN A SINGLE CALL");
  console.log("==================================================");
  console.log("Keeper/Deployer Address:", deployer.address);

  const coreAddress = "0x8E8D9a9CeF5da78F92152CA7E3a193e0fdE636b3";
  const core = await hre.ethers.getContractAt("BrokexCore", coreAddress);
  const assetHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD/USD"));

  const tradeIds = [94, 95, 96, 97];
  const reasons  = [0, 0, 0, 0]; // REASON_MARKET = 0

  // Build signed TEE risk proofs for each trade
  const timestamp = Math.floor(Date.now() / 1000);
  const maxOILong = hre.ethers.parseUnits("10000000", 6);
  const maxOIShort = hre.ethers.parseUnits("10000000", 6);
  const spreadLong = 10;  // 0.001%
  const spreadShort = 10; // 0.001%

  const hash = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [assetHash, maxOILong, maxOIShort, spreadLong, spreadShort, timestamp]
    )
  );

  const sig = await deployer.signMessage(hre.ethers.getBytes(hash));

  const proofTemplate = {
    assetHash,
    maxOILong,
    maxOIShort,
    spreadLong,
    spreadShort,
    timestamp,
    sig
  };

  const riskProofs = [proofTemplate, proofTemplate, proofTemplate, proofTemplate];

  console.log(`Sending batchExecute for Trade IDs: [${tradeIds.join(", ")}] in 1 transaction...`);

  const tx = await core.batchExecute(tradeIds, reasons, riskProofs);
  console.log(`Transaction submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}!`);

  // Verify trade states post-execution
  for (const id of tradeIds) {
    const t = await core.getTrade(id);
    const stateNames = ["ORDER", "OPEN", "CLOSED", "CANCELLED", "LIQUIDATED", "EMERGENCY", "LIQ_POS"];
    console.log(`Trade ID ${id}: State = ${stateNames[Number(t.state)]} (${t.state}), OpenPrice = ${hre.ethers.formatUnits(t.openPrice, 6)} USD`);
  }

  console.log("==================================================");
  console.log("       BATCH EXECUTION FINISHED SUCCESSFULLY!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
