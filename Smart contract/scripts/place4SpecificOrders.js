const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("==================================================");
  console.log("    PLACING 4 SPECIFIC LIMIT & STOP ORDERS");
  console.log("==================================================");
  console.log("Deployer Address:", deployer.address);

  const coreAddress = "0x8E8D9a9CeF5da78F92152CA7E3a193e0fdE636b3";
  const usdcAddress = "0xfDA686186510208C4E91028Fed671Dd9c35111d3";

  const core = await hre.ethers.getContractAt("BrokexCore", coreAddress);
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);

  const assetHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD/USD"));

  // 1. Approve USDC pour BrokexCore (10,000 USDC)
  const approveAmount = hre.ethers.parseUnits("10000", 6);
  const txApprove = await usdc.approve(coreAddress, approveAmount);
  await txApprove.wait();
  console.log("1. Approved USDC for BrokexCore.");

  // Constantes
  const DIR_SHORT  = 0;
  const DIR_LONG   = 1;
  const ORDER_LIMIT = 1;
  const ORDER_STOP  = 2;

  const collateral = hre.ethers.parseUnits("50", 6); // 50 USDC collateral
  const leverage   = 10;                              // 10x leverage
  const slPrice    = 0;
  const tpPrice    = 0;

  const ordersToPlace = [
    {
      name: "Limit LONG @ $5000",
      direction: DIR_LONG,
      orderType: ORDER_LIMIT,
      targetPrice: hre.ethers.parseUnits("5000", 6)
    },
    {
      name: "Limit SHORT @ $4000",
      direction: DIR_SHORT,
      orderType: ORDER_LIMIT,
      targetPrice: hre.ethers.parseUnits("4000", 6)
    },
    {
      name: "Stop LONG @ $4000",
      direction: DIR_LONG,
      orderType: ORDER_STOP,
      targetPrice: hre.ethers.parseUnits("4000", 6)
    },
    {
      name: "Stop SHORT @ $5000",
      direction: DIR_SHORT,
      orderType: ORDER_STOP,
      targetPrice: hre.ethers.parseUnits("5000", 6)
    }
  ];

  const placedOrders = [];

  for (const o of ordersToPlace) {
    try {
      const tx = await core.createLimitOrStopOrder(
        assetHash,
        o.direction,
        o.orderType,
        o.targetPrice,
        collateral,
        leverage,
        slPrice,
        tpPrice
      );
      const receipt = await tx.wait();
      
      // Filter TradeEvent to get tradeId
      let tradeId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = core.interface.parseLog(log);
          if (parsed && parsed.name === 'TradeEvent') {
            tradeId = parsed.args.tradeId.toString();
          }
        } catch (e) {}
      }

      console.log(`[PLACED] ${o.name} | Trade ID: ${tradeId || 'N/A'} | Tx: ${receipt.hash}`);
      placedOrders.push({ name: o.name, tradeId, hash: receipt.hash });
    } catch (err) {
      console.error(`[ERROR] ${o.name}:`, err.reason || err.message);
    }
  }

  console.log("==================================================");
  console.log("          FINISHED PLACING 4 ORDERS");
  console.log("==================================================");
  console.log("Placed Orders:", placedOrders);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
