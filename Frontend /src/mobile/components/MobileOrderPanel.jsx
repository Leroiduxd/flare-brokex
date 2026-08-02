import React, { useState, useEffect } from 'react';

// Common Accent Colors (Theme-aware via CSS variables)
const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
const buyColor = '#3b82f6'; // blue
const sellColor = '#ef4444'; // red
const buyColorBg = 'rgba(59, 130, 246, 0.1)';
const sellColorBg = 'rgba(239, 68, 68, 0.1)';

export default function MobileOrderPanel({ isOpen, onClose, initialSide = 'buy', isInline = false }) {
  const [side, setSide] = useState(initialSide);
  const [orderType, setOrderType] = useState('market');
  const [leverage, setLeverage] = useState(10);
  const [collateralAmount, setCollateralAmount] = useState('100');
  const [targetPrice, setTargetPrice] = useState('');
  const [sizeCurrency, setSizeCurrency] = useState('USD');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');

  // Sync side with initialSide prop when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSide(initialSide);
    }
  }, [isOpen, initialSide]);

  if (!isOpen) return null;

  const askPrice = '2,315.10';
  const bidPrice = '2,314.90';
  const usdcBalance = '1,500.00';
  const selectedAsset = 'XAU';

  const minLeverageNum = 1;
  const maxLeverageNum = 100;
  const leverageStops = [2, 10, 25, 50, 100];

  const percentage = ((leverage - minLeverageNum) / (maxLeverageNum - minLeverageNum)) * 100;
  const sliderBackground = `linear-gradient(to right, ${goldAccent} ${percentage}%, var(--border-color) ${percentage}%)`;

  const collatNum = Number(collateralAmount || 0);
  const estimatedSizeUSDNum = collatNum * leverage;
  const displaySize = sizeCurrency === 'USD'
    ? estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (estimatedSizeUSDNum / 2315).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const selectedSideColor = side === 'buy' ? buyColor : sellColor;
  const selectedSideBg = side === 'buy' ? buyColorBg : sellColorBg;

  const innerSheet = (
    <div style={{
      background: isInline ? 'transparent' : 'var(--bg-dark)',
      borderTop: isInline ? 'none' : '1px solid var(--border-color)',
      borderTopLeftRadius: isInline ? '0px' : '20px',
      borderTopRightRadius: isInline ? '0px' : '20px',
      padding: isInline ? '12px 8px' : '16px 12px',
      maxHeight: isInline ? '100%' : '85vh',
      height: isInline ? '100%' : 'auto',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: isInline ? 'none' : '0 -8px 30px rgba(0, 0, 0, 0.5)',
      width: '100%'
    }}>
      {/* Drag Handle indicator */}
      {!isInline && (
        <div style={{
          width: '40px',
          height: '4px',
          background: 'var(--border-color)',
          borderRadius: '2px',
          alignSelf: 'center',
          marginBottom: '4px'
        }} />
      )}

      {/* Drawer Header */}
      {!isInline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-dark)', textTransform: 'uppercase' }}>
            Configure Order
          </h3>

          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-grey)',
              fontSize: '22px',
              lineHeight: '1',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            &times;
          </button>
        </div>
      )}

        {/* Long/Short Tabs */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          padding: '3px', 
          border: '1px solid var(--border-color)' 
        }}>
          <div
            onClick={() => setSide('buy')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              padding: '6px 8px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              alignItems: 'center',
              backgroundColor: side === 'buy' ? buyColorBg : 'transparent', 
              border: `1px solid ${side === 'buy' ? buyColor : 'transparent'}`, 
              transition: 'all 0.15s' 
            }}
          >
            <div style={{ color: side === 'buy' ? buyColor : 'var(--text-grey)', fontWeight: side === 'buy' ? 700 : 500, fontSize: '12px' }}>LONG</div>
            <div style={{ color: side === 'buy' ? buyColor : 'var(--text-grey)', fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>{askPrice}</div>
          </div>
          <div
            onClick={() => setSide('sell')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              padding: '6px 8px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              alignItems: 'center',
              backgroundColor: side === 'sell' ? sellColorBg : 'transparent', 
              border: `1px solid ${side === 'sell' ? sellColor : 'transparent'}`, 
              transition: 'all 0.15s' 
            }}
          >
            <div style={{ color: side === 'sell' ? sellColor : 'var(--text-grey)', fontWeight: side === 'sell' ? 700 : 500, fontSize: '12px' }}>SHORT</div>
            <div style={{ color: side === 'sell' ? sellColor : 'var(--text-grey)', fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>{bidPrice}</div>
          </div>
        </div>

        {/* Order Types */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          padding: '3px', 
          border: '1px solid var(--border-color)' 
        }}>
          {['market', 'limit', 'stop'].map(type => (
            <div
              key={type}
              onClick={() => setOrderType(type)}
              style={{
                flex: 1, 
                textAlign: 'center', 
                padding: '6px', 
                cursor: 'pointer', 
                borderRadius: '6px',
                backgroundColor: orderType === type ? goldAccentLight : 'transparent',
                color: orderType === type ? goldAccent : 'var(--text-grey)',
                border: `1px solid ${orderType === type ? goldAccent : 'transparent'}`,
                fontSize: '11px', 
                fontWeight: orderType === type ? 600 : 400, 
                textTransform: 'uppercase', 
                transition: 'all 0.15s'
              }}
            >
              {type}
            </div>
          ))}
        </div>

        {/* Target Price (Limit/Stop only) */}
        {orderType !== 'market' && (
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.02)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)', 
            padding: '6px 10px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2px' 
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>
              {orderType} Price
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: goldAccent }}>
                {orderType === 'limit' ? (side === 'buy' ? '≤' : '≥') : (side === 'buy' ? '≥' : '≤')}
              </span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-dark)', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  width: '100%', 
                  fontWeight: '600', 
                  fontFamily: 'Source Code Pro, monospace' 
                }}
              />
            </div>
          </div>
        )}

        {/* Collateral Input */}
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Collateral</span>
              <span 
                style={{ fontSize: '10px', color: goldAccent, fontWeight: 'bold', cursor: 'pointer' }} 
                onClick={() => setCollateralAmount('1500')}
              >
                MAX (Bal: {usdcBalance} USDC)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                style={{ 
                  fontSize: '14px', 
                  color: 'var(--text-dark)', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  padding: 0, 
                  width: '120px', 
                  fontWeight: 'bold',
                  fontFamily: 'Source Code Pro, monospace' 
                }}
              />
              <span style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-dark)' }}>
                USDC
              </span>
            </div>
          </div>

          {/* Size Indicator */}
          <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Estimated Size</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
                {displaySize}
              </span>
            </div>
            <button
              onClick={() => setSizeCurrency(prev => prev === 'USD' ? 'ASSET' : 'USD')}
              style={{ 
                border: `1px solid ${goldAccent}`, 
                background: goldAccentLight, 
                color: goldAccent, 
                padding: '4px 8px', 
                borderRadius: '4px', 
                fontSize: '10px', 
                fontWeight: 'bold',
                cursor: 'pointer' 
              }}
            >
              {sizeCurrency === 'USD' ? 'USD' : selectedAsset}
            </button>
          </div>
        </div>

        {/* Leverage Slider */}
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          padding: '8px 10px', 
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Leverage</span>
            <span style={{ color: goldAccent, fontWeight: 'bold', fontSize: '12px', fontFamily: 'Source Code Pro, monospace' }}>{leverage}x</span>
          </div>
          <input
            type="range"
            min={minLeverageNum}
            max={maxLeverageNum}
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            style={{ 
              width: '100%', 
              background: sliderBackground, 
              accentColor: goldAccent, 
              height: '4px',
              borderRadius: '2px',
              cursor: 'pointer' 
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '4px' }}>
            {leverageStops.map(lev => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                style={{
                  flex: 1, 
                  padding: '4px 0', 
                  fontSize: '9px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: leverage === lev ? goldAccentLight : 'rgba(255,255,255,0.02)',
                  color: leverage === lev ? goldAccent : 'var(--text-grey)',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* TP / SL Toggle and Fields */}
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          padding: '8px 10px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px' 
        }}>
          <div 
            onClick={() => setTpSlEnabled(!tpSlEnabled)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontWeight: 'bold' }}>Take Profit / Stop Loss</span>
            <div style={{ 
              width: '28px', 
              height: '14px', 
              backgroundColor: tpSlEnabled ? goldAccent : 'rgba(255,255,255,0.1)', 
              borderRadius: '8px', 
              position: 'relative',
              transition: 'all 0.2s'
            }}>
              <div style={{ 
                width: '10px', 
                height: '10px', 
                backgroundColor: '#fff', 
                borderRadius: '50%', 
                position: 'absolute',
                top: '2px',
                left: tpSlEnabled ? '16px' : '2px',
                transition: 'all 0.2s'
              }} />
            </div>
          </div>

          {tpSlEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>TAKE PROFIT</span>
                <input 
                  type="number"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                  placeholder="Target Price"
                  style={{ 
                    width: '100%', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    padding: '5px', 
                    color: 'var(--text-dark)', 
                    fontSize: '11px', 
                    outline: 'none', 
                    fontFamily: 'Source Code Pro, monospace' 
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>STOP LOSS</span>
                <input 
                  type="number"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                  placeholder="Stop Price"
                  style={{ 
                    width: '100%', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    padding: '5px', 
                    color: 'var(--text-dark)', 
                    fontSize: '11px', 
                    outline: 'none', 
                    fontFamily: 'Source Code Pro, monospace' 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Metric Details list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', padding: '0 2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Liquidation Price</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
              {side === 'buy'
                ? (2315 * (1 - 0.9 / leverage)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : (2315 * (1 + 0.9 / leverage)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Exposure Size</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
              ${estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Total Fees</span>
            <span style={{ color: goldAccent, fontFamily: 'Source Code Pro', fontWeight: 'bold' }}>
              ~$0.54
            </span>
          </div>
        </div>

        {/* Large Action Submit Button */}
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'var(--gold)',
            color: '#000000',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            fontWeight: '900',
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}
        >
          {side === 'buy' ? 'Go Long' : 'Go Short'}
        </button>
      </div>
  );

  if (isInline) return innerSheet;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      {/* Tap outside to close spacer */}
      <div style={{ flex: 1 }} onClick={onClose} />
      {innerSheet}
    </div>
  );
}
