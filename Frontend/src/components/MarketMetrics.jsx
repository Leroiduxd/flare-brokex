import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function MarketMetrics() {
  const goldAccent = '#BC8961';
  const blueColor = '#3b82f6';
  const redColor = '#ef4444';

  // Historical volume distribution
  const volumeByAsset = {
    labels: ['XAU/USD', 'BTC/USDC', 'ETH/USDC', 'SOL/USDC'],
    values: [185800, 123868, 61934, 41290],
    percentages: ['45%', '30%', '15%', '10%']
  };

  const chartData = {
    labels: volumeByAsset.labels,
    datasets: [
      {
        data: volumeByAsset.values,
        backgroundColor: [
          '#BC8961', // Gold
          '#3b82f6', // Blue
          'rgba(188, 137, 97, 0.5)', // Muted Gold
          'rgba(59, 130, 246, 0.4)', // Muted Blue
        ],
        borderWidth: 1,
        borderColor: '#0f0f0f',
        hoverOffset: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0a0a0a',
        titleColor: '#fff',
        titleFont: { family: "'Source Code Pro', monospace", size: 10 },
        bodyColor: goldAccent,
        bodyFont: { family: "'Source Code Pro', monospace", size: 10, weight: 'bold' },
        borderColor: goldAccent,
        borderWidth: 1,
        padding: 8,
        displayColors: true,
        boxWidth: 8,
        callbacks: {
          label: (context) => {
            const val = context.raw;
            return ` Volume: $${new Intl.NumberFormat('en-US').format(val)}`;
          }
        }
      },
    },
    cutout: '76%',
  };

  return (
    <div className="panel" style={{ 
      width: '320px', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative', 
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* Subtle grid pattern background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.01) 1px, transparent 0)',
        backgroundSize: '16px 16px',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '8px 12px', 
        borderBottom: '1px solid var(--border-color)',
        zIndex: 1
      }}>
        <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.12em', color: goldAccent, fontFamily: 'Source Code Pro' }}>
          [ ACCOUNT METRICS ]
        </span>
        <span style={{ fontSize: '8px', color: 'var(--text-grey)', fontFamily: 'Source Code Pro', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
          LIVE FEED
        </span>
      </div>

      {/* Scrollable Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1 }} className="custom-scrollbar">
        
        {/* Camembert (Doughnut) Chart Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em', color: 'var(--text-grey)', textTransform: 'uppercase' }}>
            Volume Distribution
          </span>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '4px 0' }}>
            <div style={{ position: 'relative', width: '150px', height: '150px' }}>
              <Doughnut data={chartData} options={chartOptions} />
              {/* Center Text inside Donut */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vol Total</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', fontFamily: 'Source Code Pro' }}>$412.8k</span>
              </div>
            </div>
          </div>

          {/* Custom List Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            {volumeByAsset.labels.map((lbl, idx) => {
              const colors = ['#BC8961', '#3b82f6', 'rgba(188, 137, 97, 0.6)', 'rgba(59, 130, 246, 0.5)'];
              return (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: colors[idx] }} />
                    <span style={{ fontSize: '9px', fontFamily: 'Source Code Pro', color: 'var(--text-grey)' }}>{lbl}</span>
                  </div>
                  <span style={{ fontSize: '9px', fontFamily: 'Source Code Pro', color: '#fff', fontWeight: 'bold' }}>{volumeByAsset.percentages[idx]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.03), transparent)' }} />

        {/* Performance Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em', color: 'var(--text-grey)', textTransform: 'uppercase' }}>
            Performance Overview
          </span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: 'All-Time PnL', value: '+$3,479.23', color: blueColor },
              { label: 'Total Volume', value: '$412,892.00', color: goldAccent },
              { label: 'Win/Loss Ratio', value: '1.69 (22W - 13L)', color: '#fff' },
              { label: 'Total Fees Paid', value: '$247.74', color: redColor },
              { label: 'All-Time Orders', value: '35', color: '#fff' },
              { label: 'Win Rate', value: '62.8%', color: blueColor }
            ].map((stat, i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '6px 0', 
                  borderBottom: '1px solid rgba(255,255,255,0.02)' 
                }}
              >
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
                  {stat.label}
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  color: stat.color, 
                  fontFamily: 'Source Code Pro' 
                }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.03), transparent)' }} />

        {/* Lifecycle & Triggers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em', color: 'var(--text-grey)', textTransform: 'uppercase' }}>
            Lifecycle & Triggers
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: 'Open Positions', value: '2 Active', color: blueColor },
              { label: 'Take Profits Triggered', value: '14 times', color: blueColor },
              { label: 'Stop Losses Triggered', value: '9 times', color: redColor },
              { label: 'Positions Liquidated', value: '0 Clean', color: 'var(--text-grey)' }
            ].map((trigger, i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '6px 0', 
                  borderBottom: '1px solid rgba(255,255,255,0.02)' 
                }}
              >
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
                  {trigger.label}
                </span>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  color: trigger.color, 
                  fontFamily: 'Source Code Pro' 
                }}>
                  {trigger.value}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
