import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

export default function PositionManager({ position, isOpen, onClose }) {
  const [position_win, setPositionWin] = useState({ x: window.innerWidth / 2 - 370, y: window.innerHeight / 2 - 260 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [activeTab, setActiveTab] = useState('close'); // 'close', 'collateral', 'tpsl'
  const [closeAmount, setCloseAmount] = useState(100);
  const [tpValue, setTpValue] = useState(position?.tp || '');
  const [slValue, setSlValue] = useState(position?.sl || '');
  const [marginAction, setMarginAction] = useState('add');
  const [marginAmount, setMarginAmount] = useState('');

  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPositionWin({ x: window.innerWidth / 2 - 370, y: window.innerHeight / 2 - 260 });
      setTpValue(position?.tp?.replace('$', '') || '');
      setSlValue(position?.sl?.replace('$', '') || '');
    }
  }, [isOpen, position]);

  const handleMouseDown = (e) => {
    if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('a') && !e.target.closest('input[type="range"]')) {
      setIsDragging(true);
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));

      setPositionWin({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  if (!isOpen || !position) return null;

  const content = (
    <div
      ref={containerRef}
      className="panel-no-border no-spinners"
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: position_win.x,
        top: position_win.y,
        width: '760px',
        backgroundColor: 'var(--bg-dark)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
        zIndex: 9999999,
        backdropFilter: 'blur(10px)',
        cursor: isDragging ? 'grabbing' : 'auto'
      }}
    >
      <style>{`
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners { -moz-appearance: textfield; }
        
        .manager-tab {
          flex: 1;
          text-align: center;
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          transition: all 0.2s;
          color: var(--text-grey);
          border: 1px solid transparent;
        }
        .manager-tab.active {
          background: ${goldAccentLight};
          color: ${goldAccent};
          border: 1px solid ${goldAccent};
        }
        .info-label {
          color: var(--text-grey);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .info-value {
          color: var(--text-dark);
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          font-weight: 600;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .section-title {
          font-size: 9px;
          color: ${goldAccent};
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 10px;
          margin-bottom: 5px;
          opacity: 0.7;
        }
        .close-btn-pos {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          color: var(--text-grey);
          cursor: pointer;
          font-size: 20px;
          z-index: 10;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .close-btn-pos:hover {
          color: var(--text-dark);
        }
      `}</style>

      {/* Absolute Close Button */}
      <button onClick={onClose} className="close-btn-pos">&times;</button>

      {/* LEFT COLUMN: Trade Info */}
      <div style={{ flex: '1', background: 'rgba(255,255,255,0.01)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '15px', borderRight: '1px solid var(--border-color)', maxHeight: '550px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: goldAccent, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
            {position.asset.split('/')[0]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-dark)' }}>{position.asset}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: position.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: position.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{position.side.toUpperCase()}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 'bold' }}>{position.leverage}</span>
            </div>
          </div>
        </div>

        {/* PnL Block */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span className="info-label">Unrealized PnL</span>
            <span style={{ color: position.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444', fontWeight: 'bold', fontFamily: 'Source Code Pro', fontSize: '18px' }}>{position.pnlUsd}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: position.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444', opacity: 0.8 }}>{position.pnlPct}</div>
        </div>

        {/* DETAILS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">Trade Identification</div>
          <div className="detail-row">
            <span className="info-label">Trade ID</span>
            <span className="info-value" style={{ color: goldAccent }}>{position.id}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Wallet</span>
            <span className="info-value">0x71...f2e9</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Open Time</span>
            <span className="info-value">2024-05-16 14:22:10</span>
          </div>

          <div className="section-title">Position Metrics</div>
          <div className="detail-row">
            <span className="info-label">Size (USD)</span>
            <span className="info-value">{position.size}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Collateral</span>
            <span className="info-value">{position.collateral}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Net Value</span>
            <span className="info-value" style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>$625.40</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Margin Ratio</span>
            <span className="info-value" style={{ color: goldAccent }}>2.04%</span>
          </div>

          <div className="section-title">Risk Management</div>
          <div className="detail-row">
            <span className="info-label">Liq. Price</span>
            <span className="info-value" style={{ color: '#ef4444' }}>{position.liqPrice}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Distance to Liq.</span>
            <span className="info-value" style={{ color: '#ef4444' }}>1.28%</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Max Drawdown</span>
            <span className="info-value">-$42.10</span>
          </div>

          <div className="section-title">Costs & Fees</div>
          <div className="detail-row">
            <span className="info-label">Funding Fee</span>
            <span className="info-value" style={{ color: '#ef4444' }}>-$1.42</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Borrow Rate</span>
            <span className="info-value">0.0024% / hr</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Realized PnL</span>
            <span className="info-value">$0.00</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Actions */}
      <div style={{ flex: '1.1', background: 'var(--bg-dark)', padding: '44px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div className={`manager-tab ${activeTab === 'close' ? 'active' : ''}`} onClick={() => setActiveTab('close')}>Close</div>
          <div className={`manager-tab ${activeTab === 'collateral' ? 'active' : ''}`} onClick={() => setActiveTab('collateral')}>Margin</div>
          <div className={`manager-tab ${activeTab === 'tpsl' ? 'active' : ''}`} onClick={() => setActiveTab('tpsl')}>TP/SL</div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, minHeight: '220px' }}>
          {activeTab === 'close' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>CLOSE PERCENTAGE</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: goldAccent, fontFamily: 'Source Code Pro' }}>{closeAmount}%</span>
              </div>
              <input
                type="range" min="1" max="100" value={closeAmount} onChange={e => setCloseAmount(e.target.value)}
                style={{ width: '100%', accentColor: goldAccent, height: '4px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p} onClick={() => setCloseAmount(p)}
                    style={{ flex: 1, padding: '6px', fontSize: '10px', background: closeAmount == p ? goldAccentLight : 'rgba(255,255,255,0.03)', border: `1px solid ${closeAmount == p ? goldAccent : 'var(--border-color)'}`, borderRadius: '4px', color: closeAmount == p ? goldAccent : 'var(--text-grey)', cursor: 'pointer' }}
                  >{p}%</button>
                ))}
              </div>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Closing Size</span>
                  <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>${(closeAmount / 100 * parseFloat(position.size.replace('$', '').replace(',', ''))).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Estimated Return</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>${(closeAmount / 100 * (parseFloat(position.collateral.replace('$', '')) + parseFloat(position.pnlUsd.replace('$', '').replace('+', '')))).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collateral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '6px' }}>
                <button onClick={() => setMarginAction('add')} style={{ flex: 1, padding: '6px', fontSize: '10px', background: marginAction === 'add' ? goldAccentLight : 'transparent', border: `1px solid ${marginAction === 'add' ? goldAccent : 'transparent'}`, borderRadius: '4px', color: marginAction === 'add' ? goldAccent : 'var(--text-grey)', cursor: 'pointer' }}>ADD</button>
                <button onClick={() => setMarginAction('remove')} style={{ flex: 1, padding: '6px', fontSize: '10px', background: marginAction === 'remove' ? goldAccentLight : 'transparent', border: `1px solid ${marginAction === 'remove' ? goldAccent : 'transparent'}`, borderRadius: '4px', color: marginAction === 'remove' ? goldAccent : 'var(--text-grey)', cursor: 'pointer' }}>REMOVE</button>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Amount</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-grey)' }}>Bal: 1,500 USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number" value={marginAmount} onChange={e => setMarginAmount(e.target.value)} placeholder="0.00"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-dark)', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Source Code Pro', width: '70%' }}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-dark)' }}>USDC</span>
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>New Leverage</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold' }}>{marginAction === 'add' ? '42x' : '58x'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>New Liq. Price</span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{marginAction === 'add' ? '$2,105.20' : '$2,350.40'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tpsl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Take Profit</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <div key={p} style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-grey)', cursor: 'pointer', border: '1px solid var(--border-color)' }}>{p}</div>
                    ))}
                  </div>
                </div>
                <input
                  type="number" value={tpValue} onChange={e => setTpValue(e.target.value)} placeholder="Target Price"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Stop Loss</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <div key={p} style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-grey)', cursor: 'pointer', border: '1px solid var(--border-color)' }}>{p}</div>
                    ))}
                  </div>
                </div>
                <input
                  type="number" value={slValue} onChange={e => setSlValue(e.target.value)} placeholder="Stop Price"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          style={{ width: '100%', padding: '14px', background: goldAccent, border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'opacity 0.2s', marginTop: 'auto' }}
        >
          {activeTab === 'close' ? `Close ${closeAmount}% Position` : activeTab === 'collateral' ? `${marginAction === 'add' ? 'Add' : 'Remove'} Margin` : 'Update TP/SL'}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
