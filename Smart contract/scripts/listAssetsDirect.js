const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Listing assets with wallet:", wallet.address);

  const coreAddress = "0x5620dA2B418577b94a74B121eD61B5B84962AC93";
  const coreArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/BrokexCore.sol/BrokexCore.json"));

  const core = new ethers.Contract(coreAddress, coreArtifact.abi, wallet);

  // 1. GOLD (XAU)
  const goldAssetHash = "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55";
  const goldFtsoFeedId = "0x01504158472f555344000000000000000000000000";

  const goldConfig = {
    ftsoFeedId:         goldFtsoFeedId,
    minLeverage:        2,
    maxLeverage:        100,
    minTradeSize:       10000000n,       // 10 USDC (6 décimales)
    commissionBps:      1000,            // 0.1%
    borrowRateHourly:   40,              // 0.004%/h
    profitCap:          100000,          // 10%
    executionTolerance: 100,             // 0.1%
    maxProofAge:        60,              // 60s
    maxTraderOI:        1000000000000n,  // 1 000 000 USDC
    maxGlobalOI:        1000000000000n,  // 1 000 000 USDC
    lockedCapitalBps:   50000,           // 5%
    liqThresholdBps:    950000,          // 95%
    listed:             true,
    frozen:             false
  };

  console.log("\n1. Listing GOLD (XAU)...");
  const txGold = await core.listAsset(goldAssetHash, goldFtsoFeedId, goldConfig);
  console.log("   Tx sent:", txGold.hash);
  await txGold.wait();
  console.log("   --> GOLD listed successfully!");

  // 2. XRP (FXRP)
  const xrpAssetHash = "0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298";
  const xrpFtsoFeedId = "0x015852502f55534400000000000000000000000000";

  const xrpConfig = {
    ftsoFeedId:         xrpFtsoFeedId,
    minLeverage:        2,
    maxLeverage:        25,
    minTradeSize:       10000000n,       // 10 USDC (6 décimales)
    commissionBps:      1000,            // 0.1%
    borrowRateHourly:   70,              // 0.007%/h
    profitCap:          100000,          // 10%
    executionTolerance: 100,             // 0.1%
    maxProofAge:        60,              // 60s
    maxTraderOI:        1000000000000n,  // 1 000 000 USDC
    maxGlobalOI:        1000000000000n,  // 1 000 000 USDC
    lockedCapitalBps:   100000,          // 10%
    liqThresholdBps:    950000,          // 95%
    listed:             true,
    frozen:             false
  };

  console.log("\n2. Listing XRP (FXRP)...");
  const txXrp = await core.listAsset(xrpAssetHash, xrpFtsoFeedId, xrpConfig);
  console.log("   Tx sent:", txXrp.hash);
  await txXrp.wait();
  console.log("   --> XRP listed successfully!");

  console.log("\n==================================================");
  console.log("       BOTH ASSETS LISTED SUCCESSFULLY!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Listing failed:", err);
  process.exit(1);
});
