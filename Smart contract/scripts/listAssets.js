const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Listing assets with deployer:", deployer.address);

  const coreAddress = "0x471F4EF6820d596C209bAE41a7A47b4836Cbca72";
  const core = await hre.ethers.getContractAt("BrokexCore", coreAddress);

  // 1. GOLD (XAU)
  const goldAssetHash = "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55";
  const goldFtsoFeedId = "0x01504158472f555344000000000000000000000000";

  const goldConfig = {
    ftsoFeedId:         goldFtsoFeedId,
    minLeverage:        2,
    maxLeverage:        100,
    minTradeSize:       "10000000",       // 10 USDC
    commissionBps:      1000,             // 0.1%
    borrowRateHourly:   40,               // 0.004%/h
    profitCap:          100000,           // 10%
    executionTolerance: 100,              // 0.1%
    maxProofAge:        60,               // 60s
    maxTraderOI:        "1000000000000",  // 1 000 000 USDC
    maxGlobalOI:        "1000000000000",  // 1 000 000 USDC
    lockedCapitalBps:   50000,            // 5%
    liqThresholdBps:    950000,           // 95%
    listed:             true,
    frozen:             false
  };

  console.log("Listing GOLD (XAU)...");
  const txGold = await core.listAsset(goldAssetHash, goldFtsoFeedId, goldConfig);
  await txGold.wait();
  console.log("--> GOLD listed successfully!");

  // 2. XRP (FXRP)
  const xrpAssetHash = "0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298";
  const xrpFtsoFeedId = "0x015852502f55534400000000000000000000000000";

  const xrpConfig = {
    ftsoFeedId:         xrpFtsoFeedId,
    minLeverage:        2,
    maxLeverage:        25,
    minTradeSize:       "10000000",       // 10 USDC
    commissionBps:      1000,             // 0.1%
    borrowRateHourly:   70,               // 0.007%/h
    profitCap:          100000,           // 10%
    executionTolerance: 100,              // 0.1%
    maxProofAge:        60,               // 60s
    maxTraderOI:        "1000000000000",  // 1 000 000 USDC
    maxGlobalOI:        "1000000000000",  // 1 000 000 USDC
    lockedCapitalBps:   100000,           // 10%
    liqThresholdBps:    950000,           // 95%
    listed:             true,
    frozen:             false
  };

  console.log("Listing XRP (FXRP)...");
  const txXrp = await core.listAsset(xrpAssetHash, xrpFtsoFeedId, xrpConfig);
  await txXrp.wait();
  console.log("--> XRP listed successfully!");

  console.log("=== ALL ASSETS LISTED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
