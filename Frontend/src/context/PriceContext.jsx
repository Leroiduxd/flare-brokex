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

  // SINGLE GLOBAL SSE CONNECTION FOR THE ENTIRE APP
  useEffect(() => {
    let eventSource = null;
    let isMounted = true;

    const connectSSE = () => {
      try {
        const url = `${apiBase}/v1/shims/tradingview/streaming?symbol=${encodeURIComponent(selectedAssetSymbol)}`;
        eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
          if (!event.data || !isMounted) return;
          try {
            const data = JSON.parse(event.data);
            const p = parseFloat(data.p || data.priceUSD || data.price || data.close || data.ask);
            if (!isNaN(p) && p > 0) {
              setPrices(prev => ({
                ...prev,
                [selectedAssetKey]: p
              }));
            }
          } catch (err) {}
        };

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
          if (isMounted) {
            setTimeout(connectSSE, 5000);
          }
        };
      } catch (err) {}
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedAssetSymbol, selectedAssetKey]);

  return (
    <PriceContext.Provider value={{
      selectedAssetKey,
      setSelectedAssetKey,
      currentMarkPrice,
      prices,
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
    throw new Error('usePriceStream must be used within a PriceProvider');
  }
  return context;
}
