import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useWriteContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useNotifications } from '../context/NotificationContext';
import BrokexCoreAbi from '../abi/BrokexCore.json';
import { fetchTeeProof } from './OrderPanel';

const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

export const closePositionMarketAbi = BrokexCoreAbi.abi?.find(item => item.name === 'closePositionMarket');

function PositionManagerInner({ position, isOpen, onClose, livePrice }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [position_win, setPositionWin] = useState({ x: window.innerWidth / 2 - 370, y: window.innerHeight / 2 - 260 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [activeTab, setActiveTab] = useState('close'); // 'close', 'collateral', 'tpsl'
  const [closeAmount, setCloseAmount] = useState(100);
  const [tpValue, setTpValue] = useState(position?.tp || '');
  const [slValue, setSlValue] = useState(position?.sl || '');
  const [marginAction, setMarginAction] = useState('add');
  const [marginAmount, setMarginAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleAction = async () => {
    if (activeTab !== 'close') {
      showNotification && showNotification({ type: 'info', title: 'Not Implemented', message: `${activeTab} action is coming soon.` });
      return;
    }

    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS;
    if (!coreAddress) {
      showNotification && showNotification({ type: 'error', title: 'Configuration Error', message: 'VITE_BROKEX_CORE_ADDRESS is not set.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Determine tradeId & assetHash
      const rawTradeId = position.rawId !== undefined ? position.rawId : (position.tradeId || position.id || '0');
      const cleanTradeIdStr = String(rawTradeId).replace(/[^0-9]/g, '') || '0';
      const tradeId = BigInt(cleanTradeIdStr);

      const goldHash = import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55';
      const xrpHash = import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298';

      const rawAssetStr = String(position.assetHash || position.assetKey || position.asset || '').toLowerCase();
      const isXRP = rawAssetStr.includes('xrp') || rawAssetStr === xrpHash.toLowerCase();

      const targetAssetHash = isXRP ? xrpHash : goldHash;
      const targetAssetKey = isXRP ? 'XRP' : 'GOLD';

      // Helper for safe BigInt conversion
      const safeBigInt = (val, fallback) => {
        try {
          if (val === undefined || val === null) return BigInt(fallback);
          return BigInt(val);
        } catch (e) {
          return BigInt(fallback);
        }
      };

      // 2. Fetch TEE Risk Proof
      showNotification && showNotification({ type: 'info', title: 'Fetching TEE Proof', message: `Retrieving signed TEE risk proof for ${targetAssetKey}...` });
      const proofData = await fetchTeeProof(targetAssetKey) || {};

      const riskProof = {
        assetHash: targetAssetHash,
        maxOILong: safeBigInt(proofData.maxOILong, "37500000000"),
        maxOIShort: safeBigInt(proofData.maxOIShort, "37500000000"),
        spreadLong: safeBigInt(proofData.spreadLong, 1000),
        spreadShort: safeBigInt(proofData.spreadShort, 1000),
        timestamp: safeBigInt(proofData.timestamp, Math.floor(Date.now() / 1000)),
        sig: proofData.sig || "0x"
      };

      // 3. Prepare closePositionMarket ABI definition
      const targetAbi = closePositionMarketAbi || {
        "inputs": [
          { "internalType": "bytes32", "name": "assetHash", "type": "bytes32" },
          { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
          {
            "components": [
              { "internalType": "bytes32", "name": "assetHash", "type": "bytes32" },
              { "internalType": "uint256", "name": "maxOILong", "type": "uint256" },
              { "internalType": "uint256", "name": "maxOIShort", "type": "uint256" },
              { "internalType": "uint256", "name": "spreadLong", "type": "uint256" },
              { "internalType": "uint256", "name": "spreadShort", "type": "uint256" },
              { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
              { "internalType": "bytes", "name": "sig", "type": "bytes" }
            ],
            "internalType": "struct BrokexCore.RiskProof",
            "name": "riskProof",
            "type": "tuple"
          }
        ],
        "name": "closePositionMarket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      };

      showNotification && showNotification({ type: 'info', title: 'Submitting Close Order', message: 'Please confirm transaction in your wallet...' });

      const txHash = await writeContractAsync({
        address: coreAddress,
        abi: [targetAbi],
        functionName: 'closePositionMarket',
        args: [targetAssetHash, tradeId, riskProof]
      });

      const safeTxHashStr = typeof txHash === 'string' ? `${txHash.slice(0, 10)}...` : '';
      showNotification && showNotification({
        type: 'success',
        title: 'Position Close Submitted!',
        message: `Transaction sent successfully${safeTxHashStr ? `: ${safeTxHashStr}` : ''}`
      });

      if (typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      console.error("closePositionMarket error:", err);
      showNotification && showNotification({
        type: 'error',
        title: 'Close Position Failed',
        message: err?.shortMessage || err?.message || 'Transaction failed'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !position) return null;

  // Compute live unrealized PnL from live SSE price if provided
  const parseNum = (val, fallback) => {
    if (val === undefined || val === null) return fallback;
    const str = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? fallback : num;
  };

  const currentMark = Number(livePrice || parseNum(position.marketPrice, 2315.10));
  const entryPriceNum = parseNum(position.entryPrice || position.openPrice, 2315.10);
  const isLong = position.side === 'Long' || position.side === 'buy' || position.isLong === true;
  const leverageNum = parseNum(position.leverage, 50);
  const collateralNum = parseNum(position.collateral, 500);
  const sizeUsdNum = parseNum(position.size, collateralNum * leverageNum);

  const priceDiffPct = isLong
    ? (currentMark - entryPriceNum) / (entryPriceNum || 1)
    : (entryPriceNum - currentMark) / (entryPriceNum || 1);

  const livePnlUsd = sizeUsdNum * priceDiffPct;
  const livePnlPct = collateralNum > 0 ? (livePnlUsd / collateralNum) * 100 : 0;

  const pnlIsPositive = livePnlUsd >= 0;
  const displayPnlUsd = `${pnlIsPositive ? '+' : ''}$${livePnlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayPnlPct = `${pnlIsPositive ? '+' : ''}${livePnlPct.toFixed(2)}%`;

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
            {(position.asset || 'XAU/USD').split('/')[0]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-dark)' }}>{position.asset || 'XAU/USD'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: isLong ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isLong ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{isLong ? 'LONG' : 'SHORT'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 'bold' }}>{position.leverage}</span>
            </div>
          </div>
        </div>

        {/* Real-time PnL Block */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span className="info-label">Unrealized PnL</span>
            <span style={{ color: pnlIsPositive ? '#3b82f6' : '#ef4444', fontWeight: 'bold', fontFamily: 'Source Code Pro', fontSize: '18px' }}>{displayPnlUsd}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: pnlIsPositive ? '#3b82f6' : '#ef4444', opacity: 0.8 }}>{displayPnlPct}</div>
        </div>

        {/* DETAILS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">Trade Identification</div>
          <div className="detail-row">
            <span className="info-label">Trade ID</span>
            <span className="info-value" style={{ color: goldAccent }}>{position.id || '#8492'}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Trader Address</span>
            <span className="info-value">{position.trader ? `${position.trader.slice(0, 6)}...${position.trader.slice(-4)}` : '0x71...f2e9'}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Open Price</span>
            <span className="info-value">${entryPriceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div className="section-title">Position Metrics</div>
          <div className="detail-row">
            <span className="info-label">Size (USD)</span>
            <span className="info-value">${sizeUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Collateral</span>
            <span className="info-value">${collateralNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Mark Price (WSS)</span>
            <span className="info-value" style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>${currentMark.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div className="section-title">Risk Management</div>
          <div className="detail-row">
            <span className="info-label">Liq. Price</span>
            <span className="info-value" style={{ color: '#ef4444' }}>{position.liqPrice || position.liquidationPrice}</span>
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
                  <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>${(closeAmount / 100 * sizeUsdNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Estimated Return</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>${(closeAmount / 100 * (collateralNum + livePnlUsd)).toFixed(2)}</span>
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
            </div>
          )}

          {activeTab === 'tpsl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Take Profit</span>
                </div>
                <input
                  type="number" value={tpValue} onChange={e => setTpValue(e.target.value)} placeholder="Target Price"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Stop Loss</span>
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
          onClick={handleAction}
          disabled={isSubmitting}
          style={{ width: '100%', padding: '14px', background: goldAccent, border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', marginTop: 'auto', opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? 'Processing...' : (!isConnected ? 'Connect Wallet' : (activeTab === 'close' ? `Close ${closeAmount}% Position` : activeTab === 'collateral' ? `${marginAction === 'add' ? 'Add' : 'Remove'} Margin` : 'Update TP/SL'))}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// Simple Error Boundary component for PositionManager
class PositionManagerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("PositionManager error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Return null so if modal errors out, it just closes without crashing the entire page
    }
    return this.props.children;
  }
}

export default function PositionManager(props) {
  return (
    <PositionManagerErrorBoundary>
      <PositionManagerInner {...props} />
    </PositionManagerErrorBoundary>
  );
}


