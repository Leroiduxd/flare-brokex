import { useState, useEffect, useRef } from 'react';

export default function OrderBook() {
  const [trades, setTrades] = useState([]);
  const scrollRef = useRef(null);

  const generateTrade = (index) => {
    const assets = ['XAU/USD', 'BTC/USDC', 'ETH/USDC', 'SOL/USDC', 'EUR/USD', 'GBP/USD'];
    const sides = ['buy', 'sell'];
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const isOrder = Math.random() > 0.8;
    const size = `$${(Math.random() * 10000 + 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const pnlVal = (Math.random() * 200 - 100).toFixed(2);
    const pnl = isOrder ? '—' : (pnlVal > 0 ? `+$${pnlVal}` : `-$${Math.abs(pnlVal)}`);
    
    // Fake time going backwards
    const date = new Date(Date.now() - index * 45000); // 45s intervals
    const time = date.toLocaleTimeString('en-GB', { hour12: false });

    return { time, asset, side, size, pnl, isOrder };
  };

  useEffect(() => {
    const initialTrades = Array.from({ length: 40 }, (_, i) => generateTrade(i));
    setTrades(initialTrades);
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      // Near bottom, load 15 more
      const moreTrades = Array.from({ length: 15 }, (_, i) => generateTrade(trades.length + i));
      setTrades(prev => [...prev, ...moreTrades]);
    }
  };

  return (
    <div className="book panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        padding: '10px 8px', 
        fontSize: '11px', 
        fontWeight: 'bold', 
        color: 'var(--gold)', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        RECENT ACTIVITY
        <span style={{ fontSize: '9px', color: 'var(--text-grey)', fontWeight: 'normal' }}>Live Feed</span>
      </div>
      
      {/* Table Header */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '0.8fr 1.2fr 1fr 1fr', 
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
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '5px 0' }}
      >
        {trades.map((trade, i) => (
          <div key={i} style={{ 
            display: 'grid', 
            gridTemplateColumns: '0.8fr 1.2fr 1fr 1fr', 
            padding: '6px 8px', 
            fontSize: '11px',
            borderBottom: '1px solid rgba(255,255,255,0.02)',
            transition: 'background 0.2s',
            cursor: 'pointer'
          }} className="trade-row">
            <div style={{ color: 'var(--text-grey)', fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{trade.time}</div>
            <div style={{ fontWeight: '600', color: 'var(--text-dark)' }}>
              {trade.asset}
              <span style={{ 
                fontSize: '8px', 
                marginLeft: '5px', 
                padding: '1px 3px', 
                borderRadius: '3px', 
                background: trade.side === 'buy' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: trade.side === 'buy' ? '#3b82f6' : '#ef4444'
              }}>
                {trade.side.toUpperCase()}
              </span>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'Source Code Pro, monospace' }}>{trade.size}</div>
            <div style={{ 
              textAlign: 'right', 
              fontFamily: 'Source Code Pro, monospace',
              color: trade.pnl.startsWith('+') ? '#3b82f6' : trade.pnl === '—' ? 'var(--text-grey)' : '#ef4444'
            }}>
              {trade.pnl}
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        <div style={{ padding: '15px', textAlign: 'center', fontSize: '10px', color: 'var(--text-grey)' }}>
          Syncing more data...
        </div>
      </div>

      <style>{`
        .trade-row:hover {
          background: rgba(255,255,255,0.03);
        }
        .book.panel div::-webkit-scrollbar {
          width: 4px;
        }
        .book.panel div::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 2px;
        }
      `}</style>
    </div>
  )
}
