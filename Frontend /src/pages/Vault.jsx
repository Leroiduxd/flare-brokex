import React from 'react';
import Sidebar from '../components/Sidebar';
import Ticker from '../components/Ticker';
import VaultHeader from '../components/vault/VaultHeader';
import VaultOverview from '../components/vault/VaultOverview';
import VaultHistory from '../components/vault/VaultHistory';
import VaultDetails from '../components/vault/VaultDetails';

export default function Vault() {
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

      {/* CENTER COLUMN: Flex column containing Header, Overview, History, Ticker */}
      <div style={{ 
        flex: 2, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* TOP ROW: Header Bar (height: 50px) */}
        <div style={{ height: '50px', flexShrink: 0 }}>
          <VaultHeader />
        </div>

        {/* MIDDLE ROW: Main overview pool list (flex: 1) */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <VaultOverview />
        </div>

        {/* BOTTOM ROW: Deposit history (height: 280px) */}
        <div style={{ height: '280px', flexShrink: 0 }}>
          <VaultHistory />
        </div>

        {/* BOTTOM-MOST ROW: Status Ticker (height: 40px) */}
        <div style={{ height: '40px', flexShrink: 0 }}>
          <Ticker />
        </div>
      </div>

      {/* RIGHT COLUMN: Deposit panel (width: 320px, full height) */}
      <div style={{ 
        width: '320px', 
        height: '100%', 
        flexShrink: 0 
      }}>
        <VaultDetails />
      </div>
    </div>
  );
}
