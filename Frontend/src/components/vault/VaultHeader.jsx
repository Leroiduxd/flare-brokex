import React, { useRef, useState, useEffect } from 'react';
import { useGlobalData } from '../../context/DataContext';

const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

export default function VaultHeader() {
  const containerRef = useRef(null);

  const [metricsData, setMetricsData] = useState([]);
  const [snapshotData, setSnapshotData] = useState(null);

  const { snapshotData: globalSnapshot } = useGlobalData();

  useEffect(() => {
    if (globalSnapshot) setSnapshotData(globalSnapshot);
  }, [globalSnapshot]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const metricsRes = await fetch(`${apiBase}/api/vault/metrics?timeframe=1h&from=0`).catch(() => null);
        if (metricsRes && metricsRes.ok) {
          const metricsJson = await metricsRes.json();
          if (isMounted && metricsJson && Array.isArray(metricsJson.data)) {
            setMetricsData(metricsJson.data);
          }
        }
      } catch (err) {}
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const parse1e6 = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    if (isNaN(num)) return fallback;
    return Math.abs(num) > 100000 ? num / 1e6 : num;
  };

  const latestMetric = metricsData.length > 0 ? metricsData[metricsData.length - 1] : {};
  const goldSnapshot = snapshotData?.assets?.GOLD?.snapshot || snapshotData?.assets?.GOLD || {};

  // Real Values Calculation
  const lpPrice = latestMetric.lpTokenPrice 
    ? `$${parse1e6(latestMetric.lpTokenPrice, 1.0).toFixed(4)}` 
    : '$1.0000';

  const rawSupply = latestMetric.totalSupply;
  const totalSupply = rawSupply 
    ? `${parse1e6(rawSupply, 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BLP`
    : '10,000.00 BLP';

  const rawTotalVaultUSDC = latestMetric.totalVaultUSDC;
  const totalLiquidity = rawTotalVaultUSDC
    ? `$${parse1e6(rawTotalVaultUSDC, 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$10,032.45';

  const rawLocked = latestMetric.totalLockedCapital;
  const usedLiquidity = rawLocked
    ? `$${parse1e6(rawLocked, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  const rawFree = latestMetric.freeCapital;
  const freeLiquidity = rawFree
    ? `$${parse1e6(rawFree, 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$10,032.45';

  const rawUsageBps = latestMetric.vaultUsageBps;
  const stressFactor = rawUsageBps !== undefined
    ? `${(Number(rawUsageBps) / 100).toFixed(2)}%`
    : '0.00%';

  const rawPnL = latestMetric.unrealizedPnL !== undefined 
    ? latestMetric.unrealizedPnL 
    : (latestMetric.accumulatedFees !== undefined 
      ? latestMetric.accumulatedFees 
      : (snapshotData?.accumulatedFees || 0));

  const livePnLVal = parse1e6(rawPnL, 0);
  const livePnLSign = livePnLVal > 0 ? '+' : (livePnLVal < 0 ? '-' : '');
  const livePnL = `${livePnLSign}$${Math.abs(livePnLVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Long/Short Open Interest Ratio cumulated across all assets from /api/snapshot
  let oiLong = 0;
  let oiShort = 0;

  if (snapshotData?.assets && typeof snapshotData.assets === 'object') {
    Object.values(snapshotData.assets).forEach(assetObj => {
      const snp = assetObj?.snapshot || assetObj || {};
      oiLong += Number(snp.openInterestLong || 0);
      oiShort += Number(snp.openInterestShort || 0);
    });
  }

  if (oiLong === 0 && oiShort === 0 && latestMetric) {
    oiLong = Number(latestMetric.openInterestLong || 0);
    oiShort = Number(latestMetric.openInterestShort || 0);
  }

  const totalOiNum = parse1e6(oiLong + oiShort, 0);
  const totalOiStr = totalOiNum >= 1e6 
    ? `$${(totalOiNum / 1e6).toFixed(2)}M` 
    : `$${totalOiNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalOi = oiLong + oiShort;
  const longRatio = totalOi > 0 ? Math.round((oiLong / totalOi) * 100) : 50;

  const pendingRequestsCount = latestMetric.pendingRequestsCount !== undefined
    ? String(latestMetric.pendingRequestsCount)
    : '0';

  const handleMouseDown = (e) => {
    const ele = containerRef.current;
    if (!ele) return;
    
    ele.style.cursor = 'grabbing';
    ele.style.userSelect = 'none';

    const startX = e.clientX - ele.offsetLeft;
    const scrollLeft = ele.scrollLeft;

    const handleMouseMove = (e) => {
      const x = e.clientX - ele.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll speed factor
      ele.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      ele.style.cursor = 'grab';
      ele.style.removeProperty('user-select');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box'
    }}>
      <style>{`
        /* Hide scrollbars completely across browsers */
        .vault-scrollable-stats::-webkit-scrollbar {
          display: none;
        }
        .vault-scrollable-stats > * {
          flex-shrink: 0;
        }
      `}</style>

      {/* Internal scrollable stats container identical to TopNav */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="vault-scrollable-stats" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '20px', 
          overflowX: 'auto', 
          width: '100%',
          height: '100%',
          padding: '0 16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab'
        }}
      >
        
        {/* LP Price */}
        <div className="stat-item">
          <span className="stat-label">LP Price</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="stat-value" style={{ fontWeight: 'bold' }}>{lpPrice}</span>
            <span className="stat-value up" style={{ fontSize: '10px' }}>+0.00%</span>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Total Supply */}
        <div className="stat-item">
          <span className="stat-label">Total Supply</span>
          <span className="stat-value">{totalSupply}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Total Liquidity */}
        <div className="stat-item">
          <span className="stat-label">Total Liquidity</span>
          <span className="stat-value" style={{ color: '#BC8961' }}>{totalLiquidity}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Used Liquidity */}
        <div className="stat-item">
          <span className="stat-label">Used Liquidity</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{usedLiquidity}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Free Liquidity */}
        <div className="stat-item">
          <span className="stat-label">Free Liquidity</span>
          <span className="stat-value" style={{ color: '#3b82f6' }}>{freeLiquidity}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Live Unrealized PnL */}
        <div className="stat-item">
          <span className="stat-label">Live Vault PnL</span>
          <span className="stat-value" style={{ color: '#3b82f6', fontWeight: 'bold' }}>{livePnL}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Long/Short Balance */}
        <div className="stat-item">
          <span className="stat-label">Total OI ({totalOiStr})</span>
          <span className="stat-value" style={{ fontFamily: 'Source Code Pro, monospace' }}>
            <span style={{ color: '#3b82f6' }}>{longRatio}% L</span>
            <span style={{ color: 'var(--text-grey, #888888)' }}> / </span>
            <span style={{ color: '#ef4444' }}>{100 - longRatio}% S</span>
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Pending Requests */}
        <div className="stat-item">
          <span className="stat-label">Pending Withdrawals</span>
          <span className="stat-value" style={{ color: '#BC8961' }}>{pendingRequestsCount}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

        {/* Stress Factor */}
        <div className="stat-item">
          <span className="stat-label">Capital Utilization</span>
          <span className="stat-value" style={{ color: '#BC8961' }}>{stressFactor}</span>
        </div>

      </div>
    </div>
  );
}

