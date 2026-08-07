import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Chart from '../../components/Chart';
import MobileLayout from '../components/MobileLayout';
import { MobilePortfolioContent } from './MobilePortfolio';
import { 
  MobilePositions,
  MobileOrderPanel, 
  MobilePositionManager,
  MobileTradeHeader,
  MobileTopNav
} from '../components/MobileTradeComponents';
import { usePriceStream } from '../../context/PriceContext';

const marketsData = [
  // COMMODITIES
  { symbol: 'XAU-USD', price: '4,046.52', change: '+0.12%', volume: '$452.0M', leverage: '100x', category: 'Commodities', logo: '[XAU]', company: 'Gold / US Dollar' },
  // CRYPTO
  { symbol: 'XRP-USD', price: '2.4500', change: '+0.00%', volume: '$125.0M', leverage: '100x', category: 'Crypto', logo: '[XRP]', company: 'XRP / US Dollar' },
];

const categories = ['All', 'Commodities', 'Crypto'];

export default function MobileTrade() {
  const navigate = useNavigate();
  const location = useLocation();
  const { prices: livePrices } = usePriceStream();

  // Primary active tab switcher: 'markets', 'trade', 'portfolio'
  // On first load, parse path to select matching tab, fallback to 'markets' by default
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname === '/portfolio') return 'portfolio';
    if (location.pathname === '/trade') return 'trade';
    return 'markets';
  });

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };

  // State to manage Market selection overlay/subview inside Markets tab
  const [isMarketSelectorOpen, setIsMarketSelectorOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPair, setSelectedPair] = useState(() => {
    return localStorage.getItem('brokex_selected_pair') || 'XAU-USD';
  });

  // Position Manager Modal State (for Portfolio positions)
  const [isPosManagerOpen, setIsPosManagerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [posManagerTab, setPosManagerTab] = useState('close');

  const [isConnected, setIsConnected] = useState(() => {
    return localStorage.getItem('brokex_wallet_connected') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setIsConnected(localStorage.getItem('brokex_wallet_connected') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('wallet_connection_changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wallet_connection_changed', handleStorageChange);
    };
  }, []);

  const handleSelectMarket = (symbolStr) => {
    const key = symbolStr.includes('XRP') ? 'XRP' : 'GOLD';
    const chartSym = key === 'XRP' ? 'Crypto.XRP/USD' : 'Metal.XAU/USD';
    setSelectedPair(symbolStr);
    localStorage.setItem('brokex_selected_pair', symbolStr);
    localStorage.setItem('brokex_selected_asset', key);
    window.dispatchEvent(new CustomEvent('brokex_asset_changed', { detail: { assetKey: key, symbol: chartSym } }));
    window.dispatchEvent(new Event('brokex_pair_changed'));
    setIsMarketSelectorOpen(false);
  };

  const handleManagePosition = (position, tab) => {
    setSelectedPosition(position);
    setPosManagerTab(tab);
    setIsPosManagerOpen(true);
  };

  const filteredMarkets = useMemo(() => {
    if (activeCategory === 'All') return marketsData;
    return marketsData.filter(m => m.category === activeCategory);
  }, [activeCategory]);

  const activeMarketInfo = useMemo(() => {
    const market = marketsData.find(m => m.symbol === selectedPair);
    if (market) return market;
    return { symbol: 'XAU-USD', price: '4,046.52', change: '+0.12%', volume: '$452.0M', leverage: '50x', logo: 'XAU', company: 'Gold / US Dollar CFD' };
  }, [selectedPair]);

  return (
    <MobileLayout disablePadding={true}>
      <style>{`
        .mobile-main-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          width: 100%;
        }
        
        .mobile-chart-area {
          flex: 1;
          background: var(--panel-bg);
          overflow: hidden;
          position: relative;
        }

        .chart.panel {
          border-radius: 0px !important;
          border-left: none !important;
          border-right: none !important;
        }

        /* Premium Bottom Tab Bar styling */
        .mobile-bottom-tabs {
          display: flex;
          background: rgba(10, 10, 10, 0.92);
          backdrop-filter: blur(25px);
          border-top: 1px solid var(--border-color);
          height: 46px;
          padding-bottom: env(safe-area-inset-bottom, 0);
          align-items: center;
          justify-content: space-around;
          z-index: 1000;
          flex-shrink: 0;
        }

        body.light-mode .mobile-bottom-tabs {
          background: rgba(255, 255, 255, 0.92);
        }

        .mobile-tab-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          color: var(--text-grey);
          cursor: pointer;
          gap: 6px;
          flex: 1;
          height: 100%;
          transition: all 0.2s ease;
          border: none;
          background: transparent;
          outline: none;
        }

        .mobile-tab-item.active {
          color: var(--gold);
        }

        .mobile-tab-label {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .market-list-card:active {
          transform: scale(0.98);
          background: rgba(200, 169, 126, 0.04);
        }

        /* Hide scrollbars across the app for ultra-clean mobile feeling */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Main viewport */}
      <main className="mobile-main-container">
        
        {/* TAB 1: MARKETS VIEW (CHART + DETAILS + POSITIONS) */}
        {activeTab === 'markets' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
            {isMarketSelectorOpen ? (
              /* Market Selection Subview */
              <div className="no-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-dark)', textTransform: 'uppercase', margin: 0 }}>
                    Select Asset
                  </h3>
                  <button 
                    onClick={() => setIsMarketSelectorOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', fontSize: '20px', cursor: 'pointer' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Categories */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
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
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Markets List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredMarkets.map((m) => {
                    const isXRP = m.symbol.includes('XRP');
                    const assetKey = isXRP ? 'XRP' : 'GOLD';
                    const rawPrice = livePrices?.[assetKey] || (isXRP ? 2.45 : 4046.52);
                    const displayPrice = rawPrice.toLocaleString('en-US', { minimumFractionDigits: isXRP ? 4 : 2, maximumFractionDigits: isXRP ? 4 : 2 });
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
                          transition: 'all 0.2s ease'
                        }}
                        className="market-list-card"
                      >
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
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {m.logo}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                              {m.symbol}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-grey)' }}>
                              Vol {m.volume} ({m.leverage})
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
                            ${displayPrice}
                          </span>
                          <span style={{ fontSize: '9.5px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isPositive ? '#3b82f6' : '#ef4444' }}>
                            {m.change}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Unified Chart + Ticker stats + Positions scrollable container */
              <div className="no-scrollbar" style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: 'var(--bg-dark)',
                padding: '8px',
                gap: '2px'
              }}>
                
                {/* CARD 1: Unified TradeHeader + Metrics Stats + Chart (看起来像一个整体 div) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  backgroundColor: 'var(--panel-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  flexShrink: 0
                }}>
                  {/* Unified Header & Market Stats Row */}
                  <MobileTopNav 
                    activeMarketInfo={activeMarketInfo} 
                    setIsMarketSelectorOpen={setIsMarketSelectorOpen} 
                  />

                  {/* 3. Chart Container */}
                  <div style={{ height: '320px', width: '100%', overflow: 'hidden' }}>
                    <Chart />
                  </div>
                </div>

                {/* CARD 2: Positions Section Card */}
                <div style={{ 
                  flexShrink: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  width: '100%',
                  backgroundColor: 'var(--panel-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  marginBottom: '16px'
                }}>
                  <MobilePositions 
                    onManagePosition={handleManagePosition} 
                    isFullPage={false} 
                  />
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRADE VIEW (ORDER PANEL ONLY) */}
        {activeTab === 'trade' && (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: 'var(--bg-dark)', 
            padding: '8px', 
            width: '100%' 
          }}>
            {/* Unified Trade TopNav + Order Panel (One Single Div!) */}
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: 'var(--panel-bg)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <MobileTopNav 
                activeMarketInfo={activeMarketInfo} 
                setIsMarketSelectorOpen={setIsMarketSelectorOpen} 
              />
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <MobileOrderPanel 
                  isOpen={true} 
                  onClose={() => handleTabChange('markets')} 
                  initialSide="buy" 
                  isInline={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PORTFOLIO VIEW */}
        {activeTab === 'portfolio' && (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: 'var(--bg-dark)', 
            padding: '8px', 
            width: '100%',
            overflow: 'hidden'
          }}>
            <MobilePortfolioContent />
          </div>
        )}
      </main>

      {/* Premium Sticky Bottom Tab Bar */}
      <footer className="mobile-bottom-tabs">
        {/* Markets Tab Button */}
        <button 
          className={`mobile-tab-item ${activeTab === 'markets' ? 'active' : ''}`}
          onClick={() => handleTabChange('markets')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
          </svg>
          <span className="mobile-tab-label">Markets</span>
        </button>

        {/* Trade Tab Button */}
        <button 
          className={`mobile-tab-item ${activeTab === 'trade' ? 'active' : ''}`}
          onClick={() => handleTabChange('trade')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="12" cy="12" r="3" /><path d="m14 10 2-2" /><path d="m10 14-2 2" /><path d="m14 14 2 2" /><path d="m10 10-2-2" />
          </svg>
          <span className="mobile-tab-label">Trade</span>
        </button>

        {/* Portfolio Tab Button */}
        <button 
          className={`mobile-tab-item ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => handleTabChange('portfolio')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span className="mobile-tab-label">Portfolio</span>
        </button>
      </footer>

      {/* Position action overlay manager */}
      <MobilePositionManager
        isOpen={isPosManagerOpen}
        onClose={() => setIsPosManagerOpen(false)}
        position={selectedPosition}
        initialTab={posManagerTab}
      />
    </MobileLayout>
  );
}
