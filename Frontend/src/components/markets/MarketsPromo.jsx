import React, { useState } from 'react';

export default function MarketsPromo() {
  const [activeSegment, setActiveSegment] = useState(null);

  const goldAccent = '#BC8961';
  const themeBorder = 'var(--border-color, #222)';
  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';
  const themeBg = 'var(--panel-bg, #111111)';

  // Vault Assets & Open Interest Data - No Green!
  const assetsData = [
    { name: 'BTC', percentage: 45, value: '$4.00B', color: '#BC8961', dashArray: '45 100', offset: '0' },
    { name: 'ETH', percentage: 30, value: '$2.67B', color: '#3b82f6', dashArray: '30 100', offset: '-45' },
    { name: 'SOL', percentage: 15, value: '$1.33B', color: '#ef4444', dashArray: '15 100', offset: '-75' },
    { name: 'Others', percentage: 10, value: '$0.90B', color: '#6b7280', dashArray: '10 100', offset: '-90' },
  ];

  // Vault Stats - Enriched with PnL & more metrics
  const stats = {
    tvl: '$45,210,845',
    poolCap: '$50,000,000',
    currentPnL: '+$412,850', // Unrealized PnL
    realizedPnL: '+$3,429,504', // Realized PnL
    volume24h: '$24,850,192',
    fees24h: '$42,850',
    stakingApy: '18.42%',
    cumulativeVolume: '$184.25B',
    cumulativeOi: '$8.90B',
    averageLeverage: '18.5x',
    longRatio: 58,
    activeTraders: '1,420',
    totalTraders: '28,452',
    totalTrades: '1,842,501',
    totalOrders: '3,412,987',
    liquidations: '42,912',
    cumulativeFees: '$8,421,902',
    insuranceFund: '$5,250,000',
    utilizationRate: '78.4%',
  };

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      padding: '10px 12px', // Reduced padding
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px', // Reduced gap for high density
      overflowY: 'auto',
      backgroundColor: themeBg,
      border: `1px solid ${themeBorder}`,
      borderRadius: '10px',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      <style>{`
        /* Hide scrollbars */
        .panel::-webkit-scrollbar {
          display: none;
        }

        .section-header {
          font-size: 9px;
          color: ${themeTextMuted};
          font-weight: bold;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 4px;
          margin-top: 2px;
        }

        .stat-row-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
        }

        .progress-bar-container {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
          overflow: hidden;
          display: flex;
        }
      `}</style>

      {/* Main Title */}
      <div style={{
        fontSize: '10px',
        color: themeTextMuted,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        borderBottom: `1px solid ${themeBorder}`,
        paddingBottom: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        textTransform: 'uppercase',
        flexShrink: 0
      }}>
        <span>[ VAULT STATS ]</span>
        <span style={{ color: goldAccent, fontWeight: 'bold' }}>LIVE</span>
      </div>

      {/* Section 1: Donut Chart - Open Interest Allocation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        <div className="section-header" style={{ alignSelf: 'flex-start' }}>[ OPEN INTEREST ALLOCATION ]</div>
        
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-around', gap: '10px' }}>
          {/* SVG Donut */}
          <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
            <svg viewBox="0 0 42 42" className="donut" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              {assetsData.map((asset) => (
                <circle
                  key={asset.name}
                  cx="21"
                  cy="21"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke={asset.color}
                  strokeWidth={activeSegment === asset.name ? '4.5' : '3.5'}
                  strokeDasharray={asset.dashArray}
                  strokeDashoffset={asset.offset}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: activeSegment === null || activeSegment === asset.name ? 1 : 0.4
                  }}
                  onMouseEnter={() => setActiveSegment(asset.name)}
                  onMouseLeave={() => setActiveSegment(null)}
                />
              ))}
            </svg>
            
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: themeText }}>
                {activeSegment ? activeSegment : 'Total'}
              </span>
              <span style={{ fontSize: '9px', color: themeTextMuted, fontFamily: 'Source Code Pro, monospace' }}>
                {activeSegment 
                  ? assetsData.find(a => a.name === activeSegment).value 
                  : stats.cumulativeOi}
              </span>
            </div>
          </div>

          {/* Legend Table-like */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {assetsData.map(asset => (
              <div 
                key={asset.name} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '10px',
                  cursor: 'pointer',
                  opacity: activeSegment === null || activeSegment === asset.name ? 1 : 0.5,
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={() => setActiveSegment(asset.name)}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: asset.color }} />
                <span style={{ color: themeText, fontWeight: 500 }}>{asset.name}</span>
                <span style={{ color: themeTextMuted, marginLeft: 'auto', fontFamily: 'Source Code Pro, monospace' }}>
                  {asset.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dividers with horizontal margins so they don't touch the borders */}
      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.03)', margin: '6px 16px' }} />

      {/* Section 2: Vault Financial Metrics */}
      <div>
        <div className="section-header">[ FINANCIAL METRICS ]</div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Total Value Locked</span>
          <span style={{ color: goldAccent, fontWeight: 'bold' }}>{stats.tvl}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Pool Capacity</span>
          <span style={{ color: themeText }}>90.4% / {stats.poolCap}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Current Vault PnL (Unrealized)</span>
          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{stats.currentPnL}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Total Realized PnL</span>
          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{stats.realizedPnL}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>24h Volume / Fees</span>
          <span style={{ color: themeText }}>{stats.volume24h} / {stats.fees24h}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Cumulative Volume</span>
          <span style={{ color: themeText }}>{stats.cumulativeVolume}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Cumulative Fees</span>
          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{stats.cumulativeFees}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Staking APY (Vault)</span>
          <span style={{ color: goldAccent, fontWeight: 'bold' }}>{stats.stakingApy}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Vault Utilization</span>
          <span style={{ color: themeText }}>{stats.utilizationRate}</span>
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.03)', margin: '6px 16px' }} />

      {/* Section 3: Long / Short Balance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: themeTextMuted }}>
          <span className="section-header" style={{ margin: 0 }}>[ VAULT BALANCE ]</span>
          <span style={{ fontFamily: 'Source Code Pro, monospace' }}>
            <span style={{ color: '#3b82f6' }}>{stats.longRatio}% L</span>
            <span style={{ color: themeTextMuted }}> / </span>
            <span style={{ color: '#ef4444' }}>{100 - stats.longRatio}% S</span>
          </span>
        </div>
        
        <div className="progress-bar-container">
          <div style={{ width: `${stats.longRatio}%`, backgroundColor: '#3b82f6', height: '100%' }} />
          <div style={{ width: `${100 - stats.longRatio}%`, backgroundColor: '#ef4444', height: '100%' }} />
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.03)', margin: '6px 16px' }} />

      {/* Section 4: Trading Activity */}
      <div>
        <div className="section-header">[ TRADING ACTIVITY ]</div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Active Traders (24h)</span>
          <span style={{ color: themeText, fontWeight: 'bold' }}>{stats.activeTraders}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>All-time Traders</span>
          <span style={{ color: themeText }}>{stats.totalTraders}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Total Trades</span>
          <span style={{ color: themeText }}>{stats.totalTrades}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Avg. Leverage Used</span>
          <span style={{ color: goldAccent, fontWeight: 'bold' }}>{stats.averageLeverage}</span>
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.03)', margin: '6px 16px' }} />

      {/* Section 5: Risk & Health */}
      <div>
        <div className="section-header">[ RISK & HEALTH ]</div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>Liquidations Handled</span>
          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{stats.liquidations}</span>
        </div>
        <div className="stat-row-item">
          <span style={{ color: themeTextMuted }}>System Health</span>
          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>99.98% SECURE</span>
        </div>
      </div>

      {/* Footer Info */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '8px', 
        color: themeTextMuted, 
        marginTop: 'auto', 
        paddingTop: '6px',
        borderTop: `1px solid ${themeBorder}`,
        fontFamily: 'Source Code Pro, monospace'
      }}>
        AUTOMATED VIA SMART CONTRACTS
      </div>
    </div>
  );
}
