import React, { useState, useMemo } from 'react';

const marketsData = [
  // CRYPTO
  { symbol: 'BTC-USDC', price: '78,207', oracle: '-37', change: '-1.10%', changeAbs: '-866.0', volume: '$1.64b', openInterest: '$76.58m', marketCap: '$1.52t', longFunding: '+0.0001%', shortFunding: '-0.0001%', lsRatio: 52, leverage: '40x', category: 'Crypto', logo: 'BTC' },
  { symbol: 'ETH-USDC', price: '2,180.5', oracle: '-1', change: '-1.74%', changeAbs: '-38.50', volume: '$592.58m', openInterest: '$34.12m', marketCap: '$261.2b', longFunding: '+0.0005%', shortFunding: '-0.0005%', lsRatio: 48, leverage: '25x', category: 'Crypto', logo: 'ETH' },
  { symbol: 'SOL-USDC', price: '142.12', oracle: '+0.45', change: '+2.85%', changeAbs: '+3.94', volume: '$452.12m', openInterest: '$18.45m', marketCap: '$66.8b', longFunding: '+0.0002%', shortFunding: '-0.0002%', lsRatio: 65, leverage: '20x', category: 'Crypto', logo: 'SOL' },
  
  // FOREX
  { symbol: 'EUR-USD', price: '1.0842', oracle: '+0.0001', change: '+0.12%', changeAbs: '+0.0013', volume: '$12.4b', openInterest: '$120.4m', marketCap: '—', longFunding: '+0.0002%', shortFunding: '-0.0002%', lsRatio: 51, leverage: '100x', category: 'Forex', logo: 'EUR' },
  { symbol: 'GBP-USD', price: '1.2645', oracle: '-0.0002', change: '-0.08%', changeAbs: '-0.0010', volume: '$8.1b', openInterest: '$78.2m', marketCap: '—', longFunding: '+0.0001%', shortFunding: '-0.0001%', lsRatio: 49, leverage: '100x', category: 'Forex', logo: 'GBP' },
  { symbol: 'USD-JPY', price: '149.52', oracle: '+0.05', change: '+0.34%', changeAbs: '+0.51', volume: '$15.2b', openInterest: '$94.5m', marketCap: '—', longFunding: '-0.0001%', shortFunding: '+0.0001%', lsRatio: 45, leverage: '100x', category: 'Forex', logo: 'JPY' },
  
  // COMMODITIES (Metals + Energy)
  { symbol: 'XAU-USD', price: '2,315.10', oracle: '+1.2', change: '+0.45%', changeAbs: '+10.4', volume: '$452m', openInterest: '$55.1m', marketCap: '—', longFunding: '+0.0012%', shortFunding: '-0.0012%', lsRatio: 72, leverage: '50x', category: 'Commodities', logo: 'XAU' },
  { symbol: 'XAG-USD', price: '28.45', oracle: '-0.05', change: '-0.21%', changeAbs: '-0.06', volume: '$104m', openInterest: '$12.4m', marketCap: '—', longFunding: '-0.0002%', shortFunding: '+0.0002%', lsRatio: 58, leverage: '20x', category: 'Commodities', logo: 'XAG' },
  { symbol: 'WTI-USD', price: '82.45', oracle: '+0.12', change: '+0.15%', changeAbs: '+0.12', volume: '$85m', openInterest: '$9.8m', marketCap: '—', longFunding: '+0.0005%', shortFunding: '-0.0005%', lsRatio: 61, leverage: '20x', category: 'Commodities', logo: 'WTI' },
  
  // STOCKS
  { symbol: 'AAPL-USD', price: '189.45', oracle: '+0.45', change: '+0.24%', changeAbs: '+0.45', volume: '$1.2b', openInterest: '$45.2m', marketCap: '$2.82t', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 70, leverage: '10x', category: 'Stocks', logo: 'AAPL' },
  { symbol: 'META-USD', price: '502.12', oracle: '-1.20', change: '-0.45%', changeAbs: '-2.27', volume: '$840m', openInterest: '$22.8m', marketCap: '$1.28t', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 64, leverage: '10x', category: 'Stocks', logo: 'META' },
  { symbol: 'MSFT-USD', price: '415.67', oracle: '+2.10', change: '+0.51%', changeAbs: '+2.12', volume: '$950m', openInterest: '$38.4m', marketCap: '$3.09t', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 68, leverage: '10x', category: 'Stocks', logo: 'MSFT' },
  { symbol: 'AMZN-USD', price: '178.90', oracle: '+0.12', change: '+0.07%', changeAbs: '+0.13', volume: '$720m', openInterest: '$19.2m', marketCap: '$1.85t', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 66, leverage: '10x', category: 'Stocks', logo: 'AMZN' },
  { symbol: 'GOOG-USD', price: '154.21', oracle: '-0.45', change: '-0.29%', changeAbs: '-0.45', volume: '$680m', openInterest: '$15.8m', marketCap: '$1.92t', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 62, leverage: '10x', category: 'Stocks', logo: 'GOOG' },
];

