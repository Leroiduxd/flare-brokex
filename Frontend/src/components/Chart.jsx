import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries } from 'lightweight-charts';

const RESOLUTION_MAP = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
  '1w': '1D',
};

const TIMEFRAME_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
};

const ONE_MONTH_SECONDS = 30 * 86400; // 30 days

export default function Chart({ symbol: initialSymbol = 'Metal.XAU/USD' }) {
  const [currentSymbol, setCurrentSymbol] = useState(() => {
    const savedAsset = localStorage.getItem('brokex_selected_asset');
    if (savedAsset === 'XRP') return 'Crypto.XRP/USD';
    return initialSymbol || 'Metal.XAU/USD';
  });

  const chartContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const seriesRef = useRef(null);
  const lastPriceRef = useRef(2300);
  const lastTimeRef = useRef(Math.floor(Date.now() / 1000));
  const activeCandleRef = useRef(null);

  const [activeTimeframe, setActiveTimeframe] = useState('15m');
  const [isCandleType, setIsCandleType] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const allDataRef = useRef([]);
  const earliestTimeRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

  // Listen to asset change event from TopNav toggle
  useEffect(() => {
    const handleAssetChange = (e) => {
      if (e.detail && e.detail.symbol) {
        setCurrentSymbol(e.detail.symbol);
      }
    };
    window.addEventListener('brokex_asset_changed', handleAssetChange);
    return () => window.removeEventListener('brokex_asset_changed', handleAssetChange);
  }, []);

  // Helper to fetch real UDF history from backend strictly via apiBase from .env
  const fetchUDFHistory = useCallback(async (sym, res, fromSec, toSec) => {
    let targetSymbol = sym || currentSymbol || 'Metal.XAU/USD';
    if (targetSymbol === 'Crypto.XAU/USD' || targetSymbol === 'XAU/USD') {
      targetSymbol = 'Metal.XAU/USD';
    } else if (targetSymbol === 'XRP/USD' || targetSymbol === 'XRP') {
      targetSymbol = 'Crypto.XRP/USD';
    }

    const params = new URLSearchParams({
      symbol: targetSymbol,
      resolution: res,
      from: fromSec.toString(),
      to: toSec.toString()
    });

    try {
      let response = await fetch(`${apiBase}/api/chart/history?${params.toString()}`);
      if (!response.ok) {
        response = await fetch(`${apiBase}/v1/shims/tradingview/history?${params.toString()}`);
      }
      if (response.ok) {
        const json = await response.json();
        if (json && json.s === 'ok' && Array.isArray(json.t) && json.t.length > 0) {
          const candles = [];
          for (let i = 0; i < json.t.length; i++) {
            candles.push({
              time: json.t[i],
              open: Number(json.o[i]),
              high: Number(json.h[i]),
              low: Number(json.l[i]),
              close: Number(json.c[i])
            });
          }
          return candles;
        }
      }
    } catch (err) {
      console.error("Chart fetchUDFHistory error:", err);
    }

    return [];
  }, [apiBase, currentSymbol]);

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

  // Update Series and Load Initial 1-Month Real Data
  useEffect(() => {
    if (!chartInstance) return;

    try {
      if (seriesRef.current) {
        chartInstance.removeSeries(seriesRef.current);
      }

      const isXRP = currentSymbol.includes('XRP');
      const priceFormatOptions = isXRP
        ? { type: 'price', precision: 4, minMove: 0.0001 }
        : { type: 'price', precision: 2, minMove: 0.01 };

      let series;
      if (isCandleType) {
        series = chartInstance.addSeries(CandlestickSeries, {
          upColor: '#3b82f6',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#3b82f6',
          wickDownColor: '#ef4444',
          priceFormat: priceFormatOptions,
        });
      } else {
        series = chartInstance.addSeries(AreaSeries, {
          lineColor: '#c8a97e',
          topColor: 'rgba(200, 169, 126, 0.2)',
          bottomColor: 'rgba(200, 169, 126, 0)',
          lineWidth: 2,
          priceFormat: priceFormatOptions,
        });
      }
      seriesRef.current = series;

      // Reset state for new timeframe / series
      allDataRef.current = [];
      earliestTimeRef.current = null;
      activeCandleRef.current = null;
      hasMoreRef.current = true;
      loadingMoreRef.current = false;
      setError(null);

      const resolution = RESOLUTION_MAP[activeTimeframe] || '15';
      const now = Math.floor(Date.now() / 1000);
      const oneMonthAgo = now - ONE_MONTH_SECONDS;

      const loadInitialMonth = async () => {
        const fetchedData = await fetchUDFHistory(currentSymbol, resolution, oneMonthAgo, now);

        if (fetchedData && fetchedData.length > 0) {
          // Deduplicate and sort ascending by time
          const uniqueMap = new Map();
          fetchedData.forEach(c => uniqueMap.set(c.time, c));
          const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);

          allDataRef.current = sorted;
          earliestTimeRef.current = sorted[0].time;
          
          const lastCandle = sorted[sorted.length - 1];
          activeCandleRef.current = { ...lastCandle };
          lastPriceRef.current = lastCandle.close;
          lastTimeRef.current = lastCandle.time;

          if (isCandleType) {
            series.setData(sorted);
          } else {
            series.setData(sorted.map(c => ({ time: c.time, value: c.close })));
          }
          chartInstance.timeScale().fitContent();
        } else {
          setError("No historical chart data available.");
        }
      };

      loadInitialMonth();

    } catch (err) {
      console.error("Series update error:", err);
      setError(err.message);
    }
  }, [chartInstance, isCandleType, activeTimeframe, currentSymbol, fetchUDFHistory]);

  // Infinite Scroll: Load Previous Month when Scrolling Left
  useEffect(() => {
    if (!chartInstance) return;

    const handleVisibleLogicalRangeChange = async (logicalRange) => {
      if (!logicalRange || loadingMoreRef.current || !hasMoreRef.current || !earliestTimeRef.current) {
        return;
      }

      // Trigger lazy loading when user scrolls within 15 bars of the earliest loaded data
      if (logicalRange.from < 15) {
        loadingMoreRef.current = true;
        setIsLoadingMore(true);

        const currentEarliest = earliestTimeRef.current;
        const toSec = currentEarliest - 1;
        const fromSec = toSec - ONE_MONTH_SECONDS; // Fetch previous 1 month
        const resolution = RESOLUTION_MAP[activeTimeframe] || '15';

        try {
          const olderData = await fetchUDFHistory(currentSymbol, resolution, fromSec, toSec);

          if (olderData && olderData.length > 0) {
            const merged = [...olderData, ...allDataRef.current];
            const uniqueMap = new Map();
            merged.forEach(c => uniqueMap.set(c.time, c));
            const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);

            allDataRef.current = sorted;
            earliestTimeRef.current = sorted[0].time;

            if (seriesRef.current) {
              if (isCandleType) {
                seriesRef.current.setData(sorted);
              } else {
                seriesRef.current.setData(sorted.map(c => ({ time: c.time, value: c.close })));
              }
            }
          } else {
            hasMoreRef.current = false;
          }
        } catch (err) {
          console.error("Infinite scroll historical load error:", err);
        } finally {
          loadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      }
    };

    const timeScale = chartInstance.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
    };
  }, [chartInstance, activeTimeframe, currentSymbol, isCandleType, fetchUDFHistory]);

  // Real-Time Price Streaming via EventSource (SSE) strictly using apiBase from .env
  useEffect(() => {
    if (!chartInstance) return;

    let eventSource = null;

    const connectSSE = () => {
      const targetUrl = `${apiBase}/v1/shims/tradingview/streaming?symbol=${encodeURIComponent(currentSymbol)}`;

      try {
        eventSource = new EventSource(targetUrl);

        eventSource.onmessage = (event) => {
          if (!event.data || !seriesRef.current) return;

          try {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.p || data.priceUSD || data.price || data.close || data.ask);
            const timestamp = parseInt(data.t || data.timestamp, 10);

            if (isNaN(price) || isNaN(timestamp)) return;

            const intervalSec = TIMEFRAME_SECONDS[activeTimeframe] || 900;
            const candleTime = Math.floor(timestamp / intervalSec) * intervalSec;

            let currentCandle = activeCandleRef.current;

            if (!currentCandle || candleTime > currentCandle.time) {
              currentCandle = {
                time: candleTime,
                open: price,
                high: price,
                low: price,
                close: price
              };
            } else if (candleTime === currentCandle.time) {
              currentCandle = {
                ...currentCandle,
                high: Math.max(currentCandle.high, price),
                low: Math.min(currentCandle.low, price),
                close: price
              };
            }

            activeCandleRef.current = currentCandle;

            if (isCandleType) {
              seriesRef.current.update(currentCandle);
            } else {
              seriesRef.current.update({
                time: currentCandle.time,
                value: price
              });
            }

            lastPriceRef.current = price;
            lastTimeRef.current = candleTime;
          } catch (err) {
            console.error("SSE parse error:", err);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
          }
          setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        console.error("Failed to initialize SSE EventSource:", err);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [chartInstance, activeTimeframe, isCandleType, apiBase, currentSymbol]);

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
    <div ref={chartWrapperRef} className="chart panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
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
              <path fill="currentColor" fillRule="evenodd" d="M3.25001 1c0 -0.414214 -0.33579 -0.75 -0.75 -0.75 -0.41422 0 -0.75 0.335786 -0.75 0.75v3.64999c-0.41363 0 -0.797166 0.14006 -1.078556 0.42145 -0.281389 0.28139 -0.421446 0.66493 -0.421446 1.07855v3c0 0.41363 0.140057 0.79717 0.421446 1.07851 0.28139 0.2814 0.664926 0.4215 1.078556 0.4215v2.5c0 0.4142 0.33578 0.75 0.75 0.75 0.41421 0 0.75 -0.3358 0.75 -0.75v-2.5c0.41362 0 0.79716 -0.1401 1.07855 -0.4215 0.28139 -0.28134 0.42145 -0.66488 0.42145 -1.07851v-3c0 -0.41362 -0.14006 -0.79716 -0.42145 -1.07855 -0.28139 -0.28139 -0.66493 -0.42145 -1.07855 -0.42145V1Zm4 18.75c-0.41363 0 -0.79717 -0.1401 -1.07856 -0.4215 -0.28139 -0.2813 -0.42144 -0.6649 -0.42144 -1.0785v-4.5c0 -0.4136 0.14005 -0.7972 0.42144 -1.0786s0.66493 -0.4214 1.07856 -0.4214V9.74999c0 -0.41421 0.33578 -0.75 0.75 -0.75 0.41421 0 0.75 0.33579 0.75 0.75V12.25c0.41362 0 0.79716 0.14 1.07855 0.4214 0.28144 0.2814 0.42144 0.665 0.4214 1.0786v4.5c0 0.4136 -0.14 0.7972 -0.42144 1.0785 -0.28139 0.2814 -0.66493 0.4215 -1.07855 0.4215V23c0 0.4142 -0.33579 0.75 -0.75 0.75 -0.41422 0 -0.75 -0.3358 -0.75 -0.75v-3.25Zm5.72149 -7.9786c0.2813 -0.2813 0.6649 -0.4214 1.0785 -0.4214h1.5c0.4136 0 0.7972 0.1401 1.0786 0.4214 0.2814 0.2814 0.4214 0.665 0.4214 1.0786v4c0 0.4136 -0.14 0.7972 -0.4214 1.0786 -0.2814 0.2813 -0.665 0.4214 -1.0786 0.4214v3.5c0 0.4142 -0.3358 0.75 -0.75 0.75s-0.75 -0.3358 -0.75 -0.75v-3.5c-0.4136 0 -0.7972 -0.1401 -1.0785 -0.4214 -0.2814 -0.2814 -0.4215 -0.665 -0.4215 -1.0786v-4c0 -0.4136 0.1401 -0.7972 0.4215 -1.0786Zm7.8547 -9.00155c-0.1425 -0.17099 -0.3536 -0.26986 -0.5762 -0.26986 -0.2226 0 -0.4337 0.09887 -0.5762 0.26986l-3 3.60001c-0.1863 0.22356 -0.2264 0.53472 -0.103 0.79826 0.1234 0.26353 0.3882 0.43188 0.6792 0.43188h2v11.25c0 0.5523 0.4477 1 1 1s1 -0.4477 1 -1V7.6h2c0.291 0 0.5557 -0.16835 0.6792 -0.43188 0.1234 -0.26354 0.0833 -0.5747 -0.103 -0.79826l-3 -3.60001Z" clipRule="evenodd" strokeWidth="1" />
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
