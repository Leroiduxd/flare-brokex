import React, { useState, useRef, useEffect } from 'react';

const marketsData = [
  // CRYPTO
  { symbol: 'BTC-USDC', price: '78,207', oracle: '-37', change: '-1.10%', changeAbs: '-866.0', volume: '$1.64b', longFunding: '+0.0001%', shortFunding: '-0.0001%', lsRatio: 52, leverage: '40x', category: 'Crypto', logo: 'BTC' },
  { symbol: 'ETH-USDC', price: '2,180.5', oracle: '-1', change: '-1.74%', changeAbs: '-38.50', volume: '$592.58m', longFunding: '+0.0005%', shortFunding: '-0.0005%', lsRatio: 48, leverage: '25x', category: 'Crypto', logo: 'ETH' },
  { symbol: 'SOL-USDC', price: '142.12', oracle: '+0.45', change: '+2.85%', changeAbs: '+3.94', volume: '$452.12m', longFunding: '+0.0002%', shortFunding: '-0.0002%', lsRatio: 65, leverage: '20x', category: 'Crypto', logo: 'SOL' },
  
  // FOREX
  { symbol: 'EUR-USD', price: '1.0842', oracle: '+0.0001', change: '+0.12%', changeAbs: '+0.0013', volume: '$12.4b', longFunding: '+0.0002%', shortFunding: '-0.0002%', lsRatio: 51, leverage: '100x', category: 'Forex', logo: 'EUR' },
  { symbol: 'GBP-USD', price: '1.2645', oracle: '-0.0002', change: '-0.08%', changeAbs: '-0.0010', volume: '$8.1b', longFunding: '+0.0001%', shortFunding: '-0.0001%', lsRatio: 49, leverage: '100x', category: 'Forex', logo: 'GBP' },
  { symbol: 'USD-JPY', price: '149.52', oracle: '+0.05', change: '+0.34%', changeAbs: '+0.51', volume: '$15.2b', longFunding: '-0.0001%', shortFunding: '+0.0001%', lsRatio: 45, leverage: '100x', category: 'Forex', logo: 'JPY' },
  
  // COMMODITIES (Metals + Energy)
  { symbol: 'XAU-USD', price: '2,315.10', oracle: '+1.2', change: '+0.45%', changeAbs: '+10.4', volume: '$452m', longFunding: '+0.0012%', shortFunding: '-0.0012%', lsRatio: 72, leverage: '50x', category: 'Commodities', logo: 'XAU' },
  { symbol: 'XAG-USD', price: '28.45', oracle: '-0.05', change: '-0.21%', changeAbs: '-0.06', volume: '$104m', longFunding: '-0.0002%', shortFunding: '+0.0002%', lsRatio: 58, leverage: '20x', category: 'Commodities', logo: 'XAG' },
  { symbol: 'WTI-USD', price: '82.45', oracle: '+0.12', change: '+0.15%', changeAbs: '+0.12', volume: '$85m', longFunding: '+0.0005%', shortFunding: '-0.0005%', lsRatio: 61, leverage: '20x', category: 'Commodities', logo: 'WTI' },
  
  // STOCKS
  { symbol: 'AAPL-USD', price: '189.45', oracle: '+0.45', change: '+0.24%', changeAbs: '+0.45', volume: '$1.2b', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 70, leverage: '10x', category: 'Stocks', logo: 'AAPL' },
  { symbol: 'META-USD', price: '502.12', oracle: '-1.20', change: '-0.45%', changeAbs: '-2.27', volume: '$840m', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 64, leverage: '10x', category: 'Stocks', logo: 'META' },
  { symbol: 'MSFT-USD', price: '415.67', oracle: '+2.10', change: '+0.51%', changeAbs: '+2.12', volume: '$950m', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 68, leverage: '10x', category: 'Stocks', logo: 'MSFT' },
  { symbol: 'AMZN-USD', price: '178.90', oracle: '+0.12', change: '+0.07%', changeAbs: '+0.13', volume: '$720m', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 66, leverage: '10x', category: 'Stocks', logo: 'AMZN' },
  { symbol: 'GOOG-USD', price: '154.21', oracle: '-0.45', change: '-0.29%', changeAbs: '-0.45', volume: '$680m', longFunding: '0.0000%', shortFunding: '0.0000%', lsRatio: 62, leverage: '10x', category: 'Stocks', logo: 'GOOG' },
];

const tabs = ['All', 'Crypto', 'Forex', 'Stocks', 'Commodities'];

