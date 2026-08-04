import React from 'react';
import MobileLayout from '../components/MobileLayout';

export default function MobileVault() {
  return (
    <MobileLayout title="Vault">
      <div className="mobile-placeholder-card">
        <div className="mobile-glow-accent">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="12" cy="12" r="3" /><path d="m14 10 2-2" /><path d="m10 14-2 2" /><path d="m14 14 2 2" /><path d="m10 10-2-2" />
          </svg>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-dark)' }}>
          Mobile Vaults
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-grey)', lineHeight: '1.6', maxWidth: '280px' }}>
          Provide liquidity to Brokex pools, check your pool share, track APY metrics, and complete deposits/withdrawals directly through integrated mobile wallets.
        </p>
        <div style={{
          width: '100%',
          height: '1px',
          backgroundColor: 'var(--border-color)',
          margin: '8px 0'
        }} />
        <span style={{
          fontSize: '10px',
          fontFamily: "'Source Code Pro', monospace",
          color: 'var(--gold)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Terminal Status: Ready to Build
        </span>
      </div>
    </MobileLayout>
  );
}