const tabs = ['All', 'Crypto', 'Forex', 'Stocks', 'Commodities'];

// Helper to generate deterministic wave points for smooth sparklines
const getDeterministicPoints = (symbol) => {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const points = [];
  let currentVal = 50; 
  for (let i = 0; i < 18; i++) {
    const pseudoRandom = Math.sin(hash + i * 1.6) * Math.cos(hash - i * 0.9);
    const step = pseudoRandom * 22; 
    currentVal = Math.max(15, Math.min(85, currentVal + step));
    points.push(currentVal);
  }
  return points;
};

const generateSparklinePath = (points, width = 100, height = 24) => {
  const stepX = width / (points.length - 1);
  return points.map((p, index) => {
    const x = index * stepX;
    const y = height - (p / 100) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
};

function Sparkline({ symbol, isPositive }) {
  const width = 100;
  const height = 20; // Slightly slimmer height
  
  const points = useMemo(() => getDeterministicPoints(symbol), [symbol]);
  const path = useMemo(() => generateSparklinePath(points, width, height), [points]);
  
  const strokeColor = isPositive ? '#3b82f6' : '#ef4444';
  
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
      {/* Clean thin Sparkline Line, NO gradient/shadow below */}
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MarketsTable() {
  const goldAccent = '#BC8961';
  const [activeTab, setActiveTab] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteSymbols, setFavoriteSymbols] = useState(['BTC-USDC', 'SOL-USDC', 'XAU-USD']);

  const toggleFavorite = (symbol, e) => {
    e.stopPropagation();
    setFavoriteSymbols(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol) 
        : [...prev, symbol]
    );
  };

  const filteredMarkets = useMemo(() => {
    return marketsData.filter(m => {
      const matchesTab = activeTab === 'All' || m.category === activeTab;
      const matchesFavorite = !showFavoritesOnly || favoriteSymbols.includes(m.symbol);
      return matchesTab && matchesFavorite;
    });
  }, [activeTab, showFavoritesOnly, favoriteSymbols]);

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 1. TOP SECTION: Tabs Filters & Favorites Button */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        gap: '20px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.01)'
      }}>
        {/* Categories Tab Row */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {tabs.map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === tab ? 'var(--gold)' : 'var(--text-grey)',
                padding: '6px 0',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {/* Selected category enclosed in square brackets [ CATEGORY ] */}
              {activeTab === tab ? `[ ${tab} ]` : tab}
            </button>
          ))}
        </div>

        {/* Favorites Toggle Button */}
        <button 
          onClick={() => setShowFavoritesOnly(prev => !prev)}
          style={{
            background: showFavoritesOnly ? 'rgba(188, 137, 97, 0.1)' : 'transparent',
            border: `1px solid ${showFavoritesOnly ? goldAccent : 'var(--border-color)'}`,
            color: showFavoritesOnly ? goldAccent : 'var(--text-grey)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: 'Source Code Pro, monospace',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            letterSpacing: '0.04em'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill={showFavoritesOnly ? goldAccent : "none"} stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          {showFavoritesOnly ? '[ FAVORITES ONLY ]' : 'FAVORITES'}
        </button>
      </div>

      {/* 2. TABLE HEADER */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr 1fr 0.9fr 0.9fr',
        padding: '8px 16px',
        fontSize: '9px',
        color: 'var(--text-grey)',
        borderBottom: '1px solid var(--border-color)',
        textTransform: 'uppercase',
        fontWeight: '600',
        alignItems: 'center',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.05)'
      }}>
        <span>Market</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span style={{ textAlign: 'right' }}>24h %</span>
        <span style={{ textAlign: 'right' }}>Volume</span>
        <span style={{ textAlign: 'right' }}>Open Interest</span>
        <span style={{ textAlign: 'right' }}>Market Cap</span>
        <span style={{ textAlign: 'center' }}>Last 24h Trend</span>
        <span style={{ textAlign: 'right' }}>L/S Ratio</span>
        <span style={{ textAlign: 'right' }}>Funding (L/S)</span>
      </div>

      {/* 3. TABLE BODY (Scrollable, ultra-thin rows) */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredMarkets.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-grey)', fontSize: '11px', fontFamily: 'Source Code Pro' }}>
            NO MATCHING MARKETS FOUND
          </div>
        ) : (
          filteredMarkets.map((m) => {
            const isPositive = m.change.startsWith('+');
            const isStarred = favoriteSymbols.includes(m.symbol);
            return (
              <div 
                key={m.symbol} 
                className="market-row-item"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr 1fr 0.9fr 0.9fr',
                  padding: '5px 16px', // Reduced padding for ultra-thin lines
                  fontSize: '11px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  transition: 'background-color 0.2s',
                  cursor: 'pointer'
                }} 
              >
                {/* Symbol logo + details (ENLARGED logo size) */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Star toggle */}
                  <button 
                    onClick={(e) => toggleFavorite(m.symbol, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isStarred ? goldAccent : 'var(--text-grey)',
                      cursor: 'pointer',
                      padding: 0,
                      marginRight: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: isStarred ? 1 : 0.25,
                      transition: 'opacity 0.2s, color 0.2s'
                    }}
                    className="star-toggle-btn"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={isStarred ? goldAccent : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </button>

                  <div style={{
                    width: '30px', // Enlarged logo from 24px to 30px
                    height: '30px', // Enlarged logo from 24px to 30px
                    background: 'var(--bg-dark)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '11px', // Slightly larger logo text font
                    color: goldAccent,
                    marginRight: '12px',
                    border: '1px solid var(--panel-border)'
                  }}>{m.logo}</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="symbol-label" style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-dark)' }}>{m.symbol}</span>
                    <span style={{
                      alignSelf: 'flex-start',
                      marginTop: '1px',
                      fontSize: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'var(--text-grey)',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      border: '1px solid rgba(255,255,255,0.02)'
                    }}>{m.leverage}</span>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'Source Code Pro', color: 'var(--text-dark)' }}>
                  {m.price}
                </div>

                {/* 24h Change */}
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'Source Code Pro', color: isPositive ? '#3b82f6' : '#ef4444' }}>
                  {m.change}
                </div>

                {/* Volume */}
                <div style={{ textAlign: 'right', color: 'var(--text-grey)', fontFamily: 'Source Code Pro' }}>
                  {m.volume}
                </div>

                {/* Open Interest Column */}
                <div style={{ textAlign: 'right', color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
                  {m.openInterest}
                </div>

                {/* Market Cap Column */}
                <div style={{ textAlign: 'right', color: 'var(--text-grey)', fontFamily: 'Source Code Pro' }}>
                  {m.marketCap}
                </div>

                {/* Sparkline (NO shadow/gradient, clean line) */}
                <div style={{ padding: '0 8px' }}>
                  <Sparkline symbol={m.symbol} isPositive={isPositive} />
                </div>

                {/* L/S Ratio */}
                <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '3px', fontFamily: 'Source Code Pro', fontSize: '10px' }}>
                  <span style={{ color: '#3b82f6' }}>{m.lsRatio}%</span>
                  <span style={{ color: 'var(--text-grey)' }}>/</span>
                  <span style={{ color: '#ef4444' }}>{100 - m.lsRatio}%</span>
                </div>

                {/* Funding L/S */}
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', fontSize: '10px', fontFamily: 'Source Code Pro' }}>
                  <span style={{ color: '#3b82f6' }}>L: {m.longFunding}</span>
                  <span style={{ color: '#ef4444' }}>S: {m.shortFunding}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .market-row-item {
          position: relative;
        }
        .market-row-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--gold, #BC8961);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .market-row-item:hover::before {
          opacity: 1;
        }
        .market-row-item:hover {
          background-color: rgba(255, 255, 255, 0.015);
        }
        .market-row-item:hover .symbol-label {
          color: var(--gold, #BC8961) !important;
        }
        .market-row-item:hover .symbol-label::before {
          content: '[';
          color: var(--gold, #BC8961);
          margin-right: 3px;
        }
        .market-row-item:hover .symbol-label::after {
          content: ']';
          color: var(--gold, #BC8961);
          margin-left: 3px;
        }
        .star-toggle-btn:hover {
          opacity: 0.85 !important;
        }
      `}</style>
    </div>
  );
}