export default function MarketSelector({ isOpen, onClose }) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle') && !e.target.closest('button') && !e.target.closest('input')) {
      setIsDragging(true);
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  const filteredMarkets = marketsData.filter(m => {
    const matchesTab = activeTab === 'All' || m.category === activeTab;
    const matchesSearch = m.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div 
      ref={containerRef}
      className="panel"
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: '800px',
        maxHeight: '70vh',
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border-color)',
        zIndex: 10000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        borderRadius: '12px'
      }}
    >
      <style>{`
        .drag-handle-bar {
          height: 6px;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: var(--panel-border);
          cursor: grab;
          border-bottom: 1px solid var(--panel-border);
        }
        .drag-handle-bar::after {
          content: '';
          width: 30px;
          height: 2px;
          background: var(--text-grey);
          opacity: 0.2;
          border-radius: 1px;
        }
        .market-row {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr 0.8fr 0.8fr 1fr 1fr 30px;
          padding: 10px 24px;
          align-items: center;
          border-bottom: 1px solid var(--panel-border);
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .market-row::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--gold);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .market-row:hover {
          background: var(--gold-glow);
        }
        .market-row:hover::before {
          opacity: 1;
        }
        .asset-symbol {
          font-weight: 600;
          font-size: 12px;
          color: var(--text-dark);
          transition: all 0.2s;
        }
        .market-row:hover .asset-symbol::before {
          content: '[';
          color: var(--gold);
          margin-right: 2px;
        }
        .market-row:hover .asset-symbol::after {
          content: ']';
          color: var(--gold);
          margin-left: 2px;
        }
        .market-header {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr 0.8fr 0.8fr 1fr 1fr 30px;
          padding: 8px 24px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-grey);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .search-container {
          display: flex;
          align-items: center;
          padding: 14px 24px;
          gap: 12px;
          border-bottom: 1px solid var(--border-color);
        }
        .search-input {
          background: transparent;
          border: none;
          color: var(--text-dark);
          font-size: 14px;
          width: 100%;
          outline: none;
        }
        .search-input::placeholder {
          color: var(--text-grey);
          opacity: 0.5;
        }
        .tab-item {
          padding: 8px 0;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-grey);
          position: relative;
          transition: color 0.2s;
        }
        .tab-item:hover { color: var(--text-dark); }
        .tab-item.active { color: var(--text-dark); }
        .tab-item.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: var(--gold);
        }
        .asset-logo {
          width: 28px;
          height: 28px;
          background: var(--bg-dark);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 10px;
          color: var(--gold);
          margin-right: 12px;
          border: 1px solid var(--panel-border);
        }
        .market-label {
          font-size: 10px;
          background: var(--panel-border);
          color: var(--text-grey);
          padding: 1px 4px;
          border-radius: 3px;
          margin-left: 6px;
        }
      `}</style>

      {/* Dedicated Drag Bar at the top */}
      <div className="drag-handle drag-handle-bar" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}></div>

      {/* Search Container */}
      <div className="drag-handle search-container" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-grey)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input 
          className="search-input" 
          placeholder="Search markets..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', cursor: 'pointer', fontSize: '20px', zIndex: 2 }}>&times;</button>
      </div>

      {/* Tabs */}
      <div className="drag-handle" style={{ display: 'flex', gap: '30px', padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--panel-bg)', cursor: isDragging ? 'grabbing' : 'grab' }}>
        {tabs.map(tab => (
          <div 
            key={tab} 
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Table Header */}
      <div className="market-header">
        <span>Markets</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span style={{ textAlign: 'right' }}>24h %</span>
        <span style={{ textAlign: 'right' }}>Volume</span>
        <span style={{ textAlign: 'right' }}>L/S Ratio</span>
        <span style={{ textAlign: 'right' }}>Funding (L/S)</span>
        <span></span>
      </div>

      {/* Markets List */}
      <div style={{ flex: 1, overflowY: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
        {filteredMarkets.map((m, i) => (
          <div key={m.symbol} className="market-row">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="asset-logo">{m.logo}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="asset-symbol">{m.symbol}</span>
                <span className="market-label" style={{ alignSelf: 'flex-start', margin: '2px 0 0 0' }}>{m.leverage}</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-dark)' }}>{m.price}</span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: m.change.startsWith('+') ? '#3b82f6' : '#ef4444' }}>{m.change}</span>
            </div>

            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-grey)' }}>{m.volume}</div>
            
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                <span style={{ color: '#3b82f6' }}>{m.lsRatio}%</span>
                <span style={{ color: 'var(--text-grey)' }}>/</span>
                <span style={{ color: '#ef4444' }}>{100 - m.lsRatio}%</span>
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: '#3b82f6' }}>L: {m.longFunding}</span>
              <span style={{ fontSize: '11px', color: '#ef4444' }}>S: {m.shortFunding}</span>
            </div>

            <div style={{ textAlign: 'center', opacity: 0.5, transition: 'opacity 0.2s', color: 'var(--text-grey)' }} className="star-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="drag-handle" style={{ padding: '12px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)', cursor: isDragging ? 'grabbing' : 'grab' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-grey)' }}>
          {filteredMarkets.length} markets / $3.58b Volume
        </div>
      </div>
    </div>
  );
}
