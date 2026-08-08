import React, { useState, useEffect } from 'react';
import { useGlobalData } from '../../context/DataContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

export default function VaultOverview() {
  const [activeTab, setActiveTab] = useState('price');
  const [activeTimeframe, setActiveTimeframe] = useState('ALL'); // '7D' | '30D' | '1Y' | 'ALL'
  const [vaultMetrics, setVaultMetrics] = useState([]);
  const [snapshotData, setSnapshotData] = useState(null);
  const [loading, setLoading] = useState(true);

  const goldAccent = '#BC8961';
  const goldAccentLight = 'rgba(188, 137, 97, 0.12)';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';
  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';
  const themeBorder = 'var(--border-color, #222)';

  const { snapshotData: globalSnapshot } = useGlobalData();

  useEffect(() => {
    if (globalSnapshot) setSnapshotData(globalSnapshot);
  }, [globalSnapshot]);

  // 1. Fetch live metrics from /api/vault/metrics
  useEffect(() => {
    let isMounted = true;
    const fetchVaultData = async () => {
      try {
        const metricsRes = await fetch(`${apiBase}/api/vault/metrics?timeframe=1h&from=0`).catch(() => null);

        if (metricsRes && metricsRes.ok) {
          const metricsJson = await metricsRes.json();
          if (isMounted && metricsJson && Array.isArray(metricsJson.data)) {
            setVaultMetrics(metricsJson.data);
          }
        }
      } catch (err) {
        console.error("VaultOverview fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVaultData();
    const interval = setInterval(fetchVaultData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Helper for 1e6 scaled metrics division
  const parse1e6 = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    if (isNaN(num)) return fallback;
    return Math.abs(num) > 100000 ? num / 1e6 : num;
  };

  // Compute live statistics from latest metric entry & snapshot
  const latestMetric = vaultMetrics.length > 0 ? vaultMetrics[vaultMetrics.length - 1] : null;
  
  const currentPrice = latestMetric ? parse1e6(latestMetric.lastKnownPrice, 1.0).toFixed(4) : '1.0000';
  const rawSupply = latestMetric ? parse1e6(latestMetric.totalSupply, 50000) : 50000;
  const currentSupply = (rawSupply / 1000).toFixed(2);
  const currentUtilization = latestMetric ? (Number(latestMetric.vaultUsageBps || 0) / 100).toFixed(2) : '0.00';
  const freeMarginPct = (100 - Number(currentUtilization)).toFixed(2);
  const rawFees = latestMetric ? parse1e6(latestMetric.unrealizedPnL, 0) : 0;
  const currentFees = `$${rawFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Dynamic Tab configurations
  const tabs = [
    { id: 'price', label: 'LP Token Price', value: `$${currentPrice}`, sub: '+0.00% (live)' },
    { id: 'supply', label: 'Total Supply', value: `${currentSupply}k BLP`, sub: 'Active Vault' },
    { id: 'utilization', label: 'Capital Utilization', value: `${currentUtilization}%`, sub: `Free Margin: ${freeMarginPct}%` },
    { id: 'fees', label: 'Fees Collected', value: currentFees, sub: 'Vault PnL / Yield' }
  ];

  // 2. Fetch Borrow Fees chart data from /api/borrow-fees/chart
  const [borrowFeesData, setBorrowFeesData] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchBorrowFees = async () => {
      try {
        const res = await fetch(`${apiBase}/api/borrow-fees/chart?timeframe=1h`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json && Array.isArray(json.data)) {
            setBorrowFeesData(json.data);
          }
        }
      } catch (err) {
        console.error("Borrow fees fetch error:", err);
      }
    };
    fetchBorrowFees();
    const interval = setInterval(fetchBorrowFees, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Shared chart options template
  const createChartOptions = (unit = '', isCurrency = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
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
            const val = Number(context.parsed.y || 0);
            const decimals = Math.abs(val) < 10 ? 4 : 2;
            const formatted = val.toLocaleString('en-US', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: 4
            });
            if (isCurrency) return `$${formatted}`;
            return unit ? `${formatted} ${unit}` : formatted;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#666666', font: { family: "'Source Code Pro', monospace", size: 9 }, maxTicksLimit: 8 }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
        ticks: {
          color: '#666666',
          font: { family: "'Source Code Pro', monospace", size: 9 },
          callback: (value) => {
            const valNum = Number(value);
            if (isCurrency) {
              if (valNum >= 1e6) return `$${(valNum / 1e6).toFixed(1)}M`;
              if (valNum >= 1e3) return `$${(valNum / 1e3).toFixed(1)}k`;
              return `$${valNum}`;
            }
            if (valNum >= 1e6) return `${(valNum / 1e6).toFixed(1)}M`;
            if (valNum >= 1e3) return `${(valNum / 1e3).toFixed(1)}k`;
            return `${valNum}${unit}`;
          }
        }
      }
    }
  });

  // Sample up to 30 evenly distributed metrics across history (or smooth 2-point line if only 1 entry)
  const sampleMetricsData = (rawList, targetCount = 30) => {
    if (!rawList || rawList.length === 0) return [];
    
    if (rawList.length === 1) {
      const single = rawList[0];
      const ts = Number(single.timestamp || Math.floor(Date.now() / 1000));
      return [
        { ...single, timestamp: ts - 300 },
        { ...single, timestamp: ts }
      ];
    }

    if (rawList.length <= targetCount) {
      return rawList;
    }

    const step = (rawList.length - 1) / (targetCount - 1);
    const sampled = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.round(i * step);
      sampled.push(rawList[idx]);
    }
    return sampled;
  };

  const metricsSlice = sampleMetricsData(vaultMetrics, 30);
  const metricsLabels = metricsSlice.map(m => {
    const rawTs = m.timestamp || Math.floor(Date.now() / 1000);
    const dateVal = Number(rawTs) > 1e11 ? Number(rawTs) : Number(rawTs) * 1000;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '--:--';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
  });

  // 1. LP Price Data
  const lpPriceData = {
    labels: metricsLabels.length > 0 ? metricsLabels : ['10:00', '10:05', '10:10', '10:15'],
    datasets: [{
      label: 'LP Price',
      data: metricsSlice.length > 0 ? metricsSlice.map(m => parse1e6(m.lpTokenPrice || m.lastKnownPrice, 1)) : [1, 1, 1, 1],
      borderColor: blueColor,
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 0,
      fill: false,
      spanGaps: true
    }]
  };

  // 2. Total Supply Data
  const totalSupplyData = {
    labels: metricsLabels.length > 0 ? metricsLabels : ['10:00', '10:05', '10:10', '10:15'],
    datasets: [{
      label: 'Total Supply',
      data: metricsSlice.length > 0 ? metricsSlice.map(m => parse1e6(m.totalSupply, 10000)) : [10000, 10000, 10000, 10000],
      borderColor: goldAccent,
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 0,
      fill: false
    }]
  };

  // 3. Utilization Data
  const utilizationData = {
    labels: metricsLabels.length > 0 ? metricsLabels : ['10:00', '10:05', '10:10', '10:15'],
    datasets: [{
      label: 'Utilization',
      data: metricsSlice.length > 0 ? metricsSlice.map(m => Number(m.vaultUsageBps || 0) / 100) : [5.92, 5.92, 5.92, 5.92],
      borderColor: redColor,
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 0,
      fill: false
    }]
  };

  // 4. Borrow Fees Data (from /api/borrow-fees/chart)
  const feeSlice = borrowFeesData.length > 0 ? borrowFeesData : [];
  const feeLabels = feeSlice.map(f => {
    const d = new Date(Number(f.timestamp) * 1000);
    if (isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });
  const borrowFeeChartData = {
    labels: feeLabels.length > 0 ? feeLabels : ['10:00', '11:00', '12:00', '13:00'],
    datasets: [{
      label: 'Cumulative Fees',
      data: feeSlice.length > 0 ? feeSlice.map(f => parse1e6(f.cumulativeFee || f.periodFee, 0)) : [0, 15, 47, 80],
      backgroundColor: goldAccent,
      borderRadius: 3,
      barThickness: 12
    }]
  };

  // Compute tight dynamic Y-axis bounds for LP Price to zoom in on micro variations
  const lpValues = metricsSlice.length > 0 ? metricsSlice.map(m => parse1e6(m.lpTokenPrice || m.lastKnownPrice, 1)) : [1.0];
  const lpMin = Math.min(...lpValues);
  const lpMax = Math.max(...lpValues);
  const lpMargin = (lpMax - lpMin) > 0 ? (lpMax - lpMin) * 0.15 : 0.0005;

  const lpChartOptions = {
    ...createChartOptions('', true),
    scales: {
      ...createChartOptions('', true).scales,
      y: {
        ...createChartOptions('', true).scales.y,
        min: Math.max(0, lpMin - lpMargin),
        max: lpMax + lpMargin,
        ticks: {
          color: '#666666',
          font: { family: "'Source Code Pro', monospace", size: 9 },
          callback: (value) => `$${Number(value).toFixed(4)}`
        }
      }
    }
  };

  const [oiAssetFilter, setOiAssetFilter] = useState('ALL'); // 'ALL' | 'GOLD' | 'XRP'

  // Helper for Open Interest values per asset
  const getOiValues = (metric, filterKey) => {
    if (!metric) return { long: 0, short: 0 };
    if (filterKey === 'GOLD') {
      return {
        long: parse1e6(metric.goldOpenInterestLong !== undefined ? metric.goldOpenInterestLong : metric.openInterestLong, 0),
        short: parse1e6(metric.goldOpenInterestShort !== undefined ? metric.goldOpenInterestShort : metric.openInterestShort, 0)
      };
    }
    if (filterKey === 'XRP') {
      return {
        long: parse1e6(metric.xrpOpenInterestLong !== undefined ? metric.xrpOpenInterestLong : 0, 0),
        short: parse1e6(metric.xrpOpenInterestShort !== undefined ? metric.xrpOpenInterestShort : 0, 0)
      };
    }
    return {
      long: parse1e6(metric.openInterestLong, 0),
      short: parse1e6(metric.openInterestShort, 0)
    };
  };

  const currentOi = getOiValues(latestMetric, oiAssetFilter);
  const currentOiLongStr = currentOi.long >= 1e6 ? `${(currentOi.long / 1e6).toFixed(2)}M` : currentOi.long.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const currentOiShortStr = currentOi.short >= 1e6 ? `${(currentOi.short / 1e6).toFixed(2)}M` : currentOi.short.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 4. Open Interest Chart Data per asset
  const chartDataOi = {
    labels: metricsLabels.length > 0 ? metricsLabels : ['10:00', '10:05', '10:10', '10:15'],
    datasets: [
      {
        label: `${oiAssetFilter === 'ALL' ? 'ALL' : oiAssetFilter} Long OI`,
        data: metricsSlice.length > 0 ? metricsSlice.map(m => getOiValues(m, oiAssetFilter).long) : [0, 0, 0, 0],
        borderColor: blueColor,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        fill: false
      },
      {
        label: `${oiAssetFilter === 'ALL' ? 'ALL' : oiAssetFilter} Short OI`,
        data: metricsSlice.length > 0 ? metricsSlice.map(m => getOiValues(m, oiAssetFilter).short) : [0, 0, 0, 0],
        borderColor: redColor,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        fill: false
      }
    ]
  };

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden', 
      minHeight: 0,
      padding: '10px',
      boxSizing: 'border-box'
    }}>
      {/* 2x2 Grid of Live Vault Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '10px',
        width: '100%',
        height: '100%'
      }}>
        {/* Card 1: LP Token Price */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.015)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted, fontWeight: 'bold' }}>LP TOKEN PRICE</span>
            <span style={{ fontSize: '12px', color: blueColor, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              ${currentPrice}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Line data={lpPriceData} options={lpChartOptions} />
          </div>
        </div>

        {/* Card 2: Total Supply */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.015)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted, fontWeight: 'bold' }}>TOTAL SUPPLY</span>
            <span style={{ fontSize: '12px', color: goldAccent, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              {currentSupply}k BLP
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Line data={totalSupplyData} options={createChartOptions('BLP')} />
          </div>
        </div>

        {/* Card 3: Vault Utilization */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.015)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted, fontWeight: 'bold' }}>CAPITAL UTILIZATION</span>
            <span style={{ fontSize: '12px', color: redColor, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              {currentUtilization}%
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Line data={utilizationData} options={createChartOptions('%')} />
          </div>
        </div>

        {/* Card 4: Open Interest ($) with Asset Filter (ALL / GOLD / XRP) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.015)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: themeTextMuted, fontWeight: 'bold' }}>OPEN INTEREST ($)</span>
              <span style={{ fontSize: '11px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
                <span style={{ color: blueColor }}>L: ${currentOiLongStr}</span>
                <span style={{ color: themeTextMuted, margin: '0 4px' }}>/</span>
                <span style={{ color: redColor }}>S: ${currentOiShortStr}</span>
              </span>
            </div>

            {/* Asset Selector Buttons */}
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '4px', border: `1px solid ${themeBorder}` }}>
              {[
                { key: 'ALL', label: 'ALL' },
                { key: 'GOLD', label: 'GOLD' },
                { key: 'XRP', label: 'XRP' }
              ].map((ast) => (
                <button
                  key={ast.key}
                  onClick={() => setOiAssetFilter(ast.key)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '9px',
                    fontFamily: 'Source Code Pro, monospace',
                    fontWeight: 'bold',
                    background: oiAssetFilter === ast.key ? 'rgba(188, 137, 97, 0.25)' : 'transparent',
                    border: `1px solid ${oiAssetFilter === ast.key ? goldAccent : 'transparent'}`,
                    borderRadius: '3px',
                    color: oiAssetFilter === ast.key ? goldAccent : themeTextMuted,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {ast.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Line data={chartDataOi} options={createChartOptions('', true)} />
          </div>
        </div>
      </div>
    </div>
  );
}
