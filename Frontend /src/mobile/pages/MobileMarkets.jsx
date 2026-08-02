import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/MobileLayout';

const marketsData = [
  // CRYPTO
  { symbol: 'BTC-USDC', price: '78,207.00', change: '-1.10%', volume: '$1.64B', leverage: '40x', category: 'Crypto', logo: 'BTC' },
  { symbol: 'ETH-USDC', price: '2,180.50', change: '-1.74%', volume: '$592.5M', leverage: '25x', category: 'Crypto', logo: 'ETH' },
  { symbol: 'SOL-USDC', price: '142.12', change: '+2.85%', volume: '$452.1M', leverage: '20x', category: 'Crypto', logo: 'SOL' },
  
  // COMMODITIES
  { symbol: 'XAU-USD', price: '2,315.10', change: '+0.45%', volume: '$452.0M', leverage: '50x', category: 'Commodities', logo: 'XAU' },
  { symbol: 'XAG-USD', price: '28.45', change: '-0.21%', volume: '$104.0M', leverage: '20x', category: 'Commodities', logo: 'XAG' },
  { symbol: 'WTI-USD', price: '82.45', change: '+0.15%', volume: '$85.0M', leverage: '20x', category: 'Commodities', logo: 'WTI' },

  // FOREX
  { symbol: 'EUR-USD', price: '1.0842', change: '+0.12%', volume: '$12.4B', leverage: '100x', category: 'Forex', logo: 'EUR' },
  { symbol: 'GBP-USD', price: '1.2645', change: '-0.08%', volume: '$8.1B', leverage: '100x', category: 'Forex', logo: 'GBP' },
  { symbol: 'USD-JPY', price: '149.52', change: '+0.34%', volume: '$15.2B', leverage: '100x', category: 'Forex', logo: 'JPY' },
  
  // STOCKS
  { symbol: 'AAPL-USD', price: '189.45', change: '+0.24%', volume: '$1.2B', leverage: '10x', category: 'Stocks', logo: 'AAPL' },
  { symbol: 'META-USD', price: '502.12', change: '-0.45%', volume: '$840.0M', leverage: '10x', category: 'Stocks', logo: 'META' },
  { symbol: 'MSFT-USD', price: '415.67', change: '+0.51%', volume: '$950.0M', leverage: '10x', category: 'Stocks', logo: 'MSFT' },
];

const categories = ['All', 'Crypto', 'Commodities', 'Forex', 'Stocks'];

export default function MobileMarkets() {
  const [activeCategory, setActiveCategory] = useState('All');
  const navigate = useNavigate();

  const filteredMarkets = useMemo(() => {
    if (activeCategory === 'All') return marketsData;
    return marketsData.filter(m => m.category === activeCategory);
  }, [activeCategory]);

  const handleSelectMarket = (symbol) => {
    // Save selected pair to localStorage to update the trading chart and tickers
    localStorage.setItem('brokex_selected_pair', symbol);
    // Dispatches a custom event to notify MobileTrade immediately if open
    window.dispatchEvent(new Event('brokex_pair_changed'));
    // Redirect to trade
    navigate('/');
  };

  return (
    <MobileLayout>
      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '4px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <style>{`
          .mobile-cat-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div className="mobile-cat-scroll" style={{ display: 'flex', gap: '6px', flexShrink: 0, width: '100%' }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: isActive ? 'var(--gold-glow)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isActive ? 'var(--gold)' : 'var(--border-color)'}`,
                  color: isActive ? 'var(--gold)' : 'var(--text-grey)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Markets List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flex: 1
      }}>
        {filteredMarkets.map((m) => {
          const isPositive = m.change.startsWith('+');
          return (
            <div
              key={m.symbol}
              onClick={() => handleSelectMarket(m.symbol)}
              style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              className="market-list-card"
            >
              {/* Left side: Symbol details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(200, 169, 126, 0.08)',
                  border: '1px solid rgba(200, 169, 126, 0.2)',
                  borderRadius: '8px',
                  color: 'var(--gold)',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px'
                }}>
                  {m.logo}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                    {m.symbol}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      color: 'var(--text-grey)',
                      border: '1px solid rgba(255, 255, 255, 0.02)',
                      fontWeight: 'bold'
                    }}>
                      {m.leverage}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-grey)' }}>
                      Vol {m.volume}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side: Prices & Changes */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
                  ${m.price}
                </span>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  fontFamily: 'Source Code Pro, monospace',
                  color: isPositive ? '#3b82f6' : '#ef4444'
                }}>
                  {m.change}
                </span>
              </div>

              <style>{`
                .market-list-card:active {
                  transform: scale(0.98);
                  background: rgba(200, 169, 126, 0.04);
                }
              `}</style>
            </div>
          );
        })}
      </div>
    </MobileLayout>
  );
}
