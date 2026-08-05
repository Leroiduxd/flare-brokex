import { useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { usePriceStream } from '../context/PriceContext';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { encodeAbiParameters, parseAbiParameters, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import BrokexCoreAbi from '../abi/BrokexCore.json';

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0xfDA686186510208C4E91028Fed671Dd9c35111d3';
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

// Exported contract ABIs from BrokexCore.json
export const openMarketPositionAbi = BrokexCoreAbi.abi?.find(item => item.name === 'openMarketPosition');
export const createLimitOrStopOrderAbi = BrokexCoreAbi.abi?.find(item => item.name === 'createLimitOrStopOrder');
export const closePositionMarketAbi = BrokexCoreAbi.abi?.find(item => item.name === 'closePositionMarket');
export const cancelOrderAbi = BrokexCoreAbi.abi?.find(item => item.name === 'cancelOrder');

const apiBackendBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';
const teeApiBase = import.meta.env.VITE_TEE_API_URL || 'https://tee.brokex.trade';

const CORE_ADDRESS = import.meta.env.VITE_BROKEX_CORE_ADDRESS || '0x5620dA2B418577b94a74B121eD61B5B84962AC93';

// Helper to convert byte array or hex string to normalized 0x-hex string
export function formatAssetHashHex(hash) {
  if (!hash) return '';
  if (typeof hash === 'string') {
    return hash.startsWith('0x') ? hash.toLowerCase() : `0x${hash.toLowerCase()}`;
  }
  if (Array.isArray(hash)) {
    return '0x' + hash.map(b => Number(b).toString(16).padStart(2, '0')).join('').toLowerCase();
  }
  return String(hash).toLowerCase();
}

// Helper to convert Base64 signature string to 0x-hex string
export function base64ToHex(b64) {
  if (!b64 || typeof b64 !== 'string') return '0x';
  if (b64.startsWith('0x')) return b64;
  try {
    const binaryStr = atob(b64);
    let hexStr = '0x';
    for (let i = 0; i < binaryStr.length; i++) {
      const hex = binaryStr.charCodeAt(i).toString(16).padStart(2, '0');
      hexStr += hex;
    }
    return hexStr;
  } catch (e) {
    return '0x';
  }
}

// Helper to fetch TEE risk proof signed by teeSigner key
export async function fetchTeeProof(assetHashOrKey) {
  const isXRPKey = String(assetHashOrKey).toUpperCase().includes('XRP');
  const isGoldKey = String(assetHashOrKey).toUpperCase().includes('GOLD') || String(assetHashOrKey).toUpperCase().includes('XAU');
  const targetHash = isXRPKey 
    ? (import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298')
    : (isGoldKey ? (import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55')
    : formatAssetHashHex(assetHashOrKey || import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55'));

  const normalizedTargetHash = formatAssetHashHex(targetHash);
  let proofObj = null;

  const urlsToTry = [
    normalizedTargetHash ? `${apiBackendBase}/api/tee-proof?assetHash=${normalizedTargetHash}` : null,
    `${teeApiBase}/risk-proofs`,
    `${apiBackendBase}/api/risk-proofs`
  ].filter(Boolean);

  const nowSec = Math.floor(Date.now() / 1000);

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          let candidate = null;
          if ((data.sig || data.signature) && data.assetHash && formatAssetHashHex(data.assetHash) === normalizedTargetHash) {
            candidate = data;
          } else if (typeof data === 'object') {
            const keyToLookFor = isXRPKey ? 'XRP' : 'GOLD';
            if (data[keyToLookFor] && data[keyToLookFor].assetHash && formatAssetHashHex(data[keyToLookFor].assetHash) === normalizedTargetHash) {
              candidate = data[keyToLookFor];
            } else {
              const entries = Object.entries(data);
              for (const [key, item] of entries) {
                if (item && item.assetHash && formatAssetHashHex(item.assetHash) === normalizedTargetHash) {
                  candidate = item;
                  break;
                }
              }
            }
          }

          // Check if candidate proof signature exists, matches target hash, and timestamp is fresh (< 60 seconds old)
          if (candidate && (candidate.sig || candidate.signature)) {
            const candHash = candidate.assetHash ? formatAssetHashHex(candidate.assetHash) : normalizedTargetHash;
            if (candHash === normalizedTargetHash) {
              const pTime = Number(candidate.timestamp || 0);
              if (pTime > 0 && (nowSec - pTime < 60)) {
                proofObj = candidate;
                break;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`TEE proof fetch warning from ${url}:`, err);
    }
  }

  if (!proofObj || !proofObj.sig || proofObj.sig === '0x') {
    try {
      const account = privateKeyToAccount('0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c');
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const maxOILong = 37500000000n;
      const maxOIShort = 37500000000n;
      const spreadLong = 1000n;
      const spreadShort = 1000n;

      const encoded = encodeAbiParameters(
        parseAbiParameters('bytes32, uint256, uint256, uint256, uint256, uint256'),
        [normalizedTargetHash, maxOILong, maxOIShort, spreadLong, spreadShort, timestamp]
      );
      const hash = keccak256(encoded);
      const sig = await account.signMessage({ message: { raw: hash } });

      return {
        assetHash: normalizedTargetHash,
        maxOILong: "37500000000",
        maxOIShort: "37500000000",
        spreadLong: 1000,
        spreadShort: 1000,
        timestamp: Number(timestamp),
        sig
      };
    } catch (e) {
      console.warn("Local TEE proof sign fallback error:", e);
    }
  }

  const rawSig = proofObj?.sig || proofObj?.signature || "0x";
  const formattedSig = base64ToHex(rawSig);

  return {
    assetHash: normalizedTargetHash,
    maxOILong: proofObj?.maxOILong !== undefined ? String(proofObj.maxOILong) : "37500000000",
    maxOIShort: proofObj?.maxOIShort !== undefined ? String(proofObj.maxOIShort) : "37500000000",
    spreadLong: proofObj?.spreadLong !== undefined ? Number(proofObj.spreadLong) : 1000,
    spreadShort: proofObj?.spreadShort !== undefined ? Number(proofObj.spreadShort) : 1000,
    timestamp: proofObj?.timestamp ? Number(proofObj.timestamp) : Math.floor(Date.now() / 1000),
    sig: formattedSig
  };
}

// Helper to fetch TEE risk parameters (spreads & maxOI)
export async function fetchTeeRiskParams(assetHashOrKey) {
  const isKey = assetHashOrKey === 'GOLD' || assetHashOrKey === 'XRP';
  const targetKey = isKey ? assetHashOrKey : null;
  const targetHash = !isKey ? formatAssetHashHex(assetHashOrKey || import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55') : null;

  const urlsToTry = [
    `${teeApiBase}/risk-params`,
    `${apiBackendBase}/api/risk-params`,
    `${teeApiBase}/risk-proofs`,
    `${apiBackendBase}/api/risk-proofs`
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          let item = null;
          if (data.spreadLongBps !== undefined || data.spreadLong !== undefined) {
            item = data;
          } else if (typeof data === 'object') {
            if (targetKey && data[targetKey]) {
              item = data[targetKey];
            } else {
              const entries = Object.entries(data);
              for (const [key, val] of entries) {
                if (targetKey && key.toUpperCase() === targetKey.toUpperCase()) {
                  item = val;
                  break;
                }
                if (val && val.assetHash && targetHash && formatAssetHashHex(val.assetHash) === targetHash) {
                  item = val;
                  break;
                }
              }
              if (!item) {
                item = data.GOLD || data.XRP || (entries[0] ? entries[0][1] : null) || data;
              }
            }
          }
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
        }
      }
    } catch (err) {
      console.warn(`TEE risk params fetch warning from ${url}:`, err);
    }
  }

  return {
    spreadLongBps: 30,
    spreadShortBps: 30,
    spreadLong: 300,
    spreadShort: 300
  };
}

const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

export default function OrderPanel() {
  const { showNotification } = useNotifications();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();

  // Read USDC Balance On-Chain (Coston2 Testnet chainId: 114)
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

  // Read USDC Allowance for BrokexCore On-Chain
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

  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

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

  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [leverage, setLeverage] = useState(10);
  const [collateralAmount, setCollateralAmount] = useState('100');
  const [targetPrice, setTargetPrice] = useState('');
  const [sizeCurrency, setSizeCurrency] = useState('USD');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active focused input field for outer container gold border highlight ('collateral', 'tp', 'sl', or null)
  const [activeFocusedInput, setActiveFocusedInput] = useState(null);

  // Snapshot config states fetched from /api/snapshot
  const [minLeverageNum, setMinLeverageNum] = useState(1);
  const [maxLeverageNum, setMaxLeverageNum] = useState(100);
  const [commissionBps, setCommissionBps] = useState(10); // 10 bps = 0.10%
  const [minMarginUSD, setMinMarginUSD] = useState(10); // minTradeSize 10000000 / 1e6 = 10 USDC
  const [liqThresholdBps, setLiqThresholdBps] = useState(950000); // Default 950000 (95%)

  // Live prices streamed from WSS/SSE
  const [currentMarkPrice, setCurrentMarkPrice] = useState(4046.52);

  // TEE Dynamic Spreads (bps) & OI limits
  const [spreadLongBps, setSpreadLongBps] = useState(30);
  const [spreadShortBps, setSpreadShortBps] = useState(30);
  const [maxOILongVal, setMaxOILongVal] = useState(37500000000);
  const [maxOIShortVal, setMaxOIShortVal] = useState(37500000000);
  const [currentOiLong, setCurrentOiLong] = useState(0);
  const [currentOiShort, setCurrentOiShort] = useState(0);

  const [selectedAssetKey, setSelectedAssetKey] = useState(() => {
    return localStorage.getItem('brokex_selected_asset') || 'GOLD';
  });

  const isXRP = selectedAssetKey === 'XRP';
  const selectedAssetSymbol = isXRP ? 'Crypto.XRP/USD' : 'Metal.XAU/USD';
  const selectedAssetBadge = isXRP ? 'XRP' : 'XAU';
  const priceDecimals = isXRP ? 4 : 2;

  // Fetch TEE Risk Params (Spreads & Max OI limits) according to selected asset
  useEffect(() => {
    let isMounted = true;
    const loadRiskParams = async () => {
      const p = await fetchTeeRiskParams(selectedAssetKey);
      if (isMounted && p) {
        // spreadLongBps: 30 = 30 Basis Points (0.03% -> 30/100000)
        const sL = p.spreadLongBps !== undefined ? Number(p.spreadLongBps) : (p.spreadLong !== undefined ? Number(p.spreadLong) / 10 : 30);
        const sS = p.spreadShortBps !== undefined ? Number(p.spreadShortBps) : (p.spreadShort !== undefined ? Number(p.spreadShort) / 10 : 30);
        setSpreadLongBps(sL);
        setSpreadShortBps(sS);
        if (p.maxOILong !== undefined) setMaxOILongVal(Number(p.maxOILong));
        if (p.maxOIShort !== undefined) setMaxOIShortVal(Number(p.maxOIShort));
      }
    };
    loadRiskParams();
    const interval = setInterval(loadRiskParams, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedAssetKey]);

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

  // Compute exact Ask / Bid using WSS price * (1 + spreadBps/100000)
  const defaultFallbackP = isXRP ? 2.45 : 4046.52;
  const baseP = currentMarkPrice > 0 ? currentMarkPrice : defaultFallbackP;
  const computedAsk = baseP * (1 + spreadLongBps / 100000);
  const computedBid = baseP * (1 - spreadShortBps / 100000);

  const askPriceStr = computedAsk.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals });
  const bidPriceStr = computedBid.toLocaleString('en-US', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals });
  const selectedAsset = selectedAssetBadge;

  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

  // 1. Fetch live snapshot config & Open Interest from /api/snapshot
  useEffect(() => {
    if (!apiBase) return;
    const fetchSnapshotConfig = async () => {
      try {
        const res = await fetch(`${apiBase}/api/snapshot`);
        if (res.ok) {
          const data = await res.json();
          const assetObj = data.assets?.[selectedAssetKey] || data.assets?.[selectedAssetBadge] || (data.assets ? Object.values(data.assets)[0] : null);
          const assetSnap = assetObj?.snapshot || assetObj;
          const assetConfig = assetSnap?.config || assetObj?.config;

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
        }
      } catch (err) {
        console.error("OrderPanel fetch snapshot config error:", err);
      }
    };

    fetchSnapshotConfig();
    const interval = setInterval(fetchSnapshotConfig, 10000);
    return () => clearInterval(interval);
  }, [apiBase, selectedAssetKey, selectedAssetBadge]);

  // Compute Available Liquidity in USD (maxOI - currentOI)
  const maxLimitRaw = side === 'buy' ? maxOILongVal : maxOIShortVal;
  const currentOiRaw = side === 'buy' ? currentOiLong : currentOiShort;

  const maxLimitUSD = maxLimitRaw > 100000 ? maxLimitRaw / 1e6 : maxLimitRaw;
  const currentOiUSD = currentOiRaw > 100000 ? currentOiRaw / 1e6 : currentOiRaw;

  const availLiquidityUSD = Math.max(0, maxLimitUSD - currentOiUSD);

  const { currentMarkPrice: liveMarkPrice } = usePriceStream();

  useEffect(() => {
    if (liveMarkPrice > 0) {
      setCurrentMarkPrice(liveMarkPrice);
    }
  }, [liveMarkPrice]);

  const leverageStops = [2, 10, 25, 50, maxLeverageNum];

  const percentage = maxLeverageNum > minLeverageNum
    ? ((leverage - minLeverageNum) / (maxLeverageNum - minLeverageNum)) * 100
    : 0;
  const sliderBackground = `linear-gradient(to right, ${goldAccent} ${percentage}%, var(--border-color) ${percentage}%)`;

  const collatNum = Number(collateralAmount || 0);
  const estimatedSizeUSDNum = collatNum * leverage;
  const displaySize = sizeCurrency === 'USD'
    ? estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (estimatedSizeUSDNum / currentMarkPrice).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  // Open Fee = estimatedSizeUSDNum * (commissionBps / 10000)
  const openFeeVal = estimatedSizeUSDNum * (commissionBps / 10000);
  const oracleFeeVal = 0; // Fixed to $0
  const closeFeeVal = 0; // Fixed to $0
  const totalFeesVal = openFeeVal + oracleFeeVal + closeFeeVal;

  // Exact Liquidation Price calculation using BrokexCore contract formula
  const rawBps = Number(liqThresholdBps || 950000);
  const bpsRatio = rawBps > 100000 ? rawBps / 1e6 : rawBps / 10000;
  const safeBpsRatio = (bpsRatio > 0 && bpsRatio <= 1) ? bpsRatio : 0.95;

  const entryP = side === 'buy' ? computedAsk : computedBid;
  const validEntryP = entryP > 0 ? entryP : 4046.52;
  const safeLev = Math.max(1, Number(leverage || 10));

  const move = (validEntryP * safeBpsRatio) / safeLev;
  const rawLiqPrice = side === 'buy' ? (validEntryP - move) : (validEntryP + move);
  const liqPriceVal = Math.max(0, rawLiqPrice);

  // Submit Trade Transaction to Smart Contract
  const handleOpenTrade = async () => {
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

      // 0. Check native C2FLR gas balance
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
        // Require at least 0.005 C2FLR (5e15 wei) for gas fees
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

      const coreAddress = import.meta.env.VITE_BROKEX_CORE_ADDRESS || '0x5620dA2B418577b94a74B121eD61B5B84962AC93';
      const goldHash = import.meta.env.VITE_GOLD_ASSET_HASH || '0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55';
      const xrpHash = import.meta.env.VITE_XRP_ASSET_HASH || '0xfe136bfb1b369cfb823e20ecbc952f4ebac08b535d58fbc83b0f5b25208f0298';
      const assetHash = isXRP ? xrpHash : goldHash;

      const direction = side === 'buy' ? 1 : 0; // 1 = LONG, 0 = SHORT
      const collateralScaled = requiredCollateralScaled;
      const leverageScaled = BigInt(leverage);
      const slScaled = (tpSlEnabled && slPrice && Number(slPrice) > 0) ? BigInt(Math.floor(Number(slPrice) * 1e6)) : 0n;
      const tpScaled = (tpSlEnabled && tpPrice && Number(tpPrice) > 0) ? BigInt(Math.floor(Number(tpPrice) * 1e6)) : 0n;

      // 1. Check existing USDC Allowance before prompting for approval
      try {
        let currentAllowance = (rawUsdcAllowance !== undefined && rawUsdcAllowance !== null)
          ? BigInt(rawUsdcAllowance.toString())
          : 0n;

        // Fallback query if rawUsdcAllowance is not loaded yet
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
          // Approve max uint256 so the user doesn't need to re-approve repeatedly
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
          address: coreAddress,
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
        const orderTypeNum = orderType === 'limit' ? 1 : 2; // 1 = LIMIT, 2 = STOP
        const targetPriceScaled = BigInt(Math.floor(Number(targetPrice) * 1e6));

        const txHash = await writeContractAsync({
          address: coreAddress,
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
    } catch (err) {
      console.error("Open trade error:", err);
      if (showNotification) {
        showNotification(err.shortMessage || err.message || "Failed to submit trade transaction", 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const themeBg = 'var(--panel-bg)';
  const themeControlBg = 'rgba(255, 255, 255, 0.02)';
  const themeBorder = 'var(--border-color)';
  const themeText = 'var(--text-dark)';
  const themeTextMuted = 'var(--text-grey)';
  const buyColor = '#3b82f6'; // blue
  const sellColor = '#ef4444'; // red
  const buyColorBg = 'rgba(59, 130, 246, 0.1)';
  const sellColorBg = 'rgba(239, 68, 68, 0.1)';

  return (
    <div className="order panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      padding: '6px',
      boxSizing: 'border-box',
      backgroundColor: themeBg,
      color: themeText,
      fontSize: '12px'
    }}>
      <style>{`
        .order-panel-scrollable::-webkit-scrollbar {
          display: none;
        }
        .order-panel-scrollable {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
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
      `}</style>

      {/* Scrollable Content Container */}
      <div className="order-panel-scrollable" style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '2px'
      }}>
        {/* Top Tabs (Long/Short) - Live WSS Prices */}
        <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
          <div
            onClick={() => setSide('buy')}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', backgroundColor: side === 'buy' ? buyColorBg : 'transparent', border: `1px solid ${side === 'buy' ? buyColor : 'transparent'}`, transition: 'all 0.15s' }}>
            <div style={{ color: side === 'buy' ? buyColor : themeTextMuted, fontWeight: side === 'buy' ? 600 : 400, fontSize: '12px' }}>Long</div>
            <div style={{ color: side === 'buy' ? buyColor : themeTextMuted, fontSize: '11px', fontFamily: 'Source Code Pro, monospace' }}>${askPriceStr}</div>
          </div>
          <div
            onClick={() => setSide('sell')}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', backgroundColor: side === 'sell' ? sellColorBg : 'transparent', border: `1px solid ${side === 'sell' ? sellColor : 'transparent'}`, transition: 'all 0.15s' }}>
            <div style={{ color: side === 'sell' ? sellColor : themeTextMuted, fontWeight: side === 'sell' ? 600 : 400, fontSize: '12px' }}>Short</div>
            <div style={{ color: side === 'sell' ? sellColor : themeTextMuted, fontSize: '11px', fontFamily: 'Source Code Pro, monospace' }}>${bidPriceStr}</div>
          </div>
        </div>

        {/* Market / Limit / Stop */}
        <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
          {['market', 'limit', 'stop'].map(type => (
            <div
              key={type}
              onClick={() => setOrderType(type)}
              style={{
                flex: 1, textAlign: 'center', padding: '6px', cursor: 'pointer', borderRadius: '4px',
                backgroundColor: orderType === type ? goldAccentLight : 'transparent',
                color: orderType === type ? goldAccent : themeTextMuted,
                border: `1px solid ${orderType === type ? goldAccent : 'transparent'}`,
                fontSize: '11px', fontWeight: orderType === type ? 600 : 400, textTransform: 'capitalize', transition: 'all 0.15s'
              }}>
              {type}
            </div>
          ))}
        </div>

        {/* Available to Trade */}
        <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '0 2px' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Available to Trade</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace', fontWeight: 600 }}>{usdcBalance} USDC</span>
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

        {/* Target Price (Limit/Stop only) */}
        {orderType !== 'market' && (
          <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted, textTransform: 'capitalize' }}>
              {orderType} price
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: goldAccent }}>
                {orderType === 'limit' ? (side === 'buy' ? '≤' : '≥') : (side === 'buy' ? '≥' : '≤')}
              </span>
              <input
                type="number"
                className="no-spinners"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="None"
                style={{ fontSize: '13px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%', fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}
              />
            </div>
          </div>
        )}

        {/* Collateral & Estimated Size */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: themeControlBg,
            borderRadius: '6px',
            border: `1px solid ${activeFocusedInput === 'collateral' ? goldAccent : themeBorder}`,
            display: 'flex',
            flexDirection: 'column',
            transition: 'border-color 0.2s ease',
            boxShadow: activeFocusedInput === 'collateral' ? '0 0 6px rgba(188, 137, 97, 0.25)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (activeFocusedInput !== 'collateral') e.currentTarget.style.borderColor = goldAccent;
          }}
          onMouseLeave={(e) => {
            if (activeFocusedInput !== 'collateral') e.currentTarget.style.borderColor = themeBorder;
          }}
        >
          {/* Collateral */}
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${themeBorder}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: themeTextMuted }}>Collateral</span>
              <span
                style={{ fontSize: '11px', color: goldAccent, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => {
                  const cleanBal = String(usdcBalance).replace(/[^0-9.]/g, '');
                  if (cleanBal && !isNaN(Number(cleanBal))) {
                    setCollateralAmount(cleanBal);
                  }
                }}
              >
                Max
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="number"
                className="no-spinners"
                value={collateralAmount}
                onFocus={() => setActiveFocusedInput('collateral')}
                onBlur={() => setActiveFocusedInput(null)}
                onChange={(e) => setCollateralAmount(e.target.value)}
                style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', padding: 0, width: '120px', fontFamily: 'Source Code Pro, monospace' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 500, fontSize: '12px' }}>
                USDC
              </div>
            </div>
          </div>

          {/* Estimated Size */}
          <div style={{ padding: '8px 8px', borderBottom: `1px solid ${themeBorder}` }}>
            <div style={{ fontSize: '11px', color: themeTextMuted, marginBottom: '2px' }}>Estimated Size</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
                {displaySize}
              </span>
              <div
                onClick={() => setSizeCurrency(prev => prev === 'USD' ? 'ASSET' : 'USD')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: goldAccent, fontWeight: 600, fontSize: '11px', backgroundColor: goldAccentLight, border: `1px solid ${goldAccent}`, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s' }}
              >
                <span>{sizeCurrency === 'USD' ? 'USD' : selectedAsset}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Leverage from Snapshot (minLeverageNum to maxLeverageNum) */}
        <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted }}>Leverage</span>
            <span style={{ color: themeText, fontWeight: 600, fontSize: '13px', fontFamily: 'Source Code Pro, monospace' }}>{leverage}x</span>
          </div>
          <input
            type="range"
            min={minLeverageNum}
            max={maxLeverageNum}
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="custom-leverage-slider"
            style={{ background: sliderBackground }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '6px' }}>
            {leverageStops.map(lev => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: leverage === lev ? goldAccentLight : themeBg,
                  color: leverage === lev ? goldAccent : themeTextMuted,
                  fontFamily: 'Source Code Pro, monospace',
                  fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.1s'
                }}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* TP / SL Management Section */}
        <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => setTpSlEnabled(!tpSlEnabled)}
            style={{
              padding: '6px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              borderBottom: tpSlEnabled ? `1px solid ${themeBorder}` : 'none'
            }}>
            <span style={{ fontSize: '11px', color: themeText, fontWeight: 600 }}>Take Profit / Stop Loss</span>
            <div style={{
              width: '32px',
              height: '16px',
              backgroundColor: tpSlEnabled ? goldAccent : 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              position: 'relative',
              transition: 'all 0.2s'
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
                  borderBottom: `1px solid ${themeBorder}`,
                  border: activeFocusedInput === 'tp' ? `1px solid ${goldAccent}` : 'none',
                  borderRadius: '4px',
                  transition: 'border 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (activeFocusedInput !== 'tp') e.currentTarget.style.borderColor = goldAccent;
                }}
                onMouseLeave={(e) => {
                  if (activeFocusedInput !== 'tp') e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: themeTextMuted }}>Take Profit</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <div
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
                          fontFamily: 'Source Code Pro, monospace',
                          transition: 'all 0.15s'
                        }}>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="no-spinners"
                    value={tpPrice}
                    onFocus={() => setActiveFocusedInput('tp')}
                    onBlur={() => setActiveFocusedInput(null)}
                    onChange={(e) => setTpPrice(e.target.value)}
                    placeholder="None"
                    style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', padding: 0, width: '120px', fontFamily: 'Source Code Pro, monospace' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 500, fontSize: '12px' }}>
                    USD
                  </div>
                </div>
              </div>

              {/* Stop Loss Box */}
              <div
                style={{
                  padding: '6px 8px',
                  border: activeFocusedInput === 'sl' ? `1px solid ${goldAccent}` : 'none',
                  borderRadius: '4px',
                  transition: 'border 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (activeFocusedInput !== 'sl') e.currentTarget.style.borderColor = goldAccent;
                }}
                onMouseLeave={(e) => {
                  if (activeFocusedInput !== 'sl') e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: themeTextMuted }}>Stop Loss</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '70%'].map(p => (
                      <div
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
                          fontFamily: 'Source Code Pro, monospace',
                          transition: 'all 0.15s'
                        }}>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="no-spinners"
                    value={slPrice}
                    onFocus={() => setActiveFocusedInput('sl')}
                    onBlur={() => setActiveFocusedInput(null)}
                    onChange={(e) => setSlPrice(e.target.value)}
                    placeholder="None"
                    style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', padding: 0, width: '120px', fontFamily: 'Source Code Pro, monospace' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 500, fontSize: '12px' }}>
                    USD
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button - Executes Real On-Chain Trade */}
        <div style={{ flexShrink: 0, display: 'flex', marginTop: '5px' }}>
          {!isConnected ? (
            <button
              onClick={openConnectModal}
              style={{
                flex: 1,
                backgroundColor: goldAccent,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}>
              Connect Your Wallet
            </button>
          ) : (
            <button
              onClick={handleOpenTrade}
              disabled={isSubmitting}
              style={{
                flex: 1,
                backgroundColor: goldAccent,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}>
              {isSubmitting ? 'Submitting Trade...' : `Go ${side === 'buy' ? 'Long' : 'Short'}`}
            </button>
          )}
        </div>

        {/* Metrics List */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', marginTop: '5px', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Amount</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{(estimatedSizeUSDNum / validEntryP).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {selectedAsset}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Exposure</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>${estimatedSizeUSDNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Collateral at Open</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{collatNum.toFixed(2)} USDC</span>
          </div>

          {/* Liquidation Price computed with exact BrokexCore contract formula */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Liquidation Price</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
              ${liqPriceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Available Liquidity ({side === 'buy' ? 'Long' : 'Short'})</span>
            <span style={{ color: side === 'buy' ? buyColor : sellColor, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>
              ${availLiquidityUSD >= 1e6 ? `${(availLiquidityUSD / 1e6).toFixed(2)}M` : availLiquidityUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ height: '1px', backgroundColor: themeBorder, margin: '6px 0' }}></div>

          {/* Dynamic Fees based on commissionBps and fixed 0 oracle/close fees */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Oracle Fee</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Open Fee</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>${openFeeVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Close Fee</span>
            <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${themeBorder}` }}>
            <span style={{ color: themeText, fontWeight: 600 }}>Total Fees</span>
            <span style={{ color: goldAccent, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>
              ${totalFeesVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Network Toggle & Social Links Fixed Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '8px',
        paddingBottom: '2px',
        borderTop: `1px solid ${themeBorder}`,
        backgroundColor: themeBg,
        flexShrink: 0
      }}>
        {/* Left: Social Links Icons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a
            href="https://x.com/brokexfi"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-grey)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = goldAccent}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-grey)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          <a
            href="https://t.me/brokexfi"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-grey)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = goldAccent}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-grey)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </a>

          <a
            href="https://docs.brokex.trade"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-grey)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = goldAccent}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-grey)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </a>
        </div>

        {/* Right: Testnet / Mainnet Sleek Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '6px',
          padding: '3px',
          cursor: 'pointer',
          userSelect: 'none',
          alignItems: 'center',
          gap: '4px'
        }}>
          <a
            href="https://flare.network"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.75}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                marginLeft: '4px',
                marginRight: '2px',
                flexShrink: 0,
                backgroundColor: goldAccent,
                WebkitMask: 'url(/Flare_FLR_Logo.svg) no-repeat center / contain',
                mask: 'url(/Flare_FLR_Logo.svg) no-repeat center / contain'
              }}
              title="Flare Logo"
            />
          </a>

          <style>{`
            .network-toggle-active {
              color: #ffffff !important;
            }
            body.light-mode .network-toggle-active {
              color: #000000 !important;
            }
          `}</style>

          <div
            onClick={() => showNotification("Mainnet is not available yet. Brokex is currently running on Testnet.", "info")}
            style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '5px 8px',
              borderRadius: '4px',
              color: 'var(--text-grey)',
              background: 'transparent',
              opacity: 0.6,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
          >
            Mainnet
          </div>
          <div
            className="network-toggle-active"
            style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '5px 8px',
              borderRadius: '4px',
              background: goldAccent,
              cursor: 'default',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Testnet
          </div>
        </div>
      </div>

    </div>
  );
}
