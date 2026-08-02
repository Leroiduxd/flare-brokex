import React, { useState, useEffect } from 'react';

const marketsData = [
  // CRYPTO
  { symbol: 'BTC-USDC', price: '78,207', change: '-1.10%', logo: 'BTC' },
  { symbol: 'ETH-USDC', price: '2,180.5', change: '-1.74%', logo: 'ETH' },
  { symbol: 'SOL-USDC', price: '142.12', change: '+2.85%', logo: 'SOL' },
  
  // FOREX
  { symbol: 'EUR-USD', price: '1.0842', change: '+0.12%', logo: 'EUR' },
  { symbol: 'GBP-USD', price: '1.2645', change: '-0.08%', logo: 'GBP' },
  { symbol: 'USD-JPY', price: '149.52', change: '+0.34%', logo: 'JPY' },
  
  // COMMODITIES
  { symbol: 'XAU-USD', price: '2,315.10', change: '+0.45%', logo: 'XAU' },
  { symbol: 'XAG-USD', price: '28.45', change: '-0.21%', logo: 'XAG' },
  { symbol: 'WTI-USD', price: '82.45', change: '+0.15%', logo: 'WTI' },
  
  // STOCKS
  { symbol: 'AAPL-USD', price: '189.45', change: '+0.24%', logo: 'AAPL' },
  { symbol: 'META-USD', price: '502.12', change: '-0.45%', logo: 'META' },
  { symbol: 'MSFT-USD', price: '415.67', change: '+0.51%', logo: 'MSFT' },
  { symbol: 'AMZN-USD', price: '178.90', change: '+0.07%', logo: 'AMZN' },
  { symbol: 'GOOG-USD', price: '154.21', change: '-0.29%', logo: 'GOOG' },
];

const parseChange = (chgStr) => {
  return parseFloat(chgStr.replace('%', '').replace('+', ''));
};

const sortedMarkets = [...marketsData].sort((a, b) => parseChange(a.change) - parseChange(b.change));
const topLosers = sortedMarkets.slice(0, 3);
const topGainers = [...sortedMarkets].reverse().slice(0, 3);

export default function RecentlyListed() {
  const [showGainers, setShowGainers] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowGainers(prev => !prev);
    }, 4000); // Alternate every 4 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(3px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-3px); }
        }
        .rotating-section {
          animation: fadeInOut 4s infinite ease-in-out;
        }
      `}</style>
      
      {/* Title with current mode */}
      <div style={{
        fontSize: '10px',
        color: 'var(--text-grey)',
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        textTransform: 'uppercase'
      }}>
        <span>[ MARKET DYNAMICS ]</span>
        <span style={{ color: showGainers ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>
          {showGainers ? 'TOP GAINERS' : 'TOP LOSERS'}
        </span>
      </div>

      {/* Rotating content */}
      <div 
        key={showGainers ? 'gainers' : 'losers'} // React key triggers CSS keyframes on mount
        className="rotating-section" 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flex: 1,
          justifyContent: 'center',
          paddingTop: '6px'
        }}
      >
        {(showGainers ? topGainers : topLosers).map((m, idx) => (
          <div key={m.symbol} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontFamily: 'Source Code Pro, monospace'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-grey)',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '9px',
                border: '1px solid rgba(255,255,255,0.02)'
              }}>{idx + 1}</span>

              {/* Logo block modeled after MarketsTable */}
              <div style={{
                width: '30px',
                height: '30px',
                background: 'var(--bg-dark, rgba(0,0,0,0.2))',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '11px',
                color: '#BC8961',
                border: '1px solid var(--border-color)'
              }}>{m.logo}</div>

              <span style={{ color: '#fff', fontWeight: 'bold' }}>{m.symbol}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-grey)', fontSize: '10px' }}>{m.price}</span>
              <span style={{ 
                fontWeight: 'bold', 
                color: showGainers ? '#3b82f6' : '#ef4444' 
              }}>
                {m.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
