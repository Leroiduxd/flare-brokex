import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { usePriceStream } from '../../context/PriceContext';
import MobileLayout from '../components/MobileLayout';
import { MobilePositions, MobilePositionManager } from '../components/MobileTradeComponents';

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0xfDA686186510208C4E91028Fed671Dd9c35111d3';
const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

const erc20Abi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  }
];

export function MobilePortfolioContent() {
  const { address, isConnected } = useAccount();

  // Position Manager Modal State
  const [isPosManagerOpen, setIsPosManagerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [posManagerTab, setPosManagerTab] = useState('close');

  const [rawApiTrades, setRawApiTrades] = useState([]);
  const [livePrice, setLivePrice] = useState(4046.52);

  // 1. Read USDC Balance On-Chain (Coston2 Testnet chainId: 114)
  const { data: rawUsdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 114,
    query: {
      enabled: Boolean(address && isConnected),
      refetchInterval: 5000,
    },
  });

  const freeMarginNum = (() => {
    if (isConnected && rawUsdcBalance !== undefined && rawUsdcBalance !== null) {
      try {
        return Number(rawUsdcBalance.toString()) / 1e6;
      } catch (e) {}
    }
    return 0;
  })();

  // 2. Fetch Trader Trades ONLY for connected address
  useEffect(() => {
    if (!address || !isConnected) {
      setRawApiTrades([]);
      return;
    }

    const fetchTraderTrades = async () => {
      try {
        const res = await fetch(`${apiBase}/api/trades/trader/${address}`);
        if (res.ok) {
          const data = await res.json();
          if (data.trades && Array.isArray(data.trades)) {
            setRawApiTrades(data.trades);
          } else {
            setRawApiTrades([]);
          }
        } else {
          setRawApiTrades([]);
        }
      } catch (err) {
        setRawApiTrades([]);
      }
    };

    fetchTraderTrades();
    const interval = setInterval(fetchTraderTrades, 8000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  const { currentMarkPrice: liveMarkPrice } = usePriceStream();

  useEffect(() => {
    if (liveMarkPrice > 0) {
      setLivePrice(liveMarkPrice);
    }
  }, [liveMarkPrice]);

  // Compute live open trades metrics for connected user
  const openTrades = isConnected ? rawApiTrades.filter(t => Number(t.state) === 1) : [];
  const closedTrades = isConnected ? rawApiTrades.filter(t => Number(t.state) === 2 || Number(t.state) === 4) : [];

  let lockedCapitalNum = 0;
  let totalUnrealizedPnlNum = 0;

  openTrades.forEach(raw => {
    const marginNum = raw.margin ? Number(raw.margin) / 1e6 : 0;
    const leverageNum = Number(raw.leverage || 10);
    const sizeUsdNum = marginNum * leverageNum;
    const openPriceNum = raw.openPrice ? Number(raw.openPrice) / 1e6 : 4046.52;
    const isLong = Number(raw.direction) === 1 || raw.direction === 'LONG' || raw.direction === 'buy' || raw.isLong === true;
    const currentMark = livePrice > 0 ? livePrice : openPriceNum;

    lockedCapitalNum += marginNum;

    if (openPriceNum > 0) {
      const diffPct = isLong ? (currentMark - openPriceNum) / openPriceNum : (openPriceNum - currentMark) / openPriceNum;
      let tradePnl = sizeUsdNum * diffPct;
      if (marginNum > 0 && tradePnl < -marginNum) tradePnl = -marginNum;
      totalUnrealizedPnlNum += tradePnl;
    }
  });

  let totalRealizedPnlNum = 0;
  let totalVolumeNum = 0;
  let winsCount = 0;

  closedTrades.forEach(raw => {
    const marginNum = raw.margin ? Number(raw.margin) / 1e6 : 0;
    const leverageNum = Number(raw.leverage || 10);
    const sizeUsdNum = marginNum * leverageNum;
    const pnlVal = raw.pnl ? Number(raw.pnl) / 1e6 : (raw.realizedPnl ? Number(raw.realizedPnl) / 1e6 : 0);

    totalRealizedPnlNum += pnlVal;
    totalVolumeNum += sizeUsdNum;
    if (pnlVal > 0) winsCount++;
  });

  const winRatePct = closedTrades.length > 0 ? (winsCount / closedTrades.length) * 100 : 0;
  const equityNum = isConnected ? (freeMarginNum + lockedCapitalNum + totalUnrealizedPnlNum) : 0;
  const pnlPct = lockedCapitalNum > 0 ? (totalUnrealizedPnlNum / lockedCapitalNum) * 100 : 0;
  const isUnrealizedPos = totalUnrealizedPnlNum >= 0;
  const isRealizedPos = totalRealizedPnlNum >= 0;

  const handleManagePosition = (position, tab) => {
    setSelectedPosition(position);
    setPosManagerTab(tab);
    setIsPosManagerOpen(true);
  };

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: 'var(--panel-bg)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
      width: '100%',
      height: '100%'
    }}>
      {/* Top Summary Header Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px 12px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Account Summary Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            Account Summary
          </span>
          <span style={{ 
            fontSize: '8.5px', 
            color: isConnected ? '#3b82f6' : 'var(--gold)', 
            backgroundColor: isConnected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(200, 169, 126, 0.1)', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            fontWeight: 'bold' 
          }}>
            {isConnected ? 'LIVE ACCOUNT' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Main Net Worth / Balance Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
              ${equityNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Total Equity (USDC)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected && isUnrealizedPos ? '#3b82f6' : (isConnected ? '#ef4444' : 'var(--text-grey)') }}>
              {isConnected && isUnrealizedPos ? '+' : ''}${totalUnrealizedPnlNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Unrealized PnL ({isConnected && isUnrealizedPos ? '+' : ''}{pnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Detailed Metrics Grid (Realized PnL, Win Rate, Volume, Wins/Losses) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {/* 1. Free Margin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Free Margin</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
              ${freeMarginNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* 2. Realized PNL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Realized PNL</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected && isRealizedPos ? '#3b82f6' : (isConnected ? '#ef4444' : 'var(--text-grey)') }}>
              {isConnected && isRealizedPos ? '+' : ''}${totalRealizedPnlNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* 3. Total Volume */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total Volume</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
              ${totalVolumeNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* 4. Win Rate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Win Rate ({closedTrades.length} Tr.)</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--gold)' }}>
              {winRatePct.toFixed(1)}% <span style={{ fontSize: '9.5px', color: 'var(--text-grey)', fontWeight: 'normal', fontFamily: 'Inter, sans-serif' }}>({winsCount}W - {closedTrades.length - winsCount}L)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Positions Section inside same parent */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%', overflow: 'hidden' }}>
        <MobilePositions 
          onManagePosition={handleManagePosition} 
          isFullPage={true} 
        />
      </div>

      {/* Position Manager Modal Overlay */}
      <MobilePositionManager
        isOpen={isPosManagerOpen}
        onClose={() => setIsPosManagerOpen(false)}
        position={selectedPosition}
        initialTab={posManagerTab}
      />
    </div>
  );
}

export default function MobilePortfolio() {
  return (
    <MobileLayout>
      <MobilePortfolioContent />
    </MobileLayout>
  );
}
