import { useState } from 'react';

const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

export default function OrderPanel() {
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [leverage, setLeverage] = useState(10);
  const [collateralAmount, setCollateralAmount] = useState('100');
  const [targetPrice, setTargetPrice] = useState('');
  const [sizeCurrency, setSizeCurrency] = useState('USD');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');

  // Mock data for UI
  const askPrice = '2,315.10';
  const bidPrice = '2,314.90';
  const usdcBalance = '1500.00';
  const selectedAsset = 'XAU';

  const minLeverageNum = 1;
  const maxLeverageNum = 100;
  const leverageStops = [2, 10, 25, 50, 100];
  const overnightMaxLeverageNum = 50;

  const percentage = maxLeverageNum > minLeverageNum
    ? ((leverage - minLeverageNum) / (maxLeverageNum - minLeverageNum)) * 100
    : 0;
  const sliderBackground = `linear-gradient(to right, ${goldAccent} ${percentage}%, var(--border-color) ${percentage}%)`;

  const collatNum = Number(collateralAmount || 0);
  const estimatedSizeUSDNum = collatNum * leverage;
  const displaySize = sizeCurrency === 'USD'
    ? estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (estimatedSizeUSDNum / 2315).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const themeBg = 'var(--panel-bg)';
  const themeControlBg = 'rgba(255, 255, 255, 0.02)';
  const themeBorder = 'var(--border-color)';
  const themeText = 'var(--text-dark)';
  const themeTextMuted = 'var(--text-grey)';
  const buyColor = '#3b82f6'; // blue
  const sellColor = '#ef4444'; // red
  const buyColorBg = 'rgba(59, 130, 246, 0.1)';
  const sellColorBg = 'rgba(239, 68, 68, 0.1)';

  return (
    <div className="order panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto', // Scrollbar visible
      padding: '6px',
      boxSizing: 'border-box',
      gap: '8px',
      backgroundColor: themeBg,
      color: themeText,
      fontSize: '12px' // Increased base font size
    }}>
      <style>{`
        .order.panel::-webkit-scrollbar {
          display: none;
        }
        .order.panel {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners {
          -moz-appearance: textfield;
        }

        .custom-leverage-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .custom-leverage-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 1px solid #333;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
      `}</style>

      {/* Top Tabs (Long/Short) */}
      <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
        <div
          onClick={() => setSide('buy')}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', backgroundColor: side === 'buy' ? buyColorBg : 'transparent', border: `1px solid ${side === 'buy' ? buyColor : 'transparent'}`, transition: 'all 0.15s' }}>
          <div style={{ color: side === 'buy' ? buyColor : themeTextMuted, fontWeight: side === 'buy' ? 600 : 400, fontSize: '12px' }}>Long</div>
          <div style={{ color: side === 'buy' ? buyColor : themeTextMuted, fontSize: '11px', fontFamily: 'Source Code Pro, monospace' }}>{askPrice}</div>
        </div>
        <div
          onClick={() => setSide('sell')}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', backgroundColor: side === 'sell' ? sellColorBg : 'transparent', border: `1px solid ${side === 'sell' ? sellColor : 'transparent'}`, transition: 'all 0.15s' }}>
          <div style={{ color: side === 'sell' ? sellColor : themeTextMuted, fontWeight: side === 'sell' ? 600 : 400, fontSize: '12px' }}>Short</div>
          <div style={{ color: side === 'sell' ? sellColor : themeTextMuted, fontSize: '11px', fontFamily: 'Source Code Pro, monospace' }}>{bidPrice}</div>
        </div>
      </div>

      {/* Market / Limit / Stop */}
      <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
        {['market', 'limit', 'stop'].map(type => (
          <div
            key={type}
            onClick={() => setOrderType(type)}
            style={{
              flex: 1, textAlign: 'center', padding: '6px', cursor: 'pointer', borderRadius: '4px',
              backgroundColor: orderType === type ? goldAccentLight : 'transparent',
              color: orderType === type ? goldAccent : themeTextMuted,
              border: `1px solid ${orderType === type ? goldAccent : 'transparent'}`,
              fontSize: '11px', fontWeight: orderType === type ? 600 : 400, textTransform: 'capitalize', transition: 'all 0.15s'
            }}>
            {type}
          </div>
        ))}
      </div>

      {/* Available to Trade */}
      <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '0 2px' }}>
        <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Available to Trade</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</span>
        </div>
      </div>

      {/* Target Price (Limit/Stop only) */}
      {orderType !== 'market' && (
        <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: themeTextMuted, textTransform: 'capitalize' }}>
            {orderType} price
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: goldAccent }}>
              {orderType === 'limit' ? (side === 'buy' ? '≤' : '≥') : (side === 'buy' ? '≥' : '≤')}
            </span>
            <input
              type="number"
              className="no-spinners"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="None"
              style={{ fontSize: '13px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%', fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}
            />
          </div>
        </div>
      )}

      {/* Collateral & Estimated Size */}
      <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, display: 'flex', flexDirection: 'column' }}>
        {/* Collateral */}
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${themeBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted }}>Collateral</span>
            <span style={{ fontSize: '11px', color: themeTextMuted, cursor: 'pointer' }} onClick={() => setCollateralAmount(usdcBalance)}>Max</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              className="no-spinners"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', padding: 0, width: '120px', fontFamily: 'Source Code Pro, monospace' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 500, fontSize: '12px' }}>
              USDC
            </div>
          </div>
        </div>

        {/* Estimated Size - Reduced vertical padding */}
        <div style={{ padding: '8px 8px', borderBottom: `1px solid ${themeBorder}` }}>
          <div style={{ fontSize: '11px', color: themeTextMuted, marginBottom: '2px' }}>Estimated Size</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
              {displaySize}
            </span>
            <div
              onClick={() => setSizeCurrency(prev => prev === 'USD' ? 'ASSET' : 'USD')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: goldAccent, fontWeight: 600, fontSize: '11px', backgroundColor: goldAccentLight, border: `1px solid ${goldAccent}`, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s' }}
            >
              <span>{sizeCurrency === 'USD' ? 'USD' : selectedAsset}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leverage - Compact padding */}
      <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: themeTextMuted }}>Leverage</span>
          <span style={{ color: themeText, fontWeight: 600, fontSize: '13px', fontFamily: 'Source Code Pro, monospace' }}>{leverage}x</span>
        </div>
        <input
          type="range"
          min={minLeverageNum}
          max={maxLeverageNum}
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="custom-leverage-slider"
          style={{ background: sliderBackground }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '6px' }}>
          {leverageStops.map(lev => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              style={{
                flex: 1, padding: '6px 0', fontSize: '10px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: leverage === lev ? goldAccentLight : themeBg,
                color: leverage === lev ? goldAccent : themeTextMuted,
                cursor: 'pointer', transition: 'all 0.1s'
              }}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* TP / SL Management Section */}
      <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div 
          onClick={() => setTpSlEnabled(!tpSlEnabled)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '11px', color: themeText, fontWeight: 600 }}>Take Profit / Stop Loss</span>
          <div style={{ 
            width: '32px', 
            height: '16px', 
            backgroundColor: tpSlEnabled ? goldAccent : 'rgba(255,255,255,0.1)', 
            borderRadius: '8px', 
            position: 'relative',
            transition: 'all 0.2s'
          }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#fff', 
              borderRadius: '50%', 
              position: 'absolute',
              top: '2px',
              left: tpSlEnabled ? '18px' : '2px',
              transition: 'all 0.2s'
            }} />
          </div>
        </div>

        {tpSlEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Take Profit Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: themeTextMuted }}>Take Profit</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['10%', '25%', '50%', '100%'].map(p => (
                    <div key={p} style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', color: themeTextMuted, cursor: 'pointer', border: `1px solid ${themeBorder}` }}>{p}</div>
                  ))}
                </div>
              </div>
              <input 
                type="number"
                className="no-spinners"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="Target Price"
                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${themeBorder}`, borderRadius: '4px', padding: '6px', color: themeText, fontSize: '11px', outline: 'none', fontFamily: 'Source Code Pro, monospace' }}
              />
            </div>

            {/* Stop Loss Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: themeTextMuted }}>Stop Loss</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['10%', '25%', '50%', '100%'].map(p => (
                    <div key={p} style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', color: themeTextMuted, cursor: 'pointer', border: `1px solid ${themeBorder}` }}>{p}</div>
                  ))}
                </div>
              </div>
              <input 
                type="number"
                className="no-spinners"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="Stop Price"
                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${themeBorder}`, borderRadius: '4px', padding: '6px', color: themeText, fontSize: '11px', outline: 'none', fontFamily: 'Source Code Pro, monospace' }}
              />
            </div>
          </div>
        )}
      </div>


      {/* Action Button */}
      <div style={{ flexShrink: 0, display: 'flex', marginTop: '5px' }}>
        <button
          style={{
            flex: 1,
            backgroundColor: goldAccent,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}>
          Go {side === 'buy' ? 'Long' : 'Short'}
        </button>
      </div>

      {/* Metrics List */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', marginTop: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Amount</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{(estimatedSizeUSDNum / 2315).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {selectedAsset}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Exposure</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>${estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Collateral at Open</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{collatNum.toFixed(2)} USDC</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Liquidation Price</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
            {side === 'buy'
              ? (2315 * (1 - 0.9 / leverage)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : (2315 * (1 + 0.9 / leverage)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }
          </span>
        </div>

        <div style={{ height: '1px', backgroundColor: themeBorder, margin: '6px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Oracle Fee</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0.10</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Open Fee</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0.27</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Close Fee</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0.17</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${themeBorder}` }}>
          <span style={{ color: themeText, fontWeight: 600 }}>Total Fees</span>
          <span style={{ color: goldAccent, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>
            ~$0.54
          </span>
        </div>
      </div>

    </div>
  );
}
