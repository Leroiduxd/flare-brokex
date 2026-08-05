import { useState, useEffect, useMemo } from 'react';
import { useGlobalData } from '../context/DataContext';

const DISPLAY_NAMES = {
  'BTC': 'BTC/USD',
  'ETH': 'ETH/USD',
  'XRP': 'XRP/USD',
  'EURUSD': 'EUR/USD',
  'GBPUSD': 'GBP/USD',
  'JPYUSD': 'USD/JPY',
  'PETROLE': 'WTI/USD',
  'GOLD': 'XAU/USD',
  'SILVER': 'XAG/USD',
  'APPLE': 'AAPL/USD',
  'TESLA': 'TSLA/USD',
  'META': 'META/USD',
  'NVIDIA': 'NVDA/USD',
  'GOOGLE': 'GOOG/USD',
  'AMAZON': 'AMZN/USD',
  'MICROSOFT': 'MSFT/USD',
  'SOLANA': 'SOL/USD'
};

const MOCK_FALLBACK_ASSETS = [
  { symbol: 'BTC/USD', variation: 3.42, formatted: '+3.42%', isUp: true },
  { symbol: 'ETH/USD', variation: 2.15, formatted: '+2.15%', isUp: true },
  { symbol: 'SOL/USD', variation: 5.80, formatted: '+5.80%', isUp: true },
  { symbol: 'XAU/USD', variation: 1.20, formatted: '+1.20%', isUp: true },
  { symbol: 'NVDA/USD', variation: 4.10, formatted: '+4.10%', isUp: true },
  { symbol: 'AAPL/USD', variation: -0.85, formatted: '-0.85%', isUp: false },
  { symbol: 'TSLA/USD', variation: -2.30, formatted: '-2.30%', isUp: false },
  { symbol: 'EUR/USD', variation: -0.45, formatted: '-0.45%', isUp: false },
  { symbol: 'WTI/USD', variation: -1.75, formatted: '-1.75%', isUp: false },
];

export default function Ticker() {
  const [viewMode, setViewMode] = useState('winners'); // 'winners' or 'losers'
  const [assetsData, setAssetsData] = useState(MOCK_FALLBACK_ASSETS);

  const { priceDifferences: globalDiffs } = useGlobalData();

  useEffect(() => {
    if (!globalDiffs) return;
    const rawData = Array.isArray(globalDiffs) ? globalDiffs : (globalDiffs.data || []);

    const parsed = rawData.map(item => {
      const diffNum = parseFloat(item.day_price_diff_decimal || item.hour_price_diff_decimal || 0) * 100;
      const aliasKey = (item.alias || item.symbol || '').toUpperCase();
      return {
        symbol: DISPLAY_NAMES[aliasKey] || aliasKey || 'ASSET',
        variation: diffNum,
        formatted: `${diffNum >= 0 ? '+' : ''}${diffNum.toFixed(2)}%`,
        isUp: diffNum >= 0
      };
    });

    if (parsed.length > 0) {
      setAssetsData(parsed);
    }
  }, [globalDiffs]);

  const toggleMode = () => {
    setViewMode(prev => prev === 'winners' ? 'losers' : 'winners');
  };

  // Filter and sort display assets based on viewMode
  const displayedAssets = useMemo(() => {
    const sorted = [...assetsData];
    if (viewMode === 'winners') {
      return sorted.sort((a, b) => b.variation - a.variation);
    } else {
      return sorted.sort((a, b) => a.variation - b.variation);
    }
  }, [assetsData, viewMode]);

  // Icons
  const UpArrow = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );

  const DownArrow = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );

  const theme = viewMode === 'winners'
    ? { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'TOP WINNERS', icon: <UpArrow /> }
    : { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'TOP LOSERS', icon: <DownArrow /> };

  return (
    <div className="ticker panel" style={{ 
      height: '40px', 
      background: 'var(--panel-bg)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '0 10px',
      overflow: 'hidden'
    }}>
      {/* Toggle Button - Top Winners / Top Losers */}
      <button 
        onClick={toggleMode}
        style={{
          background: theme.bg,
          border: 'none',
          color: theme.color,
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '6px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginRight: '20px',
          flexShrink: 0,
          transition: 'all 0.2s'
        }}
      >
        <span style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>{theme.icon}</span>
        {theme.label}
      </button>

      {/* Ticker Assets Scroll */}
      <div 
        className="ticker-scroll"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '20px',
          overflowX: 'auto',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none' // IE/Edge
        }}
      >
        <style>{`
          .ticker-scroll::-webkit-scrollbar {
            display: none; // Chrome/Safari
          }
        `}</style>
        {displayedAssets.map((asset, index) => {
          const displayColor = asset.isUp ? '#3b82f6' : '#ef4444';

          return (
            <div key={`${asset.symbol}-${index}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-grey)', fontSize: '10px', fontWeight: '600' }}>{asset.symbol}</span>
              <span style={{ 
                color: displayColor, 
                fontSize: '10px', 
                fontWeight: 'bold',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {asset.isUp ? <UpArrow /> : <DownArrow />}
                {asset.formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
