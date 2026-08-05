import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useNotifications } from '../context/NotificationContext';
import { usePriceStream } from '../context/PriceContext';
import { useGlobalData } from '../context/DataContext';
import PositionManager from './PositionManager';
import { cancelOrderAbi, closePositionMarketAbi, fetchTeeProof } from './OrderPanel';

const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';
const DEFAULT_TRADER = '0xca30CD2760E48af1Be32C8420e71803DA6735142';

// Helper to format Unix timestamps to concise English time string (MM/DD HH:mm:ss)
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

export default function Positions() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('open'); // 'open', 'orders', 'closed', 'cancelled'
  const [filter, setFilter] = useState('all');
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [cancellingTradeId, setCancellingTradeId] = useState(null);
  const [closingTradeId, setClosingTradeId] = useState(null);

  const [livePrices, setLivePrices] = useState({ GOLD: 4046.52, XRP: 2.45 });
  const [profitCapUSD, setProfitCapUSD] = useState(100000);
  const [rawApiTrades, setRawApiTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  const openManager = (pos) => {
    setSelectedPosition(pos);
    setIsManagerOpen(true);
  };

  const handleClosePosition = async (item) => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS;
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

  const handleCancelOrder = async (item) => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS;
    if (!coreAddress) {
      if (showNotification) showNotification('VITE_BROKEX_CORE_ADDRESS is not set.', 'error');
      return;
    }

    const rawTradeId = item.rawId !== undefined ? item.rawId : (item.tradeId || item.id || '0');
    const cleanTradeIdStr = String(rawTradeId).replace(/[^0-9]/g, '') || '0';
    const tradeId = BigInt(cleanTradeIdStr);

    setCancellingTradeId(cleanTradeIdStr);
    try {
      if (showNotification) showNotification('Please confirm transaction in your wallet...', 'info');

      const targetAbi = cancelOrderAbi || {
        "inputs": [
          { "internalType": "uint256", "name": "tradeId", "type": "uint256" }
        ],
        "name": "cancelOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      };

      const txHash = await writeContractAsync({
        address: coreAddress,
        abi: [targetAbi],
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


  const { snapshotData: globalSnapshot, riskParams: globalRisk } = useGlobalData();
  const { prices } = usePriceStream();

  useEffect(() => {
    if (prices) {
      setLivePrices(prev => ({
        ...prev,
        ...prices
      }));
    }
  }, [prices]);

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

  useEffect(() => {
    if (globalSnapshot) {
      const goldConfig = globalSnapshot.assets?.GOLD?.snapshot?.config || globalSnapshot.assets?.GOLD?.config;
      if (goldConfig?.profitCap) {
        const capVal = Number(goldConfig.profitCap);
        if (!isNaN(capVal) && capVal > 0) {
          const capUSD = capVal > 1000000 ? capVal / 1e6 : capVal;
          setProfitCapUSD(capUSD);
        }
      }
    }
  }, [globalSnapshot]);

  // 3. Fetch Trader Trades from GET /api/trades/trader/:traderAddress
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

  useEffect(() => {
    if (globalRisk) {
      const goldItem = globalRisk.GOLD || globalRisk.XAU || (typeof globalRisk === 'object' ? Object.values(globalRisk)[0] : null) || globalRisk;
      const xrpItem = globalRisk.XRP;

      const gL = goldItem?.spreadLongBps !== undefined ? Number(goldItem.spreadLongBps) : 30;
      const gS = goldItem?.spreadShortBps !== undefined ? Number(goldItem.spreadShortBps) : 30;

      const xL = xrpItem?.spreadLongBps !== undefined ? Number(xrpItem.spreadLongBps) : 30;
      const xS = xrpItem?.spreadShortBps !== undefined ? Number(xrpItem.spreadShortBps) : 30;

      setTeeSpreads({
        GOLD: { spreadLongBps: gL, spreadShortBps: gS },
        XRP: { spreadLongBps: xL, spreadShortBps: xS }
      });
    }
  }, [globalRisk]);

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
    // To close a LONG position -> sell at Bid price: markPrice * (1 - spreadShortBps / 100000)
    // To close a SHORT position -> buy back at Ask price: markPrice * (1 + spreadLongBps / 100000)
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
      // Rule 1: Loss cannot exceed margin / collateral (Max loss = -marginNum)
      if (marginNum > 0 && pnlUsdVal < -marginNum) {
        pnlUsdVal = -marginNum;
      }
      // Rule 2: Profit cannot exceed profitCap from asset snapshot (Max profit = profitCapUSD)
      if (profitCapUSD > 0 && pnlUsdVal > profitCapUSD) {
        pnlUsdVal = profitCapUSD;
      }
    }

    const pnlPctVal = marginNum > 0 ? (pnlUsdVal / marginNum) * 100 : 0;
    const isPos = pnlUsdVal >= 0;

    return {
      id: `#${raw.id}`,
      rawId: raw.id,
      trader: raw.trader || address || DEFAULT_TRADER,
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
      status: stateNum === 0 ? 'Pending' : stateNum === 2 ? 'Closed' : stateNum === 3 ? 'Canceled' : stateNum === 4 ? 'Liquidated' : 'Open'
    };
  };

  // Separate trades by exact state:
  const openTrades = rawApiTrades.filter(t => t.state === 1).map(parseTrade);
  const orderTrades = rawApiTrades.filter(t => t.state === 0).map(parseTrade);
  const closedTrades = rawApiTrades.filter(t => t.state === 2 || t.state === 4).map(parseTrade);
  const cancelledTrades = rawApiTrades.filter(t => t.state === 3).map(parseTrade);

  // Active list based on tab
  const activeList = 
    activeTab === 'open' ? openTrades :
    activeTab === 'orders' ? orderTrades :
    activeTab === 'closed' ? closedTrades : cancelledTrades;

  // Filter by asset if needed
  const filteredList = filter === 'xau' ? activeList.filter(t => t.asset.toLowerCase().includes('xau')) : activeList;

  return (
    <div className="positions panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Bar with Separate Tabs (Open, Orders, Closed, Cancelled) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 10px', 
        height: '40px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {[
            { id: 'open', label: 'open positions', count: openTrades.length },
            { id: 'orders', label: 'orders', count: orderTrades.length },
            { id: 'closed', label: 'closed', count: closedTrades.length },
            { id: 'cancelled', label: 'cancelled', count: cancelledTrades.length }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ 
                background: 'transparent', 
                border: activeTab === tab.id ? '1px solid #BC8961' : '1px solid transparent', 
                color: activeTab === tab.id ? '#BC8961' : 'var(--text-grey)', 
                fontSize: '10px', 
                fontWeight: 'bold',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase'
              }}
            >
              {tab.label} [{tab.count}]
            </button>
          ))}
        </div>

        {/* Right Filter Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px' }}>
            {['all', 'xau'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                style={{ 
                  background: 'transparent', 
                  border: filter === f ? '1px solid #BC8961' : '1px solid transparent', 
                  color: filter === f ? '#BC8961' : 'var(--text-grey)', 
                  fontSize: '9px', 
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table View - Continuous Full List Scroll */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          
          {/* OPEN POSITIONS HEADER */}
          {activeTab === 'open' && (
            <div style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '10px',
              color: 'var(--text-grey)',
              borderBottom: '1px solid var(--border-color)',
              textTransform: 'uppercase',
              fontWeight: '600',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--panel-bg)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ width: '50px' }}>ID</div>
              <div style={{ width: '130px' }}>Asset</div>
              <div style={{ flex: 1 }}>Size</div>
              <div style={{ flex: 1 }}>Lev.</div>
              <div style={{ flex: 1 }}>Coll.</div>
              <div style={{ flex: 1, color: '#BC8961' }}>Open Price</div>
              <div style={{ flex: 1 }}>Liq. Price</div>
              <div style={{ flex: 1 }}>SL</div>
              <div style={{ flex: 1 }}>TP</div>
              <div style={{ flex: 1 }}>Market</div>
              <div style={{ flex: 1.5, textAlign: 'right' }}>PnL (USD/%)</div>
              <div style={{ width: '70px', textAlign: 'right' }}>Action</div>
            </div>
          )}

          {/* ORDERS HEADER */}
          {activeTab === 'orders' && (
            <div style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '10px',
              color: 'var(--text-grey)',
              borderBottom: '1px solid var(--border-color)',
              textTransform: 'uppercase',
              fontWeight: '600',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--panel-bg)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ width: '50px' }}>ID</div>
              <div style={{ width: '130px' }}>Asset</div>
              <div style={{ flex: 1 }}>Size</div>
              <div style={{ flex: 1 }}>Lev.</div>
              <div style={{ flex: 1 }}>Coll.</div>
              <div style={{ flex: 1 }}>Created</div>
              <div style={{ flex: 1 }}>Order Price</div>
              <div style={{ flex: 1 }}>SL</div>
              <div style={{ flex: 1 }}>TP</div>
              <div style={{ flex: 1.5, textAlign: 'right' }}>Status</div>
              <div style={{ width: '70px', textAlign: 'right' }}>Action</div>
            </div>
          )}

          {/* CLOSED HEADER */}
          {activeTab === 'closed' && (
            <div style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '10px',
              color: 'var(--text-grey)',
              borderBottom: '1px solid var(--border-color)',
              textTransform: 'uppercase',
              fontWeight: '600',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--panel-bg)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ width: '50px' }}>ID</div>
              <div style={{ width: '130px' }}>Asset</div>
              <div style={{ flex: 1 }}>Size</div>
              <div style={{ flex: 1 }}>Lev.</div>
              <div style={{ flex: 1 }}>Coll.</div>
              <div style={{ flex: 1 }}>Open</div>
              <div style={{ flex: 1 }}>Close</div>
              <div style={{ flex: 1.2 }}>Closed</div>
              <div style={{ flex: 0.8 }}>Fee</div>
              <div style={{ flex: 1.5, textAlign: 'right' }}>PnL (USD/%)</div>
              <div style={{ width: '70px', textAlign: 'right' }}>Status</div>
            </div>
          )}

          {/* CANCELLED HEADER */}
          {activeTab === 'cancelled' && (
            <div style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '10px',
              color: 'var(--text-grey)',
              borderBottom: '1px solid var(--border-color)',
              textTransform: 'uppercase',
              fontWeight: '600',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--panel-bg)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ width: '50px' }}>ID</div>
              <div style={{ width: '130px' }}>Asset</div>
              <div style={{ flex: 1 }}>Size</div>
              <div style={{ flex: 1 }}>Lev.</div>
              <div style={{ flex: 1 }}>Coll.</div>
              <div style={{ flex: 1.2 }}>Created</div>
              <div style={{ flex: 1.2 }}>Canceled</div>
              <div style={{ flex: 1 }}>Order Price</div>
              <div style={{ flex: 1, textAlign: 'right' }}>Status</div>
            </div>
          )}

          {/* Content Rows (Full List or Blurred Skeleton Placeholders) */}
          {filteredList.length === 0 ? (
            Array.from({ length: 10 }).map((_, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  width: '100%',
                  padding: '6px 15px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  height: '32px'
                }} 
                className="position-row-placeholder"
              >
                <div style={{ width: '50px' }}>
                  <div className="skeleton-pill" style={{ width: '28px', height: '10px' }} />
                </div>
                <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="skeleton-pill" style={{ width: '55px', height: '12px' }} />
                  <div className="skeleton-pill" style={{ width: '32px', height: '10px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-pill" style={{ width: '50px', height: '10px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-pill" style={{ width: '24px', height: '10px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-pill" style={{ width: '40px', height: '10px' }} />
                </div>

                {activeTab === 'open' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '35px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '35px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '65px', height: '11px' }} />
                    </div>
                    <div style={{ width: '70px', display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '45px', height: '16px', borderRadius: '4px' }} />
                    </div>
                  </>
                )}

                {activeTab === 'orders' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '60px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '35px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '35px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '50px', height: '10px' }} />
                    </div>
                    <div style={{ width: '70px', display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '45px', height: '16px', borderRadius: '4px' }} />
                    </div>
                  </>
                )}

                {activeTab === 'closed' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1.2 }}>
                      <div className="skeleton-pill" style={{ width: '65px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <div className="skeleton-pill" style={{ width: '30px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '60px', height: '11px' }} />
                    </div>
                    <div style={{ width: '70px', display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '40px', height: '10px' }} />
                    </div>
                  </>
                )}

                {activeTab === 'cancelled' && (
                  <>
                    <div style={{ flex: 1.2 }}>
                      <div className="skeleton-pill" style={{ width: '65px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1.2 }}>
                      <div className="skeleton-pill" style={{ width: '65px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pill" style={{ width: '55px', height: '10px' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="skeleton-pill" style={{ width: '45px', height: '10px' }} />
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            filteredList.map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                width: '100%',
                padding: '6px 15px',
                fontSize: '11px',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                height: '32px'
              }} className="position-row">
                <div style={{ width: '50px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.id}</div>
                <div style={{ width: '130px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ minWidth: '65px' }}>{item.asset}</span>
                  <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: item.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: item.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{item.side.toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{item.size}</div>
                <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{item.leverage}</div>
                <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {item.collateral}
                  {activeTab === 'open' && (
                    <button 
                      onClick={() => openManager(item)}
                      style={{ background: 'transparent', border: 'none', color: '#BC8961', cursor: 'pointer', padding: '2px', display: 'flex' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  )}
                </div>

                {/* OPEN POSITIONS SPECIFIC COLUMNS */}
                {activeTab === 'open' && (
                  <>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-dark)', fontWeight: 'bold' }}>{item.entryPrice}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#ef4444' }}>{item.liqPrice}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.sl}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.tp}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{item.marketPrice}</div>
                    <div style={{ flex: 1.5, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: 'bold', color: item.pnlUsd.startsWith('+') ? '#3b82f6' : (item.pnlUsd.startsWith('-') ? '#ef4444' : 'var(--text-grey)') }}>
                      {item.pnlUsd} {item.pnlPct !== '—' && <span style={{ fontSize: '9px', opacity: 0.8 }}>({item.pnlPct})</span>}
                    </div>
                    <div style={{ width: '70px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleClosePosition(item)}
                        disabled={closingTradeId === String(item.rawId || item.id).replace(/[^0-9]/g, '')}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          fontSize: '9px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          opacity: closingTradeId === String(item.rawId || item.id).replace(/[^0-9]/g, '') ? 0.5 : 1
                        }}
                      >
                        {closingTradeId === String(item.rawId || item.id).replace(/[^0-9]/g, '') ? '...' : 'CLOSE'}
                      </button>
                    </div>
                  </>
                )}

                {/* ORDERS SPECIFIC COLUMNS */}
                {activeTab === 'orders' && (
                  <>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.openTime}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{item.orderPrice}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.sl}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.tp}</div>
                    <div style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: '#BC8961' }}>{item.status}</div>
                    <div style={{ width: '70px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleCancelOrder(item)}
                        disabled={cancellingTradeId === String(item.rawId || item.id).replace(/[^0-9]/g, '')}
                        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-dark)', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontWeight: '600', opacity: cancellingTradeId === String(item.rawId || item.id).replace(/[^0-9]/g, '') ? 0.5 : 1 }}
                      >
                        {cancellingTradeId === String(item.rawId || item.id).replace(/[^0-9]/g, '') ? '...' : 'CANCEL'}
                      </button>
                    </div>
                  </>
                )}

                {/* CLOSED SPECIFIC COLUMNS */}
                {activeTab === 'closed' && (
                  <>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{item.entryPrice}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{item.closePrice}</div>
                    <div style={{ flex: 1.2, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.closeTime}</div>
                    <div style={{ flex: 0.8, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.borrowFee}</div>
                    <div style={{ flex: 1.5, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: 'bold', color: item.pnlUsd.startsWith('+') ? '#3b82f6' : (item.pnlUsd.startsWith('-') ? '#ef4444' : 'var(--text-grey)') }}>
                      {item.pnlUsd} {item.pnlPct !== '—' && <span style={{ fontSize: '9px', opacity: 0.8 }}>({item.pnlPct})</span>}
                    </div>
                    <div style={{ width: '70px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-grey)', fontSize: '10px' }}>
                      {item.status}
                    </div>
                  </>
                )}

                {/* CANCELLED SPECIFIC COLUMNS */}
                {activeTab === 'cancelled' && (
                  <>
                    <div style={{ flex: 1.2, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.openTime}</div>
                    <div style={{ flex: 1.2, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{item.closeTime}</div>
                    <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{item.orderPrice}</div>
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', color: 'var(--text-grey)', fontSize: '10px' }}>
                      Canceled
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .position-row:hover {
          background: rgba(255,255,255,0.03);
        }
        .skeleton-pill {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          filter: blur(1px);
          animation: skeletonPulse 1.8s infinite ease-in-out;
        }
        @keyframes skeletonPulse {
          0% { opacity: 0.12; }
          50% { opacity: 0.35; }
          100% { opacity: 0.12; }
        }
      `}</style>

      <PositionManager 
        isOpen={isManagerOpen} 
        onClose={() => setIsManagerOpen(false)} 
        position={selectedPosition}
        livePrice={selectedPosition?.assetKey === 'XRP' || selectedPosition?.asset === 'XRP/USD' ? livePrices.XRP : livePrices.GOLD}
      />
    </div>
  );
}
