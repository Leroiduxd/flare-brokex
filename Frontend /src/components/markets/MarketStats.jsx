import React from 'react';

export default function MarketStats() {
  const goldAccent = '#BC8961';
  
  const stats = [
    { label: 'TOTAL TRADING VOLUME', value: '$3,584,219,842', color: '#fff' },
    { label: 'OPEN INTEREST', value: '$284,152,904', color: goldAccent },
    { label: 'FEES GENERATED', value: '$4,215,849', color: '#3b82f6' }
  ];

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box'
    }}>
      {/* Title */}
      <div style={{
        fontSize: '10px',
        color: 'var(--text-grey)',
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px',
        textTransform: 'uppercase'
      }}>
        [ NETWORK OVERVIEW ]
      </div>

      {/* 3 Metric Rows */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
        justifyContent: 'center',
        paddingTop: '6px'
      }}>
        {stats.map((s, idx) => (
          <div key={idx} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontFamily: 'Source Code Pro, monospace',
            minHeight: '30px' // Match RecentlyListed logo height spacing
          }}>
            <span style={{ color: 'var(--text-grey)', fontSize: '10px', letterSpacing: '0.04em' }}>{s.label}</span>
            <span style={{ fontWeight: 'bold', color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
