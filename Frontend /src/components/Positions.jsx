import { useState } from 'react'
import PositionManager from './PositionManager'

export default function Positions() {
  const [activeTab, setActiveTab] = useState('open')
  const [filter, setFilter] = useState('all')
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [isManagerOpen, setIsManagerOpen] = useState(false)

  const openManager = (pos) => {
    setSelectedPosition(pos);
    setIsManagerOpen(true);
  };

  const positions = [
    { id: '#8492', asset: 'XAU/USD', side: 'Long', size: '$25,000', leverage: '50x', collateral: '$500', liqPrice: '$2,285.50', sl: '$2,300.00', tp: '$2,350.00', marketPrice: '$2,315.10', pnlUsd: '+$125.40', pnlPct: '+25.08%' },
    { id: '#8493', asset: 'BTC/USDC', side: 'Short', size: '$12,500', leverage: '25x', collateral: '$500', liqPrice: '$84,200', sl: '$82,000', tp: '$75,000', marketPrice: '$79,048', pnlUsd: '+$340.20', pnlPct: '+68.04%' },
  ];

  const orders = [
    { id: '#7102', asset: 'SOL/USDC', side: 'Long', size: '$5,000', leverage: '10x', collateral: '$500', liqPrice: '$124.50', sl: '$130.00', tp: '$180.00', orderPrice: '$145.00', status: 'Pending' },
    { id: '#7105', asset: 'ETH/USDC', side: 'Short', size: '$8,000', leverage: '20x', collateral: '$400', liqPrice: '$3,850', sl: '$3,600', tp: '$2,800', orderPrice: '$3,420', status: 'Pending' },
  ];

  const history = [
    { id: '#4421', asset: 'BTC/USDC', side: 'Long', size: '$10,000', leverage: '20x', collateral: '$500', liqPrice: '—', sl: '—', tp: '—', closePrice: '$68,400', pnlUsd: '+$840.00', pnlPct: '+168.00%' },
    { id: '#4398', asset: 'XAU/USD', side: 'Short', size: '$50,000', leverage: '100x', collateral: '$500', liqPrice: '—', sl: '—', tp: '—', closePrice: '$2,340.50', pnlUsd: '-$120.50', pnlPct: '-24.10%' },
  ];

  return (
    <div className="positions panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 10px', 
        height: '40px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {['open', 'orders', 'history'].map(tab => {
            const count = tab === 'open' ? positions.length : tab === 'orders' ? orders.length : history.length;
            const labelText = tab === 'open' ? `open positions [${count}]` : tab === 'orders' ? `orders [${count}]` : `history [${count}]`;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ 
                  background: 'transparent', 
                  border: activeTab === tab ? '1px solid #BC8961' : '1px solid transparent', 
                  color: activeTab === tab ? '#BC8961' : 'var(--text-grey)', 
                  fontSize: '10px', 
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >{labelText}</button>
            );
          })}
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px' }}>
            {['all', 'xau'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                style={{ 
                  background: 'transparent', 
                border: filter === f ? '1px solid #BC8961' : '1px solid transparent', 
                color: filter === f ? '#BC8961' : 'var(--text-grey)', 
                  fontSize: '9px', 
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Table Header */}
          <div style={{ 
            display: 'flex', 
            width: '100%',
            padding: '6px 15px',
            fontSize: '10px',
            color: 'var(--text-grey)',
            borderBottom: '1px solid var(--border-color)',
            textTransform: 'uppercase',
            fontWeight: '600',
            alignItems: 'center'
          }}>
            <div style={{ width: '60px' }}>ID</div>
            <div style={{ width: '140px' }}>Asset</div>
            <div style={{ flex: 1 }}>Size</div>
            <div style={{ flex: 1 }}>Lev.</div>
            <div style={{ flex: 1 }}>Coll.</div>
            <div style={{ flex: 1 }}>{activeTab === 'history' ? 'Status' : 'Liq. Price'}</div>
            <div style={{ flex: 1 }}>SL</div>
            <div style={{ flex: 1 }}>TP</div>
            <div style={{ flex: 1 }}>{activeTab === 'orders' ? 'Order' : activeTab === 'history' ? 'Close' : 'Market'}</div>
            <div style={{ flex: 1.5, textAlign: 'right' }}>{activeTab === 'orders' ? 'Status' : 'PnL (USD/%)'}</div>
            {activeTab !== 'history' && <div style={{ width: '80px', textAlign: 'right' }}>Action</div>}
          </div>

          {/* Table Content */}
          {activeTab === 'open' && positions.map((pos, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '11px',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              height: '32px'
            }} className="position-row">
              <div style={{ width: '60px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{pos.id}</div>
              <div style={{ width: '140px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ minWidth: '65px' }}>{pos.asset}</span>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: pos.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: pos.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{pos.side.toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{pos.size}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{pos.leverage}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {pos.collateral}
                <button 
                  onClick={() => openManager(pos)}
                  style={{ background: 'transparent', border: 'none', color: '#BC8961', cursor: 'pointer', padding: '2px', display: 'flex' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#ef4444' }}>{pos.liqPrice}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {pos.sl}
                <button 
                  onClick={() => openManager(pos)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {pos.tp}
                <button 
                  onClick={() => openManager(pos)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{pos.marketPrice}</div>
              <div style={{ flex: 1.5, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: 'bold', color: pos.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444' }}>
                {pos.pnlUsd} <span style={{ fontSize: '9px', opacity: 0.8 }}>({pos.pnlPct})</span>
              </div>
              <div style={{ width: '80px', textAlign: 'right' }}>
                <button 
                  onClick={() => openManager(pos)}
                  style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontWeight: '600' }}
                >CLOSE</button>
              </div>
            </div>
          ))}

          {activeTab === 'orders' && orders.map((order, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '11px',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              height: '32px'
            }} className="position-row">
              <div style={{ width: '60px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.id}</div>
              <div style={{ width: '140px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ minWidth: '65px' }}>{order.asset}</span>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: order.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: order.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{order.side.toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{order.size}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{order.leverage}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{order.collateral}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.liqPrice}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.sl}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.tp}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{order.orderPrice}</div>
              <div style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: '#BC8961' }}>{order.status}</div>
              <div style={{ width: '80px', textAlign: 'right' }}>
                <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-dark)', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontWeight: '600' }}>CANCEL</button>
              </div>
            </div>
          ))}

          {activeTab === 'history' && history.map((hist, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              width: '100%',
              padding: '6px 15px',
              fontSize: '11px',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              height: '32px'
            }} className="position-row">
              <div style={{ width: '60px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{hist.id}</div>
              <div style={{ width: '140px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ minWidth: '65px' }}>{hist.asset}</span>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: hist.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: hist.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{hist.side.toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{hist.size}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{hist.leverage}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{hist.collateral}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>CLOSED</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{hist.sl}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{hist.tp}</div>
              <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{hist.closePrice}</div>
              <div style={{ flex: 1.5, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: 'bold', color: hist.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444' }}>
                {hist.pnlUsd} <span style={{ fontSize: '9px', opacity: 0.8 }}>({hist.pnlPct})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .position-row:hover {
          background: rgba(255,255,255,0.03);
        }
      `}</style>

      <PositionManager 
        isOpen={isManagerOpen} 
        onClose={() => setIsManagerOpen(false)} 
        position={selectedPosition} 
      />
    </div>
  )
}
