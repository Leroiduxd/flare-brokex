const hre = require("hardhat");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("==================================================");
  console.log("    CLOSING & CANCELLING ALL ACTIVE TRADES");
  console.log("==================================================");
  console.log("Deployer Address:", deployer.address);

  const coreAddress = "0x8E8D9a9CeF5da78F92152CA7E3a193e0fdE636b3";
  const lensAddress = "0x4FD94009259C99b9027CC78295e38BE6cbDb3cE8";

  const core = await hre.ethers.getContractAt("BrokexCore", coreAddress);
  const lens = await hre.ethers.getContractAt("BrokexLens", lensAddress);

  const assetHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD/USD"));

  // Fetch total trades
  const nextId = await core.nextTradeId();
  const totalCount = Number(nextId);
  console.log(`Total Trades on Core: ${totalCount}`);

  // Fetch all trades via Lens
  const trades = await lens.getTradeRange(0, totalCount);

  let closedCount = 0;
  let cancelledCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const tradeId = Number(t.id);
    const state = Number(t.state);

    if (state === 1) {
      // STATE_OPEN -> Close position market
      const timestamp = Math.floor(Date.now() / 1000);
      const maxOILong = hre.ethers.parseUnits("10000000", 6);
      const maxOIShort = hre.ethers.parseUnits("10000000", 6);
      const spreadLong = 10;
      const spreadShort = 10;

      const hash = hre.ethers.keccak256(
        hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [assetHash, maxOILong, maxOIShort, spreadLong, spreadShort, timestamp]
        )
      );

      const sig = await deployer.signMessage(hre.ethers.getBytes(hash));

      const riskProof = {
        assetHash,
        maxOILong,
        maxOIShort,
        spreadLong,
        spreadShort,
        timestamp,
        sig
      };

      try {
        const tx = await core.closePositionMarket(assetHash, tradeId, riskProof);
        await tx.wait();
        closedCount++;
        console.log(`[CLOSED] Trade ID ${tradeId}`);
      } catch (err) {
        console.error(`[ERROR CLOSE] Trade ID ${tradeId}:`, err.reason || err.message);
      }
      await sleep(300);

    } else if (state === 0) {
      // STATE_ORDER -> Cancel order
      try {
        const tx = await core.cancelOrder(tradeId);
        await tx.wait();
        cancelledCount++;
        console.log(`[CANCELLED] Trade ID ${tradeId}`);
      } catch (err) {
        // If cancelOrder fails, try closing position if open or skip
        console.error(`[ERROR CANCEL] Trade ID ${tradeId}:`, err.reason || err.message);
      }
      await sleep(300);

    } else {
      // Already CLOSED (2), CANCELLED (3), LIQUIDATED (4)
      skippedCount++;
    }
  }

  console.log("==================================================");
  console.log(`FINISHED CLEANING ALL TRADES!`);
  console.log(`- Closed Positions: ${closedCount}`);
  console.log(`- Cancelled Orders: ${cancelledCount}`);
  console.log(`- Already Inactive: ${skippedCount}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
