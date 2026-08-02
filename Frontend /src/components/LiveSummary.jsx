import React, { useState, useEffect } from 'react';

export default function LiveSummary() {
  const goldAccent = '#BC8961';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';

  // Live ticking state for active trades PnL fluctuation
  const [livePnl, setLivePnl] = useState(465.60);
  const totalMargin = 1000.00; // Collateral currently locked in open trades
  const openInterest = 37500.00; // Sum of size of active positions ($25k + $12.5k)
  const activeTrades = 2; // Positions count
  const pendingOrders = 2; // Pending orders count (SOL & ETH matching Positions.jsx)
  const avgLeverage = '37.5x'; // Average leverage ((50x + 25x) / 2)
  const volume24h = 124500.00; // 24h trading volume

  useEffect(() => {
    const timer = setInterval(() => {
      // Simulate price fluctuation in open trades
      const change = (Math.random() - 0.5) * 1.5; // Fluctuation of up to $0.75
      setLivePnl(prev => {
        const next = prev + change;
        // Realistic bounds of PnL matching the open positions
        if (next < 420) return 420;
        if (next > 510) return 510;
        return next;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, []);

  // Return on Equity (Margin Collateral)
  const roePct = (livePnl / totalMargin) * 100;

  return (
    <div className="panel no-scrollbar" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '0 16px',
      position: 'relative',
      overflowX: 'auto', // Allow horizontal scroll if screen size is narrow
      overflowY: 'hidden',
      justifyContent: 'flex-start', // Centered/aligned on the left!
      gap: '20px' // Sleek compact gap between sections
    }}>
      {/* Subtle technical background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.01) 1px, transparent 0)',
        backgroundSize: '16px 16px',
        pointerEvents: 'none'
      }} />

      {/* 1. Active Trades */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '70px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          Active Trades
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#fff',
          fontFamily: 'Source Code Pro',
        }}>
          {activeTrades} <span style={{ fontSize: '9px', color: 'var(--text-grey)', fontWeight: 'normal' }}>Pos</span>
        </span>
      </div>

      {/* Vertical Border */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0, zIndex: 1 }} />

      {/* 2. Pending Orders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '85px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          Pending Orders
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#fff',
          fontFamily: 'Source Code Pro',
        }}>
          {pendingOrders} <span style={{ fontSize: '9px', color: 'var(--text-grey)', fontWeight: 'normal' }}>Orders</span>
        </span>
      </div>

      {/* Vertical Border */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0, zIndex: 1 }} />

      {/* 3. Total Margin */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '85px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          Total Margin
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: goldAccent,
          fontFamily: 'Source Code Pro'
        }}>
          ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(totalMargin)}
        </span>
      </div>

      {/* Vertical Border */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0, zIndex: 1 }} />

      {/* 4. Live PnL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '125px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          Live Open PnL
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 'bold',
            color: blueColor,
            fontFamily: 'Source Code Pro',
            transition: 'all 0.3s ease'
          }}>
            +${livePnl.toFixed(2)}
          </span>
          <span style={{
            fontSize: '8px',
            color: 'rgba(59, 130, 246, 0.8)',
            fontFamily: 'Source Code Pro',
            fontWeight: 'bold',
            background: 'rgba(59, 130, 246, 0.1)',
            padding: '1px 4px',
            borderRadius: '3px'
          }}>
            +{roePct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Vertical Border */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0, zIndex: 1 }} />

      {/* 5. Open Interest (Position Size) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '110px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          Open Interest (Size)
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#fff',
          fontFamily: 'Source Code Pro'
        }}>
          ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(openInterest)}
        </span>
      </div>

      {/* Vertical Border */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0, zIndex: 1 }} />

      {/* 6. Avg Leverage */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '70px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          Avg Leverage
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: goldAccent,
          fontFamily: 'Source Code Pro'
        }}>
          {avgLeverage}
        </span>
      </div>

      {/* Vertical Border */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0, zIndex: 1 }} />

      {/* 7. 24h Volume */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '85px', zIndex: 1 }}>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
          24h Volume
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#fff',
          fontFamily: 'Source Code Pro'
        }}>
          ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(volume24h)}
        </span>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
