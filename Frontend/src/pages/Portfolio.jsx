import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Positions from '../components/Positions';
import Ticker from '../components/Ticker';
import PortfolioMetrics from '../components/PortfolioMetrics';
import MarketMetrics from '../components/MarketMetrics';
import LiveSummary from '../components/LiveSummary';

export default function Portfolio() {
  const goldAccent = '#BC8961';
  const isDragging = useRef(false);
  const [positionsHeight, setPositionsHeight] = useState(340);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;

      const windowHeight = window.innerHeight;
      const mouseY = e.clientY;

      // Bottom offsets in Portfolio: padding (10) + ticker (40) + gap (8) = 58px
      const bottomOffset = 58;
      
      let newHeight = windowHeight - mouseY - bottomOffset;

      // Constraints matching Trade.jsx
      const snapThreshold = 80;
      const minOpenHeight = 180;

      if (newHeight < snapThreshold) {
        newHeight = 40;
      } else if (newHeight < minOpenHeight) {
        newHeight = minOpenHeight;
      }

      const maxPositionsHeight = windowHeight * 0.6;
      if (newHeight > maxPositionsHeight) {
        newHeight = maxPositionsHeight;
      }

      setPositionsHeight(newHeight);

      // Dispatch a window resize event to trigger Chart.js internal canvas redraw in real-time
      window.dispatchEvent(new Event('resize'));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      width: '100vw', 
      height: '100vh', 
      padding: '10px', 
      backgroundColor: 'var(--bg-dark)', 
      gap: '8px', 
      overflow: 'hidden' 
    }}>
      {/* LEFT COLUMN: Sidebar */}
      <Sidebar />

      {/* CENTER COLUMN: Top Performance Metrics & Bottom Positions component & Ticker */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* LIVE ACCOUNT SUMMARY BAR */}
        <div style={{ height: '46px', flexShrink: 0 }}>
          <LiveSummary />
        </div>

        {/* TOP PANEL: Portfolio Performance & Analytics Component */}
        <PortfolioMetrics />

        {/* RESIZER BAR */}
        <div
          className="resizer"
          style={{ 
            gridRow: 'auto',
            gridColumn: 'auto',
            marginTop: '-8px',
            marginBottom: '-8px',
            height: '10px', 
            cursor: 'ns-resize', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 10,
            flexShrink: 0,
            userSelect: 'none'
          }}
          onMouseDown={(e) => {
            isDragging.current = true;
            document.body.style.cursor = 'ns-resize';
          }}
        />

        {/* BOTTOM PANEL: Positions */}
        <div style={{ height: `${positionsHeight}px`, flexShrink: 0 }}>
          <Positions />
        </div>

        {/* TICKER PANEL (Below Positions) */}
        <div style={{ height: '40px', flexShrink: 0 }}>
          <Ticker />
        </div>
      </div>

      {/* RIGHT COLUMN: Market Metrics Widget */}
      <MarketMetrics />
    </div>
  );
}
