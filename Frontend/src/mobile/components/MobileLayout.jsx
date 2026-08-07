import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePriceStream } from '../../context/PriceContext';
import { useGlobalData } from '../../context/DataContext';

const DISPLAY_NAMES = {
  'BTC': 'BTC',
  'ETH': 'ETH',
  'XRP': 'XRP',
  'EURUSD': 'EUR',
  'GBPUSD': 'GBP',
  'JPYUSD': 'JPY',
  'PETROLE': 'WTI',
  'GOLD': 'XAU',
  'SILVER': 'XAG',
  'APPLE': 'AAPL',
  'TESLA': 'TSLA',
  'META': 'META',
  'NVIDIA': 'NVDA',
  'GOOGLE': 'GOOG',
  'AMAZON': 'AMZN',
  'MICROSOFT': 'MSFT',
  'SOLANA': 'SOL'
};

const DEFAULT_FALLBACK_TICKER = [
  { symbol: 'XAU', price: '$4,046.52', change: '+0.12%', isUp: true },
  { symbol: 'XRP', price: '$2.4500', change: '+0.00%', isUp: true },
];

export default function MobileLayout({ children, disablePadding = false }) {
  const location = useLocation();

  const [isLightMode, setIsLightMode] = useState(
    document.body.classList.contains('light-mode')
  );

  const { priceDifferences: globalDiffs } = useGlobalData();
  const { prices: livePrices } = usePriceStream();
  const [tickerItems, setTickerItems] = useState(DEFAULT_FALLBACK_TICKER);

  useEffect(() => {
    if (!globalDiffs) return;
    const rawData = Array.isArray(globalDiffs) ? globalDiffs : (globalDiffs.data || []);

    const parsed = rawData.map(item => {
      const diffNum = parseFloat(item.day_price_diff_decimal || item.hour_price_diff_decimal || 0) * 100;
      const aliasKey = (item.alias || item.symbol || '').toUpperCase();
      const symbol = DISPLAY_NAMES[aliasKey] || aliasKey || 'ASSET';
      
      let priceVal = parseFloat(item.last_price || item.priceUSD || item.price || 0);
      if (symbol === 'XAU' && livePrices?.GOLD > 0) priceVal = livePrices.GOLD;
      if (symbol === 'XRP' && livePrices?.XRP > 0) priceVal = livePrices.XRP;

      const dec = (symbol === 'XRP' || (priceVal > 0 && priceVal < 10)) ? 4 : 2;
      const priceStr = priceVal > 0 
        ? `$${priceVal.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
        : '—';

      return {
        symbol,
        price: priceStr,
        change: `${diffNum >= 0 ? '+' : ''}${diffNum.toFixed(2)}%`,
        isUp: diffNum >= 0
      };
    });

    if (parsed.length > 0) {
      setTickerItems(parsed);
    }
  }, [globalDiffs, livePrices]);

  const toggleTheme = () => {
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    document.body.classList.toggle('light-mode');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100dvh', // Use 100dvh for modern mobile devices to avoid bottom bar clipping
      backgroundColor: 'var(--bg-dark)',
      color: 'var(--text-dark)',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        html, body, #root {
          height: 100dvh !important;
          overflow: hidden !important;
        }

        @keyframes ticker-marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        .mobile-ticker-container {
          flex: 1;
          margin: 0 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          height: 100%;
          mask-image: linear-gradient(to right, transparent, white 15%, white 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, white 15%, white 85%, transparent);
        }

        .mobile-ticker-track {
          display: flex;
          gap: 18px;
          animation: ticker-marquee 36s linear infinite;
          white-space: nowrap;
        }

        .mobile-ticker-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-family: 'Source Code Pro', monospace;
          font-weight: bold;
        }

        .mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 44px;
          padding: 0 8px;
          background: rgba(10, 10, 10, 0.85);
          backdrop-filter: blur(20px);
          z-index: 1000;
        }

        body.light-mode .mobile-header {
          background: rgba(255, 255, 255, 0.85);
        }

        .mobile-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }

        .mobile-logo-text {
          font-size: 14px;
          font-weight: 900;
          color: var(--text-dark);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .mobile-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .mobile-action-btn {
          background: transparent;
          border: none;
          color: var(--text-grey);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .mobile-action-btn:active {
          background: rgba(200, 169, 126, 0.1);
          color: var(--gold);
        }

        .mobile-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flexDirection: column;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>

      {/* Premium Top Navigation Bar */}
      <header className="mobile-header">
        {/* Left: Logo Only */}
        <Link to="/" className="mobile-logo" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="Brokex" style={{ width: '22px', height: 'auto', maxHeight: '24px', display: 'block', objectFit: 'contain' }} />
        </Link>

        {/* Center: Gliding price ticker marquee */}
        <div className="mobile-ticker-container">
          <div className="mobile-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <div key={idx} className="mobile-ticker-item">
                <span style={{ color: 'var(--text-grey)' }}>[</span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>{item.symbol}</span>
                <span style={{ color: 'var(--text-grey)' }}>]</span>
                <span style={{ color: item.isUp ? '#3b82f6' : '#ef4444', marginLeft: '4px' }}>{item.change}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Actions (Theme Toggle + RainbowKit Wallet Connect) */}
        <div className="mobile-header-actions" style={{ flexShrink: 0 }}>
          {/* Theme Toggle */}
          <button className="mobile-action-btn" onClick={toggleTheme}>
            {isLightMode ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            )}
          </button>

          {/* RainbowKit Connect Button */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== 'loading';
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus || authenticationStatus === 'authenticated');

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          style={{
                            background: 'var(--gold)',
                            color: '#000',
                            border: '1px solid var(--gold)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Connect
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={openAccountModal}
                        type="button"
                        style={{
                          background: 'rgba(200, 169, 126, 0.1)',
                          color: 'var(--gold)',
                          border: '1px solid rgba(200, 169, 126, 0.4)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'Source Code Pro, monospace',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {account.displayName}
                      </button>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Page Content */}
      <main 
        className="mobile-content"
        style={disablePadding ? {
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 0
        } : {}}
      >
        {children}
      </main>
    </div>
  );
}
