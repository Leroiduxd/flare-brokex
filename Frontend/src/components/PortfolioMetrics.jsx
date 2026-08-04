import React, { useState } from 'react';
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

export default function PortfolioMetrics() {
  const [activeMainTab, setActiveMainTab] = useState('pnl'); // 'pnl' | 'volume' | 'gainloss'
  const [isNet, setIsNet] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('ALL'); // '7D' | '30D' | '1Y' | 'ALL'

  const goldAccent = '#BC8961';
  const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

  const topStats = {
    pnl: { label: 'Realized PNL', value: '$1,799.63', sub: '+12.4% vs last month' },
    volume: { label: 'Total Volume', value: '$203,444.31', sub: '35 trades executed' },
    gainloss: { label: 'Gain & Loss', value: '22 vs 13', sub: '62.8% Win Rate' }
  };

  // Dynamic datasets based on timeframe
  const chartLabels = {
    '7D': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    '30D': Array.from({ length: 30 }, (_, i) => `${i + 1}`),
    '1Y': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'ALL': ['2022', '2023', '2024', '2025', '2026']
  };

  const pnlData = {
    '7D': { 
      gross: [142, 312, 280, 720, 610, 940, 1799.63], 
      net: [132, 290, 255, 680, 560, 880, 1699.63] 
    },
    '30D': { 
      gross: Array.from({ length: 30 }, (_, i) => Math.round(200 + (1599.63 / 29) * i + Math.sin(i) * 80)), 
      net: Array.from({ length: 30 }, (_, i) => Math.round(180 + (1519.63 / 29) * i + Math.sin(i) * 75)) 
    },
    '1Y': { 
      gross: [120, 240, 390, 520, 480, 720, 890, 1100, 1050, 1340, 1580, 1799.63], 
      net: [110, 220, 360, 480, 440, 670, 830, 1020, 970, 1240, 1470, 1699.63] 
    },
    'ALL': { 
      gross: [120, 420, 890, 1340, 1799.63], 
      net: [100, 380, 810, 1220, 1699.63] 
    }
  };

  const volumeData = {
    '7D': [15000, 22000, 18000, 35000, 28000, 42000, 60000],
    '30D': [
      8000, 12000, 15000, 9000, 11000, 14000, 18000, 22000, 16000, 13000, 
      19000, 24000, 17000, 15000, 21000, 27000, 19000, 22000, 26000, 18000, 
      20000, 25000, 31000, 23000, 21000, 28000, 34000, 27000, 29000, 35000
    ],
    '1Y': [12000, 15000, 18000, 22000, 17000, 25000, 29000, 31000, 24000, 34000, 38000, 45000],
    'ALL': [35000, 75000, 120000, 165000, 203444.31]
  };

  const gainLossData = {
    '7D': { 
      wins: [2, 4, 3, 5, 2, 4, 6], 
      losses: [-1, -2, -1, 0, -3, -2, -1] 
    },
    '30D': { 
      wins: [2, 3, 1, 2, 4, 2, 1, 3, 2, 2, 4, 1, 3, 2, 3, 1, 2, 2, 4, 1, 3, 2, 3, 2, 1, 4, 3, 2, 3, 5], 
      losses: [-1, -1, -2, -1, 0, -2, -3, -1, -2, -1, -1, -2, 0, -1, -2, -1, -3, -1, 0, -2, -1, -1, -2, -1, -3, 0, -1, -2, -1, -1] 
    },
    '1Y': { 
      wins: [3, 5, 4, 6, 2, 5, 7, 8, 4, 6, 9, 12], 
      losses: [-1, -2, -3, -1, -4, -2, -3, -1, -5, -2, -3, -2] 
    },
    'ALL': { 
      wins: [12, 18, 25, 32, 42], 
      losses: [-5, -8, -12, -10, -13] 
    }
  };

  const currentLabels = chartLabels[activeTimeframe];

  // Configure Chart.js options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#0a0a0a',
        titleColor: '#fff',
        titleFont: {
          family: "'Source Code Pro', monospace",
          size: 10
        },
        bodyColor: goldAccent,
        bodyFont: {
          family: "'Source Code Pro', monospace",
          size: 11,
          weight: 'bold'
        },
        borderColor: goldAccent,
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (activeMainTab === 'gainloss') {
                label += Math.abs(context.parsed.y) + ' trades';
              } else {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#888888',
          font: {
            family: "'Source Code Pro', monospace",
            size: 9
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.02)',
          drawTicks: false
        },
        ticks: {
          color: '#888888',
          font: {
            family: "'Source Code Pro', monospace",
            size: 9
          },
          callback: (value) => {
            if (activeMainTab === 'gainloss') return Math.abs(value);
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
            if (value <= -1000) return `-$${(Math.abs(value) / 1000).toFixed(0)}k`;
            return value < 0 ? `-$${Math.abs(value)}` : `$${value}`;
          }
        }
      }
    }
  };

  // Generate chart data based on active tab
  const getChartData = () => {
    const barThickness = activeTimeframe === '30D' ? 5 : activeTimeframe === '1Y' ? 14 : activeTimeframe === 'ALL' ? 34 : 26;

    if (activeMainTab === 'pnl') {
      const grossSet = pnlData[activeTimeframe].gross;
      const netSet = pnlData[activeTimeframe].net;

      const datasets = [
        {
          label: 'Gross Profit',
          data: grossSet,
          borderColor: goldAccent,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: goldAccent,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: activeTimeframe === '30D' ? 0 : 4
        }
      ];

      if (isNet) {
        datasets.push({
          label: 'Net Profit',
          data: netSet,
          borderColor: '#3b82f6',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: activeTimeframe === '30D' ? 0 : 4
        });
      }

      return { labels: currentLabels, datasets };
    } else if (activeMainTab === 'volume') {
      const volSet = volumeData[activeTimeframe];
      return {
        labels: currentLabels,
        datasets: [
          {
            label: 'Volume',
            data: volSet,
            backgroundColor: goldAccent,
            borderRadius: 4,
            borderWidth: 0,
            barThickness: barThickness
          }
        ]
      };
    } else {
      // Gain & Loss (Bar chart showing upward blue and downward red bars)
      const wins = gainLossData[activeTimeframe].wins;
      const losses = gainLossData[activeTimeframe].losses;
      return {
        labels: currentLabels,
        datasets: [
          {
            label: 'Wins',
            data: wins,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            borderWidth: 0,
            barThickness: barThickness
          },
          {
            label: 'Losses',
            data: losses,
            backgroundColor: '#ef4444',
            borderRadius: 4,
            borderWidth: 0,
            barThickness: barThickness
          }
        ]
      };
    }
  };

  return (
    <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      
      {/* Tab Selector Headers */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)' }}>
        {Object.keys(topStats).map((tab) => {
          const active = activeMainTab === tab;
          return (
            <div 
              key={tab} 
              onClick={() => setActiveMainTab(tab)}
              style={{
                flex: 1,
                padding: '10px 16px',
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.01)' : 'transparent',
                borderBottom: `2px solid ${active ? goldAccent : 'transparent'}`,
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                {topStats[tab].label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  color: active ? goldAccent : 'var(--text-dark)', 
                  fontFamily: 'Source Code Pro',
                  transition: 'color 0.3s'
                }}>
                  {topStats[tab].value}
                </span>
                <span style={{ fontSize: '9px', color: active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)', transition: 'color 0.3s' }}>
                  {topStats[tab].sub}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Controls & Canvas Area */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Toggle switch */}
          <div 
            onClick={() => setIsNet(!isNet)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ 
              width: '34px', 
              height: '18px', 
              borderRadius: '10px', 
              backgroundColor: isNet ? goldAccent : 'rgba(255,255,255,0.1)', 
              position: 'relative',
              transition: 'background-color 0.2s',
              border: '1px solid var(--panel-border)'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: isNet ? '#fff' : 'var(--text-grey)',
                position: 'absolute',
                top: '2px',
                left: isNet ? '18px' : '3px',
                transition: 'left 0.2s, background-color 0.2s'
              }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compare Gross vs. Net
            </span>
          </div>

          {/* Timeframe Selectors */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '6px', border: '1px solid var(--panel-border)' }}>
            {['7D', '30D', '1Y', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                style={{
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontFamily: 'Source Code Pro',
                  fontWeight: 'bold',
                  background: activeTimeframe === tf ? goldAccentLight : 'transparent',
                  border: `1px solid ${activeTimeframe === tf ? goldAccent : 'transparent'}`,
                  borderRadius: '4px',
                  color: activeTimeframe === tf ? goldAccent : 'var(--text-grey)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Glowing ChartJS Plot Area */}
        <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0 }}>
          {activeMainTab === 'volume' || activeMainTab === 'gainloss' ? (
            <Bar data={getChartData()} options={options} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          ) : (
            <Line data={getChartData()} options={options} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          )}
        </div>
      </div>
    </div>
  );
}
