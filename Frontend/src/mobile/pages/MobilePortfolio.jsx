import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
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

export default function MobilePortfolio() {
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
      enabled: Boolean(address),
      refetchInterval: 5000,
    },
  });

  const freeMarginNum = (() => {
    if (!address || rawUsdcBalance === undefined || rawUsdcBalance === null) return 0;
    try {
      return Number(rawUsdcBalance.toString()) / 1e6;
    } catch (e) {
      return 0;
    }
  })();

  // 2. Fetch Trader Trades from /api/trades/trader/:address
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
        }
      } catch (err) {
        console.error("MobilePortfolio fetch error:", err);
      }
    };

    fetchTraderTrades();
    const interval = setInterval(fetchTraderTrades, 8000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  // 3. SSE Price Streaming for live PnL calculation
  useEffect(() => {
    let eventSource = null;
    try {
      eventSource = new EventSource(`${apiBase}/v1/shims/tradingview/streaming`);
      eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          const priceVal = parseFloat(data.p || data.priceUSD || data.price);
          if (!isNaN(priceVal) && priceVal > 0) {
            setLivePrice(priceVal);
          }
        } catch (err) {}
      };
    } catch (err) {}
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Compute live open trades metrics (Locked Capital & Unrealized PnL)
  const openTrades = rawApiTrades.filter(t => Number(t.state) === 1);

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

  const totalMarginNum = freeMarginNum + lockedCapitalNum;
  const pnlPct = lockedCapitalNum > 0 ? (totalUnrealizedPnlNum / lockedCapitalNum) * 100 : (freeMarginNum > 0 ? (totalUnrealizedPnlNum / freeMarginNum) * 100 : 0);
  const isPnlPos = totalUnrealizedPnlNum >= 0;

  const handleManagePosition = (position, tab) => {
    setSelectedPosition(position);
    setPosManagerTab(tab);
    setIsPosManagerOpen(true);
  };

  return (
    <MobileLayout>
      {/* Premium Portfolio Overview Card */}
      <div style={{
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}>
        <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
          Account Summary
        </span>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
              ${freeMarginNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Free Margin (USDC)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isPnlPos ? '#3b82f6' : '#ef4444' }}>
              {isPnlPos ? '+' : ''}${totalUnrealizedPnlNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Unrealized PnL ({isPnlPos ? '+' : ''}{pnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Mini stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Locked Capital:</span>
            <span style={{ fontWeight: '600', color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
              ${lockedCapitalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Total Account:</span>
            <span style={{ fontWeight: '600', color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
              ${totalMarginNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Actual Positions, Orders, and History List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <MobilePositions 
          onManagePosition={handleManagePosition} 
          isFullPage={true} 
        />
      </div>

      {/* Dialog modal overlays for margin / close action */}
      <MobilePositionManager
        isOpen={isPosManagerOpen}
        onClose={() => setIsPosManagerOpen(false)}
        position={selectedPosition}
        initialTab={posManagerTab}
      />
    </MobileLayout>
  );
}
