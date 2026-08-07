import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { usePriceStream } from '../../context/PriceContext';
import { useGlobalData } from '../../context/DataContext';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import BrokexCoreAbi from '../../abi/BrokexCore.json';
import { fetchTeeProof, fetchTeeRiskParams, formatAssetHashHex } from '../../components/OrderPanel';

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0xfDA686186510208C4E91028Fed671Dd9c35111d3';
const CORE_ADDRESS = import.meta.env.VITE_BROKEX_CORE_ADDRESS || '0x5620dA2B418577b94a74B121eD61B5B84962AC93';

const erc20Abi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  }
];

const apiBackendBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';
const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
const buyColor = '#3b82f6'; // blue
const sellColor = '#ef4444'; // red
const buyColorBg = 'rgba(59, 130, 246, 0.1)';
const sellColorBg = 'rgba(239, 68, 68, 0.1)';

export default function MobileOrderPanel({ isOpen, onClose, initialSide = 'buy', isInline = false }) {
  const { showNotification } = useNotifications();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();

  // Asset selection sync with desktop / TopNav
  const [selectedAssetKey, setSelectedAssetKey] = useState(() => {
    return localStorage.getItem('brokex_selected_asset') || 'GOLD';
  });

  const isXRP = selectedAssetKey === 'XRP';
  const selectedAssetSymbol = isXRP ? 'Crypto.XRP/USD' : 'Metal.XAU/USD';
  const selectedAssetBadge = isXRP ? 'XRP' : 'XAU';
  const priceDecimals = isXRP ? 4 : 2;

  const [side, setSide] = useState(initialSide);
  const [orderType, setOrderType] = useState('market');
  const [leverage, setLeverage] = useState(10);
  const [collateralAmount, setCollateralAmount] = useState('100');
  const [targetPrice, setTargetPrice] = useState('');
  const [sizeCurrency, setSizeCurrency] = useState('USD');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

  // Snapshot config states fetched from /api/snapshot
  const [minLeverageNum, setMinLeverageNum] = useState(1);
  const [maxLeverageNum, setMaxLeverageNum] = useState(100);
  const [commissionBps, setCommissionBps] = useState(10);
  const [minMarginUSD, setMinMarginUSD] = useState(10);
  const [liqThresholdBps, setLiqThresholdBps] = useState(950000);
  const [focusedInput, setFocusedInput] = useState(null);

  // Live price
  const [currentMarkPrice, setCurrentMarkPrice] = useState(isXRP ? 2.45 : 4046.52);

  // TEE Spreads & Open Interest
  const [spreadLongBps, setSpreadLongBps] = useState(30);
  const [spreadShortBps, setSpreadShortBps] = useState(30);
  const [maxOILongVal, setMaxOILongVal] = useState(37500000000);
  const [maxOIShortVal, setMaxOIShortVal] = useState(37500000000);
  const [currentOiLong, setCurrentOiLong] = useState(0);
  const [currentOiShort, setCurrentOiShort] = useState(0);

  // Read USDC Balance On-Chain
  const { data: rawUsdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 114,
    query: {
      enabled: Boolean(address),
      refetchInterval: 5000,
    },
  });

  // Read USDC Allowance
  const { data: rawUsdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CORE_ADDRESS] : undefined,
    chainId: 114,
    query: {
      enabled: Boolean(address),
      refetchInterval: 5000,
    },
  });

  const formattedUsdcBal = (() => {
    if (rawUsdcBalance === undefined || rawUsdcBalance === null) return '0.00';
    try {
      const balBig = BigInt(rawUsdcBalance.toString());
      const integerPart = balBig / 1000000n;
      const decimalPart = (balBig % 1000000n).toString().padStart(6, '0').slice(0, 2);
      return `${integerPart.toLocaleString('en-US')}.${decimalPart}`;
    } catch (e) {
      return '0.00';
    }
  })();

  const usdcBalance = address ? formattedUsdcBal : '0.00';

  // Faucet Claiming Handler
  const handleClaimFaucet = async () => {
    if (!address) {
      if (openConnectModal) openConnectModal();
      return;
    }
    setIsClaimingFaucet(true);
    if (showNotification) {
      showNotification('Claiming 1,000 USDC Faucet...', 'info');
    }
    try {
      const res = await fetch(`${apiBackendBase}/api/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (showNotification) {
          showNotification('Successfully claimed 1,000 USDC Faucet!', 'success', data.txHash || null);
        }
      } else {
        if (showNotification) {
          let errMsg = data.error || 'Failed to claim faucet';
          if (errMsg.includes('déjà réclamé') || errMsg.includes('deja reclame')) {
            errMsg = 'This wallet has already claimed 1,000 USDC Faucet.';
          }
          showNotification(errMsg, 'error');
        }
      }
    } catch (err) {
      console.error("Faucet claim error:", err);
      if (showNotification) {
        showNotification('Network error calling faucet', 'error');
      }
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  // Sync side with initialSide prop when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSide(initialSide);
    }
  }, [isOpen, initialSide]);

  // Listen to asset change event from TopNav toggle
  useEffect(() => {
    const handleAssetChange = (e) => {
      if (e.detail && e.detail.assetKey) {
        setSelectedAssetKey(e.detail.assetKey);
        setCurrentMarkPrice(e.detail.assetKey === 'XRP' ? 2.45 : 4046.52);
      }
    };
    window.addEventListener('brokex_asset_changed', handleAssetChange);
    return () => window.removeEventListener('brokex_asset_changed', handleAssetChange);
  }, []);

  const { getAssetRiskParams, getAssetSnapshot } = useGlobalData();

  // Sync risk params from central DataContext
  useEffect(() => {
    const p = getAssetRiskParams(selectedAssetKey);
    if (p) {
      const sL = p.spreadLongBps !== undefined ? Number(p.spreadLongBps) : 30;
      const sS = p.spreadShortBps !== undefined ? Number(p.spreadShortBps) : 30;
      setSpreadLongBps(sL);
      setSpreadShortBps(sS);
      if (p.maxOILong !== undefined) setMaxOILongVal(Number(p.maxOILong));
      if (p.maxOIShort !== undefined) setMaxOIShortVal(Number(p.maxOIShort));
    }
  }, [selectedAssetKey, getAssetRiskParams]);

  // Sync snapshot config & Open Interest from central DataContext
  useEffect(() => {
    const assetObj = getAssetSnapshot(selectedAssetKey);
    if (!assetObj) return;

    const assetSnap = assetObj.snapshot || assetObj;
    const assetConfig = assetSnap.config || assetObj.config;

    if (assetSnap) {
      if (assetSnap.openInterestLong !== undefined) setCurrentOiLong(Number(assetSnap.openInterestLong));
      if (assetSnap.openInterestShort !== undefined) setCurrentOiShort(Number(assetSnap.openInterestShort));
    }

    if (assetConfig) {
      if (assetConfig.minLeverage) setMinLeverageNum(Number(assetConfig.minLeverage));
      if (assetConfig.maxLeverage) setMaxLeverageNum(Number(assetConfig.maxLeverage));
      if (assetConfig.commissionBps) setCommissionBps(Number(assetConfig.commissionBps));
      if (assetConfig.minTradeSize) {
        const rawMin = Number(assetConfig.minTradeSize);
        setMinMarginUSD(rawMin > 100000 ? rawMin / 1e6 : rawMin);
      }
      if (assetConfig.liqThresholdBps) setLiqThresholdBps(Number(assetConfig.liqThresholdBps));
    }
  }, [selectedAssetKey, getAssetSnapshot]);

  const { currentMarkPrice: liveMarkPrice } = usePriceStream();

  useEffect(() => {
    if (liveMarkPrice > 0) {
      setCurrentMarkPrice(liveMarkPrice);
    }
  }, [liveMarkPrice]);

  if (!isOpen) return null;

  // Compute Available Liquidity in USD (maxOI - currentOI)
  const maxLimitRaw = side === 'buy' ? maxOILongVal : maxOIShortVal;
  const currentOiRaw = side === 'buy' ? currentOiLong : currentOiShort;
  const maxLimitUSD = maxLimitRaw > 100000 ? maxLimitRaw / 1e6 : maxLimitRaw;
  const currentOiUSD = currentOiRaw > 100000 ? currentOiRaw / 1e6 : currentOiRaw;
  const availLiquidityUSD = Math.max(0, maxLimitUSD - currentOiUSD);

  const defaultFallbackP = isXRP ? 2.45 : 4046.52;
  const baseP = currentMarkPrice > 0 ? currentMarkPrice : defaultFallbackP;
  const computedAsk = baseP * (1 + spreadLongBps / 100000);
  const computedBid = baseP * (1 - spreadShortBps / 100000);

  const askPrice = computedAsk.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals });
  const bidPrice = computedBid.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals });
  const selectedAsset = selectedAssetBadge;

  const leverageStops = Array.from(new Set([2, 10, 25, 50, maxLeverageNum]))
    .filter(v => v <= maxLeverageNum)
    .sort((a, b) => a - b);
  const percentage = maxLeverageNum > minLeverageNum
    ? ((leverage - minLeverageNum) / (maxLeverageNum - minLeverageNum)) * 100
    : 0;
  const sliderBackground = `linear-gradient(to right, ${goldAccent} ${percentage}%, var(--border-color) ${percentage}%)`;

  const collatNum = Number(collateralAmount || 0);
  const estimatedSizeUSDNum = collatNum * leverage;
  const displaySize = sizeCurrency === 'USD'
    ? estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (estimatedSizeUSDNum / currentMarkPrice).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  // Fees calculation
  const openFeeVal = estimatedSizeUSDNum * (commissionBps / 10000);
  const totalFeesVal = openFeeVal; // Oracle and close fees are 0

  // Exact Liquidation Price calculation using BrokexCore contract formula
  const rawBps = Number(liqThresholdBps || 950000);
  const bpsRatio = rawBps > 100000 ? rawBps / 1e6 : rawBps / 10000;
  const safeBpsRatio = (bpsRatio > 0 && bpsRatio <= 1) ? bpsRatio : 0.95;

  const entryP = side === 'buy' ? computedAsk : computedBid;
  const validEntryP = entryP > 0 ? entryP : defaultFallbackP;
  const safeLev = Math.max(1, Number(leverage || 10));

  const move = (validEntryP * safeBpsRatio) / safeLev;
  const rawLiqPrice = side === 'buy' ? (validEntryP - move) : (validEntryP + move);
  const liqPriceVal = Math.max(0, rawLiqPrice);

  // Submit Trade Transaction matching Desktop OrderPanel
  const handleVaultAction = async () => {
    if (!isConnected || !address) {
      if (openConnectModal) openConnectModal();
      return;
    }

    if (collatNum < minMarginUSD) {
      showNotification && showNotification(`Minimum collateral is ${minMarginUSD} USDC`, 'warning');
      return;
    }

    if (orderType !== 'market' && (!targetPrice || Number(targetPrice) <= 0)) {
      showNotification && showNotification(`Please specify a valid ${orderType} target price`, 'warning');
      return;
    }

    // Check USDC balance
    const rawUsdcVal = rawUsdcBalance ? BigInt(rawUsdcBalance.toString()) : 0n;
    const requiredCollateralScaled = BigInt(Math.floor(collatNum * 1e6));
    if (rawUsdcVal < requiredCollateralScaled) {
      if (showNotification) {
        showNotification('Insufficient USDC balance to place this trade', 'error');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const rpcUrl = import.meta.env.VITE_COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';

      // Check native C2FLR gas balance
      try {
        const nativeBalRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [address, 'latest']
          })
        });
        const nativeBalJson = await nativeBalRes.json();
        const nativeBal = nativeBalJson.result ? BigInt(nativeBalJson.result) : 0n;
        if (nativeBal < 5000000000000000n) {
          if (showNotification) {
            showNotification('Insufficient C2FLR balance to pay for transaction gas fees', 'error');
          }
          setIsSubmitting(false);
          return;
        }
      } catch (gasErr) {
        console.warn("Gas balance check error:", gasErr);
      }

      const goldHash = import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55';
      const xrpHash = import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298';
      const assetHash = isXRP ? xrpHash : goldHash;

      const direction = side === 'buy' ? 1 : 0; // 1 = LONG, 0 = SHORT
      const collateralScaled = requiredCollateralScaled;
      const leverageScaled = BigInt(leverage);
      const slScaled = (tpSlEnabled && slPrice && Number(slPrice) > 0) ? BigInt(Math.floor(Number(slPrice) * 1e6)) : 0n;
      const tpScaled = (tpSlEnabled && tpPrice && Number(tpPrice) > 0) ? BigInt(Math.floor(Number(tpPrice) * 1e6)) : 0n;

      // Check USDC Allowance
      try {
        let currentAllowance = (rawUsdcAllowance !== undefined && rawUsdcAllowance !== null)
          ? BigInt(rawUsdcAllowance.toString())
          : 0n;

        if (rawUsdcAllowance === undefined || rawUsdcAllowance === null) {
          try {
            const allowanceRes = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [
                  {
                    to: USDC_ADDRESS,
                    data: `0xdd62572e000000000000000000000000${address.slice(2).toLowerCase()}000000000000000000000000${CORE_ADDRESS.slice(2).toLowerCase()}`
                  },
                  'latest'
                ]
              })
            });
            const allowanceJson = await allowanceRes.json();
            if (allowanceJson.result && allowanceJson.result !== '0x') {
              currentAllowance = BigInt(allowanceJson.result);
            }
          } catch (fetchErr) {
            console.warn("Fallback allowance fetch error:", fetchErr);
          }
        }

        if (currentAllowance < collateralScaled) {
          if (showNotification) {
            showNotification('Approving USDC for BrokexCore...', 'info');
          }
          const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
          const approveTxHash = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CORE_ADDRESS, maxUint256]
          });
          if (showNotification) {
            showNotification('USDC approved successfully!', 'success', approveTxHash);
          }
          if (refetchAllowance) refetchAllowance();
        }
      } catch (appErr) {
        console.warn("Allowance check/approve error:", appErr);
      }

      if (orderType === 'market') {
        const proof = await fetchTeeProof(isXRP ? 'XRP' : 'GOLD');
        const riskProofStruct = {
          assetHash: assetHash,
          maxOILong: BigInt(proof.maxOILong || "37500000000"),
          maxOIShort: BigInt(proof.maxOIShort || "37500000000"),
          spreadLong: BigInt(proof.spreadLong || 1000),
          spreadShort: BigInt(proof.spreadShort || 1000),
          timestamp: BigInt(proof.timestamp || Math.floor(Date.now() / 1000)),
          sig: proof.sig || "0x"
        };

        const txHash = await writeContractAsync({
          address: CORE_ADDRESS,
          abi: BrokexCoreAbi.abi,
          functionName: 'openMarketPosition',
          args: [
            assetHash,
            direction,
            collateralScaled,
            leverageScaled,
            slScaled,
            tpScaled,
            riskProofStruct
          ]
        });

        if (showNotification) {
          showNotification('Market trade submitted successfully!', 'success', txHash);
        }
      } else {
        const orderTypeNum = orderType === 'limit' ? 1 : 2;
        const targetPriceScaled = BigInt(Math.floor(Number(targetPrice) * 1e6));

        const txHash = await writeContractAsync({
          address: CORE_ADDRESS,
          abi: BrokexCoreAbi.abi,
          functionName: 'createLimitOrStopOrder',
          args: [
            assetHash,
            direction,
            orderTypeNum,
            targetPriceScaled,
            collateralScaled,
            leverageScaled,
            slScaled,
            tpScaled
          ]
        });

        if (showNotification) {
          showNotification(`${orderType.toUpperCase()} order submitted successfully!`, 'success', txHash);
        }
      }

      if (onClose) onClose();
    } catch (err) {
      console.error("Mobile trade error:", err);
      if (showNotification) {
        showNotification(err.shortMessage || err.message || "Failed to submit trade transaction", 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const innerSheet = (
    <div style={{
      background: isInline ? 'transparent' : 'var(--bg-dark)',
      borderTop: isInline ? 'none' : '1px solid var(--border-color)',
      borderTopLeftRadius: isInline ? '0px' : '20px',
      borderTopRightRadius: isInline ? '0px' : '20px',
      padding: isInline ? '12px 8px' : '16px 12px',
      maxHeight: isInline ? '100%' : '85vh',
      height: isInline ? '100%' : 'auto',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: isInline ? 'none' : '0 -8px 30px rgba(0, 0, 0, 0.5)',
      width: '100%',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners {
          -moz-appearance: textfield;
        }
        .no-spinners:focus {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Drag Handle indicator */}
      {!isInline && (
        <div style={{
          width: '40px',
          height: '4px',
          background: 'var(--border-color)',
          borderRadius: '2px',
          alignSelf: 'center',
          marginBottom: '4px'
        }} />
      )}

      {/* Drawer Header */}
      {!isInline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-dark)', textTransform: 'uppercase' }}>
            Configure Order ({selectedAsset})
          </h3>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-grey)',
              fontSize: '22px',
              lineHeight: '1',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Long/Short Tabs */}
      <div style={{
        display: 'flex',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        padding: '3px',
        border: '1px solid var(--border-color)'
      }}>
        <div
          onClick={() => setSide('buy')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '6px 8px',
            cursor: 'pointer',
            borderRadius: '6px',
            alignItems: 'center',
            backgroundColor: side === 'buy' ? buyColorBg : 'transparent',
            border: `1px solid ${side === 'buy' ? buyColor : 'transparent'}`,
            transition: 'all 0.15s'
          }}
        >
          <div style={{ color: side === 'buy' ? buyColor : 'var(--text-grey)', fontWeight: side === 'buy' ? 700 : 500, fontSize: '12px' }}>LONG</div>
          <div style={{ color: side === 'buy' ? buyColor : 'var(--text-grey)', fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>${askPrice}</div>
        </div>
        <div
          onClick={() => setSide('sell')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '6px 8px',
            cursor: 'pointer',
            borderRadius: '6px',
            alignItems: 'center',
            backgroundColor: side === 'sell' ? sellColorBg : 'transparent',
            border: `1px solid ${side === 'sell' ? sellColor : 'transparent'}`,
            transition: 'all 0.15s'
          }}
        >
          <div style={{ color: side === 'sell' ? sellColor : 'var(--text-grey)', fontWeight: side === 'sell' ? 700 : 500, fontSize: '12px' }}>SHORT</div>
          <div style={{ color: side === 'sell' ? sellColor : 'var(--text-grey)', fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>${bidPrice}</div>
        </div>
      </div>

      {/* Order Types */}
      <div style={{
        display: 'flex',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        padding: '3px',
        border: '1px solid var(--border-color)'
      }}>
        {['market', 'limit', 'stop'].map(type => (
          <div
            key={type}
            onClick={() => setOrderType(type)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '6px',
              cursor: 'pointer',
              borderRadius: '6px',
              backgroundColor: orderType === type ? goldAccentLight : 'transparent',
              color: orderType === type ? goldAccent : 'var(--text-grey)',
              border: `1px solid ${orderType === type ? goldAccent : 'transparent'}`,
              fontSize: '10px',
              fontWeight: orderType === type ? 600 : 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'all 0.15s'
            }}
          >
            {type}
          </div>
        ))}
      </div>

      {/* Target Price (Limit/Stop only) */}
      {orderType !== 'market' && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>
            {orderType} Price
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: goldAccent }}>
              {orderType === 'limit' ? (side === 'buy' ? '≤' : '≥') : (side === 'buy' ? '≥' : '≤')}
            </span>
            <input
              type="number"
              className="no-spinners"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="0.00"
              style={{
                fontSize: '13px',
                color: 'var(--text-dark)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%',
                fontWeight: '600',
                fontFamily: 'Source Code Pro, monospace'
              }}
            />
          </div>
        </div>
      )}

      {/* Collateral Input */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Collateral</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{ fontSize: '10px', color: goldAccent, fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => {
                  const cleanBal = String(usdcBalance).replace(/[^0-9.]/g, '');
                  if (cleanBal && !isNaN(Number(cleanBal))) {
                    setCollateralAmount(cleanBal);
                  }
                }}
              >
                MAX (Bal: {usdcBalance} USDC)
              </span>
              <button
                onClick={handleClaimFaucet}
                disabled={isClaimingFaucet}
                title="Claim 1,000 USDC Faucet"
                style={{
                  background: goldAccentLight,
                  color: goldAccent,
                  border: 'none',
                  borderRadius: '2px',
                  width: '16px',
                  height: '16px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: isClaimingFaucet ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  transition: 'all 0.15s',
                  opacity: isClaimingFaucet ? 0.6 : 1
                }}
              >
                {isClaimingFaucet ? '...' : '+'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              className="no-spinners"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              style={{
                fontSize: '14px',
                color: 'var(--text-dark)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                width: '120px',
                fontWeight: 'bold',
                fontFamily: 'Source Code Pro, monospace'
              }}
            />
            <span style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-dark)' }}>
              USDC
            </span>
          </div>
        </div>

        {/* Size Indicator */}
        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Estimated Size</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
              {displaySize}
            </span>
          </div>
          <button
            onClick={() => setSizeCurrency(prev => prev === 'USD' ? 'ASSET' : 'USD')}
            style={{
              border: `1px solid ${goldAccent}`,
              background: goldAccentLight,
              color: goldAccent,
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {sizeCurrency === 'USD' ? 'USD' : selectedAsset}
          </button>
        </div>
      </div>

      {/* Dynamic Leverage Slider (PC-Matching Aesthetics & Custom Thumb Styles) */}
      <style>{`
        .custom-leverage-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .custom-leverage-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 1px solid #333;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .custom-leverage-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 1px solid #333;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
      `}</style>

      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Leverage</span>
          <span style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '13px', fontFamily: 'Source Code Pro, monospace' }}>{leverage}x</span>
        </div>
        <input
          type="range"
          min={minLeverageNum}
          max={maxLeverageNum}
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="custom-leverage-slider"
          style={{ background: sliderBackground, width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '6px' }}>
          {leverageStops.map(lev => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '10px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: leverage === lev ? goldAccentLight : 'rgba(255, 255, 255, 0.02)',
                color: leverage === lev ? goldAccent : 'var(--text-grey)',
                fontFamily: 'Source Code Pro, monospace',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.1s'
              }}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* TP / SL Toggle and Fields (PC-Matching Stacked Design) */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setTpSlEnabled(!tpSlEnabled)}
          style={{
            padding: '10px 12px',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            width: '100%',
            borderBottom: tpSlEnabled ? '1px solid var(--border-color)' : 'none'
          }}
        >
          <span style={{ fontSize: '11.5px', color: 'var(--text-dark)', fontWeight: 600 }}>Take Profit / Stop Loss</span>
          <div style={{
            width: '32px',
            height: '16px',
            backgroundColor: tpSlEnabled ? goldAccent : 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            position: 'relative',
            transition: 'all 0.2s',
            flexShrink: 0,
            marginLeft: 'auto'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#fff',
              borderRadius: '50%',
              position: 'absolute',
              top: '2px',
              left: tpSlEnabled ? '18px' : '2px',
              transition: 'all 0.2s'
            }} />
          </div>
        </div>

        {tpSlEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Take Profit Box */}
            <div
              style={{
                padding: '6px 8px',
                borderBottom: '1px solid var(--border-color)',
                borderLeft: focusedInput === 'tp' ? `2px solid ${goldAccent}` : '2px solid transparent',
                backgroundColor: focusedInput === 'tp' ? 'rgba(200, 169, 126, 0.04)' : 'transparent',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>Take Profit</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['10%', '25%', '50%', '100%'].map(p => (
                    <span
                      key={p}
                      onClick={() => {
                        const pct = parseFloat(p) / 100;
                        if (validEntryP) {
                          const calculatedTp = side === 'buy'
                            ? validEntryP * (1 + pct / safeLev)
                            : validEntryP * (1 - pct / safeLev);
                          setTpPrice(calculatedTp.toFixed(2));
                        }
                      }}
                      style={{
                        fontSize: '10px',
                        color: goldAccent,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontFamily: 'Source Code Pro, monospace'
                      }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  className="no-spinners"
                  value={tpPrice}
                  onFocus={() => setFocusedInput('tp')}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => setTpPrice(e.target.value)}
                  placeholder="None"
                  style={{
                    width: '75%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    color: 'var(--text-dark)',
                    fontSize: '13px',
                    fontWeight: '600',
                    fontFamily: 'Source Code Pro, monospace'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>USD</span>
              </div>
            </div>

            {/* Stop Loss Box */}
            <div
              style={{
                padding: '6px 8px',
                borderLeft: focusedInput === 'sl' ? `2px solid ${goldAccent}` : '2px solid transparent',
                backgroundColor: focusedInput === 'sl' ? 'rgba(200, 169, 126, 0.04)' : 'transparent',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>Stop Loss</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['10%', '25%', '50%', '70%'].map(p => (
                    <span
                      key={p}
                      onClick={() => {
                        const pct = parseFloat(p) / 100;
                        if (validEntryP) {
                          const calculatedSl = side === 'buy'
                            ? validEntryP * (1 - pct / safeLev)
                            : validEntryP * (1 + pct / safeLev);
                          setSlPrice(calculatedSl.toFixed(2));
                        }
                      }}
                      style={{
                        fontSize: '10px',
                        color: goldAccent,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontFamily: 'Source Code Pro, monospace'
                      }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  className="no-spinners"
                  value={slPrice}
                  onFocus={() => setFocusedInput('sl')}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => setSlPrice(e.target.value)}
                  placeholder="None"
                  style={{
                    width: '75%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    color: 'var(--text-dark)',
                    fontSize: '13px',
                    fontWeight: '600',
                    fontFamily: 'Source Code Pro, monospace'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 500 }}>USD</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metric Details list matching Desktop OrderPanel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', padding: '0 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-grey)' }}>Amount</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>{(estimatedSizeUSDNum / validEntryP).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {selectedAsset}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-grey)' }}>Exposure</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>${estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-grey)' }}>Collateral at Open</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>{collatNum.toFixed(2)} USDC</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-grey)' }}>Liquidation Price</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>
            ${liqPriceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-grey)' }}>Available Liquidity ({side === 'buy' ? 'Long' : 'Short'})</span>
          <span style={{ color: side === 'buy' ? buyColor : sellColor, fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
            ${availLiquidityUSD >= 1e6 ? `${(availLiquidityUSD / 1e6).toFixed(2)}M` : availLiquidityUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-grey)' }}>Oracle Fee</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>$0.00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-grey)' }}>Open Fee</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>${openFeeVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-grey)' }}>Close Fee</span>
          <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>$0.00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>Total Fees</span>
          <span style={{ color: goldAccent, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            ${totalFeesVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Large Action Submit Button */}
      <button
        onClick={handleVaultAction}
        disabled={isSubmitting}
        style={{
          backgroundColor: goldAccent,
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '13px',
          fontWeight: '900',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
          textAlign: 'center',
          marginTop: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          transition: 'all 0.15s ease'
        }}
      >
        {isSubmitting
          ? 'Processing...'
          : (!isConnected
            ? 'Connect Wallet'
            : (side === 'buy'
              ? `Go Long (${selectedAsset})`
              : `Go Short (${selectedAsset})`)
          )
        }
      </button>
    </div>
  );

  if (isInline) return innerSheet;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      {/* Tap outside to close spacer */}
      <div style={{ flex: 1 }} onClick={onClose} />
      {innerSheet}
    </div>
  );
}
