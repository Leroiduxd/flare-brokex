import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Backend Constants
// const STATE_ORDER      = 0;
// const STATE_OPEN       = 1;
// const STATE_CLOSED     = 2;
// const STATE_CANCELLED  = 3;
// const STATE_LIQUIDATED = 4;
// const DIR_SHORT = 0;
// const DIR_LONG  = 1;

export default function OrderBook() {
  const containerRef = useRef(null);
  const [containerRect, setContainerRect] = useState(null);
  const [trades, setTrades] = useState([]);
  const [livePrices, setLivePrices] = useState({ GOLD: 4046.52, XRP: 2.45 });
  const [profitCapUSD, setProfitCapUSD] = useState(100000);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredTrade, setHoveredTrade] = useState(null);

  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

  // 1. Listen to SSE live prices for both GOLD and XRP
  useEffect(() => {
    if (!apiBase) return;
    let eventSource = null;
    try {
      eventSource = new EventSource(`${apiBase}/v1/shims/tradingview/streaming`);
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
        } catch (err) {}
      };
    } catch (err) {}
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [apiBase]);

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
    if (!apiBase) return;
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
        console.error("OrderBook snapshot fetch error:", err);
      }
    };

    fetchSnapshot();
  }, [apiBase]);

  const [teeSpreads, setTeeSpreads] = useState({
    GOLD: { spreadLongBps: 30, spreadShortBps: 30 },
    XRP: { spreadLongBps: 30, spreadShortBps: 30 }
  });

  // Fetch TEE risk parameters for dynamic exit spread PnL calculation for GOLD & XRP
  useEffect(() => {
    if (!apiBase) return;
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
  }, [apiBase]);

  // 3. Fetch latest trades dynamically starting from /api/trades/max-id
  useEffect(() => {
    let isMounted = true;

    const fetchLatestTrades = async () => {
      try {
        const baseUrl = apiBase || 'https://apiflare.brokex.trade';
        
        let maxId = 0;
        const maxRes = await fetch(`${baseUrl}/api/trades/max-id`).catch(() => null);
        if (maxRes && maxRes.ok) {
          const maxJson = await maxRes.json();
          maxId = Number(maxJson?.maxTradeId || maxJson?.maxId || maxJson?.highestId || maxJson?.id || maxJson || 0);
        }

        const toId = maxId > 0 ? maxId : 1000;
        const fromId = Math.max(1, toId - 99);

        const res = await fetch(`${baseUrl}/api/trades/range?from=${fromId}&to=${toId}`);

        if (res.ok) {
          const data = await res.json();
          const rawTrades = Array.isArray(data) 
            ? data 
            : (data.trades || data.data || []);

          if (rawTrades.length > 0) {
            const sorted = [...rawTrades].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            if (isMounted) {
              setTrades(sorted);
            }
          }
        }
      } catch (err) {
        console.error("OrderBook fetch error:", err);
      }
    };

    fetchLatestTrades();
    const interval = setInterval(fetchLatestTrades, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiBase]);

  // 4. Fetch older trades progressively when scrolling to the bottom
  const loadMoreOlderTrades = async () => {
    if (loadingMore || !hasMore || trades.length === 0) return;

    const oldestTrade = trades[trades.length - 1];
    const oldestId = Number(oldestTrade?.id || 0);

    if (oldestId <= 1) {
      setHasMore(false);
      return;
    }

    setLoadingMore(true);
    try {
      const baseUrl = apiBase || 'https://apiflare.brokex.trade';
      const toId = oldestId - 1;
      const fromId = Math.max(1, toId - 49);

      const rangeRes = await fetch(`${baseUrl}/api/trades/range?from=${fromId}&to=${toId}`);
      if (rangeRes.ok) {
        const rangeData = await rangeRes.json();
        const rawTrades = Array.isArray(rangeData) ? rangeData : (rangeData.trades || rangeData.data || []);

        if (rawTrades.length === 0) {
          setHasMore(false);
        } else {
          const sortedOlder = [...rawTrades].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          setTrades(prev => {
            const existingIds = new Set(prev.map(t => String(t.id)));
            const uniqueOlder = sortedOlder.filter(t => !existingIds.has(String(t.id)));
            return [...prev, ...uniqueOlder];
          });
          if (fromId <= 1) {
            setHasMore(false);
          }
        }
      }
    } catch (err) {
      console.error("Error loading older trades:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMoreOlderTrades();
    }
  };

  return (
    <div ref={containerRef} className="book panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Table Header */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '0.9fr 1.3fr 1fr 1fr', 
        gap: '8px',
        padding: '8px 8px', 
        fontSize: '10px', 
        color: 'var(--text-grey)',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        textTransform: 'uppercase'
      }}>
        <div>Time</div>
        <div>Asset</div>
        <div style={{ textAlign: 'right' }}>Size</div>
        <div style={{ textAlign: 'right' }}>PnL</div>
      </div>

      {/* Table Content */}
      <div onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '5px 0' }}>
        {trades.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '10px', color: 'var(--text-grey)', fontFamily: 'Source Code Pro, monospace' }}>
            No recent trade activity
          </div>
        ) : (
          <>
            {trades.map((trade) => {
              const tradeId = trade.id || '0';
              const stateNum = Number(trade.state !== undefined ? trade.state : 0); // 0: ORDER, 1: OPEN, 2: CLOSED, 3: CANCELLED
              const dirNum = Number(trade.direction !== undefined ? trade.direction : 1);
              
              const goldHash = (import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55').toLowerCase();
              const xrpHash = (import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298').toLowerCase();

              const rawAssetStr = String(trade.assetHash || trade.assetKey || trade.asset || trade.symbol || '').toLowerCase();
              const isXRP = rawAssetStr.includes('xrp') || rawAssetStr === xrpHash;

              const assetSymbol = isXRP ? 'XRP/USD' : 'XAU/USD';

              // Backend Constants: DIR_SHORT = 0, DIR_LONG = 1
              const isLong = dirNum === 1 || trade.direction === 'LONG' || trade.direction === 'buy' || trade.isLong === true;
              const sideLabel = isLong ? 'LONG' : 'SHORT';

              // Size = Margin * Leverage (Margin is scaled by 1e6 in API)
              const rawMargin = Number(trade.margin || 0);
              const marginUSD = rawMargin > 100000 ? rawMargin / 1e6 : rawMargin;
              const levNum = Number(trade.leverage || 1);
              const sizeUSD = marginUSD * levNum;
              const formattedSize = `$${Math.round(sizeUSD).toLocaleString('en-US')}`;

              // Timestamp
              const ts = Number(trade.openTimestamp || trade.closeTimestamp || 0);
              const timeStr = ts > 0 
                ? new Date(ts * 1000).toLocaleTimeString('en-GB', { hour12: false })
                : '—';

              // Prices scaled by 1e6 in backend API
              const defaultPrice = isXRP ? 2.45 : 4046.52;
              const rawOpen = Number(trade.openPrice || 0);
              const openP = rawOpen > 100000 ? rawOpen / 1e6 : (rawOpen > 0 ? rawOpen : defaultPrice);

              const markPrice = isXRP ? livePrices.XRP : livePrices.GOLD;

              // Apply TEE spread for this specific asset on exit price:
              const activeSpreads = isXRP ? teeSpreads.XRP : teeSpreads.GOLD;
              const spreadLongBps = activeSpreads?.spreadLongBps || 30;
              const spreadShortBps = activeSpreads?.spreadShortBps || 30;

              const exitPrice = isLong 
                ? markPrice * (1 - spreadShortBps / 100000)
                : markPrice * (1 + spreadLongBps / 100000);

              let pnlStr = '—';
              let pnlColor = 'var(--text-grey)';

              let rawPnlVal = 0;
              let calculatePnl = false;

              if (stateNum === 1 && openP > 0) { // OPEN (uPnL)
                calculatePnl = true;
                const diffPct = isLong ? (exitPrice - openP) / openP : (openP - exitPrice) / openP;
                rawPnlVal = sizeUSD * diffPct;
              } else if ((stateNum === 2 || stateNum === 4) && openP > 0) { // CLOSED / LIQUIDATED (rPnL)
                const rawClose = Number(trade.closePrice || 0);
                const closeP = rawClose > 100000 ? rawClose / 1e6 : rawClose;
                if (closeP > 0) {
                  calculatePnl = true;
                  const diffPct = isLong ? (closeP - openP) / openP : (openP - closeP) / openP;
                  rawPnlVal = sizeUSD * diffPct;
                }
              }

              if (calculatePnl) {
                let cappedPnl = rawPnlVal;

                // Rule 1: Loss cannot exceed collateral / margin (Max loss = -marginUSD)
                if (marginUSD > 0 && cappedPnl < -marginUSD) {
                  cappedPnl = -marginUSD;
                }

                // Rule 2: Profit cannot exceed profitCap from asset snapshot (Max profit = profitCapUSD)
                if (profitCapUSD > 0 && cappedPnl > profitCapUSD) {
                  cappedPnl = profitCapUSD;
                }

                const sign = cappedPnl >= 0 ? '+' : '';
                pnlStr = `${sign}$${cappedPnl.toFixed(2)}`;
                pnlColor = cappedPnl >= 0 ? '#3b82f6' : '#ef4444';
              }

              const statusLabel = stateNum === 0 ? 'ORDER' : stateNum === 1 ? 'OPEN' : stateNum === 2 ? 'CLOSED' : stateNum === 3 ? 'CANCELLED' : 'LIQ';
              const statusColor = stateNum === 0 ? '#eab308' : stateNum === 1 ? '#3b82f6' : stateNum === 2 ? 'var(--text-grey)' : stateNum === 3 ? 'var(--text-grey)' : '#ef4444';

              const rawTrader = String(trade.trader || '');
              const traderShort = rawTrader.length > 10 ? `${rawTrader.substring(0, 6)}...${rawTrader.substring(rawTrader.length - 4)}` : (rawTrader || '—');

              const rawClose = Number(trade.closePrice || 0);
              const closeP = rawClose > 100000 ? rawClose / 1e6 : rawClose;
              const closePriceStr = closeP > 0 ? `$${closeP.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 })}` : '—';

              const liqPriceNum = Number(trade.liquidationPrice || 0);
              const liqP = liqPriceNum > 100000 ? liqPriceNum / 1e6 : liqPriceNum;
              const liqPriceStr = liqP > 0 ? `$${liqP.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 })}` : '—';

              const slNum = Number(trade.stopLoss || 0);
              const slP = slNum > 100000 ? slNum / 1e6 : slNum;
              const slStr = slP > 0 ? `$${slP.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 })}` : '—';

              const tpNum = Number(trade.takeProfit || 0);
              const tpP = tpNum > 100000 ? tpNum / 1e6 : tpNum;
              const tpStr = tpP > 0 ? `$${tpP.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 })}` : '—';

              const tradeDetails = {
                id: `#${tradeId}`,
                traderShort,
                asset: assetSymbol,
                side: sideLabel,
                isLong,
                status: statusLabel,
                statusColor,
                sizeUSD: formattedSize,
                collateral: `$${marginUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                leverage: `${levNum}x`,
                entryPrice: `$${openP.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 })}`,
                marketPrice: `$${markPrice.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 })}`,
                closePrice: closePriceStr,
                liqPrice: liqPriceStr,
                sl: slStr,
                tp: tpStr,
                pnlUsd: pnlStr,
                pnlColor: pnlColor,
                timeStr
              };

              return (
                <div 
                  key={tradeId}
                  onMouseEnter={() => {
                    if (containerRef.current) {
                      setContainerRect(containerRef.current.getBoundingClientRect());
                    }
                    setHoveredTrade(tradeDetails);
                  }}
                  onMouseLeave={() => setHoveredTrade(null)}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '0.9fr 1.3fr 1fr 1fr', 
                    gap: '8px',
                    padding: '6px 8px', 
                    fontSize: '11px',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }} 
                  className="trade-row"
                >
                  <div style={{ color: 'var(--text-grey)', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', paddingRight: '8px' }}>
                    {timeStr}
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--text-dark)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <span>{assetSymbol}</span>
                    <sup style={{ 
                      fontSize: '7px', 
                      fontWeight: '700',
                      marginLeft: '2px', 
                      padding: '1px 3px', 
                      borderRadius: '2px', 
                      background: isLong ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isLong ? '#3b82f6' : '#ef4444',
                      lineHeight: '1',
                      transform: 'translateY(-3px)',
                      display: 'inline-block'
                    }}>
                      {sideLabel}
                    </sup>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'Source Code Pro, monospace' }}>
                    {formattedSize}
                  </div>
                  <div style={{ 
                    textAlign: 'right', 
                    fontFamily: 'Source Code Pro, monospace',
                    color: pnlColor
                  }}>
                    {pnlStr}
                  </div>
                </div>
              );
            })}
            {loadingMore && (
              <div style={{ padding: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--text-grey)' }}>
                Loading older trades...
              </div>
            )}
          </>
        )}
      </div>

      {/* Stationary Fixed Side Card via React Portal */}
      {hoveredTrade && containerRect && createPortal(
        <div style={{
          position: 'fixed',
          top: `${containerRect.top}px`,
          left: `${containerRect.left - 245 < 10 ? containerRect.right + 10 : containerRect.left - 245}px`,
          width: '235px',
          background: '#0d0e12',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '12px',
          zIndex: 999999,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          fontFamily: 'Inter, sans-serif'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#fff' }}>{hoveredTrade.asset}</span>
              <span style={{
                fontSize: '8px',
                fontWeight: 'bold',
                padding: '1px 5px',
                borderRadius: '3px',
                background: hoveredTrade.isLong ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: hoveredTrade.isLong ? '#3b82f6' : '#ef4444'
              }}>
                {hoveredTrade.side} {hoveredTrade.leverage}
              </span>
            </div>
            <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-grey)' }}>
              {hoveredTrade.id}
            </span>
          </div>

          {/* Details List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>Status:</span>
              <span style={{ fontWeight: '600', color: hoveredTrade.statusColor }}>{hoveredTrade.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>Trader:</span>
              <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.traderShort}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>Size:</span>
              <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.sizeUSD}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>Margin:</span>
              <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.collateral}</span>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>Entry Price:</span>
              <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.entryPrice}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>Mark Price:</span>
              <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.marketPrice}</span>
            </div>

            {hoveredTrade.closePrice !== '—' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-grey)' }}>Close Price:</span>
                <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.closePrice}</span>
              </div>
            )}

            {hoveredTrade.liqPrice !== '—' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-grey)' }}>Liq. Price:</span>
                <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#ef4444' }}>{hoveredTrade.liqPrice}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-grey)' }}>TP / SL:</span>
              <span style={{ fontFamily: 'Source Code Pro, monospace', color: '#fff' }}>{hoveredTrade.tp} / {hoveredTrade.sl}</span>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-grey)', fontSize: '10px' }}>PnL:</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: hoveredTrade.pnlColor }}>
                {hoveredTrade.pnlUsd}
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .trade-row:hover {
          background: rgba(255,255,255,0.03);
        }
      `}</style>
    </div>
  );
}
