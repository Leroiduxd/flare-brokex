import React, { useState, useEffect } from 'react';
import { usePriceStream } from '../context/PriceContext';
import { useGlobalData } from '../context/DataContext';

function formatCompactUSD(val) {
  const num = Number(val || 0);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const ASSET_CONFIGS = {
  GOLD: {
    key: 'GOLD',
    symbol: 'XAU/USD',
    chartSymbol: 'Metal.XAU/USD',
    name: 'Gold / US Dollar',
    badge: 'XAU',
    badgeBg: '#BC8961',
    badgeColor: '#000',
    defaultPrice: '4,046.52',
    category: 'COMMODITY'
  },
  XRP: {
    key: 'XRP',
    symbol: 'XRP/USD',
    chartSymbol: 'Crypto.XRP/USD',
    name: 'XRP / US Dollar',
    badge: 'XRP',
    badgeBg: '#BC8961',
    badgeColor: '#000',
    defaultPrice: '2.4500',
    category: 'CRYPTO'
  }
};

const getAssetVolume24h = (volData, assetKey) => {
  if (!volData || !volData.v24h) return 0;
  const v24h = volData.v24h;

  if (v24h.byAsset && v24h.byAsset[assetKey]) {
    const item = v24h.byAsset[assetKey];
    const val = typeof item === 'object' ? (item.totalVolume || item.volume || 0) : item;
    return Number(val || 0);
  }

  if (v24h[assetKey] !== undefined) {
    const item = v24h[assetKey];
    const val = typeof item === 'object' ? (item.totalVolume || item.volume || 0) : item;
    return Number(val || 0);
  }

  return Number(v24h.totalVolume || 0);
};

export default function TopNav() {
  const [selectedAssetKey, setSelectedAssetKey] = useState(() => {
    return localStorage.getItem('brokex_selected_asset') || 'GOLD';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeAsset = ASSET_CONFIGS[selectedAssetKey] || ASSET_CONFIGS.GOLD;

  const [livePrice, setLivePrice] = useState(activeAsset.defaultPrice);
  const [priceChange, setPriceChange] = useState('+0.12%');
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [snapshotData, setSnapshotData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [teeSpreads, setTeeSpreads] = useState({ spreadLongBps: 30, spreadShortBps: 30 });

  // Rich metrics per asset for dropdown list display
  const [assetMetrics, setAssetMetrics] = useState({
    GOLD: { price: '4,046.52', change: '+0.12%', isUp: true, vol: '$0' },
    XRP: { price: '2.4500', change: '+0.00%', isUp: true, vol: '$0' }
  });

  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

  // Handle asset switch
  const handleSelectAsset = (key) => {
    setSelectedAssetKey(key);
    localStorage.setItem('brokex_selected_asset', key);
    setIsDropdownOpen(false);
    setHigh24h(0);
    setLow24h(0);
    const initialPrice = assetMetrics[key]?.price || ASSET_CONFIGS[key].defaultPrice;
    setLivePrice(initialPrice);
    setPriceChange(assetMetrics[key]?.change || '+0.00%');
    window.dispatchEvent(new CustomEvent('brokex_asset_changed', { detail: { assetKey: key, symbol: ASSET_CONFIGS[key].chartSymbol } }));
  };

  // Listen to external asset changes and 24h metrics from Chart.jsx
  useEffect(() => {
    const handleCustomChange = (e) => {
      if (e.detail && e.detail.assetKey && ASSET_CONFIGS[e.detail.assetKey]) {
        setSelectedAssetKey(e.detail.assetKey);
        setHigh24h(0);
        setLow24h(0);
      }
    };

    const handle24hMetrics = (e) => {
      if (e.detail && e.detail.high24h !== undefined && e.detail.low24h !== undefined) {
        setHigh24h(e.detail.high24h);
        setLow24h(e.detail.low24h);
      }
    };

    window.addEventListener('brokex_asset_changed', handleCustomChange);
    window.addEventListener('brokex_24h_metrics_updated', handle24hMetrics);
    return () => {
      window.removeEventListener('brokex_asset_changed', handleCustomChange);
      window.removeEventListener('brokex_24h_metrics_updated', handle24hMetrics);
    };
  }, []);

  const { snapshotData: globalSnapshot, volumeData: globalVolume, priceDifferences: globalDiffs, getAssetRiskParams } = useGlobalData();

  // Sync TEE risk parameters for dynamic spread calculation from DataContext
  useEffect(() => {
    const p = getAssetRiskParams(selectedAssetKey);
    if (p) {
      const sL = p.spreadLongBps !== undefined ? Number(p.spreadLongBps) : 30;
      const sS = p.spreadShortBps !== undefined ? Number(p.spreadShortBps) : 30;
      setTeeSpreads({ spreadLongBps: sL, spreadShortBps: sS });
    }
  }, [selectedAssetKey, getAssetRiskParams]);

  // Sync real-time snapshot, volume, and price differences from DataContext
  useEffect(() => {
    if (globalSnapshot) setSnapshotData(globalSnapshot);
    if (globalVolume) setVolumeData(globalVolume);

    setAssetMetrics(prev => {
      const next = { ...prev };
      const diffArray = Array.isArray(globalDiffs) ? globalDiffs : (globalDiffs?.data || []);

      ['GOLD', 'XRP'].forEach(key => {
        const currentItem = next[key] || {};

        const rawVol = getAssetVolume24h(globalVolume, key);
        const volFormatted = formatCompactUSD(rawVol);

        const diffItem = diffArray.find(d => (d.alias || d.symbol || '').toUpperCase() === key);
        let changeStr = currentItem.change || '+0.00%';
        let isUp = currentItem.isUp ?? true;

        if (diffItem) {
          const diffNum = parseFloat(diffItem.day_price_diff_decimal || diffItem.hour_price_diff_decimal || 0) * 100;
          isUp = diffNum >= 0;
          changeStr = `${isUp ? '+' : ''}${diffNum.toFixed(2)}%`;
        }

        const astData = globalSnapshot?.assets?.[key] || null;
        const astSnap = astData?.snapshot || astData || null;
        let priceStr = currentItem.price || ASSET_CONFIGS[key].defaultPrice;
        if (astSnap?.lastKnownPrice) {
          const numP = Number(astSnap.lastKnownPrice) > 100000 ? Number(astSnap.lastKnownPrice) / 1e6 : Number(astSnap.lastKnownPrice);
          if (numP > 0) {
            const dec = key === 'XRP' ? 4 : 2;
            priceStr = numP.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
          }
        }

        next[key] = {
          price: priceStr,
          change: changeStr,
          isUp,
          vol: volFormatted
        };
      });

      return next;
    });
  }, [globalSnapshot, globalVolume, globalDiffs]);

  const { currentMarkPrice: liveMarkPrice, prices: livePrices } = usePriceStream();

  useEffect(() => {
    if (livePrices) {
      setAssetMetrics(prev => {
        const next = { ...prev };
        if (livePrices.GOLD && livePrices.GOLD > 0) {
          next.GOLD = {
            ...(next.GOLD || {}),
            price: livePrices.GOLD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          };
        }
        if (livePrices.XRP && livePrices.XRP > 0) {
          next.XRP = {
            ...(next.XRP || {}),
            price: livePrices.XRP.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
          };
        }
        return next;
      });
    }
  }, [livePrices]);

  useEffect(() => {
    if (liveMarkPrice > 0) {
      const decimals = selectedAssetKey === 'XRP' ? 4 : 2;
      const formattedPrice = liveMarkPrice.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      setLivePrice(formattedPrice);
    }
  }, [liveMarkPrice, selectedAssetKey]);

  // Compute stats dynamically from snapshot and volume API data
  const currentAssetData = snapshotData?.assets?.[selectedAssetKey] || snapshotData?.assets?.[activeAsset.badge] || null;
  const assetSnap = currentAssetData?.snapshot || currentAssetData || null;
  const snapConfig = assetSnap?.config || {};

  // Borrow Fee (% / h)
  const rawBorrowFee = Number(snapConfig.borrowRateHourly || 0);
  const borrowFeePct = (rawBorrowFee / 10000).toFixed(4);

  // Open Interest
  const oiLongRaw = Number(assetSnap?.openInterestLong || 0) / 1e6;
  const oiShortRaw = Number(assetSnap?.openInterestShort || 0) / 1e6;
  const oiTotalRaw = (assetSnap?.totalOpenInterest ? Number(assetSnap.totalOpenInterest) : (oiLongRaw + oiShortRaw) * 1e6) / 1e6;
  const maxOiRaw = Number(snapConfig.maxGlobalOI || 0) / 1e6;

  // Long / Short Ratio
  const totalOiForRatio = oiLongRaw + oiShortRaw;
  const longRatio = totalOiForRatio > 0 ? Math.round((oiLongRaw / totalOiForRatio) * 100) : 50;
  const shortRatio = 100 - longRatio;

  // 24h Volume for currently selected asset
  const vol24hRaw = getAssetVolume24h(volumeData, selectedAssetKey);

  // Dynamic Spread Calculation (spreadLongBps + spreadShortBps) * WSS Live Price
  const numericLivePrice = parseFloat((livePrice || activeAsset.defaultPrice).replace(/,/g, '')) || 0;
  const totalSpreadBps = (teeSpreads.spreadLongBps || 30) + (teeSpreads.spreadShortBps || 30);
  const spreadUSDVal = (totalSpreadBps / 100000) * numericLivePrice;
  const spreadDecimals = selectedAssetKey === 'XRP' ? 4 : 2;
  const spreadDisplayStr = `$${spreadUSDVal.toFixed(spreadDecimals)}`;

  return (
    <div className="nav panel" style={{ overflow: 'visible' }}>
      <div className="nav-stats-container" style={{ display: 'flex', width: '100%', overflow: 'visible', gap: '0', paddingRight: '0' }}>
        {/* FIXED LEFT SIDE: Ticker Selector Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '15px', padding: '0 15px 0 0', position: 'relative' }}>
          <div 
            className="ticker-selector" 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{ 
              flexShrink: 0, 
              paddingRight: '13px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              userSelect: 'none'
            }}
          >
            <div 
              className="ticker-logo" 
              style={{ 
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: activeAsset.badgeBg, // Gold #BC8961
                color: activeAsset.badgeColor, // Black #000
                fontWeight: 'bold', 
                fontSize: '10.5px', 
                fontFamily: 'Source Code Pro, monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              [{activeAsset.badge}]
            </div>
            <div className="ticker-info">
              <span className="ticker-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {activeAsset.symbol}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M1 1L5 5L9 1" stroke="var(--text-grey)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="ticker-label" style={{ fontSize: '10px', color: 'var(--text-grey)', fontWeight: 'normal' }}>{activeAsset.name}</span>
            </div>
          </div>

          {/* Toggle Dropdown Menu with Rich Asset Details */}
          {isDropdownOpen && (
            <div 
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                backgroundColor: 'var(--bg-subtle, #14171A)',
                border: '1px solid var(--border-color, #26292E)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                zIndex: 9999,
                minWidth: '340px',
                overflow: 'hidden',
                padding: '6px'
              }}
            >
              <div style={{ padding: '4px 8px 8px 8px', fontSize: '9.5px', fontWeight: 'bold', color: 'var(--text-grey, #888)', fontFamily: 'Source Code Pro, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color, #26292E)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>ASSET / MARKET</span>
                <span>PRICE / 24H</span>
              </div>
              {Object.values(ASSET_CONFIGS).map((asset) => {
                const isSelected = asset.key === selectedAssetKey;
                const metrics = assetMetrics[asset.key] || { price: asset.defaultPrice, change: '+0.00%', isUp: true, vol: '$0' };

                return (
                  <div
                    key={asset.key}
                    onClick={() => handleSelectAsset(asset.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(188, 137, 97, 0.15)' : 'transparent',
                      border: isSelected ? '1px solid rgba(188, 137, 97, 0.3)' : '1px solid transparent',
                      transition: 'all 0.2s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Left: Square Gold Badge + Asset Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px', 
                        background: asset.badgeBg, // Gold #BC8961
                        color: asset.badgeColor, // Black #000
                        fontWeight: 'bold', 
                        fontSize: '10px', 
                        fontFamily: 'Source Code Pro, monospace', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        [{asset.badge}]
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: isSelected ? 'bold' : '600', color: 'var(--text-dark, #FFF)' }}>{asset.symbol}</span>
                          <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-grey, #888)', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
                            {asset.category}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-grey, #888)' }}>{asset.name}</span>
                      </div>
                    </div>

                    {/* Right: Price + 24h Variation & Vol */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark, #FFF)' }}>
                        ${metrics.price}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9.5px', fontFamily: 'Source Code Pro, monospace' }}>
                        <span style={{ color: metrics.isUp ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>
                          {metrics.change}
                        </span>
                        {metrics.vol && metrics.vol !== '$0' && (
                          <span style={{ color: 'var(--text-grey, #888)', fontSize: '9px' }}>
                            Vol: {metrics.vol}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0 }}></div>
        </div>

        {/* SCROLLABLE RIGHT SIDE: Stats Items */}
        <div className="scrollable-stats" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          overflowX: 'auto',
          flexGrow: 1,
          padding: '0 20px 0 5px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          <style>{`
            .scrollable-stats::-webkit-scrollbar {
              display: none;
            }
            .scrollable-stats > * {
              flex-shrink: 0;
            }
          `}</style>

          {/* Live Price Section */}
          <div className="stat-item">
            <span className="stat-label">Price</span>
            <span className="stat-value" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
              ${livePrice}
            </span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Live Variation Section */}
          <div className="stat-item">
            <span className="stat-label">Variation</span>
            <span className={`stat-value ${priceChange.startsWith('+') ? 'up' : 'down'}`} style={{ fontFamily: 'Source Code Pro, monospace' }}>
              {priceChange}
            </span>
          </div>

          {/* Spread Section */}
          <div className="stat-item">
            <span className="stat-label">Spread</span>
            <span className="stat-value" style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>{spreadDisplayStr}</span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Borrow Fee Section */}
          <div className="stat-item">
            <span className="stat-label">Borrow Fee</span>
            <span className="stat-value" style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>{borrowFeePct}%/h</span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Open Interest & Ratio Group */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="stat-item">
              <span className="stat-label">Open Interest</span>
              <span className="stat-value" style={{ fontFamily: 'Source Code Pro, monospace' }}>
                {formatCompactUSD(oiTotalRaw)} / {formatCompactUSD(maxOiRaw)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Long/Short Ratio</span>
              <span className="stat-value" style={{ fontFamily: 'Source Code Pro, monospace' }}>
                <span style={{ color: '#3b82f6' }}>{longRatio}%</span>
                <span style={{ color: 'var(--text-grey)', margin: '0 4px' }}>/</span>
                <span style={{ color: '#ef4444' }}>{shortRatio}%</span>
              </span>
            </div>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* 24h Volume Section */}
          <div className="stat-item">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value" style={{ fontFamily: 'Source Code Pro, monospace' }}>
              {formatCompactUSD(vol24hRaw)}
            </span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* 24h High & Low Group (Right Aligned, No Separator Between Them) */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="stat-item">
              <span className="stat-label">24h High</span>
              <span className="stat-value" style={{ color: '#3b82f6', fontFamily: 'Source Code Pro, monospace' }}>
                {high24h > 0 ? `$${high24h.toLocaleString('en-US', { minimumFractionDigits: selectedAssetKey === 'XRP' ? 4 : 2, maximumFractionDigits: selectedAssetKey === 'XRP' ? 4 : 2 })}` : '—'}
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-label">24h Low</span>
              <span className="stat-value" style={{ color: '#ef4444', fontFamily: 'Source Code Pro, monospace' }}>
                {low24h > 0 && low24h < Infinity ? `$${low24h.toLocaleString('en-US', { minimumFractionDigits: selectedAssetKey === 'XRP' ? 4 : 2, maximumFractionDigits: selectedAssetKey === 'XRP' ? 4 : 2 })}` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

