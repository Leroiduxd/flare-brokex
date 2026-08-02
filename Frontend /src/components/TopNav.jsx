import React from 'react';

export default function TopNav({ onOpenMarket }) {
  // Mock data - in a real app this would come from a context or prop
  const stats = {
    ticker: 'XAU/USD',
    price: '2,315.10',
    change: '+0.12%',
    funding: '0.0100%',
    oi: '125.4M',
    maxOi: '500M',
    longRatio: 65, // 65% longs
  };

  const goldAccent = '#BC8961';

  return (
    <div className="nav panel" style={{ overflow: 'hidden' }}>
      <div className="nav-stats-container" style={{ display: 'flex', width: '100%', overflow: 'hidden', gap: '0', paddingRight: '0' }}>
        {/* FIXED LEFT SIDE: Ticker Selector */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '15px', padding: '0 15px 0 0' }}>
          <div className="ticker-selector" onClick={onOpenMarket} style={{ flexShrink: 0, paddingRight: '13px' }}>
            <div className="ticker-logo" style={{ borderRadius: '6px', background: '#BC8961', color: '#000', fontWeight: 'bold' }}>G</div>
            <div className="ticker-info">
              <span className="ticker-name">{stats.ticker}</span>
              <span className="ticker-label" style={{ fontSize: '10px', color: 'var(--text-grey)', fontWeight: 'normal' }}>Gold / US Dollar</span>
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0 }}></div>
        </div>

        {/* SCROLLABLE RIGHT SIDE: Stats Items */}
        <div className="scrollable-stats" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          overflowX: 'auto',
          flexGrow: 1,
          padding: '0 20px 0 5px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          <style>{`
            .scrollable-stats::-webkit-scrollbar {
              display: none;
            }
            .scrollable-stats > * {
              flex-shrink: 0;
            }
          `}</style>

          {/* Price Section */}
          <div className="stat-item">
            <span className="stat-label">Price</span>
            <span className="stat-value" style={{ fontSize: '14px', fontWeight: 'bold' }}>${stats.price}</span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Variation Section */}
          <div className="stat-item">
            <span className="stat-label">Variation</span>
            <span className={`stat-value ${stats.change.startsWith('+') ? 'up' : 'down'}`}>
              {stats.change}
            </span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Funding Rates */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="stat-item">
              <span className="stat-label">Funding Long</span>
              <span className="stat-value" style={{ color: '#ef4444' }}>{stats.funding}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Funding Short</span>
              <span className="stat-value" style={{ color: '#3b82f6' }}>-{stats.funding}</span>
            </div>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Open Interest & Ratio Group */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="stat-item">
              <span className="stat-label">Open Interest</span>
              <span className="stat-value">{stats.oi} / {stats.maxOi}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Long/Short Ratio</span>
              <span className="stat-value">
                <span style={{ color: '#3b82f6' }}>{stats.longRatio}%</span>
                <span style={{ color: 'var(--text-grey)', margin: '0 4px' }}>/</span>
                <span style={{ color: '#ef4444' }}>{100 - stats.longRatio}%</span>
              </span>
            </div>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* 24h Volume Section */}
          <div className="stat-item">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value">$842.5M</span>
          </div>
        </div>
      </div>
    </div>
  );
}
