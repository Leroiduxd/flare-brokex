import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Ticker from '../components/Ticker';
import VaultHeader from '../components/vault/VaultHeader';
import VaultDetails from '../components/vault/VaultDetails';
import VaultChartsGrid from '../components/vault/VaultChartsGrid';
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

class VaultErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[VaultErrorBoundary catch in ${this.props.name || 'Component'}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#ef4444',
          fontSize: '11px',
          fontFamily: 'Source Code Pro, monospace'
        }}>
          <strong>{this.props.name || 'Component'} Error:</strong> {this.state.error?.message || 'Render error'}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Vault() {
  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';
  const [snapshotData, setSnapshotData] = useState(null);
  const [metricsData, setMetricsData] = useState([]);

  const goldAccent = '#BC8961';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';
  const greenColor = '#10b981';

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [snapRes, metricsRes] = await Promise.all([
          fetch(`${apiBase}/api/snapshot`).catch(() => null),
          fetch(`${apiBase}/api/vault/metrics?timeframe=1h&from=0`).catch(() => null)
        ]);

        if (snapRes && snapRes.ok) {
          const snapJson = await snapRes.json();
          if (isMounted && snapJson) setSnapshotData(snapJson);
        }
        if (metricsRes && metricsRes.ok) {
          const metricsJson = await metricsRes.json();
          if (isMounted && metricsJson && Array.isArray(metricsJson.data)) {
            setMetricsData(metricsJson.data);
          }
        }
      } catch (err) {
        console.error("Vault metrics fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiBase]);

  // Compute live card values
  const vaultSnap = snapshotData?.assets?.GOLD?.snapshot || snapshotData?.assets?.GOLD || {};
  const latestMetric = metricsData.length > 0 ? metricsData[metricsData.length - 1] : {};

  // 1. LP Token Price
  const rawLpPrice = latestMetric.lpTokenPrice || latestMetric.lpPrice || vaultSnap.lpPrice;
  const lpPrice = rawLpPrice ? (Number(rawLpPrice) > 100000 ? Number(rawLpPrice) / 1e6 : Number(rawLpPrice)).toFixed(4) : '1.0000';

  // 2. Total Supply
  const rawSupply = latestMetric.totalSupply || vaultSnap.totalSupply;
  const totalSupply = rawSupply ? ((Number(rawSupply) > 100000 ? Number(rawSupply) / 1e6 : Number(rawSupply))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '10,000.00';

  // 3. Capital Utilization
  const rawUsageBps = latestMetric.vaultUsageBps || vaultSnap.vaultUsageBps;
  const utilization = rawUsageBps !== undefined ? (Number(rawUsageBps) / 100).toFixed(2) : '5.92';

  // 4. Fees Collected
  const rawFees = latestMetric.unrealizedPnL || latestMetric.accumulatedFees || vaultSnap.accumulatedFees;
  const feesCollected = rawFees ? ((Number(rawFees) > 100000 ? Number(rawFees) / 1e6 : Number(rawFees))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

  // Sample max 30 evenly spaced points across the full historical range
  const sampledMetrics = (() => {
    if (!metricsData || metricsData.length <= 30) return metricsData || [];
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
    ? sampledMetrics.map(m => {
        const val = Number(m.lpTokenPrice || m.lpPrice || 1000000);
        return val > 100000 ? val / 1e6 : val;
      })
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
        ? sampledMetrics.map(m => {
            const val = Number(m.totalSupply || 10000000000);
            return val > 100000 ? val / 1e6 : val;
          })
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

  const chartDataFees = {
    labels,
    datasets: [{
      data: sampledMetrics.length > 0 
        ? sampledMetrics.map(m => {
            const val = Number(m.unrealizedPnL || m.accumulatedFees || 0);
            return val > 100000 ? val / 1e6 : val;
          })
        : [0, 0, 0, 0],
      backgroundColor: goldAccent,
      borderRadius: 2,
      borderWidth: 0
    }]
  };

  // Timeframe states for each individual card
  const [tfPrice, setTfPrice] = useState('ALL');
  const [tfSupply, setTfSupply] = useState('ALL');
  const [tfUtilization, setTfUtilization] = useState('ALL');
  const [tfFees, setTfFees] = useState('ALL');

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

      {/* CENTER COLUMN: Flex column containing Header, 2x2 Grid, Ticker */}
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
          <VaultErrorBoundary name="VaultHeader">
            <VaultHeader />
          </VaultErrorBoundary>
        </div>

        {/* MIDDLE AREA: 2x2 Grid of 4 Standalone Cards with Full Real Charts */}
        <VaultErrorBoundary name="VaultChartsGrid">
          <VaultChartsGrid metricsData={metricsData} snapshotData={snapshotData} />
        </VaultErrorBoundary>

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
        <VaultErrorBoundary name="VaultDetails">
          <VaultDetails />
        </VaultErrorBoundary>
      </div>
    </div>
  );
}
