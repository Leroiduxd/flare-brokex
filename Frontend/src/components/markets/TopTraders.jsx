import React from 'react';

export default function TopTraders() {
  const goldAccent = '#BC8961';
  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';
  const themeBorder = 'var(--border-color, #222)';

  const leaders = [
    { rank: 1, handle: '0x71a...f2e9', pnl: '+$42,150.40', roi: '+245.2%' },
    { rank: 2, handle: '0x83b...d091', pnl: '+$28,940.12', roi: '+182.1%' },
    { rank: 3, handle: '0x19c...a281', pnl: '+$19,450.80', roi: '+154.5%' },
  ];

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Title */}
      <div style={{
        fontSize: '10px',
        color: themeTextMuted,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        borderBottom: `1px solid ${themeBorder}`,
        paddingBottom: '8px',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>[ TRADER LEADERBOARD ]</span>
        <span style={{ color: goldAccent, fontWeight: 'bold' }}>TOP PNL</span>
      </div>

      {/* Leader rows */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
        justifyContent: 'center',
        paddingTop: '6px'
      }}>
        {leaders.map((leader) => (
          <div key={leader.rank} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontFamily: 'Source Code Pro, monospace',
            minHeight: '30px' // Match RecentlyListed logo height spacing
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: leader.rank === 1 ? 'rgba(188, 137, 97, 0.15)' : 'rgba(255,255,255,0.03)',
                color: leader.rank === 1 ? goldAccent : themeTextMuted,
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 'bold',
                border: leader.rank === 1 ? `1px solid ${goldAccent}` : '1px solid rgba(255,255,255,0.02)'
              }}>{leader.rank}</span>
              <span style={{ color: themeText, fontWeight: 'bold' }}>{leader.handle}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ color: themeTextMuted, fontSize: '10px' }}>{leader.pnl}</span>
              <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{leader.roi}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
