const hre = require("hardhat");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("==================================================");
  console.log("      CREATING 20 TRADES ON BROKEX PROTOCOL");
  console.log("==================================================");
  console.log("Deployer Address:", deployer.address);

  const coreAddress = "0x8E8D9a9CeF5da78F92152CA7E3a193e0fdE636b3";
  const usdcAddress = "0xfDA686186510208C4E91028Fed671Dd9c35111d3";

  const core = await hre.ethers.getContractAt("BrokexCore", coreAddress);
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);

  // Asset GOLD/USD
  const assetHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD/USD"));

  // 1. Approve USDC pour BrokexCore
  const approveAmount = hre.ethers.parseUnits("100000", 6);
  const txApprove = await usdc.approve(coreAddress, approveAmount);
  await txApprove.wait();
  console.log("1. Approved 100,000 USDC for BrokexCore.");

  // Constantes
  const DIR_SHORT = 0;
  const DIR_LONG  = 1;
  const ORDER_LIMIT = 1;
  const ORDER_STOP  = 2;

  const tradesCreated = [];

  for (let i = 1; i <= 20; i++) {
    const isMarket = i <= 10; // 10 Market, 10 Limit/Stop
    const direction = (i % 2 === 0) ? DIR_SHORT : DIR_LONG;
    const directionName = direction === DIR_LONG ? "LONG" : "SHORT";
    
    const collateralUsd = 10 + (i * 2);
    const collateral = hre.ethers.parseUnits(collateralUsd.toString(), 6);
    const leverage = 2 + (i % 15);

    if (isMarket) {
      // Market Order avec TEE Proof signée par le deployer (teeSigner)
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
        const tx = await core.openMarketPosition(
          assetHash,
          direction,
          collateral,
          leverage,
          0,
          0,
          riskProof
        );
        const receipt = await tx.wait();
        console.log(`Trade #${i}: Market ${directionName} | Collateral: $${collateralUsd} | Lev: ${leverage}x | Tx: ${receipt.hash.slice(0, 14)}...`);
        tradesCreated.push({ index: i, type: `Market ${directionName}`, hash: receipt.hash });
      } catch (err) {
        console.error(`Trade #${i} Market Error:`, err.reason || err.message);
      }

    } else {
      // Limit / Stop Order
      const orderType = (i % 2 === 0) ? ORDER_LIMIT : ORDER_STOP;
      const orderTypeName = orderType === ORDER_LIMIT ? "LIMIT" : "STOP";
      
      const basePrice = 2500;
      const priceOffset = (i % 5) * 10 - 20;
      const targetPrice = hre.ethers.parseUnits((basePrice + priceOffset).toString(), 6);

      try {
        const tx = await core.createLimitOrStopOrder(
          assetHash,
          direction,
          orderType,
          targetPrice,
          collateral,
          leverage,
          0,
          0
        );
        const receipt = await tx.wait();
        console.log(`Trade #${i}: ${orderTypeName} ${directionName} @ $${basePrice + priceOffset} | Collateral: $${collateralUsd} | Lev: ${leverage}x | Tx: ${receipt.hash.slice(0, 14)}...`);
        tradesCreated.push({ index: i, type: `${orderTypeName} ${directionName}`, hash: receipt.hash });
      } catch (err) {
        console.error(`Trade #${i} ${orderTypeName} Error:`, err.reason || err.message);
      }
    }

    await sleep(500);
  }

  console.log("==================================================");
  console.log(`   SUCCESSFULLY CREATED ${tradesCreated.length}/20 TRADES!`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
