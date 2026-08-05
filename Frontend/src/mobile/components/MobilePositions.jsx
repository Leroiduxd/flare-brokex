import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useNotifications } from '../../context/NotificationContext';
import PositionManager from '../../components/PositionManager';
import { cancelOrderAbi, closePositionMarketAbi, fetchTeeProof } from '../../components/OrderPanel';

const goldAccent = '#BC8961';
const buyColor = '#3b82f6';
const sellColor = '#ef4444';
const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

function formatTimestamp(ts) {
  if (!ts || Number(ts) === 0) return '—';
  const date = new Date(Number(ts) * 1000);
  if (isNaN(date.getTime())) return '—';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${m}/${d} ${hh}:${mm}:${ss}`;
}

export default function MobilePositions({ onManagePosition, isFullPage = false }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('open'); // 'open', 'orders', 'closed', 'cancelled'
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const [livePrices, setLivePrices] = useState({ GOLD: 4046.52, XRP: 2.45 });
  const [profitCapUSD, setProfitCapUSD] = useState(100000);
  const [rawApiTrades, setRawApiTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [cancellingTradeId, setCancellingTradeId] = useState(null);

  const openManager = (pos) => {
    if (onManagePosition) {
      onManagePosition(pos);
    } else {
      setSelectedPosition(pos);
      setIsManagerOpen(true);
    }
  };

  // 1. SSE Real-time Price Streaming from API for both GOLD & XRP
  useEffect(() => {
    let eventSource = null;
    const connectSSE = () => {
      const targetUrl = `${apiBase}/v1/shims/tradingview/streaming`;
      try {
        eventSource = new EventSource(targetUrl);
        eventSource.onmessage = (event) => {
          if (!event.data) return;
          try {
            const data = JSON.parse(event.data);
            const priceVal = parseFloat(data.p || data.priceUSD || data.price || data.close);
            const sym = String(data.symbol || data.name || data.s || '').toUpperCase();
            if (!isNaN(priceVal) && priceVal > 0) {
              if (sym.includes('XRP')) {
                setLivePrices(prev => ({ ...prev, XRP: priceVal }));
              } else if (sym.includes('XAU') || sym.includes('GOLD') || sym.includes('METAL') || !sym) {
                setLivePrices(prev => ({ ...prev, GOLD: priceVal }));
              }
            }
          } catch (err) {
            console.error("MobilePositions SSE parse error:", err);
          }
        };
        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
          setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        console.error("MobilePositions SSE connect error:", err);
      }
    };

    connectSSE();
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Listen to asset price updates from UI events
  useEffect(() => {
    const handleAssetChange = (e) => {
      if (e.detail && e.detail.assetKey) {
        const key = e.detail.assetKey;
        const p = e.detail.price || (key === 'XRP' ? 2.45 : 4046.52);
        setLivePrices(prev => ({ ...prev, [key]: Number(p) }));
      }
    };
    window.addEventListener('brokex_asset_changed', handleAssetChange);
    return () => window.removeEventListener('brokex_asset_changed', handleAssetChange);
  }, []);

  // 2. Fetch profitCap from /api/snapshot
  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`${apiBase}/api/snapshot`);
        if (res.ok) {
          const data = await res.json();
          const goldConfig = data.assets?.GOLD?.snapshot?.config || data.assets?.GOLD?.config;
          if (goldConfig?.profitCap) {
            const capVal = Number(goldConfig.profitCap);
            if (!isNaN(capVal) && capVal > 0) {
              const capUSD = capVal > 1000000 ? capVal / 1e6 : capVal;
              setProfitCapUSD(capUSD);
            }
          }
        }
      } catch (err) {
        console.error("MobilePositions snapshot fetch error:", err);
      }
    };

    fetchSnapshot();
  }, []);

  // 3. Fetch Trader Trades from /api/trades/trader/:address
  useEffect(() => {
    if (!address || !isConnected) {
      setRawApiTrades([]);
      setLoading(false);
      return;
    }

    const fetchTraderTrades = async () => {
      setLoading(true);
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
        console.error("MobilePositions fetch error:", err);
        setRawApiTrades([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTraderTrades();
    const interval = setInterval(fetchTraderTrades, 8000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  const [teeSpreads, setTeeSpreads] = useState({
    GOLD: { spreadLongBps: 30, spreadShortBps: 30 },
    XRP: { spreadLongBps: 30, spreadShortBps: 30 }
  });

  // Fetch TEE risk parameters for dynamic exit spread PnL calculation for GOLD & XRP
  useEffect(() => {
    let isMounted = true;
    const loadRiskParams = async () => {
      try {
        const res = await fetch(`${apiBase}/api/risk-params`).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            const goldItem = data.GOLD || data.XAU || (typeof data === 'object' ? Object.values(data)[0] : null) || data;
            const xrpItem = data.XRP;

            const gL = goldItem?.spreadLongBps !== undefined ? Number(goldItem.spreadLongBps) : (goldItem?.spreadLong !== undefined ? Number(goldItem.spreadLong) / 10 : 30);
            const gS = goldItem?.spreadShortBps !== undefined ? Number(goldItem.spreadShortBps) : (goldItem?.spreadShort !== undefined ? Number(goldItem.spreadShort) / 10 : 30);

            const xL = xrpItem?.spreadLongBps !== undefined ? Number(xrpItem.spreadLongBps) : (xrpItem?.spreadLong !== undefined ? Number(xrpItem.spreadLong) / 10 : 30);
            const xS = xrpItem?.spreadShortBps !== undefined ? Number(xrpItem.spreadShortBps) : (xrpItem?.spreadShort !== undefined ? Number(xrpItem.spreadShort) / 10 : 30);

            setTeeSpreads({
              GOLD: { spreadLongBps: gL, spreadShortBps: gS },
              XRP: { spreadLongBps: xL, spreadShortBps: xS }
            });
          }
        }
      } catch (e) {}
    };
    loadRiskParams();
    const interval = setInterval(loadRiskParams, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Helper to parse raw API trade structure according to exact backend constants
  const parseTrade = (raw) => {
    if (typeof raw.id === 'string' && raw.id.startsWith('#')) return raw;

    const goldHash = (import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55').toLowerCase();
    const xrpHash = (import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298').toLowerCase();

    const rawAssetStr = String(raw.assetHash || raw.assetKey || raw.asset || raw.symbol || '').toLowerCase();
    const isXRP = rawAssetStr.includes('xrp') || rawAssetStr === xrpHash;

    const targetAssetHash = isXRP ? xrpHash : goldHash;
    const targetAssetSymbol = isXRP ? 'XRP/USD' : 'XAU/USD';
    const targetAssetKey = isXRP ? 'XRP' : 'GOLD';
    const priceDecimals = isXRP ? 4 : 2;

    const stateNum = Number(raw.state !== undefined ? raw.state : 1);
    const dirNum = Number(raw.direction !== undefined ? raw.direction : 1);
    
    // Backend Constants: DIR_SHORT = 0, DIR_LONG = 1
    const isLong = dirNum === 1 || raw.direction === 'LONG' || raw.direction === 'buy' || raw.isLong === true;
    
    const marginNum = raw.margin ? Number(raw.margin) / 1e6 : 49.50;
    const leverageNum = Number(raw.leverage || 10);
    const sizeUsdNum = marginNum * leverageNum;

    const defaultPrice = isXRP ? 2.45 : 4046.52;
    const openPriceNum = raw.openPrice ? Number(raw.openPrice) / 1e6 : defaultPrice;
    const closePriceNum = raw.closePrice && Number(raw.closePrice) > 0 ? Number(raw.closePrice) / 1e6 : 0;
    const targetPriceNum = raw.targetPrice && Number(raw.targetPrice) > 0 ? Number(raw.targetPrice) / 1e6 : 0;
    const liqPriceNum = raw.liquidationPrice ? Number(raw.liquidationPrice) / 1e6 : 0;
    const slNum = raw.stopLoss && Number(raw.stopLoss) > 0 ? Number(raw.stopLoss) / 1e6 : 0;
    const tpNum = raw.takeProfit && Number(raw.takeProfit) > 0 ? Number(raw.takeProfit) / 1e6 : 0;
    const borrowFeeNum = raw.borrowFee ? Number(raw.borrowFee) / 1e6 : 0;

    const openTimeStr = formatTimestamp(raw.openTimestamp);
    const closeTimeStr = formatTimestamp(raw.closeTimestamp);

    // Current live price for this exact asset from SSE stream
    const assetLivePrice = isXRP ? livePrices.XRP : livePrices.GOLD;
    const currentMark = assetLivePrice && assetLivePrice > 0 ? assetLivePrice : openPriceNum;

    // Apply TEE spread for this specific asset on exit price:
    const activeSpreads = isXRP ? teeSpreads.XRP : teeSpreads.GOLD;
    const spreadLongBps = activeSpreads?.spreadLongBps || 30;
    const spreadShortBps = activeSpreads?.spreadShortBps || 30;

    const exitPrice = isLong 
      ? currentMark * (1 - spreadShortBps / 100000)
      : currentMark * (1 + spreadLongBps / 100000);

    let pnlUsdVal = 0;
    let hasPnl = false;

    if (stateNum === 1 && openPriceNum > 0) { // OPEN
      hasPnl = true;
      const diffPct = isLong ? (exitPrice - openPriceNum) / openPriceNum : (openPriceNum - exitPrice) / openPriceNum;
      pnlUsdVal = sizeUsdNum * diffPct;
    } else if ((stateNum === 2 || stateNum === 4) && openPriceNum > 0 && closePriceNum > 0) { // CLOSED / LIQUIDATED
      hasPnl = true;
      const diffPct = isLong ? (closePriceNum - openPriceNum) / openPriceNum : (openPriceNum - closePriceNum) / openPriceNum;
      pnlUsdVal = sizeUsdNum * diffPct;
    }

    if (hasPnl) {
      // Max loss = -marginNum
      if (marginNum > 0 && pnlUsdVal < -marginNum) {
        pnlUsdVal = -marginNum;
      }
      // Max profit = profitCapUSD
      if (profitCapUSD > 0 && pnlUsdVal > profitCapUSD) {
        pnlUsdVal = profitCapUSD;
      }
    }

    const pnlPctVal = marginNum > 0 ? (pnlUsdVal / marginNum) * 100 : 0;
    const isPos = pnlUsdVal >= 0;

    return {
      id: `#${raw.id}`,
      rawId: raw.id,
      trader: raw.trader || address,
      asset: targetAssetSymbol,
      assetKey: targetAssetKey,
      assetHash: targetAssetHash,
      side: isLong ? 'Long' : 'Short',
      isLong: isLong,
      state: stateNum,
      orderType: Number(raw.orderType || 0),
      entryPrice: `$${openPriceNum.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}`,
      size: `$${sizeUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      leverage: `${leverageNum}x`,
      collateral: `$${marginNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      liqPrice: liqPriceNum > 0 ? `$${liqPriceNum.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}` : '—',
      sl: slNum > 0 ? `$${slNum.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}` : '—',
      tp: tpNum > 0 ? `$${tpNum.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}` : '—',
      marketPrice: `$${currentMark.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}`,
      orderPrice: targetPriceNum > 0 ? `$${targetPriceNum.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}` : 'Market',
      closePrice: closePriceNum > 0 ? `$${closePriceNum.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}` : '—',
      borrowFee: `$${borrowFeeNum.toFixed(2)}`,
      openTime: openTimeStr,
      closeTime: closeTimeStr,
      pnlUsd: hasPnl ? `${isPos ? '+' : ''}$${pnlUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
      pnlPct: hasPnl ? `${isPos ? '+' : ''}${pnlPctVal.toFixed(2)}%` : '—',
      isPnlPos: isPos,
      status: stateNum === 0 ? 'Pending' : stateNum === 2 ? 'Closed' : stateNum === 3 ? 'Canceled' : stateNum === 4 ? 'Liquidated' : 'Open'
    };
  };

  const openTrades = rawApiTrades.filter(t => t.state === 1).map(parseTrade);
  const orderTrades = rawApiTrades.filter(t => t.state === 0).map(parseTrade);
  const closedTrades = rawApiTrades.filter(t => t.state === 2 || t.state === 4).map(parseTrade);
  const cancelledTrades = rawApiTrades.filter(t => t.state === 3).map(parseTrade);

  const currentList = 
    activeTab === 'open' ? openTrades :
    activeTab === 'orders' ? orderTrades :
    activeTab === 'closed' ? closedTrades : cancelledTrades;

  // Direct On-Chain Market Close Position Function
  const handleClosePosition = async (item) => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS || '0x5620dA2B418577b94a74B121eD61B5B84962AC93';
    if (!coreAddress) {
      if (showNotification) showNotification('VITE_BROKEX_CORE_ADDRESS is not set.', 'error');
      return;
    }

    const rawTradeId = item.rawId !== undefined ? item.rawId : (item.tradeId || item.id || '0');
    const cleanTradeIdStr = String(rawTradeId).replace(/[^0-9]/g, '') || '0';
    const tradeId = BigInt(cleanTradeIdStr);

    const goldHash = import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55';
    const xrpHash = import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298';

    const rawAssetStr = String(item.assetHash || item.assetKey || item.asset || '').toLowerCase();
    const isXRP = rawAssetStr.includes('xrp') || rawAssetStr === xrpHash.toLowerCase();

    const targetAssetHash = isXRP ? xrpHash : goldHash;
    const targetAssetKey = isXRP ? 'XRP' : 'GOLD';

    setClosingTradeId(cleanTradeIdStr);
    try {
      if (showNotification) showNotification(`Fetching signed TEE risk proof for ${targetAssetKey}...`, 'info');
      const proofData = await fetchTeeProof(targetAssetKey) || {};

      const safeBigInt = (val, fallback) => {
        try {
          if (val === undefined || val === null) return BigInt(fallback);
          return BigInt(val);
        } catch (e) {
          return BigInt(fallback);
        }
      };

      const riskProof = {
        assetHash: targetAssetHash,
        maxOILong: safeBigInt(proofData.maxOILong, "37500000000"),
        maxOIShort: safeBigInt(proofData.maxOIShort, "37500000000"),
        spreadLong: safeBigInt(proofData.spreadLong, 1000),
        spreadShort: safeBigInt(proofData.spreadShort, 1000),
        timestamp: safeBigInt(proofData.timestamp, Math.floor(Date.now() / 1000)),
        sig: proofData.sig || "0x"
      };

      if (showNotification) showNotification('Please confirm transaction in your wallet...', 'info');

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
            "internalType": "struct BrokexStructs.RiskProof",
            "name": "riskProof",
            "type": "tuple"
          }
        ],
        "name": "closePositionMarket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      };

      const txHash = await writeContractAsync({
        address: coreAddress,
        abi: [targetAbi],
        functionName: 'closePositionMarket',
        args: [targetAssetHash, tradeId, riskProof]
      });

      if (showNotification) {
        showNotification('Market position close submitted successfully!', 'success', txHash);
      }
    } catch (err) {
      console.error("closePositionMarket error:", err);
      if (showNotification) {
        showNotification(err?.shortMessage || err?.message || 'Failed to close position', 'error');
      }
    } finally {
      setClosingTradeId(null);
    }
  };

  // Direct On-Chain Cancel Order Function
  const handleCancelOrder = async (item) => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS || '0x8E8D9a9CeF5da78F92152CA7E3a193e0fdE636b3';
    const rawTradeId = item.rawId !== undefined ? item.rawId : (item.id || '0');
    const cleanTradeIdStr = String(rawTradeId).replace(/[^0-9]/g, '') || '0';
    const tradeId = BigInt(cleanTradeIdStr);

    setCancellingTradeId(cleanTradeIdStr);
    try {
      if (showNotification) showNotification('Please confirm transaction in your wallet...', 'info');

      const txHash = await writeContractAsync({
        address: coreAddress,
        abi: [cancelOrderAbi],
        functionName: 'cancelOrder',
        args: [tradeId]
      });

      if (showNotification) {
        showNotification('Order cancel submitted successfully!', 'success', txHash);
      }
    } catch (err) {
      console.error("cancelOrder error:", err);
      if (showNotification) {
        showNotification(err?.shortMessage || err?.message || 'Transaction failed', 'error');
      }
    } finally {
      setCancellingTradeId(null);
    }
  };

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderTop: isFullPage ? 'none' : '1px solid var(--border-color)',
      borderRadius: '0px',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: isFullPage ? '100%' : 'auto',
      flex: isFullPage ? 1 : 'none',
      overflow: 'hidden'
    }}>
      {/* Tabs Header */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        padding: '10px 12px 0px 12px',
        justifyContent: 'flex-start',
        gap: '12px',
        background: 'rgba(255,255,255,0.01)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {[
          { id: 'open', label: 'open', count: openTrades.length },
          { id: 'orders', label: 'orders', count: orderTrades.length },
          { id: 'closed', label: 'closed', count: closedTrades.length },
          { id: 'cancelled', label: 'cancelled', count: cancelledTrades.length }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const labelText = `${tab.label} (${tab.count})`;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? goldAccent : 'transparent'}`,
                color: isActive ? goldAccent : 'var(--text-grey)',
                fontSize: '11px',
                fontWeight: isActive ? 'bold' : '600',
                padding: '6px 0px 8px 0px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.15s'
              }}
            >
              {labelText}
            </button>
          );
        })}
      </div>

      {/* Cards List container */}
      <div style={{
        padding: '0 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        overflowY: 'auto',
        flex: 1
      }}>
        {!isConnected ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-grey)', fontSize: '11px' }}>
            CONNECT WALLET TO VIEW POSITIONS
          </div>
        ) : currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-grey)', fontSize: '11px' }}>
            NO POSITIONS OR ORDERS FOUND
          </div>
        ) : (
          currentList.map((item, idx) => {
            const cleanId = String(item.rawId || item.id || '').replace(/[^0-9]/g, '');
            const isClosing = closingTradeId === cleanId;
            const isCancelling = cancellingTradeId === cleanId;

            return (
              <div 
                key={idx}
                style={{
                  background: 'transparent',
                  borderBottom: idx !== currentList.length - 1 ? '1px solid var(--border-color)' : 'none',
                  padding: '12px 0px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Card Title Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.asset}</span>
                    <span style={{
                      fontSize: '8px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      background: item.isLong ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: item.isLong ? buyColor : sellColor
                    }}>
                      {item.side.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', color: goldAccent, fontWeight: 'bold' }}>
                      {item.leverage}
                    </span>
                  </div>

                  <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', color: 'var(--text-grey)' }}>
                    {item.id}
                  </span>
                </div>

                {/* Grid Values */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px 12px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-grey)' }}>Size:</span>
                    <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.size}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-grey)' }}>Collateral:</span>
                    <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.collateral}</span>
                  </div>
                  
                  {activeTab === 'open' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-grey)' }}>Entry Price:</span>
                        <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.entryPrice}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-grey)' }}>Liq. Price:</span>
                        <span style={{ color: '#ef4444', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.liqPrice}</span>
                      </div>
                    </>
                  )}

                  {activeTab === 'orders' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-grey)' }}>Trigger Price:</span>
                        <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.orderPrice}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-grey)' }}>Status:</span>
                        <span style={{ color: goldAccent, fontWeight: 'bold' }}>{item.status}</span>
                      </div>
                    </>
                  )}

                  {(activeTab === 'closed' || activeTab === 'cancelled') && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-grey)' }}>Close Price:</span>
                        <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.closePrice}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-grey)' }}>Status:</span>
                        <span style={{ color: 'var(--text-grey)', fontWeight: 'bold' }}>{item.status}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* SL / TP row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '10px'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>TP:</span>
                    <span style={{ color: buyColor, fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.tp}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>SL:</span>
                    <span style={{ color: sellColor, fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.sl}</span>
                  </div>
                </div>

                {/* PnL and Actions block */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.03)'
                }}>
                  <div>
                    {(activeTab === 'open' || activeTab === 'closed') && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>PnL / ROI</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          fontFamily: 'Source Code Pro',
                          color: item.isPnlPos ? buyColor : sellColor
                        }}>
                          {item.pnlUsd} <span style={{ fontSize: '10px', fontWeight: '500' }}>({item.pnlPct})</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {activeTab === 'open' && (
                      <>
                        <button
                          onClick={() => openManager(item)}
                          style={{
                            background: 'rgba(188, 137, 97, 0.15)',
                            border: `1px solid ${goldAccent}`,
                            color: goldAccent,
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleClosePosition(item)}
                          disabled={isClosing}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${sellColor}`,
                            color: sellColor,
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '6px 12px',
                            cursor: isClosing ? 'not-allowed' : 'pointer',
                            opacity: isClosing ? 0.6 : 1,
                            textTransform: 'uppercase'
                          }}
                        >
                          {isClosing ? 'CLOSING...' : 'CLOSE'}
                        </button>
                      </>
                    )}
                    {activeTab === 'orders' && (
                      <button
                        onClick={() => handleCancelOrder(item)}
                        disabled={isCancelling}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${sellColor}`,
                          color: sellColor,
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '6px 12px',
                          cursor: isCancelling ? 'not-allowed' : 'pointer',
                          opacity: isCancelling ? 0.6 : 1,
                          textTransform: 'uppercase'
                        }}
                      >
                        {isCancelling ? 'CANCELLING...' : 'CANCEL'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Position Manager Modal */}
      {isManagerOpen && selectedPosition && (
        <PositionManager 
          isOpen={isManagerOpen} 
          onClose={() => {
            setIsManagerOpen(false);
            setSelectedPosition(null);
          }} 
          position={selectedPosition} 
        />
      )}
    </div>
  );
}
