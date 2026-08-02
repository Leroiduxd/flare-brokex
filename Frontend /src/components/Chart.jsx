import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries } from 'lightweight-charts';

export default function Chart() {
  const chartContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const seriesRef = useRef(null);
  const lastPriceRef = useRef(2300);
  const lastTimeRef = useRef(Math.floor(Date.now() / 1000));

  const [activeTimeframe, setActiveTimeframe] = useState('15m');
  const [isCandleType, setIsCandleType] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(null);

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#888',
          fontSize: 10,
          fontFamily: "'Source Code Pro', monospace",
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.02)' },
          horzLines: { color: 'rgba(255,255,255,0.02)' },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: '#c8a97e', width: 1, labelBackgroundColor: '#c8a97e' },
          horzLine: { color: '#c8a97e', width: 1, labelBackgroundColor: '#c8a97e' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.05)',
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.05)',
          timeVisible: true,
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });

      setChartInstance(chart);

      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0] && chart) {
          const { width, height } = entries[0].contentRect;
          chart.applyOptions({ width, height });
        }
      });

      resizeObserver.observe(chartContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
      };
    } catch (err) {
      console.error("Chart init error:", err);
      setError(err.message);
    }
  }, []);

  // Update Series and Data
  useEffect(() => {
    if (!chartInstance) return;

    try {
      if (seriesRef.current) {
        chartInstance.removeSeries(seriesRef.current);
      }

      let series;
      if (isCandleType) {
        series = chartInstance.addSeries(CandlestickSeries, {
          upColor: '#3b82f6',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#3b82f6',
          wickDownColor: '#ef4444',
        });
      } else {
        series = chartInstance.addSeries(AreaSeries, {
          lineColor: '#c8a97e',
          topColor: 'rgba(200, 169, 126, 0.2)',
          bottomColor: 'rgba(200, 169, 126, 0)',
          lineWidth: 2,
        });
      }
      seriesRef.current = series;

      // Initial historical data
      const data = [];
      let price = 2300;
      const interval = 60;
      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 200; i++) {
        const time = now - (200 - i) * interval;
        const open = price;
        const close = price + (Math.random() - 0.5) * 10;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;

        if (isCandleType) {
          data.push({ time, open, high, low, close });
        } else {
          data.push({ time, value: close });
        }
        price = close;
      }

      series.setData(data);
      lastPriceRef.current = price;
      lastTimeRef.current = now;
      chartInstance.timeScale().fitContent();
    } catch (err) {
      console.error("Series update error:", err);
      setError(err.message);
    }
  }, [chartInstance, isCandleType]);

  // Live updates
  useEffect(() => {
    if (!chartInstance || !seriesRef.current) return;

    const timer = setInterval(() => {
      if (!seriesRef.current) return;

      const change = (Math.random() - 0.5) * 4;
      const newPrice = lastPriceRef.current + change;

      if (isCandleType) {
        seriesRef.current.update({
          time: lastTimeRef.current,
          open: lastPriceRef.current,
          high: Math.max(lastPriceRef.current, newPrice) + 0.5,
          low: Math.min(lastPriceRef.current, newPrice) - 0.5,
          close: newPrice
        });
      } else {
        seriesRef.current.update({
          time: lastTimeRef.current,
          value: newPrice
        });
      }
      lastPriceRef.current = newPrice;
    }, 1000);

    return () => clearInterval(timer);
  }, [chartInstance, isCandleType]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={chartWrapperRef} className="chart panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div className="chart-toolbar" style={{ display: 'flex', padding: '6px 8px', gap: '8px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              style={{
                background: activeTimeframe === tf ? 'rgba(200, 169, 126, 0.1)' : 'transparent',
                color: activeTimeframe === tf ? 'var(--gold)' : 'var(--text-grey)',
                border: 'none',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: activeTimeframe === tf ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '12px', background: 'var(--border-color)', margin: '0 4px' }} />

        {/* Type Toggle */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setIsCandleType(true)}
            className={`chart-action-btn ${isCandleType ? 'active' : ''}`}
            title="Chandelier Japonais"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" id="Trading-Pattern-Up--Streamline-Ultimate">
              <path fill="currentColor" fillRule="evenodd" d="M3.25001 1c0 -0.414214 -0.33579 -0.75 -0.75 -0.75 -0.41422 0 -0.75 0.335786 -0.75 0.75v3.64999c-0.41363 0 -0.797166 0.14006 -1.078556 0.42145 -0.281389 0.28139 -0.421446 0.66493 -0.421446 1.07855v3c0 0.41363 0.140057 0.79717 0.421446 1.07851 0.28139 0.2814 0.664926 0.4215 1.078556 0.4215v2.5c0 0.4142 0.33578 0.75 0.75 0.75 0.41421 0 0.75 -0.3358 0.75 -0.75v-2.5c0.41362 0 0.79716 -0.1401 1.07855 -0.4215 0.28139 -0.28134 0.42145 -0.66488 0.42145 -1.07851v-3c0 -0.41362 -0.14006 -0.79716 -0.42145 -1.07855 -0.28139 -0.28139 -0.66493 -0.42145 -1.07855 -0.42145V1Zm4 18.75c-0.41363 0 -0.79717 -0.1401 -1.07856 -0.4215 -0.28139 -0.2813 -0.42144 -0.6649 -0.42144 -1.0785v-4.5c0 -0.4136 0.14005 -0.7972 0.42144 -1.0786s0.66493 -0.4214 1.07856 -0.4214V9.74999c0 -0.41421 0.33578 -0.75 0.75 -0.75 0.41421 0 0.75 0.33579 0.75 0.75V12.25c0.41362 0 0.79716 0.14 1.07855 0.4214 0.28144 0.2814 0.42144 0.665 0.42144 1.0786v4.5c0 0.4136 -0.14 0.7972 -0.42144 1.0785 -0.28139 0.2814 -0.66493 0.4215 -1.07855 0.4215V23c0 0.4142 -0.33579 0.75 -0.75 0.75 -0.41422 0 -0.75 -0.3358 -0.75 -0.75v-3.25Zm5.72149 -7.9786c0.2813 -0.2813 0.6649 -0.4214 1.0785 -0.4214h1.5c0.4136 0 0.7972 0.1401 1.0786 0.4214 0.2814 0.2814 0.4214 0.665 0.4214 1.0786v4c0 0.4136 -0.14 0.7972 -0.4214 1.0786 -0.2814 0.2813 -0.665 0.4214 -1.0786 0.4214v3.5c0 0.4142 -0.3358 0.75 -0.75 0.75s-0.75 -0.3358 -0.75 -0.75v-3.5c-0.4136 0 -0.7972 -0.1401 -1.0785 -0.4214 -0.2814 -0.2814 -0.4215 -0.665 -0.4215 -1.0786v-4c0 -0.4136 0.1401 -0.7972 0.4215 -1.0786Zm7.8547 -9.00155c-0.1425 -0.17099 -0.3536 -0.26986 -0.5762 -0.26986 -0.2226 0 -0.4337 0.09887 -0.5762 0.26986l-3 3.60001c-0.1863 0.22356 -0.2264 0.53472 -0.103 0.79826 0.1234 0.26353 0.3882 0.43188 0.6792 0.43188h2v11.25c0 0.5523 0.4477 1 1 1s1 -0.4477 1 -1V7.6h2c0.291 0 0.5557 -0.16835 0.6792 -0.43188 0.1234 -0.26354 0.0833 -0.5747 -0.103 -0.79826l-3 -3.60001Z" clipRule="evenodd" strokeWidth="1" />
            </svg>
          </button>
          <button
            onClick={() => setIsCandleType(false)}
            className={`chart-action-btn ${!isCandleType ? 'active' : ''}`}
            title="Graphique en Ligne"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <path fill="currentColor" fillRule="evenodd" d="M1.25 18a.75.75 0 0 1 .75-.75h20a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75Zm3.47-5.53a.75.75 0 0 1 0-1.06l5.5-5.5a.75.75 0 0 1 1.06 0l4.5 4.5 4.97-4.97a.75.75 0 1 1 1.06 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-4.5-4.5-4.97 4.97a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-grey)',
            padding: '4px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s'
          }}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          )}
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {error ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            {error}
          </div>
        ) : (
          <div ref={chartContainerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        )}
      </div>
    </div>
  );
}
