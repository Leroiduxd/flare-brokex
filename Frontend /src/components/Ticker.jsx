import { useState, useMemo } from 'react'

const ASSETS = [
  { symbol: 'BTC/USD', name: 'Bitcoin' },
  { symbol: 'ETH/USD', name: 'Ethereum' },
  { symbol: 'SOL/USD', name: 'Solana' },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
  { symbol: 'GBP/USD', name: 'British Pound' },
  { symbol: 'XAU/USD', name: 'Gold' },
  { symbol: 'XAG/USD', name: 'Silver' },
  { symbol: 'WTI/USD', name: 'Oil' },
]

export default function Ticker() {
  const [viewMode, setViewMode] = useState('winners') // 'winners', 'losers', 'favorites'
  
  const toggleMode = () => {
    const modes = ['winners', 'losers', 'favorites']
    const nextIndex = (modes.indexOf(viewMode) + 1) % modes.length
    setViewMode(modes[nextIndex])
  }

  // Icons
  const UpArrow = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );

  const DownArrow = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );

  const StarIcon = ({ fill = "currentColor" }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={fill} xmlns="http://www.w3.org/2000/svg" style={{ stroke: 'currentColor', strokeWidth: '2', strokeLinejoin: 'round', strokeLinecap: 'round' }}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );

  // Generate random data for assets
  const assetData = useMemo(() => {
    return ASSETS.map(asset => {
      const variation = (Math.random() * 5).toFixed(2)
      const isUp = Math.random() > 0.5
      return {
        ...asset,
        winnersVal: `+${variation}%`,
        losersVal: `-${variation}%`,
        favVal: `${isUp ? '+' : '-'}${variation}%`,
        isUp
      }
    })
  }, [])

  const getTheme = () => {
    switch (viewMode) {
      case 'winners': return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'TOP WINNERS', icon: <UpArrow /> }
      case 'losers': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'TOP LOSERS', icon: <DownArrow /> }
      case 'favorites': return { color: 'var(--gold)', bg: 'rgba(200, 169, 126, 0.15)', label: 'FAVORITES', icon: <StarIcon fill="var(--gold)" /> }
      default: return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'TOP WINNERS', icon: <UpArrow /> }
    }
  }

  const theme = getTheme()

  return (
    <div className="ticker panel" style={{ 
      height: '40px', 
      background: 'var(--panel-bg)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '0 10px',
      overflow: 'hidden'
    }}>
      {/* Toggle Button - Fixe à gauche */}
      <button 
        onClick={toggleMode}
        style={{
          background: theme.bg,
          border: 'none',
          color: theme.color,
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '6px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginRight: '20px',
          flexShrink: 0,
          transition: 'all 0.2s'
        }}
      >
        <span style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>{theme.icon}</span>
        {theme.label}
      </button>

      {/* Liste Fixe des Actifs */}
      <div 
        className="ticker-scroll"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '20px',
          overflowX: 'auto',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none' // IE/Edge
        }}
      >
        <style>{`
          .ticker-scroll::-webkit-scrollbar {
            display: none; // Chrome/Safari
          }
        `}</style>
        {assetData.map((asset, index) => {
          let displayColor = theme.color;
          if (viewMode === 'favorites') {
            displayColor = asset.isUp ? '#3b82f6' : '#ef4444';
          }

          return (
            <div key={`${asset.symbol}-${index}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-grey)', fontSize: '10px', fontWeight: '600' }}>{asset.symbol}</span>
              <span style={{ 
                color: displayColor, 
                fontSize: '10px', 
                fontWeight: 'bold',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {viewMode === 'winners' && <><UpArrow /> {asset.winnersVal}</>}
                {viewMode === 'losers' && <><DownArrow /> {asset.losersVal}</>}
                {viewMode === 'favorites' && (
                  <>
                    {asset.isUp ? <UpArrow /> : <DownArrow />}
                    {asset.favVal}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  )
}
