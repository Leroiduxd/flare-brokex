import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useNotifications } from '../../context/NotificationContext';
import { usePriceStream } from '../../context/PriceContext';
import { useGlobalData } from '../../context/DataContext';
import { fetchTeeProof, closePositionMarketAbi } from '../../components/OrderPanel';
import MobileTradeHeader from './MobileTradeHeader';
import MobilePositions from './MobilePositions';
import MobileOrderPanel from './MobileOrderPanel';

export { MobileTradeHeader, MobilePositions, MobileOrderPanel };

// Common Accent Colors (Theme-aware via CSS variables)
const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
const buyColor = '#3b82f6'; // blue
const sellColor = '#ef4444'; // red
const buyColorBg = 'rgba(59, 130, 246, 0.1)';
const sellColorBg = 'rgba(239, 68, 68, 0.1)';


// ----------------------------------------------------
// 0.5. MOBILE TOPNAV (TradeHeader + Scrollable Metrics Row)
// ----------------------------------------------------
export function MobileTopNav({ activeMarketInfo = {}, setIsMarketSelectorOpen }) {
  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';
  const [snapshotData, setSnapshotData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [livePrice, setLivePrice] = useState(activeMarketInfo?.price || '4,046.52');
  const [priceChange, setPriceChange] = useState(activeMarketInfo?.change || '+0.12%');
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [teeSpreads, setTeeSpreads] = useState({ spreadLongBps: 30, spreadShortBps: 30 });

  const { snapshotData: globalSnapshot, volumeData: globalVolume, getAssetRiskParams } = useGlobalData();

  const currentAssetKey = activeMarketInfo?.symbol?.includes('XRP') || activeMarketInfo?.badge === 'XRP' ? 'XRP' : 'GOLD';

  useEffect(() => {
    if (globalSnapshot) setSnapshotData(globalSnapshot);
    if (globalVolume) setVolumeData(globalVolume);
  }, [globalSnapshot, globalVolume]);

  useEffect(() => {
    if (getAssetRiskParams) {
      const p = getAssetRiskParams(currentAssetKey);
      if (p) {
        const sL = p.spreadLongBps !== undefined ? Number(p.spreadLongBps) : 30;
        const sS = p.spreadShortBps !== undefined ? Number(p.spreadShortBps) : 30;
        setTeeSpreads({ spreadLongBps: sL, spreadShortBps: sS });
      }
    }
  }, [currentAssetKey, getAssetRiskParams]);

  useEffect(() => {
    const handle24hMetrics = (e) => {
      if (e.detail && e.detail.high24h !== undefined && e.detail.low24h !== undefined) {
        setHigh24h(e.detail.high24h);
        setLow24h(e.detail.low24h);
      }
    };
    window.addEventListener('brokex_24h_metrics_updated', handle24hMetrics);
    return () => window.removeEventListener('brokex_24h_metrics_updated', handle24hMetrics);
  }, []);

  const { currentMarkPrice: liveMarkPrice, high24hMap, low24hMap } = usePriceStream();

  const effectiveHigh24h = high24h > 0 ? high24h : (high24hMap?.[currentAssetKey] || 0);
  const effectiveLow24h = (low24h > 0 && low24h < Infinity) ? low24h : (low24hMap?.[currentAssetKey] || 0);

  useEffect(() => {
    if (liveMarkPrice > 0) {
      const formattedPrice = liveMarkPrice.toLocaleString('en-US', { minimumFractionDigits: currentAssetKey === 'XRP' ? 4 : 2, maximumFractionDigits: currentAssetKey === 'XRP' ? 4 : 2 });
      setLivePrice(formattedPrice);
    }
  }, [liveMarkPrice, currentAssetKey]);

  // Compute exact dynamic stats matching TopNav.jsx
  const currentAssetData = snapshotData?.assets?.[currentAssetKey] || snapshotData?.assets?.GOLD?.snapshot || snapshotData?.assets?.GOLD || null;
  const astSnap = currentAssetData?.snapshot || currentAssetData || null;
  const snapConfig = astSnap?.config || {};

  const rawBorrowFee = Number(snapConfig.borrowRateHourly || 100);
  const borrowFeePct = (rawBorrowFee / 10000).toFixed(4); // "0.0100"

  const oiLongRaw = Number(astSnap?.openInterestLong || 0) / 1e6;
  const oiShortRaw = Number(astSnap?.openInterestShort || 0) / 1e6;
  const oiTotalRaw = (astSnap?.totalOpenInterest ? Number(astSnap.totalOpenInterest) : (oiLongRaw + oiShortRaw) * 1e6) / 1e6;
  const maxOiRaw = Number(snapConfig.maxGlobalOI || 500000000000) / 1e6;

  const totalOiForRatio = oiLongRaw + oiShortRaw;
  const longRatio = totalOiForRatio > 0 ? Math.round((oiLongRaw / totalOiForRatio) * 100) : 50;
  const shortRatio = 100 - longRatio;

  const numericLivePrice = parseFloat((livePrice || '0').replace(/,/g, '')) || 0;
  const spreadDisplayStr = numericLivePrice > 0 
    ? `$${((teeSpreads.spreadLongBps / 10000) * numericLivePrice).toFixed(2)} (${(teeSpreads.spreadLongBps / 100).toFixed(2)}%)` 
    : `${(teeSpreads.spreadLongBps / 100).toFixed(2)}%`;

  const getAssetVolume24h = (volData, assetKey) => {
    if (!volData || !volData.v24h) return 0;
    const v24h = volData.v24h;
    if (v24h.byAsset && v24h.byAsset[assetKey]) {
      const item = v24h.byAsset[assetKey];
      const val = typeof item === 'object' ? (item.totalVolume || item.volume || 0) : item;
      return Number(val || 0);
    }
    if (v24h[assetKey] !== undefined) {
      const item = v24h[assetKey];
      const val = typeof item === 'object' ? (item.totalVolume || item.volume || 0) : item;
      return Number(val || 0);
    }
    return Number(v24h.totalVolume || 0);
  };

  const vol24hRaw = getAssetVolume24h(volumeData, currentAssetKey);

  function formatCompactUSD(val) {
    const num = Number(val || 0);
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  const dynamicMarketInfo = {
    ...activeMarketInfo,
    price: livePrice,
    change: priceChange
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Title & Select with Live Streamed Price */}
      <MobileTradeHeader 
        activeMarketInfo={dynamicMarketInfo} 
        setIsMarketSelectorOpen={setIsMarketSelectorOpen} 
      />

      {/* 2. Scrollable stats row (matching TopNav.jsx metrics exactly) */}
      <div className="mobile-metrics-scroll no-scrollbar" style={{
        display: 'flex',
        gap: '18px',
        overflowX: 'auto',
        padding: '4px 12px 12px 12px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        borderBottom: '1px solid var(--border-color)',
        background: 'transparent'
      }}>
        <style>{`
          .mobile-metrics-scroll > * { flex-shrink: 0; }
        `}</style>

        {/* Spread */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Spread</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {spreadDisplayStr}
          </span>
        </div>

        {/* Borrow Fee */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Borrow Fee</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {borrowFeePct}%/h
          </span>
        </div>

        {/* Open Interest */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Open Interest</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {formatCompactUSD(oiTotalRaw)} / {formatCompactUSD(maxOiRaw)}
          </span>
        </div>

        {/* Long/Short Ratio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>L/S Ratio</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            <span style={{ color: '#3b82f6' }}>{longRatio}%</span>
            <span style={{ color: 'var(--text-grey)', margin: '0 2px' }}>/</span>
            <span style={{ color: '#ef4444' }}>{shortRatio}%</span>
          </span>
        </div>

        {/* 24h Volume */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>24h Volume</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {formatCompactUSD(vol24hRaw)}
          </span>
        </div>

        {/* 24h High & Low Group */}
        <div style={{ display: 'flex', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>24h High</span>
            <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: '#3b82f6' }}>
              {effectiveHigh24h > 0 ? `$${effectiveHigh24h.toLocaleString('en-US', { minimumFractionDigits: currentAssetKey === 'XRP' ? 4 : 2, maximumFractionDigits: currentAssetKey === 'XRP' ? 4 : 2 })}` : '—'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>24h Low</span>
            <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: '#ef4444' }}>
              {effectiveLow24h > 0 && effectiveLow24h < Infinity ? `$${effectiveLow24h.toLocaleString('en-US', { minimumFractionDigits: currentAssetKey === 'XRP' ? 4 : 2, maximumFractionDigits: currentAssetKey === 'XRP' ? 4 : 2 })}` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 1. MOBILE TRADE INFO (Ticker & Market Stats)
// ----------------------------------------------------
export function MobileTradeInfo({ onOpenMarket, activeView, setActiveView }) {
  const stats = {
    ticker: 'XAU/USD',
    price: '2,315.10',
    change: '+0.12%',
    fundingLong: '0.0100%',
    fundingShort: '-0.0100%',
    oi: '125.4M',
    maxOi: '500M',
    longRatio: 65,
    vol24h: '842.5M'
  };

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: '1px solid var(--border-color)',
      borderRadius: '0px',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%'
    }}>
      {/* Top Ticker Selector & Main Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {/* Left: Ticker selector */}
        <div 
          onClick={onOpenMarket}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            cursor: 'pointer'
          }}
        >
          <div style={{ 
            width: '28px', 
            height: '28px', 
            background: goldAccent, 
            borderRadius: '6px', 
            color: '#000', 
            fontWeight: 'bold', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '11px',
            fontFamily: 'Source Code Pro, monospace'
          }}>
            [{stats.ticker.includes('XRP') ? 'XRP' : 'XAU'}]
          </div>
          <span style={{ fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
            {stats.ticker}
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-grey)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </div>

        {/* Right: Main Price (Larger font size) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)', lineHeight: '1.1' }}>
            ${stats.price}
          </span>
        </div>
      </div>

      {activeView !== 'positions' && (
        <>
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '2px 0' }} />

          {/* Horizontal Scrolling Stats grid for clean fit */}
          <div style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            <style>{`
              .mobile-scroll-stats::-webkit-scrollbar { display: none; }
            `}</style>
            
            <div className="mobile-scroll-stats" style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Funding L/S</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  <span style={{ color: '#ef4444' }}>{stats.fundingLong}</span>
                  <span style={{ color: 'var(--text-grey)', margin: '0 2px' }}>/</span>
                  <span style={{ color: '#3b82f6' }}>{stats.fundingShort}</span>
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Open Interest</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  {stats.oi} <span style={{ color: 'var(--text-grey)', fontSize: '8px' }}>/ {stats.maxOi}</span>
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Long/Short Ratio</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  <span style={{ color: '#3b82f6' }}>{stats.longRatio}%</span>
                  <span style={{ color: 'var(--text-grey)', margin: '0 2px' }}>/</span>
                  <span style={{ color: '#ef4444' }}>{100 - stats.longRatio}%</span>
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>24h Volume</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  ${stats.vol24h}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 2. MOBILE POSITIONS (Imported from Standalone Component)
// ----------------------------------------------------

// ----------------------------------------------------
// 3. MOBILE ORDER PANEL (Imported from Standalone Component)
// ----------------------------------------------------

// ----------------------------------------------------
// 4. MOBILE POSITION MANAGER (Details & Edit Modal)
// ----------------------------------------------------
export function MobilePositionManager({ isOpen, onClose, position, initialTab = 'close' }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [closeAmount, setCloseAmount] = useState(100);
  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  const [marginAction, setMarginAction] = useState('add');
  const [marginAmount, setMarginAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial state when position/isOpen changes
  useEffect(() => {
    if (isOpen && position) {
      setTpValue(position.tp?.replace('$', '') || '');
      setSlValue(position.sl?.replace('$', '') || '');
    }
  }, [isOpen, position]);

  // Sync tab when opened via specific quick buttons
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const handleAction = async () => {
    if (activeTab !== 'close') {
      showNotification && showNotification({ type: 'info', title: 'Not Implemented', message: `${activeTab} action is coming soon.` });
      return;
    }

    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS;
    if (!coreAddress) {
      showNotification && showNotification({ type: 'error', title: 'Configuration Error', message: 'VITE_BROKEX_CORE_ADDRESS is not set.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const rawTradeId = position.tradeId || position.id || '0';
      const cleanTradeIdStr = String(rawTradeId).replace(/[^0-9]/g, '') || '0';
      const tradeId = BigInt(cleanTradeIdStr);

      const defaultAssetHash = import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55';
      const assetHash = position.assetHash || defaultAssetHash;

      showNotification && showNotification({ type: 'info', title: 'Fetching TEE Proof', message: 'Retrieving signed TEE risk proof...' });
      const proofData = await fetchTeeProof(assetHash);

      const riskProof = {
        assetHash: proofData.assetHash || assetHash,
        maxOILong: BigInt(proofData.maxOILong || "10000000000000"),
        maxOIShort: BigInt(proofData.maxOIShort || "10000000000000"),
        spreadLong: BigInt(proofData.spreadLong ?? 10),
        spreadShort: BigInt(proofData.spreadShort ?? 10),
        timestamp: BigInt(proofData.timestamp || Math.floor(Date.now() / 1000)),
        sig: proofData.sig || "0x"
      };

      const targetAbi = closePositionMarketAbi || {
        "inputs": [
          { "internalType": "bytes32", "name": "assetHash", "type": "bytes32" },
          { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
          {
            "components": [
              { "internalType": "bytes32", "name": "assetHash", "type": "bytes32" },
              { "internalType": "uint256", "name": "maxOILong", "type": "uint256" },
              { "internalType": "uint256", "name": "maxOIShort", "type": "uint256" },
              { "internalType": "uint256", "name": "spreadLong", "type": "uint256" },
              { "internalType": "uint256", "name": "spreadShort", "type": "uint256" },
              { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
              { "internalType": "bytes", "name": "sig", "type": "bytes" }
            ],
            "internalType": "struct BrokexCore.RiskProof",
            "name": "riskProof",
            "type": "tuple"
          }
        ],
        "name": "closePositionMarket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      };

      showNotification && showNotification({ type: 'info', title: 'Submitting Close Order', message: 'Please confirm transaction in your wallet...' });

      const txHash = await writeContractAsync({
        address: coreAddress,
        abi: [targetAbi],
        functionName: 'closePositionMarket',
        args: [assetHash, tradeId, riskProof]
      });

      showNotification && showNotification({
        type: 'success',
        title: 'Position Close Submitted!',
        message: `Transaction sent successfully: ${txHash.slice(0, 10)}...`
      });

      onClose();
    } catch (err) {
      console.error("Mobile closePositionMarket error:", err);
      showNotification && showNotification({
        type: 'error',
        title: 'Close Position Failed',
        message: err.shortMessage || err.message || 'Transaction failed'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      {/* Modal Card container */}
      <div style={{
        background: 'var(--bg-dark)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        
        {/* Header Block */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{position.asset}</span>
            <span style={{
              fontSize: '8px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 'bold',
              background: position.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: position.side === 'Long' ? '#3b82f6' : '#ef4444'
            }}>
              {position.side.toUpperCase()}
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-grey)',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: '1',
              padding: '2px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Quick Position Status */}
        <div style={{
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.01)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Unrealized PnL</span>
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 'bold', 
              fontFamily: 'Source Code Pro',
              color: position.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444' 
            }}>
              {position.pnlUsd} <span style={{ fontSize: '11px', fontWeight: '500' }}>({position.pnlPct})</span>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Collateral</span>
            <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'Source Code Pro' }}>
              {position.collateral}
            </span>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {['close', 'collateral', 'tpsl'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeTab === tab ? goldAccentLight : 'transparent',
                color: activeTab === tab ? goldAccent : 'var(--text-grey)',
                border: `1px solid ${activeTab === tab ? goldAccent : 'transparent'}`
              }}
            >
              {tab === 'collateral' ? 'Margin' : tab === 'tpsl' ? 'TP/SL' : 'Close'}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div style={{ padding: '16px', flex: 1, minHeight: '180px' }}>
          
          {activeTab === 'close' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Close Percentage</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: goldAccent, fontFamily: 'Source Code Pro' }}>{closeAmount}%</span>
              </div>
              <input
                type="range" min="1" max="100" value={closeAmount} onChange={e => setCloseAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: goldAccent, height: '4px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p} onClick={() => setCloseAmount(p)}
                    style={{ 
                      flex: 1, 
                      padding: '4px', 
                      fontSize: '9px', 
                      background: closeAmount === p ? goldAccentLight : 'rgba(255,255,255,0.02)', 
                      border: `1px solid ${closeAmount === p ? goldAccent : 'var(--border-color)'}`, 
                      borderRadius: '4px', 
                      color: closeAmount === p ? goldAccent : 'var(--text-grey)', 
                      cursor: 'pointer',
                      fontWeight: 'bold' 
                    }}
                  >{p}%</button>
                ))}
              </div>
              <div style={{ 
                padding: '10px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '6px', 
                fontSize: '10px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px', 
                marginTop: '6px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Closing size</span>
                  <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
                    ${(closeAmount / 100 * parseFloat(position.size.replace('$', '').replace(',', ''))).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Estimated Return</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>
                    ${(closeAmount / 100 * (parseFloat(position.collateral.replace('$', '')) + parseFloat(position.pnlUsd.replace('$', '').replace('+', '')))).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collateral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ 
                display: 'flex', 
                gap: '4px', 
                background: 'rgba(255,255,255,0.02)', 
                padding: '3px', 
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}>
                <button 
                  onClick={() => setMarginAction('add')} 
                  style={{ 
                    flex: 1, padding: '5px', fontSize: '10px', fontWeight: 'bold',
                    background: marginAction === 'add' ? goldAccentLight : 'transparent', 
                    border: `1px solid ${marginAction === 'add' ? goldAccent : 'transparent'}`, 
                    borderRadius: '4px', color: marginAction === 'add' ? goldAccent : 'var(--text-grey)', 
                    cursor: 'pointer' 
                  }}
                >ADD MARGIN</button>
                <button 
                  onClick={() => setMarginAction('remove')} 
                  style={{ 
                    flex: 1, padding: '5px', fontSize: '10px', fontWeight: 'bold',
                    background: marginAction === 'remove' ? goldAccentLight : 'transparent', 
                    border: `1px solid ${marginAction === 'remove' ? goldAccent : 'transparent'}`, 
                    borderRadius: '4px', color: marginAction === 'remove' ? goldAccent : 'var(--text-grey)', 
                    cursor: 'pointer' 
                  }}
                >REMOVE MARGIN</button>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Amount</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>Bal: 1,500 USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number" value={marginAmount} onChange={e => setMarginAmount(e.target.value)} placeholder="0.00"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-dark)', fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro', width: '70%' }}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-dark)' }}>USDC</span>
                </div>
              </div>
              <div style={{ 
                padding: '10px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '6px', 
                fontSize: '10px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>New Leverage</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold' }}>{marginAction === 'add' ? '42x' : '58x'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>New Liq. Price</span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{marginAction === 'add' ? '$2,105.20' : '$2,350.40'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tpsl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Take Profit Box */}
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>Take Profit</span>
                  <span style={{ fontSize: '10px', color: goldAccent, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>Target</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={tpValue}
                    onChange={e => setTpValue(e.target.value)}
                    placeholder="None"
                    style={{
                      width: '75%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      color: 'var(--text-dark)',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fontFamily: 'Source Code Pro, monospace'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>USD</span>
                </div>
              </div>

              {/* Stop Loss Box */}
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>Stop Loss</span>
                  <span style={{ fontSize: '10px', color: goldAccent, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>Stop</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={slValue}
                    onChange={e => setSlValue(e.target.value)}
                    placeholder="None"
                    style={{
                      width: '75%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      color: 'var(--text-dark)',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fontFamily: 'Source Code Pro, monospace'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>USD</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Submit Actions Button */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
          <button
            onClick={handleAction}
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              padding: '10px', 
              background: goldAccent, 
              border: 'none', 
              borderRadius: '6px', 
              color: '#fff', 
              fontWeight: 'bold', 
              fontSize: '12px', 
              cursor: isSubmitting ? 'not-allowed' : 'pointer', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Processing...' : (!isConnected ? 'Connect Wallet' : (activeTab === 'close' ? `Close ${closeAmount}% Position` : activeTab === 'collateral' ? `${marginAction === 'add' ? 'Add' : 'Remove'} Margin` : 'Update TP/SL'))}
          </button>
        </div>
      </div>
    </div>
  );
}

