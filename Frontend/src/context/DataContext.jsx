import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DataContext = createContext(null);

const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

export function DataProvider({ children }) {
  const [snapshotData, setSnapshotData] = useState(null);
  const [riskParams, setRiskParams] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [priceDifferences, setPriceDifferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Single centralized poll function for all core platform APIs
  const fetchGlobalData = useCallback(async () => {
    try {
      const [snapRes, riskRes, volRes, diffRes] = await Promise.allSettled([
        fetch(`${apiBase}/api/snapshot`),
        fetch(`${apiBase}/api/risk-params`),
        fetch(`${apiBase}/api/volume`),
        fetch(`${apiBase}/api/price-differences`)
      ]);

      if (snapRes.status === 'fulfilled' && snapRes.value.ok) {
        const data = await snapRes.value.json();
        setSnapshotData(data);
      }

      if (riskRes.status === 'fulfilled' && riskRes.value.ok) {
        const data = await riskRes.value.json();
        setRiskParams(data);
      }

      if (volRes.status === 'fulfilled' && volRes.value.ok) {
        const data = await volRes.value.json();
        setVolumeData(data);
      }

      if (diffRes.status === 'fulfilled' && diffRes.value.ok) {
        const data = await diffRes.value.json();
        setPriceDifferences(data);
      }
    } catch (err) {
      console.warn("Global DataContext fetch warning:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 8000);
    return () => clearInterval(interval);
  }, [fetchGlobalData]);

  // Helper to extract risk params for a given asset (GOLD or XRP)
  const getAssetRiskParams = useCallback((assetKey = 'GOLD') => {
    if (!riskParams) {
      return { spreadLongBps: 30, spreadShortBps: 30, spreadLong: 300, spreadShort: 300 };
    }
    const item = riskParams[assetKey] || (typeof riskParams === 'object' ? Object.values(riskParams)[0] : null) || riskParams;
    if (item) {
      const sL = item.spreadLongBps !== undefined ? Number(item.spreadLongBps) : (item.spreadLong !== undefined ? Number(item.spreadLong) / 10 : 30);
      const sS = item.spreadShortBps !== undefined ? Number(item.spreadShortBps) : (item.spreadShort !== undefined ? Number(item.spreadShort) / 10 : 30);
      return {
        ...item,
        spreadLongBps: sL,
        spreadShortBps: sS,
        spreadLong: item.spreadLong !== undefined ? item.spreadLong : sL * 10,
        spreadShort: item.spreadShort !== undefined ? item.spreadShort : sS * 10
      };
    }
    return { spreadLongBps: 30, spreadShortBps: 30, spreadLong: 300, spreadShort: 300 };
  }, [riskParams]);

  // Helper to extract snapshot info for a given asset (GOLD or XRP)
  const getAssetSnapshot = useCallback((assetKey = 'GOLD') => {
    if (!snapshotData || !snapshotData.assets) return null;
    const badge = assetKey === 'XRP' ? 'XRP' : 'XAU';
    return snapshotData.assets[assetKey] || snapshotData.assets[badge] || Object.values(snapshotData.assets)[0] || null;
  }, [snapshotData]);

  return (
    <DataContext.Provider value={{
      snapshotData,
      riskParams,
      volumeData,
      priceDifferences,
      isLoading,
      refetchGlobalData: fetchGlobalData,
      getAssetRiskParams,
      getAssetSnapshot
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useGlobalData() {
  const context = useContext(DataContext);
  if (!context) {
    return {
      snapshotData: null,
      riskParams: null,
      volumeData: null,
      priceDifferences: null,
      isLoading: false,
      refetchGlobalData: () => {},
      getAssetRiskParams: () => ({ spreadLongBps: 30, spreadShortBps: 30, spreadLong: 300, spreadShort: 300 }),
      getAssetSnapshot: () => null
    };
  }
  return context;
}
