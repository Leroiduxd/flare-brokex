import React, { useState } from 'react';

const goldAccent = '#BC8961';
const sellColor = '#ef4444'; // red

export default function MobilePositions({ onManagePosition, isFullPage = false }) {
  const [activeTab, setActiveTab] = useState('open');

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

  const currentList = activeTab === 'open' ? positions : activeTab === 'orders' ? orders : history;

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderTop: isFullPage ? 'none' : '1px solid var(--border-color)',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      borderRadius: '0px',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: isFullPage ? '100%' : 'auto',
      flex: isFullPage ? 1 : 'none',
      overflow: 'hidden'
    }}>
      {/* Tabs Header */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 12px 0px 12px',
        justifyContent: 'flex-start',
        gap: '16px',
        background: 'rgba(255,255,255,0.01)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {['open', 'orders', 'history'].map(tab => {
          const count = tab === 'open' ? positions.length : tab === 'orders' ? orders.length : history.length;
          const isActive = activeTab === tab;
          const labelText = tab === 'open' ? `Open (${count})` : tab === 'orders' ? `Orders (${count})` : `History (${count})`;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? goldAccent : 'transparent'}`,
                color: isActive ? 'var(--text-dark)' : 'var(--text-grey)',
                fontSize: '11px',
                fontWeight: '600',
                padding: '6px 0px 8px 0px',
                borderRadius: '0px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s'
              }}
            >
              {labelText}
            </button>
          );
        })}
      </div>

      {/* Cards List container */}
      <div style={{
        padding: '0 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        flexShrink: 0,
        maxHeight: 'none',
        overflow: 'visible'
      }}>
        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-grey)', fontSize: '11px' }}>
            NO ACTIVE ITEMS
          </div>
        ) : (
          currentList.map((item, idx) => (
            <div 
              key={idx}
              style={{
                background: 'transparent',
                borderBottom: idx !== currentList.length - 1 ? '1px solid var(--border-color)' : 'none',
                padding: '12px 0px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Card Title Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.asset}</span>
                  <span style={{
                    fontSize: '8px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    background: item.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: item.side === 'Long' ? '#3b82f6' : '#ef4444'
                  }}>
                    {item.side.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', color: '#BC8961', fontWeight: 'bold' }}>
                    {item.leverage}
                  </span>
                </div>
                
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', color: 'var(--text-grey)' }}>
                  {item.id}
                </span>
              </div>

              {/* Grid Values */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 12px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Size:</span>
                  <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.size}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Collateral:</span>
                  <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.collateral}</span>
                </div>
                
                {activeTab === 'open' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Market Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.marketPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Liq. Price:</span>
                      <span style={{ color: '#ef4444', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.liqPrice}</span>
                    </div>
                  </>
                )}

                {activeTab === 'orders' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Trigger Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.orderPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Status:</span>
                      <span style={{ color: goldAccent, fontWeight: 'bold' }}>{item.status}</span>
                    </div>
                  </>
                )}

                {activeTab === 'history' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Close Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.closePrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Closed:</span>
                      <span style={{ color: 'var(--text-grey)', fontWeight: 'bold' }}>Settled</span>
                    </div>
                  </>
                )}
              </div>

              {/* SL / TP row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px dashed var(--border-color)',
                borderRadius: '6px',
                fontSize: '10px'
              }}>
                <div>
                  <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>TP:</span>
                  <span style={{ color: '#3b82f6', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.tp}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>SL:</span>
                  <span style={{ color: '#ef4444', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.sl}</span>
                </div>
              </div>

              {/* PnL and Actions block */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255,255,255,0.03)'
              }}>
                <div>
                  {(activeTab === 'open' || activeTab === 'history') && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>Unrealized PnL</span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        fontFamily: 'Source Code Pro',
                        color: item.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444'
                      }}>
                        {item.pnlUsd} <span style={{ fontSize: '10px', fontWeight: '500' }}>({item.pnlPct})</span>
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {activeTab === 'open' && (
                    <>
                      <button
                        onClick={() => onManagePosition(item, 'collateral')}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-dark)',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '4px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        + MARGIN
                      </button>
                      <button
                        onClick={() => onManagePosition(item, 'close')}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${sellColor}`,
                          color: sellColor,
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '4px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        CLOSE
                      </button>
                    </>
                  )}
                  {activeTab === 'orders' && (
                    <button
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-dark)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
