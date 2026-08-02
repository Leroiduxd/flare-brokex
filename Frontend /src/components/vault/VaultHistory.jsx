import React, { useState } from 'react';

export default function VaultHistory() {
  const [hoveredSymbol, setHoveredSymbol] = useState(null);

  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';
  const themeBorder = 'var(--border-color, #222)';
  const goldAccent = '#BC8961';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';

  // 1:1 Asset mapping matching MarketsTable.jsx completely
  const assetsData = [
    // CRYPTO
    { symbol: 'BTC-USDC', oiLong: '$12,450,180', oiShort: '$7,845,920', pnlUnrealized: '-$142,500', pnlRealized: '+$2,450,880', fees: '$650,420', trades: '42 / 18,450', leverage: '15.8x', isPnlPos: false },
    { symbol: 'ETH-USDC', oiLong: '$6,840,940', oiShort: '$4,120,450', pnlUnrealized: '+$45,800', pnlRealized: '+$1,210,420', fees: '$420,180', trades: '31 / 14,120', leverage: '12.4x', isPnlPos: true },
    { symbol: 'SOL-USDC', oiLong: '$2,120,450', oiShort: '$1,245,850', pnlUnrealized: '-$98,120', pnlRealized: '+$420,850', fees: '$285,900', trades: '39 / 9,450', leverage: '18.2x', isPnlPos: false },
    
    // FOREX
    { symbol: 'EUR-USD', oiLong: '$85,420,100', oiShort: '$64,150,200', pnlUnrealized: '-$120,500', pnlRealized: '+$8,450,200', fees: '$1,120,450', trades: '112 / 48,200', leverage: '85.4x', isPnlPos: false },
    { symbol: 'GBP-USD', oiLong: '$42,150,900', oiShort: '$31,850,400', pnlUnrealized: '+$12,400', pnlRealized: '+$3,120,400', fees: '$542,100', trades: '64 / 24,150', leverage: '62.1x', isPnlPos: true },
    { symbol: 'USD-JPY', oiLong: '$58,450,200', oiShort: '$49,120,800', pnlUnrealized: '-$85,600', pnlRealized: '+$4,850,900', fees: '$785,200', trades: '82 / 31,450', leverage: '78.5x', isPnlPos: false },
    
    // COMMODITIES
    { symbol: 'XAU-USD',  oiLong: '$1,038,550', oiShort: '$638,720',  pnlUnrealized: '-$53,330',  pnlRealized: '+$128,330',  fees: '$131,100', trades: '12 / 3,800', leverage: '8.5x', isPnlPos: false },
    { symbol: 'XAG-USD', oiLong: '$450,120', oiShort: '$320,450', pnlUnrealized: '+$12,450', pnlRealized: '+$48,150', fees: '$32,450', trades: '8 / 1,420', leverage: '10.2x', isPnlPos: true },
    { symbol: 'WTI-USD', oiLong: '$850,420', oiShort: '$710,200', pnlUnrealized: '-$15,400', pnlRealized: '+$92,400', fees: '$72,150', trades: '14 / 2,150', leverage: '12.1x', isPnlPos: false },
    
    // STOCKS
    { symbol: 'AAPL-USD', oiLong: '$3,120,450', oiShort: '$2,150,900', pnlUnrealized: '+$98,400', pnlRealized: '+$210,450', fees: '$42,150', trades: '22 / 5,120', leverage: '4.5x', isPnlPos: true },
    { symbol: 'META-USD', oiLong: '$1,850,200', oiShort: '$1,120,450', pnlUnrealized: '-$12,400', pnlRealized: '+$142,500', fees: '$28,900', trades: '14 / 3,120', leverage: '5.2x', isPnlPos: false },
    { symbol: 'MSFT-USD', oiLong: '$2,450,800', oiShort: '$1,820,100', pnlUnrealized: '+$34,500', pnlRealized: '+$285,900', fees: '$39,400', trades: '19 / 4,210', leverage: '4.8x', isPnlPos: true },
    { symbol: 'AMZN-USD', oiLong: '$1,240,900', oiShort: '$910,250', pnlUnrealized: '-$8,450', pnlRealized: '+$98,150', fees: '$19,250', trades: '11 / 2,140', leverage: '5.1x', isPnlPos: false },
    { symbol: 'GOOG-USD', oiLong: '$1,150,450', oiShort: '$840,120', pnlUnrealized: '+$15,120', pnlRealized: '+$110,450', fees: '$21,450', trades: '12 / 2,450', leverage: '4.9x', isPnlPos: true }
  ];

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      padding: '10px 14px', // Increased padding slightly for breathing room
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      
      {/* Dense Title Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${themeBorder}`,
        paddingBottom: '6px',
        marginBottom: '6px',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', fontWeight: 'bold', color: goldAccent }}>
          [ ACTIVE POOL ASSETS EXPOSURE & TELEMETRY ]
        </span>
        <span style={{ fontSize: '9px', fontFamily: 'Source Code Pro', color: themeTextMuted }}>
          {assetsData.length} ACTIVE TRADING PAIRS
        </span>
      </div>

      {/* Grid Headers exactly in the style of MarketsTable (Funding removed) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.2fr 1fr 1.2fr 0.8fr', // Adjusted first column for square brackets space
        padding: '6px 8px',
        fontSize: '9.5px',
        color: themeTextMuted,
        borderBottom: `1px solid ${themeBorder}`,
        textTransform: 'uppercase',
        fontWeight: '600',
        alignItems: 'center',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.05)',
        fontFamily: 'Source Code Pro, monospace'
      }}>
        <span>Asset</span>
        <span style={{ textAlign: 'right' }}>OI Long</span>
        <span style={{ textAlign: 'right' }}>OI Short</span>
        <span style={{ textAlign: 'right' }}>Unreal. PnL</span>
        <span style={{ textAlign: 'right' }}>Realized PnL</span>
        <span style={{ textAlign: 'right' }}>Fees Coll.</span>
        <span style={{ textAlign: 'right' }}>Trades (O/T)</span>
        <span style={{ textAlign: 'right' }}>Avg Lev</span>
      </div>

      {/* Grid Body (Scrollable, NO visible scrollbar, thin rows) */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            display: none; /* Hide scrollbar completely */
          }
          .custom-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
        `}</style>
        {assetsData.map((asset) => {
          const isHovered = hoveredSymbol === asset.symbol;
          return (
            <div 
              key={asset.symbol} 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.2fr 1fr 1.2fr 0.8fr',
                padding: '6px 8px',
                fontSize: '11.5px',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.015)',
                fontFamily: 'Source Code Pro, monospace',
                transition: 'background-color 0.15s ease',
                cursor: 'pointer',
                color: themeText
              }}
              onMouseEnter={() => setHoveredSymbol(asset.symbol)}
              onMouseLeave={() => setHoveredSymbol(null)}
            >
              {/* Asset Name (wraps in square brackets on hover) */}
              <span style={{ 
                fontWeight: 'bold', 
                color: isHovered ? goldAccent : themeText,
                transition: 'all 0.15s ease'
              }}>
                {isHovered ? `[ ${asset.symbol} ]` : asset.symbol}
              </span>
              
              {/* OI Long */}
              <span style={{ textAlign: 'right', color: blueColor, fontWeight: 'bold' }}>{asset.oiLong}</span>
              
              {/* OI Short */}
              <span style={{ textAlign: 'right', color: themeText }}>{asset.oiShort}</span>
              
              {/* Unrealized PnL */}
              <span style={{ textAlign: 'right', color: asset.isPnlPos ? blueColor : redColor, fontWeight: 'bold' }}>
                {asset.pnlUnrealized}
              </span>
              
              {/* Realized PnL */}
              <span style={{ textAlign: 'right', color: blueColor, fontWeight: 'bold' }}>{asset.pnlRealized}</span>
              
              {/* Fees Collected */}
              <span style={{ textAlign: 'right', color: goldAccent, fontWeight: 'bold' }}>{asset.fees}</span>
              
              {/* Active Trades (Open/Total) */}
              <span style={{ textAlign: 'right' }}>{asset.trades}</span>
              
              {/* Avg Leverage */}
              <span style={{ textAlign: 'right', fontWeight: 'bold', color: goldAccent }}>{asset.leverage}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
