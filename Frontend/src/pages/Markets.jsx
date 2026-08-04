import React from 'react';
import Sidebar from '../components/Sidebar';
import Ticker from '../components/Ticker';
import MarketStats from '../components/markets/MarketStats';
import RecentlyListed from '../components/markets/RecentlyListed';
import TopTraders from '../components/markets/TopTraders';
import MarketsPromo from '../components/markets/MarketsPromo';
import MarketsTable from '../components/markets/MarketsTable';

export default function Markets() {
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

      {/* CENTER COLUMN: Occupies 2/3 of the page width (flex: 2) */}
      <div style={{ 
        flex: 2, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        height: '100%',
        overflow: 'hidden'
      }}>
        
        {/* TOP ROW: 3 components taking equal width side-by-side */}
        <div style={{ 
          display: 'flex', 
          width: '100%', 
          gap: '8px',
          height: '180px',
          flexShrink: 0
        }}>
          {/* 1. Market Stats Component */}
          <div style={{ flex: 1, height: '100%' }}>
            <MarketStats />
          </div>

          {/* 2. Recently Listed Component */}
          <div style={{ flex: 1, height: '100%' }}>
            <RecentlyListed />
          </div>

          {/* 3. Top Traders Component */}
          <div style={{ flex: 1, height: '100%' }}>
            <TopTraders />
          </div>
        </div>

        {/* BOTTOM BLOCK: Merged Search, Filters, and Table */}
        <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
          <MarketsTable />
        </div>

        {/* TICKER PANEL (Below MarketsTable) */}
        <div style={{ height: '40px', flexShrink: 0 }}>
          <Ticker />
        </div>

      </div>

      {/* RIGHT COLUMN: MarketsPromo (takes 1/3 of the page width, e.g. 320px, and full height 100vh) */}
      <div style={{ 
        width: '320px', 
        height: '100%', 
        flexShrink: 0 
      }}>
        <MarketsPromo />
      </div>

    </div>
  );
}
