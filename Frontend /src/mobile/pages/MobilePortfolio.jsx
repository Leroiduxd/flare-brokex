import React, { useState } from 'react';
import MobileLayout from '../components/MobileLayout';
import { MobilePositions, MobilePositionManager } from '../components/MobileTradeComponents';

export default function MobilePortfolio() {
  // Position Manager Modal State
  const [isPosManagerOpen, setIsPosManagerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [posManagerTab, setPosManagerTab] = useState('close');

  const handleManagePosition = (position, tab) => {
    setSelectedPosition(position);
    setPosManagerTab(tab);
    setIsPosManagerOpen(true);
  };

  return (
    <MobileLayout>
      {/* Premium Portfolio Overview Card */}
      <div style={{
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}>
        <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
          Account Summary
        </span>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
              $1,500.00
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Free Margin (USDC)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: '#3b82f6' }}>
              +$465.60
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Unrealized PnL (+46.56%)
            </span>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Mini stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Locked Capital:</span>
            <span style={{ fontWeight: '600', color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>$1,000.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Total Margin:</span>
            <span style={{ fontWeight: '600', color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>$2,500.00</span>
          </div>
        </div>
      </div>

      {/* Actual Positions, Orders, and History List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <MobilePositions 
          onManagePosition={handleManagePosition} 
          isFullPage={true} 
        />
      </div>

      {/* Dialog modal overlays for margin / close action */}
      <MobilePositionManager
        isOpen={isPosManagerOpen}
        onClose={() => setIsPosManagerOpen(false)}
        position={selectedPosition}
        initialTab={posManagerTab}
      />
    </MobileLayout>
  );
}
