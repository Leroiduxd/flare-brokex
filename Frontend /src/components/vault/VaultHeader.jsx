import React, { useRef } from 'react';

export default function VaultHeader() {
  const containerRef = useRef(null);

  const stats = {
    lpPrice: '$1.2450',
    change24h: '+1.85%',
    totalSupply: '36,312,940 BLP',
    totalLiquidity: '$45,210,845',
    usedLiquidity: '$35,420,180',
    freeLiquidity: '$9,790,665',
    stressFactor: '12.4%',
    livePnL: '+$412,850',
    longRatio: 58,
    totalTrades: '1,842,501',
    activeTraders: '1,420',
    pendingOrders: '142'
  };

  const handleMouseDown = (e) => {
    const ele = containerRef.current;
    if (!ele) return;
    
    ele.style.cursor = 'grabbing';
    ele.style.userSelect = 'none';

    const startX = e.clientX - ele.offsetLeft;
    const scrollLeft = ele.scrollLeft;

    const handleMouseMove = (e) => {
      const x = e.clientX - ele.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll speed factor
      ele.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      ele.style.cursor = 'grab';
      ele.style.removeProperty('user-select');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box'
    }}>
      <style>{`
        /* Hide scrollbars completely across browsers */
        .vault-scrollable-stats::-webkit-scrollbar {
          display: none;
        }
        .vault-scrollable-stats > * {
          flex-shrink: 0;
        }
      `}</style>

      {/* Internal scrollable stats container identical to TopNav */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="vault-scrollable-stats" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '20px', 
          overflowX: 'auto', 
          width: '100%',
          height: '100%',
          padding: '0 16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab'
        }}
      >
        
        {/* LP Price */}
        <div className="stat-item">
          <span className="stat-label">LP Price</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="stat-value" style={{ fontWeight: 'bold' }}>{stats.lpPrice}</span>
            <span className="stat-value up" style={{ fontSize: '10px' }}>{stats.change24h}</span>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Total Supply */}
        <div className="stat-item">
          <span className="stat-label">Total Supply</span>
          <span className="stat-value">{stats.totalSupply}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Total Liquidity */}
        <div className="stat-item">
          <span className="stat-label">Total Liquidity</span>
          <span className="stat-value" style={{ color: '#BC8961' }}>{stats.totalLiquidity}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Used Liquidity */}
        <div className="stat-item">
          <span className="stat-label">Used Liquidity</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{stats.usedLiquidity}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Free Liquidity */}
        <div className="stat-item">
          <span className="stat-label">Free Liquidity</span>
          <span className="stat-value" style={{ color: '#3b82f6' }}>{stats.freeLiquidity}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Live Unrealized PnL */}
        <div className="stat-item">
          <span className="stat-label">Live Vault PnL</span>
          <span className="stat-value" style={{ color: '#3b82f6', fontWeight: 'bold' }}>{stats.livePnL}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Long/Short Balance */}
        <div className="stat-item">
          <span className="stat-label">Long / Short</span>
          <span className="stat-value" style={{ fontFamily: 'Source Code Pro, monospace' }}>
            <span style={{ color: '#3b82f6' }}>{stats.longRatio}% L</span>
            <span style={{ color: 'var(--text-grey, #888888)' }}> / </span>
            <span style={{ color: '#ef4444' }}>{100 - stats.longRatio}% S</span>
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Trades / Traders */}
        <div className="stat-item">
          <span className="stat-label">Trades / Traders</span>
          <span className="stat-value" style={{ fontFamily: 'Source Code Pro, monospace' }}>
            {stats.totalTrades} <span style={{ color: 'var(--text-grey, #888888)', fontSize: '10px' }}>/</span> {stats.activeTraders}
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Pending Orders */}
        <div className="stat-item">
          <span className="stat-label">Pending Orders</span>
          <span className="stat-value" style={{ color: '#BC8961' }}>{stats.pendingOrders}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Stress Factor */}
        <div className="stat-item">
          <span className="stat-label">Stress Factor</span>
          <span className="stat-value" style={{ color: '#BC8961' }}>{stats.stressFactor}</span>
        </div>

      </div>
    </div>
  );
}
