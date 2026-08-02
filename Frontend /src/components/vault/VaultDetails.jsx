import React, { useState } from 'react';

export default function VaultDetails() {
  const [side, setSide] = useState('deposit'); // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState('100');
  const [isClaimed, setIsClaimed] = useState(false);
  const [usdcWallet, setUsdcWallet] = useState(1500.00);

  const goldAccent = '#BC8961';
  const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
  const themeBg = 'var(--panel-bg, #0d0d0d)';
  const themeControlBg = 'rgba(255, 255, 255, 0.02)';
  const themeBorder = 'var(--border-color, #222)';
  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';

  const buyColor = '#3b82f6'; // Blue
  const sellColor = '#ef4444'; // Red
  const buyColorBg = 'rgba(59, 130, 246, 0.1)';
  const sellColorBg = 'rgba(239, 68, 68, 0.1)';

  // Mock data for vault details
  const lpTokenPrice = 1.2450;
  const blpBalance = 8032.12;
  const feeRate = 0.0015; // 0.15%

  const activeBalance = side === 'deposit' ? usdcWallet : blpBalance;
  const currencyLabel = side === 'deposit' ? 'USDC' : 'BLP';

  const amountNum = parseFloat(amount || 0);
  const feeUSD = amountNum * feeRate;

  // Calcul estimations
  const estLPMinted = side === 'deposit' ? (amountNum / lpTokenPrice) : 0;
  const estUSDCReceived = side === 'withdraw' ? (amountNum * lpTokenPrice) : 0;

  // Percentage helper click
  const handlePercentClick = (pct) => {
    const calculated = activeBalance * pct;
    setAmount(calculated.toFixed(2));
  };

  // Claim click handler
  const handleClaim = () => {
    setIsClaimed(true);
    // Add funds to wallet balance as an interactive easter egg
    setUsdcWallet(prev => prev + 6225.00);
  };

  return (
    <div className="order panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      padding: '8px',
      boxSizing: 'border-box',
      gap: '12px',
      backgroundColor: themeBg,
      color: themeText,
      fontSize: '12px'
    }}>
      <style>{`
        .order.panel::-webkit-scrollbar {
          display: none;
        }
        .order.panel {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Top Header Label */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${themeBorder}`,
        paddingBottom: '6px',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', fontWeight: 'bold', color: goldAccent }}>
          [ LP LIQUIDITY PANEL ]
        </span>
        <span style={{ fontSize: '8px', fontFamily: 'Source Code Pro', color: themeTextMuted }}>
          BLP VAULT
        </span>
      </div>

      {/* Top Tabs (Deposit / Withdraw) */}
      <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
        <div
          onClick={() => {
            setSide('deposit');
            setAmount('100');
          }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1, 
            padding: '6px 8px', 
            cursor: 'pointer', 
            borderRadius: '4px', 
            backgroundColor: side === 'deposit' ? buyColorBg : 'transparent', 
            border: `1px solid ${side === 'deposit' ? buyColor : 'transparent'}`, 
            transition: 'all 0.15s' 
          }}>
          <div style={{ color: side === 'deposit' ? buyColor : themeTextMuted, fontWeight: side === 'deposit' ? 600 : 400, fontSize: '11px', textTransform: 'uppercase' }}>Deposit</div>
          <div style={{ color: side === 'deposit' ? buyColor : themeTextMuted, fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>USDC → BLP</div>
        </div>
        <div
          onClick={() => {
            setSide('withdraw');
            setAmount('100');
          }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1, 
            padding: '6px 8px', 
            cursor: 'pointer', 
            borderRadius: '4px', 
            backgroundColor: side === 'withdraw' ? sellColorBg : 'transparent', 
            border: `1px solid ${side === 'withdraw' ? sellColor : 'transparent'}`, 
            transition: 'all 0.15s' 
          }}>
          <div style={{ color: side === 'withdraw' ? sellColor : themeTextMuted, fontWeight: side === 'withdraw' ? 600 : 400, fontSize: '11px', textTransform: 'uppercase' }}>Withdraw</div>
          <div style={{ color: side === 'withdraw' ? sellColor : themeTextMuted, fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>BLP → USDC</div>
        </div>
      </div>

      {/* Available to Mint/Burn */}
      <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '0 2px' }}>
        <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Available Wallet</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            {activeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencyLabel}
          </span>
        </div>
      </div>

      {/* Input Box for amount to Swap */}
      <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${themeBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted }}>Amount to {side === 'deposit' ? 'Deposit' : 'Withdraw'}</span>
            <span style={{ fontSize: '10px', color: goldAccent, cursor: 'pointer', fontFamily: 'Source Code Pro' }} onClick={() => handlePercentClick(1)}>MAX</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              className="no-spinners"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', padding: 0, width: '150px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 600, fontSize: '12px', fontFamily: 'Source Code Pro' }}>
              {currencyLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Percentage Helpers Row (25%, 50%, 75%, 100%) */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {[0.25, 0.50, 0.75, 1.0].map((pct, idx) => (
          <button
            key={idx}
            onClick={() => handlePercentClick(pct)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '10px',
              border: `1px solid ${themeBorder}`,
              borderRadius: '4px',
              backgroundColor: themeControlBg,
              color: themeTextMuted,
              fontFamily: 'Source Code Pro, monospace',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = goldAccent;
              e.currentTarget.style.color = goldAccent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = themeBorder;
              e.currentTarget.style.color = themeTextMuted;
            }}
          >
            {pct * 100}%
          </button>
        ))}
      </div>

      {/* Action Submit Button */}
      <div style={{ flexShrink: 0, display: 'flex', marginTop: '4px' }}>
        <button
          style={{
            flex: 1,
            backgroundColor: side === 'deposit' ? buyColor : sellColor,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'Source Code Pro, monospace',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${side === 'deposit' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          {side === 'deposit' ? `DEPOSIT USDC (BUY BLP)` : `WITHDRAW BLP (SELL BLP)`}
        </button>
      </div>

      {/* Metrics List */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', padding: '0 2px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Price per BLP</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            ${lpTokenPrice.toFixed(4)}
          </span>
        </div>

        {side === 'deposit' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Est. BLP Received</span>
            <span style={{ color: buyColor, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              {estLPMinted.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} BLP
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Est. USDC Received</span>
            <span style={{ color: buyColor, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              {estUSDCReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Lockup Duration</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>15 Minutes</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Slippage Tolerance</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>0.30%</span>
        </div>

        <div style={{ height: '1px', backgroundColor: themeBorder, margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted }}>Transaction Fee (0.15%)</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
            ${feeUSD.toFixed(2)} USDC
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${themeBorder}` }}>
          <span style={{ color: themeText, fontWeight: 'bold' }}>Total Cost / Debit</span>
          <span style={{ color: goldAccent, fontWeight: 'bold', fontSize: '12px', fontFamily: 'Source Code Pro, monospace' }}>
            {side === 'deposit'
              ? `$${(amountNum + feeUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
              : `${(amountNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BLP`
            }
          </span>
        </div>

      </div>

      {/* Divider Separator */}
      <div style={{ height: '1px', backgroundColor: themeBorder, margin: '6px 0', flexShrink: 0 }} />

      {/* PENDING WITHDRAWALS SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
        
        {/* Section Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '4px'
        }}>
          <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', fontWeight: 'bold', color: goldAccent }}>
            [ PENDING WITHDRAWALS ]
          </span>
          <span style={{ fontSize: '8px', fontFamily: 'Source Code Pro', color: buyColor, fontWeight: 'bold' }}>
            {isClaimed ? '0 PENDING' : '1 PENDING'}
          </span>
        </div>

        {/* Free / Muted Liquidity Stats */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '11px',
          fontFamily: 'Source Code Pro, monospace'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted }}>Free Liquidity:</span>
            <span style={{ color: buyColor, fontWeight: 'bold' }}>$9,790,665 USDC</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted }}>Used Liquidity:</span>
            <span style={{ color: themeText, fontWeight: 'bold' }}>$35,420,180 USDC</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.02)' }}>
            <span style={{ color: themeTextMuted }}>Claimable Share:</span>
            <span style={{ color: goldAccent, fontWeight: 'bold' }}>0.285% (~$6,225 USDC)</span>
          </div>
        </div>

        {/* Pending Request Details Item */}
        {!isClaimed ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'rgba(59, 130, 246, 0.03)',
            border: `1px solid ${buyColor}`,
            borderRadius: '6px',
            padding: '10px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Source Code Pro', fontSize: '9px', color: themeTextMuted }}>
                WITHDRAW ID: <span style={{ color: themeText, fontWeight: 'bold' }}>#W-8942-XF</span>
              </span>
              <span style={{ 
                fontFamily: 'Source Code Pro', 
                fontSize: '8px', 
                color: '#fff', 
                backgroundColor: buyColor, 
                padding: '2px 6px', 
                borderRadius: '3px',
                fontWeight: 'bold',
                letterSpacing: '0.04em'
              }}>
                READY
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'Source Code Pro' }}>
              <span style={{ fontSize: '10px', color: themeTextMuted }}>Amount Requested:</span>
              <span style={{ fontSize: '11px', color: themeText, fontWeight: 'bold' }}>
                5,000.00 BLP <span style={{ fontSize: '9px', color: themeTextMuted }}>(~$6,225.00)</span>
              </span>
            </div>

            {/* Claim button */}
            <button
              onClick={handleClaim}
              style={{
                width: '100%',
                backgroundColor: buyColor,
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                fontSize: '10px',
                fontFamily: 'Source Code Pro, monospace',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'opacity 0.1s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              CLAIM FUNDS
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 10px',
            border: `1px dashed ${themeBorder}`,
            borderRadius: '6px',
            color: buyColor,
            fontFamily: 'Source Code Pro',
            fontSize: '11px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            ✓ NO PENDING WITHDRAWALS / FUNDS CLAIMED
          </div>
        )}

      </div>

    </div>
  );
}
