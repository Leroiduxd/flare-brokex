// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IBrokexCore {
    struct Trade {
        uint256 id;
        address trader;
        bytes32 assetHash;
        uint8   state;
        uint8   direction;
        uint8   orderType;
        uint256 margin;
        uint256 leverage;
        uint256 targetPrice;
        uint256 openPrice;
        uint256 closePrice;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 openTimestamp;
        uint256 closeTimestamp;
        uint256 borrowFee;
    }

    struct AssetConfig {
        bytes21 ftsoFeedId;
        uint256 minLeverage;
        uint256 maxLeverage;
        uint256 minTradeSize;
        uint256 commissionBps;
        uint256 borrowRateHourly;
        uint256 profitCap;
        uint256 executionTolerance;
        uint256 maxProofAge;
        uint256 maxTraderOI;
        uint256 maxGlobalOI;
        uint256 lockedCapitalBps;
        uint256 liqThresholdBps;
        bool    listed;
        bool    frozen;
    }

    function getTrade(uint256 tradeId) external view returns (Trade memory);
    function nextTradeId() external view returns (uint256);
    function openInterestLong(bytes32 assetHash) external view returns (uint256);
    function openInterestShort(bytes32 assetHash) external view returns (uint256);
    function avgEntryPriceLong(bytes32 assetHash) external view returns (uint256);
    function avgEntryPriceShort(bytes32 assetHash) external view returns (uint256);
    function totalLockedCapital() external view returns (uint256);
    function traderOpenInterest(bytes32 assetHash, address trader) external view returns (uint256);
    function assets(bytes32 assetHash) external view returns (
        bytes21 ftsoFeedId,
        uint256 minLeverage, uint256 maxLeverage, uint256 minTradeSize, uint256 commissionBps,
        uint256 borrowRateHourly, uint256 profitCap, uint256 executionTolerance, uint256 maxProofAge,
        uint256 maxTraderOI, uint256 maxGlobalOI, uint256 lockedCapitalBps, uint256 liqThresholdBps,
        bool listed, bool frozen
    );
    function paused() external view returns (bool);
    function emergencyMode() external view returns (bool);
    function owner() external view returns (address);
    function teeSigner() external view returns (address);
    function USDC() external view returns (address);
    function getFreeCapital() external view returns (uint256);
}

interface IBrokexVault {
    function owner() external view returns (address);
    function coreContract() external view returns (address);
    function totalSupply() external view returns (uint256);
    function lastKnownPrice() external view returns (uint256);
    function getFreeLiquidity() external view returns (uint256);
    function getRequiredFreeUSDC() external view returns (uint256);
    function totalPendingLP() external view returns (uint256);
    function USDC() external view returns (address);
}

