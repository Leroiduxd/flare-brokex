import React, { createContext, useContext, useState, useEffect } from 'react';

const PriceContext = createContext(null);

const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

export function PriceProvider({ children }) {
  const [selectedAssetKey, setSelectedAssetKeyRaw] = useState(() => {
    return localStorage.getItem('brokex_selected_asset') || 'GOLD';
  });

  const isXRP = selectedAssetKey === 'XRP';
  const selectedAssetSymbol = isXRP ? 'Crypto.XRP/USD' : 'Metal.XAU/USD';

  const [prices, setPrices] = useState({
    GOLD: 4046.52,
    XRP: 2.45
  });

  const currentMarkPrice = prices[selectedAssetKey] || (isXRP ? 2.45 : 4046.52);

  const setSelectedAssetKey = (key) => {
    setSelectedAssetKeyRaw(key);
    localStorage.setItem('brokex_selected_asset', key);
    window.dispatchEvent(new CustomEvent('brokex_asset_changed', {
      detail: {
        assetKey: key,
        symbol: key === 'XRP' ? 'Crypto.XRP/USD' : 'Metal.XAU/USD'
      }
    }));
  };

  // Listen to external asset change events
  useEffect(() => {
    const handleCustomChange = (e) => {
      if (e.detail && e.detail.assetKey) {
        setSelectedAssetKeyRaw(e.detail.assetKey);
        localStorage.setItem('brokex_selected_asset', e.detail.assetKey);
      }
    };
    window.addEventListener('brokex_asset_changed', handleCustomChange);
    return () => window.removeEventListener('brokex_asset_changed', handleCustomChange);
  }, []);

  // SIMULTANEOUS SSE CONNECTIONS FOR ALL ASSETS (GOLD & XRP)
  useEffect(() => {
    let goldEventSource = null;
    let xrpEventSource = null;
    let isMounted = true;

    const connectGold = () => {
      try {
        const url = `${apiBase}/v1/shims/tradingview/streaming?symbol=${encodeURIComponent('Metal.XAU/USD')}`;
        goldEventSource = new EventSource(url);

        goldEventSource.onmessage = (event) => {
          if (!event.data || !isMounted) return;
          try {
            const data = JSON.parse(event.data);
            const p = parseFloat(data.p || data.priceUSD || data.price || data.close || data.ask);
            if (!isNaN(p) && p > 0) {
              setPrices(prev => ({
                ...prev,
                GOLD: p
              }));
            }
          } catch (err) {}
        };

        goldEventSource.onerror = () => {
          if (goldEventSource) goldEventSource.close();
          if (isMounted) {
            setTimeout(connectGold, 5000);
          }
        };
      } catch (err) {}
    };

    const connectXRP = () => {
      try {
        const url = `${apiBase}/v1/shims/tradingview/streaming?symbol=${encodeURIComponent('Crypto.XRP/USD')}`;
        xrpEventSource = new EventSource(url);

        xrpEventSource.onmessage = (event) => {
          if (!event.data || !isMounted) return;
          try {
            const data = JSON.parse(event.data);
            const p = parseFloat(data.p || data.priceUSD || data.price || data.close || data.ask);
            if (!isNaN(p) && p > 0) {
              setPrices(prev => ({
                ...prev,
                XRP: p
              }));
            }
          } catch (err) {}
        };

        xrpEventSource.onerror = () => {
          if (xrpEventSource) xrpEventSource.close();
          if (isMounted) {
            setTimeout(connectXRP, 5000);
          }
        };
      } catch (err) {}
    };

    connectGold();
    connectXRP();

    return () => {
      isMounted = false;
      if (goldEventSource) goldEventSource.close();
      if (xrpEventSource) xrpEventSource.close();
    };
  }, []);

  const [high24hMap, setHigh24hMap] = useState({ GOLD: 0, XRP: 0 });
  const [low24hMap, setLow24hMap] = useState({ GOLD: 0, XRP: 0 });

  // Fetch 24h historical high/low directly from backend API for all assets
  useEffect(() => {
    let isMounted = true;
    const fetch24hMetricsForSymbol = async (assetKey, symbol) => {
      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const fromSec = nowSec - 86400;
        const params = new URLSearchParams({
          symbol,
          resolution: '15',
          from: fromSec.toString(),
          to: nowSec.toString()
        });

        let res = await fetch(`${apiBase}/api/chart/history?${params.toString()}`);
        if (!res.ok) {
          res = await fetch(`${apiBase}/v1/shims/tradingview/history?${params.toString()}`);
        }
        if (res.ok) {
          const json = await res.json();
          if (json && json.s === 'ok' && Array.isArray(json.h) && json.h.length > 0) {
            const highs = json.h.map(Number).filter(n => !isNaN(n) && n > 0);
            const lows = json.l.map(Number).filter(n => !isNaN(n) && n > 0);
            if (highs.length > 0 && lows.length > 0 && isMounted) {
              const maxH = Math.max(...highs);
              const minL = Math.min(...lows);
              setHigh24hMap(prev => ({ ...prev, [assetKey]: maxH }));
              setLow24hMap(prev => ({ ...prev, [assetKey]: minL }));
            }
          }
        }
      } catch (err) {}
    };

    fetch24hMetricsForSymbol('GOLD', 'Metal.XAU/USD');
    fetch24hMetricsForSymbol('XRP', 'Crypto.XRP/USD');

    const interval = setInterval(() => {
      fetch24hMetricsForSymbol('GOLD', 'Metal.XAU/USD');
      fetch24hMetricsForSymbol('XRP', 'Crypto.XRP/USD');
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Listen to 24h metrics from Chart.jsx if active
  useEffect(() => {
    const handle24hMetrics = (e) => {
      if (e.detail && e.detail.high24h > 0 && e.detail.low24h > 0) {
        const key = e.detail.symbol?.includes('XRP') ? 'XRP' : 'GOLD';
        setHigh24hMap(prev => ({ ...prev, [key]: e.detail.high24h }));
        setLow24hMap(prev => ({ ...prev, [key]: e.detail.low24h }));
      }
    };
    window.addEventListener('brokex_24h_metrics_updated', handle24hMetrics);
    return () => window.removeEventListener('brokex_24h_metrics_updated', handle24hMetrics);
  }, []);

  return (
    <PriceContext.Provider value={{
      selectedAssetKey,
      setSelectedAssetKey,
      currentMarkPrice,
      prices,
      high24hMap,
      low24hMap,
      isXRP,
      selectedAssetSymbol
    }}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePriceStream() {
  const context = useContext(PriceContext);
  if (!context) {
    return {
      selectedAssetKey: 'GOLD',
      setSelectedAssetKey: () => {},
      currentMarkPrice: 4046.52,
      prices: { GOLD: 4046.52, XRP: 2.45 },
      isXRP: false,
      selectedAssetSymbol: 'Metal.XAU/USD'
    };
  }
  return context;
}
