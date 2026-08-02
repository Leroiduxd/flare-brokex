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

export default function VaultOverview() {
  const [activeTab, setActiveTab] = useState('price');
  const [activeTimeframe, setActiveTimeframe] = useState('ALL'); // '7D' | '30D' | '1Y' | 'ALL'

  const goldAccent = '#BC8961';
  const goldAccentLight = 'rgba(188, 137, 97, 0.12)';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';
  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';
  const themeBorder = 'var(--border-color, #222)';

  // Tab configurations matching PortfolioMetrics style
  const tabs = [
    { id: 'price', label: 'LP Token Price', value: '$1.2450', sub: '+1.85% (24h)' },
    { id: 'supply', label: 'Total Supply', value: '36.31M BLP', sub: '2,845 active users' },
    { id: 'utilization', label: 'Capital Utilization', value: '78.40%', sub: 'Free Margin: 21.60%' },
    { id: 'fees', label: 'Fees Collected', value: '$1,487,600', sub: 'My Share: $4,250.80' }
  ];

  // Timeframe labels
  const timeLabels = {
    '7D': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    '30D': ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
    '1Y': ['JUL', 'SEP', 'NOV', 'JAN', 'MAR', 'MAY'],
    'ALL': ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN']
  };

  // Dynamic datasets based on Active Tab & Timeframe
  const getChartData = () => {
    const labels = timeLabels[activeTimeframe];

    if (activeTab === 'price') {
      const dataValues = {
        '7D': [1.2380, 1.2400, 1.2420, 1.2410, 1.2430, 1.2440, 1.2450],
        '30D': [1.2100, 1.2150, 1.2280, 1.2300, 1.2410, 1.2450],
        '1Y': [1.0800, 1.1200, 1.1500, 1.1800, 1.2100, 1.2450],
        'ALL': [1.0000, 1.0500, 1.0800, 1.1500, 1.2000, 1.2450]
      }[activeTimeframe];

      return {
        labels,
        datasets: [
          {
            label: 'LP Token Price',
            data: dataValues,
            borderColor: blueColor,
            borderWidth: 2,
            fill: false,
            tension: 0.35,
            pointBackgroundColor: '#111111',
            pointBorderColor: blueColor,
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointRadius: activeTimeframe === '30D' ? 2 : 4
          }
        ]
      };
    }

    if (activeTab === 'supply') {
      const dataValues = {
        '7D': [36.10, 36.15, 36.20, 36.22, 36.25, 36.28, 36.31],
        '30D': [34.50, 34.80, 35.20, 35.60, 36.00, 36.31],
        '1Y': [22.00, 25.00, 28.00, 31.00, 34.00, 36.31],
        'ALL': [10.00, 15.00, 22.00, 28.00, 32.00, 36.31]
      }[activeTimeframe];

      return {
        labels,
        datasets: [
          {
            label: 'Total Supply',
            data: dataValues,
            borderColor: goldAccent,
            borderWidth: 2,
            fill: false,
            tension: 0.35,
            pointBackgroundColor: '#111111',
            pointBorderColor: goldAccent,
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointRadius: activeTimeframe === '30D' ? 2 : 4
          }
        ]
      };
    }

    if (activeTab === 'utilization') {
      const dataValues = {
        '7D': [76.50, 78.00, 77.20, 79.10, 78.40, 76.90, 78.40],
        '30D': [72.00, 75.50, 80.20, 77.40, 79.00, 78.40],
        '1Y': [68.00, 74.00, 82.00, 76.00, 80.00, 78.40],
        'ALL': [65.00, 72.00, 85.00, 78.00, 82.00, 78.40]
      }[activeTimeframe];

      return {
        labels,
        datasets: [
          {
            label: 'Capital Utilization',
            data: dataValues,
            borderColor: redColor,
            borderWidth: 2,
            fill: false,
            tension: 0.35,
            pointBackgroundColor: '#111111',
            pointBorderColor: redColor,
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointRadius: activeTimeframe === '30D' ? 2 : 4
          }
        ]
      };
    }

    // Fees Collected (Bar Chart)
    const dataValues = {
      '7D': [4200, 5100, 4800, 5900, 6100, 5800, 6250],
      '30D': [22500, 24800, 26000, 23900, 28100, 29400],
      '1Y': [1100000, 1180000, 1250000, 1310000, 1420000, 1487600],
      'ALL': [120400, 185200, 240800, 310500, 290100, 340600]
    }[activeTimeframe];

    const barThickness = activeTimeframe === '7D' ? 28 : activeTimeframe === '30D' ? 32 : 36;

    return {
      labels,
      datasets: [
        {
          label: 'Fees Collected',
          data: dataValues,
          backgroundColor: goldAccent,
          borderRadius: 4,
          borderWidth: 0,
          barThickness
        }
      ]
    };
  };

  const getActiveColor = () => {
    if (activeTab === 'price') return blueColor;
    if (activeTab === 'supply') return goldAccent;
    if (activeTab === 'utilization') return redColor;
    return goldAccent;
  };

  // Configure Chart.js options matching PortfolioMetrics style exactly
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
        bodyColor: getActiveColor(),
        bodyFont: {
          family: "'Source Code Pro', monospace",
          size: 11,
          weight: 'bold'
        },
        borderColor: getActiveColor(),
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
              if (activeTab === 'price') {
                label += `$${context.parsed.y.toFixed(4)}`;
              } else if (activeTab === 'supply') {
                label += `${context.parsed.y.toFixed(2)}M BLP`;
              } else if (activeTab === 'utilization') {
                label += `${context.parsed.y.toFixed(2)}%`;
              } else {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
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
          color: 'rgba(255, 255, 255, 0.015)',
          drawTicks: false
        },
        ticks: {
          color: '#888888',
          font: {
            family: "'Source Code Pro', monospace",
            size: 9
          },
          callback: (value) => {
            if (activeTab === 'price') return `$${value.toFixed(2)}`;
            if (activeTab === 'supply') return `${value}M`;
            if (activeTab === 'utilization') return `${value}%`;
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
            return `$${value}`;
          }
        }
      }
    }
  };

  const getTelemetryData = () => {
    switch (activeTab) {
      case 'price':
        return [
          { label: 'Current Price', value: '$1.2450', color: blueColor },
          { label: 'All-Time High', value: '$1.2680', color: themeText },
          { label: '6M Growth Rate', value: '+24.50%', color: blueColor },
          { label: 'Avg Monthly ROI', value: '4.08%', color: goldAccent }
        ];
      case 'supply':
        return [
          { label: 'Total Supply', value: '36.31M BLP', color: goldAccent },
          { label: 'Active Deposits', value: '2,845 users', color: themeText },
          { label: 'Total Minted', value: '42.10M BLP', color: themeText },
          { label: 'Total Burned', value: '5.79M BLP', color: redColor }
        ];
      case 'utilization':
        return [
          { label: 'Current Rate', value: '78.40%', color: redColor },
          { label: 'All-Time Peak', value: '88.50%', color: redColor },
          { label: 'Optimal Buffer', value: '15.00%', color: blueColor },
          { label: 'Unused Margin', value: '$9.79M', color: blueColor }
        ];
      case 'fees':
        return [
          { label: 'Total Vault Fees', value: '$1,487,600', color: goldAccent },
          { label: 'Collected by Me', value: '$4,250.80', color: blueColor },
          { label: 'My Pool Share', value: '0.285%', color: themeText },
          { label: 'Est. Monthly APY', value: '18.42%', color: goldAccent }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="panel" style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden', 
      minHeight: 0 
    }}>
      
      {/* Tab Selector Headers with Reduced Padding */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${themeBorder}`, flexShrink: 0 }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <div 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '6px 12px', // Reduced padding from '10px 16px'
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.01)' : 'transparent',
                borderBottom: `2px solid ${active ? goldAccent : 'transparent'}`,
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px'
              }}
            >
              <span style={{ fontSize: '9px', color: 'var(--text-grey, #888888)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                {tab.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  color: active ? goldAccent : 'var(--text-dark, #f5f5f5)', 
                  fontFamily: 'Source Code Pro',
                  transition: 'color 0.3s'
                }}>
                  {tab.value}
                </span>
                <span style={{ 
                  fontSize: '9px', 
                  color: active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)', 
                  fontFamily: 'Source Code Pro',
                  transition: 'color 0.3s' 
                }}>
                  {tab.sub}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* NEW SECTION: Horizontal Telemetry Stats Row with Reduced Padding */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px', // Reduced padding from '8px 20px'
        borderBottom: `1px solid ${themeBorder}`,
        flexShrink: 0,
        background: 'rgba(255, 255, 255, 0.01)',
        gap: '16px'
      }}>
        {/* Left Side: Telemetry Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {getTelemetryData().map((stat, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'Source Code Pro, monospace',
              fontSize: '11px'
            }}>
              <span style={{ color: themeTextMuted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}:</span>
              <span style={{ color: stat.color, fontWeight: 'bold' }}>{stat.value}</span>
              {idx < getTelemetryData().length - 1 && (
                <div style={{ width: '1px', height: '12px', background: themeBorder, marginLeft: '12px', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Right Side: Sleek Timeframe Selector buttons */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(255,255,255,0.02)',
          padding: '2px',
          borderRadius: '6px',
          border: `1px solid ${themeBorder}`,
          flexShrink: 0
        }}>
          {['7D', '30D', '1Y', 'ALL'].map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              style={{
                padding: '3px 8px',
                fontSize: '9px',
                fontFamily: 'Source Code Pro',
                fontWeight: 'bold',
                background: activeTimeframe === tf ? goldAccentLight : 'transparent',
                border: `1px solid ${activeTimeframe === tf ? goldAccent : 'transparent'}`,
                borderRadius: '4px',
                color: activeTimeframe === tf ? goldAccent : themeTextMuted,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Centered ChartJS Canvas with Reduced Padding */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'stretch', 
        justifyContent: 'center', 
        padding: '6px 12px 4px 12px', // Reduced padding from '16px 20px 10px 20px'
        minHeight: 0,
        overflow: 'hidden'
      }}>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {activeTab === 'fees' ? (
            <Bar data={getChartData()} options={options} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          ) : (
            <Line data={getChartData()} options={options} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          )}
        </div>
      </div>

    </div>
  );
}
