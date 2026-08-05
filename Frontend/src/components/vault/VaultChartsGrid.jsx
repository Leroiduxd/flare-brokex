import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler
);

export default function VaultChartsGrid({ metricsData = [], snapshotData = null }) {
  const goldAccent = '#BC8961';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';

  // Compute live values
  const vaultSnap = snapshotData?.assets?.GOLD?.snapshot || snapshotData?.assets?.GOLD || {};
  const latestMetric = metricsData.length > 0 ? metricsData[metricsData.length - 1] : {};

  const [oiAssetFilter, setOiAssetFilter] = useState('ALL'); // 'ALL' | 'GOLD' | 'XRP'

  // Helper function to scale raw 1e6 BigInt values to decimal
  const scale1e6 = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    return isNaN(num) ? fallback : num / 1e6;
  };

  // Helper for Open Interest values per asset
  const getOiValues = (metric, filterKey) => {
    if (!metric) return { long: 0, short: 0 };
    if (filterKey === 'GOLD') {
      return {
        long: scale1e6(metric.goldOpenInterestLong !== undefined ? metric.goldOpenInterestLong : metric.openInterestLong, 0),
        short: scale1e6(metric.goldOpenInterestShort !== undefined ? metric.goldOpenInterestShort : metric.openInterestShort, 0)
      };
    }
    if (filterKey === 'XRP') {
      return {
        long: scale1e6(metric.xrpOpenInterestLong !== undefined ? metric.xrpOpenInterestLong : 0, 0),
        short: scale1e6(metric.xrpOpenInterestShort !== undefined ? metric.xrpOpenInterestShort : 0, 0)
      };
    }
    return {
      long: scale1e6(metric.openInterestLong, 0),
      short: scale1e6(metric.openInterestShort, 0)
    };
  };

  // 1. LP Token Price
  const rawLpPrice = latestMetric.lpTokenPrice || latestMetric.lpPrice || vaultSnap.lpPrice;
  const lpPrice = rawLpPrice ? scale1e6(rawLpPrice, 1).toFixed(4) : '1.0000';

  // 2. Total Supply
  const rawSupply = latestMetric.totalSupply || vaultSnap.totalSupply;
  const totalSupply = rawSupply ? scale1e6(rawSupply, 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '10,000.00';

  // 3. Capital Utilization
  const rawUsageBps = latestMetric.vaultUsageBps || vaultSnap.vaultUsageBps;
  const utilization = rawUsageBps !== undefined ? (Number(rawUsageBps) / 100).toFixed(2) : '5.92';

  const rawTotalVaultUSDC = latestMetric.totalVaultUSDC || vaultSnap.totalVaultUSDC;
  const totalVaultUSDCVal = scale1e6(rawTotalVaultUSDC, 10032.45);
  const totalVaultUSDCStr = totalVaultUSDCVal >= 1e6 
    ? `$${(totalVaultUSDCVal / 1e6).toFixed(2)}M` 
    : `$${totalVaultUSDCVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rawLockedCapital = latestMetric.totalLockedCapital || vaultSnap.totalLockedCapital;
  const usedCapitalVal = scale1e6(rawLockedCapital, 0);
  const usedCapitalStr = usedCapitalVal >= 1e6 
    ? `$${(usedCapitalVal / 1e6).toFixed(2)}M` 
    : `$${usedCapitalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 4. Open Interest (Long & Short) per asset
  const currentOi = getOiValues(latestMetric, oiAssetFilter);
  const oiLongVal = currentOi.long;
  const oiShortVal = currentOi.short;

  const oiLongStr = oiLongVal >= 1e6 ? `${(oiLongVal / 1e6).toFixed(2)}M` : oiLongVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const oiShortStr = oiShortVal >= 1e6 ? `${(oiShortVal / 1e6).toFixed(2)}M` : oiShortVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Sample max 30 evenly spaced points across history (or 2 points if only 1 entry exists for clean horizontal line)
  const sampledMetrics = (() => {
    if (!metricsData || metricsData.length === 0) return [];
    if (metricsData.length === 1) {
      const single = metricsData[0];
      const ts = Number(single.timestamp || Math.floor(Date.now() / 1000));
      return [
        { ...single, timestamp: ts - 300 },
        { ...single, timestamp: ts }
      ];
    }
    if (metricsData.length <= 30) return metricsData;
    const step = (metricsData.length - 1) / 29;
    const sampled = [];
    for (let i = 0; i < 30; i++) {
      const idx = Math.round(i * step);
      sampled.push(metricsData[idx]);
    }
    return sampled;
  })();

  // Generate series labels & datasets using spaced sampled metrics
  const labels = sampledMetrics.length > 0 
    ? sampledMetrics.map(m => {
        const d = new Date(Number(m.timestamp) * 1000);
        if (isNaN(d.getTime())) return '--:--';
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hours}:${mins}`;
      }) 
    : ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30'];

  const lpPriceValues = sampledMetrics.length > 0 
    ? sampledMetrics.map(m => scale1e6(m.lpTokenPrice || m.lpPrice, 1.0))
    : [1.0000, 1.0000, 1.0000, 1.0000];

  const lpMin = Math.min(...lpPriceValues);
  const lpMax = Math.max(...lpPriceValues);
  const lpMargin = (lpMax - lpMin) > 0 ? (lpMax - lpMin) * 0.15 : 0.0005;

  const chartDataPrice = {
    labels,
    datasets: [{
      data: lpPriceValues,
      borderColor: blueColor,
      fill: false,
      tension: 0.35,
      borderWidth: 2
    }]
  };

  const chartDataSupply = {
    labels,
    datasets: [{
      data: sampledMetrics.length > 0 
        ? sampledMetrics.map(m => scale1e6(m.totalSupply, 10000))
        : [10000, 10000, 10000, 10000],
      borderColor: goldAccent,
      fill: false,
      tension: 0.35,
      borderWidth: 2
    }]
  };

  const chartDataUtilization = {
    labels,
    datasets: [{
      data: sampledMetrics.length > 0 
        ? sampledMetrics.map(m => Number(m.vaultUsageBps || 592) / 100)
        : [5.92, 5.92, 5.92, 5.92],
      borderColor: redColor,
      fill: false,
      tension: 0.35,
      borderWidth: 2
    }]
  };

  const chartDataOi = {
    labels,
    datasets: [
      {
        label: `${oiAssetFilter === 'ALL' ? 'ALL' : oiAssetFilter} Long OI`,
        data: sampledMetrics.length > 0 
          ? sampledMetrics.map(m => getOiValues(m, oiAssetFilter).long)
          : [0, 0, 0, 0],
        borderColor: blueColor,
        fill: false,
        tension: 0.35,
        borderWidth: 2
      },
      {
        label: `${oiAssetFilter === 'ALL' ? 'ALL' : oiAssetFilter} Short OI`,
        data: sampledMetrics.length > 0 
          ? sampledMetrics.map(m => getOiValues(m, oiAssetFilter).short)
          : [0, 0, 0, 0],
        borderColor: redColor,
        fill: false,
        tension: 0.35,
        borderWidth: 2
      }
    ]
  };

  // Timeframe states for each individual card
  const [tfPrice, setTfPrice] = useState('ALL');
  const [tfSupply, setTfSupply] = useState('ALL');
  const [tfUtilization, setTfUtilization] = useState('ALL');
  const [tfOi, setTfOi] = useState('ALL');

  const timeframes = ['7D', '30D', '1Y', 'ALL'];

  const renderTfButtons = (currentTf, setTf) => (
    <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => setTf(tf)}
          style={{
            padding: '2px 5px',
            fontSize: '9px',
            fontFamily: 'Source Code Pro, monospace',
            fontWeight: 'bold',
            background: currentTf === tf ? 'rgba(188, 137, 97, 0.2)' : 'transparent',
            border: `1px solid ${currentTf === tf ? goldAccent : 'transparent'}`,
            borderRadius: '3px',
            color: currentTf === tf ? goldAccent : 'var(--text-grey)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {tf}
        </button>
      ))}
    </div>
  );

  const createTooltipOptions = (unit = '', isCurrency = false) => ({
    enabled: true,
    backgroundColor: '#0a0a0a',
    titleColor: '#fff',
    titleFont: { family: "'Source Code Pro', monospace", size: 10 },
    bodyFont: { family: "'Source Code Pro', monospace", size: 11, weight: 'bold' },
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    padding: 8,
    displayColors: false,
    callbacks: {
      label: (context) => {
        const val = Number(context.parsed.y !== undefined ? context.parsed.y : context.raw || 0);
        const absVal = Math.abs(val);
        const decimals = absVal < 10 ? 4 : 2;
        const formatted = val.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: 4
        });
        if (isCurrency) return `$${formatted}`;
        return unit ? `${formatted} ${unit}` : formatted;
      }
    }
  });

  return (
    <div style={{ 
      flex: 1, 
      minHeight: 0,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '4px'
    }}>
      {/* Card 1: LP Token Price Chart */}
      <div className="panel" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 1px 4px 6px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '4px',
          marginBottom: '6px',
          paddingRight: '5px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: goldAccent, fontFamily: 'Source Code Pro, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>
              [ LP TOKEN PRICE ($) ]
            </span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: blueColor }}>
              ${lpPrice}
            </span>
          </div>
          {renderTfButtons(tfPrice, setTfPrice)}
        </div>
        <div style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}>
          <Line data={chartDataPrice} options={{
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 1, left: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: createTooltipOptions('', true)
            },
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' }, maxTicksLimit: 6 } },
              y: { 
                grid: { color: 'rgba(255, 255, 255, 0.015)' }, 
                min: Math.max(0, lpMin - lpMargin),
                max: lpMax + lpMargin,
                ticks: { 
                  color: '#666666', 
                  font: { size: 8.5, family: 'Source Code Pro' },
                  callback: (value) => `$${Number(value).toFixed(4)}`
                } 
              }
            }
          }} />
        </div>
      </div>

      {/* Card 2: Total LP Supply Chart */}
      <div className="panel" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 1px 4px 6px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '4px',
          marginBottom: '6px',
          paddingRight: '5px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: goldAccent, fontFamily: 'Source Code Pro, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>
              [ TOTAL LP SUPPLY (BLP) ]
            </span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: goldAccent }}>
              {totalSupply} BLP
            </span>
          </div>
          {renderTfButtons(tfSupply, setTfSupply)}
        </div>
        <div style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}>
          <Line data={chartDataSupply} options={{
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 1, left: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: createTooltipOptions('BLP', false)
            },
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' }, maxTicksLimit: 6 } },
              y: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' } } }
            }
          }} />
        </div>
      </div>

      {/* Card 3: Capital Utilization Chart */}
      <div className="panel" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 1px 4px 6px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '4px',
          marginBottom: '6px',
          paddingRight: '5px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: goldAccent, fontFamily: 'Source Code Pro, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>
              [ CAPITAL UTILIZATION (%) ]
            </span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: redColor }}>
              {utilization}%
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>
              <span style={{ color: goldAccent }}>Vault: {totalVaultUSDCStr}</span>
              <span style={{ color: 'var(--text-grey)', margin: '0 4px' }}>/</span>
              <span style={{ color: redColor }}>Used: {usedCapitalStr}</span>
            </span>
          </div>
          {renderTfButtons(tfUtilization, setTfUtilization)}
        </div>
        <div style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}>
          <Line data={chartDataUtilization} options={{
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 1, left: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: createTooltipOptions('%', false)
            },
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' }, maxTicksLimit: 6 } },
              y: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' } } }
            }
          }} />
        </div>
      </div>

      {/* Card 4: Open Interest (Long & Short) Dual Line Chart */}
      <div className="panel" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 1px 4px 6px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '4px',
          marginBottom: '6px',
          paddingRight: '5px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: goldAccent, fontFamily: 'Source Code Pro, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>
              [ OPEN INTEREST ($) ]
            </span>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
              <span style={{ color: blueColor }}>L: ${oiLongStr}</span>
              <span style={{ color: 'var(--text-grey)', margin: '0 4px' }}>/</span>
              <span style={{ color: redColor }}>S: ${oiShortStr}</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Asset Selector Buttons */}
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              {[
                { key: 'ALL', label: 'ALL' },
                { key: 'GOLD', label: 'GOLD' },
                { key: 'XRP', label: 'XRP' }
              ].map((ast) => (
                <button
                  key={ast.key}
                  onClick={() => setOiAssetFilter(ast.key)}
                  style={{
                    padding: '2px 5px',
                    fontSize: '9px',
                    fontFamily: 'Source Code Pro, monospace',
                    fontWeight: 'bold',
                    background: oiAssetFilter === ast.key ? 'rgba(188, 137, 97, 0.25)' : 'transparent',
                    border: `1px solid ${oiAssetFilter === ast.key ? goldAccent : 'transparent'}`,
                    borderRadius: '3px',
                    color: oiAssetFilter === ast.key ? goldAccent : 'var(--text-grey)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {ast.label}
                </button>
              ))}
            </div>
            {renderTfButtons(tfOi, setTfOi)}
          </div>
        </div>
        <div style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}>
          <Line data={chartDataOi} options={{
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 1, left: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: createTooltipOptions('', true)
            },
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' }, maxTicksLimit: 6 } },
              y: { grid: { color: 'rgba(255, 255, 255, 0.015)' }, ticks: { color: '#666666', font: { size: 8.5, family: 'Source Code Pro' } } }
            }
          }} />
        </div>
      </div>
    </div>
  );

}
