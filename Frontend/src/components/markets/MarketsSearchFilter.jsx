import React from 'react';

export default function MarketsSearchFilter() {
  const goldAccent = '#BC8961';
  const categories = ['All', 'Recently Listed', 'Launchable', 'Meme', 'AI & Big Data', 'DeFi', 'DePIN', 'Layer 1', 'Layer 2', 'RWA', 'Gaming', 'Forex'];
  
  return (
    <div className="panel" style={{ 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '12px',
      gap: '12px'
    }}>
      {/* Search Input Bar */}
      <div style={{ position: 'relative', width: '100%' }}>
        <input 
          type="text" 
          placeholder="Search markets..." 
          style={{
            width: '100%',
            height: '34px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0 12px 0 34px',
            fontSize: '11px',
            color: '#fff',
            fontFamily: 'Source Code Pro, monospace',
            outline: 'none'
          }}
          disabled
        />
        <svg 
          style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-grey)' }}
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>

      {/* Categories Horizontal scroll tab row */}
      <div className="no-scrollbar" style={{ 
        display: 'flex', 
        gap: '6px', 
        overflowX: 'auto', 
        width: '100%',
        paddingBottom: '2px'
      }}>
        {categories.map((cat, idx) => (
          <button 
            key={cat} 
            style={{
              flexShrink: 0,
              background: idx === 0 ? 'rgba(188,137,97,0.1)' : 'transparent',
              border: `1px solid ${idx === 0 ? goldAccent : 'transparent'}`,
              color: idx === 0 ? goldAccent : 'var(--text-grey)',
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '6px',
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