contract BrokexLens {

    IBrokexCore public immutable core;
    IBrokexVault public immutable vault;

    constructor(address coreAddress, address vaultAddress) {
        core  = IBrokexCore(coreAddress);
        vault = IBrokexVault(vaultAddress);
    }

    struct Trade {
        uint256 id;
        address trader;
        bytes32 assetHash;
        uint8   state;
        uint8   direction;
        uint8   orderType;
        uint256 margin;
        uint256 leverage;
        uint256 targetPrice;
        uint256 openPrice;
        uint256 closePrice;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 openTimestamp;
        uint256 closeTimestamp;
        uint256 borrowFee;
        uint256 liqPrice;
    }

    struct ProtocolSnapshot {
        uint256 lastTradeId;
        bool    paused;
        bool    emergencyMode;
        address coreOwner;
        address teeSigner;
        uint256 lpTotalCapital;
        uint256 lpFreeCapital;
        uint256 lpLockedCapital;
        uint256 vaultUsageBps;
        address vaultOwner;
        address vaultCore;
        bool    coreLocked;
        uint256 lpTotalSupply;
        uint256 lpLastKnownPrice;
        uint256 requiredFreeUSDC;
        uint256 totalPendingLP;
    }

    struct AssetSnapshot {
        bytes32 assetHash;
        uint256 openInterestLong;
        uint256 openInterestShort;
        uint256 totalOpenInterest;
        uint256 avgEntryPriceLong;
        uint256 avgEntryPriceShort;
        IBrokexCore.AssetConfig config;
    }

    function _liqPrice(
        uint256 openPrice,
        uint256 leverage,
        uint8 direction,
        uint256 liqThresholdBps
    ) internal pure returns (uint256) {
        if (leverage == 0) return 0;
        uint256 move = (openPrice * liqThresholdBps) / (leverage * 1e6);
        if (direction == 1) return openPrice > move ? openPrice - move : 0;
        return openPrice + move;
    }

    function getTradeRange(uint256 startId, uint256 length)
        external view returns (Trade[] memory result)
    {
        result = new Trade[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 tradeId = startId + i;
            IBrokexCore.Trade memory t = core.getTrade(tradeId);

            uint256 liq = 0;
            if (t.assetHash != bytes32(0) && t.leverage != 0) {
                liq = t.state == 1
                    ? _liqPrice(t.openPrice, t.leverage, t.direction, 950_000)
                    : _liqPrice(t.targetPrice, t.leverage, t.direction, 950_000);
            }

            result[i] = Trade({
                id:             t.id,
                trader:         t.trader,
                assetHash:      t.assetHash,
                state:          t.state,
                direction:      t.direction,
                orderType:      t.orderType,
                margin:         t.margin,
                leverage:       t.leverage,
                targetPrice:    t.targetPrice,
                openPrice:      t.openPrice,
                closePrice:     t.closePrice,
                stopLoss:       t.stopLoss,
                takeProfit:     t.takeProfit,
                openTimestamp:  t.openTimestamp,
                closeTimestamp: t.closeTimestamp,
                borrowFee:      t.borrowFee,
                liqPrice:       liq
            });
        }
    }

    function getProtocolSnapshot() external view returns (ProtocolSnapshot memory s) {
        uint256 nextId        = core.nextTradeId();
        uint256 lastId        = nextId > 0 ? nextId - 1 : 0;

        address usdcAddress   = core.USDC();
        uint256 totalCapital  = IERC20(usdcAddress).balanceOf(address(vault));
        uint256 lockedCapital = core.totalLockedCapital();
        uint256 freeCapital   = core.getFreeCapital();
        address vaultCoreAddr = vault.coreContract();

        s = ProtocolSnapshot({
            lastTradeId:        lastId,
            paused:             core.paused(),
            emergencyMode:      core.emergencyMode(),
            coreOwner:          core.owner(),
            teeSigner:          core.teeSigner(),
            lpTotalCapital:     totalCapital,
            lpFreeCapital:      freeCapital,
            lpLockedCapital:    lockedCapital,
            vaultUsageBps:      totalCapital > 0
                                    ? (lockedCapital * 10_000) / totalCapital
                                    : 0,
            vaultOwner:         vault.owner(),
            vaultCore:          vaultCoreAddr,
            coreLocked:         vaultCoreAddr != address(0),
            lpTotalSupply:      vault.totalSupply(),
            lpLastKnownPrice:   vault.lastKnownPrice(),
            requiredFreeUSDC:   vault.getRequiredFreeUSDC(),
            totalPendingLP:     vault.totalPendingLP()
        });
    }

    function getAssetSnapshot(bytes32 assetHash) external view returns (AssetSnapshot memory s) {
        uint256 oiLong  = core.openInterestLong(assetHash);
        uint256 oiShort = core.openInterestShort(assetHash);

        (
            bytes21 ftsoFeedId,
            uint256 minLeverage,
            uint256 maxLeverage,
            uint256 minTradeSize,
            uint256 commissionBps,
            uint256 borrowRateHourly,
            uint256 profitCap,
            uint256 executionTolerance,
            uint256 maxProofAge,
            uint256 maxTraderOI,
            uint256 maxGlobalOI,
            uint256 lockedCapitalBps,
            uint256 liqThresholdBps,
            bool listed,
            bool frozen
        ) = core.assets(assetHash);

        IBrokexCore.AssetConfig memory cfg = IBrokexCore.AssetConfig({
            ftsoFeedId:         ftsoFeedId,
            minLeverage:        minLeverage,
            maxLeverage:        maxLeverage,
            minTradeSize:       minTradeSize,
            commissionBps:      commissionBps,
            borrowRateHourly:   borrowRateHourly,
            profitCap:          profitCap,
            executionTolerance: executionTolerance,
            maxProofAge:        maxProofAge,
            maxTraderOI:        maxTraderOI,
            maxGlobalOI:        maxGlobalOI,
            lockedCapitalBps:   lockedCapitalBps,
            liqThresholdBps:    liqThresholdBps,
            listed:             listed,
            frozen:             frozen
        });

        s = AssetSnapshot({
            assetHash:          assetHash,
            openInterestLong:   oiLong,
            openInterestShort:  oiShort,
            totalOpenInterest:  oiLong + oiShort,
            avgEntryPriceLong:  core.avgEntryPriceLong(assetHash),
            avgEntryPriceShort: core.avgEntryPriceShort(assetHash),
            config:             cfg
        });
    }
}