import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useNotifications } from '../../context/NotificationContext';
import BrokexVaultAbi from '../../abi/BrokexVault.json';

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0xfDA686186510208C4E91028Fed671Dd9c35111d3';
const VAULT_ADDRESS = import.meta.env.VITE_BROKEX_VAULT_ADDRESS || '0x76bF375fD02D76074ca9F371E8f9A25d1DA38934';

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

export default function VaultDetails() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [side, setSide] = useState('deposit'); // 'deposit' | 'withdraw'
  const [depositMode, setDepositMode] = useState('USDC'); // 'USDC' | 'LP'
  const [amount, setAmount] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const goldAccent = '#BC8961';
  const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
  const themeBg = 'var(--panel-bg, #0d0d0d)';
  const themeControlBg = 'rgba(255, 255, 255, 0.02)';
  const themeBorder = 'var(--border-color, #222)';
  const themeText = 'var(--text-dark, #f5f5f5)';
  const themeTextMuted = 'var(--text-grey, #888888)';

  const buyColor = '#3b82f6'; // Blue
  const sellColor = '#ef4444'; // Red
  const buyColorBg = 'rgba(59, 130, 246, 0.1)';
  const sellColorBg = 'rgba(239, 68, 68, 0.1)';

  // Read USDC Wallet Balance
  const { data: rawUsdcBal } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 114,
    query: { enabled: Boolean(address), refetchInterval: 5000 }
  });

  // Read BLP Token Balance
  const { data: rawBlpBal } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BrokexVaultAbi.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 114,
    query: { enabled: Boolean(address), refetchInterval: 5000 }
  });

  // Read LP Token Price from Vault
  const { data: rawLpPrice } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BrokexVaultAbi.abi,
    functionName: 'getLPPrice',
    chainId: 114,
    query: { refetchInterval: 5000 }
  });

  const lpTokenPrice = (() => {
    if (!rawLpPrice) return 1.0;
    try {
      const num = Number(rawLpPrice.toString());
      return num > 100000 ? num / 1e6 : (num > 0 ? num : 1.0);
    } catch (e) {
      return 1.0;
    }
  })();

  const usdcWallet = (() => {
    if (!rawUsdcBal) return 0.0;
    try {
      return Number(rawUsdcBal.toString()) / 1e6;
    } catch (e) {
      return 0.0;
    }
  })();

  const blpBalance = (() => {
    if (!rawBlpBal) return 0.0;
    try {
      return Number(rawBlpBal.toString()) / 1e6;
    } catch (e) {
      return 0.0;
    }
  })();

  const activeBalance = side === 'deposit' ? usdcWallet : blpBalance;
  const currencyLabel = side === 'deposit' ? (depositMode === 'USDC' ? 'USDC' : 'BLP') : 'BLP';

  const amountNum = parseFloat(amount || 0);
  const feeRate = 0.0015; // 0.15%
  const feeUSD = amountNum * feeRate;

  // Estimation math
  const estLPMinted = side === 'deposit' ? (depositMode === 'USDC' ? (amountNum / lpTokenPrice) : amountNum) : 0;
  const estUSDCRequired = side === 'deposit' && depositMode === 'LP' ? (amountNum * lpTokenPrice) : 0;
  const estUSDCReceived = side === 'withdraw' ? (amountNum * lpTokenPrice) : 0;

  // Percentage helper click
  const handlePercentClick = (pct) => {
    if (pct === 1.0) {
      // 100% MAX: floor to 6 decimals to prevent overshooting balance by rounding up
      const floored = Math.floor(activeBalance * 1e6) / 1e6;
      setAmount(floored.toString());
    } else {
      const calculated = activeBalance * pct;
      setAmount((Math.floor(calculated * 100) / 100).toString());
    }
  };

  // Submit Vault Deposit / Withdraw Action
  const handleVaultAction = async () => {
    if (!isConnected || !address) {
      if (openConnectModal) openConnectModal();
      return;
    }

    if (amountNum <= 0) {
      if (showNotification) showNotification('Please enter a valid amount', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const rpcUrl = import.meta.env.VITE_COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';

      if (side === 'deposit') {
        let usdcNeededScaled = 0n;
        if (depositMode === 'USDC') {
          usdcNeededScaled = BigInt(Math.floor(amountNum * 1e6));
        } else {
          // Deposit LP mode: calculate USDC required with a 2% buffer/margin for price fluctuations
          const usdcNeededFloat = amountNum * lpTokenPrice * 1.02;
          usdcNeededScaled = BigInt(Math.floor(usdcNeededFloat * 1e6));
        }

        // 1. Check USDC Balance
        const rawUsdcVal = rawUsdcBal ? BigInt(rawUsdcBal.toString()) : 0n;
        if (rawUsdcVal < usdcNeededScaled) {
          if (showNotification) showNotification('Insufficient USDC balance in wallet', 'error');
          setIsSubmitting(false);
          return;
        }

        // 2. Check and approve USDC Allowance for Vault
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
                data: `0xdd62572e000000000000000000000000${address.slice(2).toLowerCase()}000000000000000000000000${VAULT_ADDRESS.slice(2).toLowerCase()}`
              },
              'latest'
            ]
          })
        });
        const allowanceJson = await allowanceRes.json();
        const currentAllowance = allowanceJson.result ? BigInt(allowanceJson.result) : 0n;

        if (currentAllowance < usdcNeededScaled) {
          if (showNotification) showNotification('Approving USDC for BrokexVault...', 'info');
          const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
          const approveTxHash = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [VAULT_ADDRESS, maxUint256]
          });
          if (showNotification) showNotification('USDC approved for Vault successfully!', 'success', approveTxHash);
        }

        // 3. Execute deposit or depositLP
        if (depositMode === 'USDC') {
          const usdcAmountScaled = BigInt(Math.floor(amountNum * 1e6));
          const txHash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: BrokexVaultAbi.abi,
            functionName: 'deposit',
            args: [usdcAmountScaled]
          });
          if (showNotification) showNotification(`Deposit of ${amountNum} USDC submitted!`, 'success', txHash);
        } else {
          const lpAmountScaled = BigInt(Math.floor(amountNum * 1e6));
          const txHash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: BrokexVaultAbi.abi,
            functionName: 'depositLP',
            args: [lpAmountScaled]
          });
          if (showNotification) showNotification(`Deposit of ${amountNum} BLP submitted!`, 'success', txHash);
        }
      } else {
        // WITHDRAWAL: Call requestWithdraw(lpAmount)
        // If amount equals or exceeds full wallet balance, use exact raw BigInt balance to avoid precision overflow
        const rawBal = rawBlpBal ? BigInt(rawBlpBal.toString()) : 0n;
        const calculatedScaled = BigInt(Math.floor(amountNum * 1e6));
        const lpAmountScaled = (rawBal > 0n && calculatedScaled >= rawBal - 100n) ? rawBal : calculatedScaled;

        const txHash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: BrokexVaultAbi.abi,
          functionName: 'requestWithdraw',
          args: [lpAmountScaled]
        });
        if (showNotification) showNotification(`Withdrawal request of ${amountNum} BLP submitted!`, 'success', txHash);
      }
    } catch (err) {
      console.error("Vault action error:", err);
      if (showNotification) showNotification(err?.shortMessage || err?.message || 'Vault transaction failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch pending withdrawals for connected user
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const apiBase = import.meta.env.VITE_FLARE_API_URL || 'https://apiflare.brokex.trade';

  useEffect(() => {
    let isMounted = true;
    const fetchPendingWithdrawals = async () => {
      if (!address) {
        if (isMounted) setPendingRequests([]);
        return;
      }
      try {
        setLoadingPending(true);
        const res = await fetch(`${apiBase}/api/vault/withdrawals/user/${address}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.requests)) {
            setPendingRequests(data.requests.filter(r => r.isPending));
          }
        }
      } catch (err) {
        console.error("Fetch pending withdrawals error:", err);
      } finally {
        if (isMounted) setLoadingPending(false);
      }
    };

    fetchPendingWithdrawals();
    const interval = setInterval(fetchPendingWithdrawals, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [address, apiBase]);

  return (
    <div className="order panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      padding: '8px',
      boxSizing: 'border-box',
      gap: '12px',
      backgroundColor: themeBg,
      color: themeText,
      fontSize: '12px'
    }}>
      <style>{`
        .order.panel::-webkit-scrollbar {
          display: none;
        }
        .order.panel {
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
      `}</style>

      {/* Top Header Label */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${themeBorder}`,
        paddingBottom: '6px',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', fontWeight: 'bold', color: goldAccent }}>
          [ LP LIQUIDITY PANEL ]
        </span>
        <span style={{ fontSize: '8px', fontFamily: 'Source Code Pro', color: themeTextMuted }}>
          BLP VAULT
        </span>
      </div>

      {/* Top Tabs (Deposit / Withdraw) */}
      <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
        <div
          onClick={() => {
            setSide('deposit');
            setAmount('100');
          }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1, 
            padding: '6px 8px', 
            cursor: 'pointer', 
            borderRadius: '4px', 
            backgroundColor: side === 'deposit' ? buyColorBg : 'transparent', 
            border: `1px solid ${side === 'deposit' ? buyColor : 'transparent'}`, 
            transition: 'all 0.15s' 
          }}>
          <div style={{ color: side === 'deposit' ? buyColor : themeTextMuted, fontWeight: side === 'deposit' ? 600 : 400, fontSize: '11px', textTransform: 'uppercase' }}>Deposit</div>
          <div style={{ color: side === 'deposit' ? buyColor : themeTextMuted, fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>USDC → BLP</div>
        </div>
        <div
          onClick={() => {
            setSide('withdraw');
            setAmount('100');
          }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1, 
            padding: '6px 8px', 
            cursor: 'pointer', 
            borderRadius: '4px', 
            backgroundColor: side === 'withdraw' ? sellColorBg : 'transparent', 
            border: `1px solid ${side === 'withdraw' ? sellColor : 'transparent'}`, 
            transition: 'all 0.15s' 
          }}>
          <div style={{ color: side === 'withdraw' ? sellColor : themeTextMuted, fontWeight: side === 'withdraw' ? 600 : 400, fontSize: '11px', textTransform: 'uppercase' }}>Withdraw</div>
          <div style={{ color: side === 'withdraw' ? sellColor : themeTextMuted, fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>BLP → USDC</div>
        </div>
      </div>

      {/* Available to Mint/Burn */}
      <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '0 2px' }}>
        <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Available Wallet</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            {activeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencyLabel}
          </span>
        </div>
      </div>

      {/* Input Box for amount to Swap */}
      <div 
        className="vault-input-box"
        style={{ 
          flexShrink: 0, 
          backgroundColor: themeControlBg, 
          borderRadius: '6px', 
          border: `1px solid ${isInputFocused ? goldAccent : themeBorder}`, 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'border-color 0.2s ease',
          boxShadow: isInputFocused ? '0 0 6px rgba(188, 137, 97, 0.25)' : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isInputFocused) e.currentTarget.style.borderColor = goldAccent;
        }}
        onMouseLeave={(e) => {
          if (!isInputFocused) e.currentTarget.style.borderColor = themeBorder;
        }}
      >
        <div style={{ padding: '6px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted }}>Amount to {side === 'deposit' ? 'Deposit' : 'Withdraw'}</span>
            <span style={{ fontSize: '10px', color: goldAccent, cursor: 'pointer', fontFamily: 'Source Code Pro' }} onClick={() => handlePercentClick(1)}>MAX</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              className="no-spinners"
              value={amount}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onChange={(e) => setAmount(e.target.value)}
              style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', padding: 0, width: '150px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 600, fontSize: '12px', fontFamily: 'Source Code Pro' }}>
              {currencyLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Percentage Helpers Row (25%, 50%, 75%, 100%) */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {[0.25, 0.50, 0.75, 1.0].map((pct, idx) => (
          <button
            key={idx}
            onClick={() => handlePercentClick(pct)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '10px',
              border: `1px solid ${themeBorder}`,
              borderRadius: '4px',
              backgroundColor: themeControlBg,
              color: themeTextMuted,
              fontFamily: 'Source Code Pro, monospace',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = goldAccent;
              e.currentTarget.style.color = goldAccent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = themeBorder;
              e.currentTarget.style.color = themeTextMuted;
            }}
          >
            {pct * 100}%
          </button>
        ))}
      </div>

      {/* Deposit Mode Selector (USDC vs LP token target) */}
      {side === 'deposit' && (
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => setDepositMode('USDC')}
            style={{
              flex: 1,
              padding: '5px',
              fontSize: '10px',
              border: `1px solid ${depositMode === 'USDC' ? goldAccent : themeBorder}`,
              borderRadius: '4px',
              backgroundColor: depositMode === 'USDC' ? goldAccentLight : themeControlBg,
              color: depositMode === 'USDC' ? goldAccent : themeTextMuted,
              fontFamily: 'Source Code Pro, monospace',
              fontWeight: depositMode === 'USDC' ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            Deposit Amount (USDC)
          </button>
          <button
            onClick={() => setDepositMode('LP')}
            style={{
              flex: 1,
              padding: '5px',
              fontSize: '10px',
              border: `1px solid ${depositMode === 'LP' ? goldAccent : themeBorder}`,
              borderRadius: '4px',
              backgroundColor: depositMode === 'LP' ? goldAccentLight : themeControlBg,
              color: depositMode === 'LP' ? goldAccent : themeTextMuted,
              fontFamily: 'Source Code Pro, monospace',
              fontWeight: depositMode === 'LP' ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            Target LP Amount (depositLP)
          </button>
        </div>
      )}

      {/* Action Submit Button */}
      <div style={{ flexShrink: 0, display: 'flex', marginTop: '4px' }}>
        <button
          onClick={handleVaultAction}
          disabled={isSubmitting}
          style={{
            flex: 1,
            backgroundColor: side === 'deposit' ? buyColor : sellColor,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'Source Code Pro, monospace',
            textTransform: 'uppercase',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
            boxShadow: `0 4px 12px ${side === 'deposit' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.opacity = '1'; }}
        >
          {isSubmitting
            ? 'Processing Transaction...'
            : (side === 'deposit'
              ? (depositMode === 'USDC' ? 'DEPOSIT USDC (deposit)' : 'DEPOSIT LP (depositLP)')
              : 'REQUEST WITHDRAWAL (requestWithdraw)')
          }
        </button>
      </div>

      {/* Metrics List */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', padding: '0 2px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Price per BLP</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            ${lpTokenPrice.toFixed(4)}
          </span>
        </div>

        {side === 'deposit' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Est. BLP Received</span>
            <span style={{ color: buyColor, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              {estLPMinted.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} BLP
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Est. USDC Received</span>
            <span style={{ color: buyColor, fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
              {estUSDCReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Execution Time</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>Immediate</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Slippage Tolerance</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>0.30%</span>
        </div>

        <div style={{ height: '1px', backgroundColor: themeBorder, margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted }}>Transaction Fee (0.15%)</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
            ${feeUSD.toFixed(2)} USDC
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${themeBorder}` }}>
          <span style={{ color: themeText, fontWeight: 'bold' }}>Total Cost / Debit</span>
          <span style={{ color: goldAccent, fontWeight: 'bold', fontSize: '12px', fontFamily: 'Source Code Pro, monospace' }}>
            {side === 'deposit'
              ? `$${(amountNum + feeUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
              : `${(amountNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BLP`
            }
          </span>
        </div>

      </div>

      {/* Divider Separator */}
      <div style={{ height: '1px', backgroundColor: themeBorder, margin: '6px 0', flexShrink: 0 }} />

      {/* VAULT PENDING WITHDRAWALS SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
        
        {/* Section Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '4px'
        }}>
          <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', fontWeight: 'bold', color: goldAccent }}>
            [ PENDING WITHDRAWALS ]
          </span>
          <span style={{ fontSize: '8px', fontFamily: 'Source Code Pro', color: buyColor, fontWeight: 'bold' }}>
            {pendingRequests.length} PENDING
          </span>
        </div>

        {/* Pending Requests List */}
        {pendingRequests.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingRequests.map((req, idx) => {
              const rawLp = req.lpAmountRemaining || req.lpAmount || '0';
              const lpFormatted = (Number(rawLp) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const estUsdc = (Number(rawLp) / 1e6 * lpTokenPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <div key={req.id || idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  backgroundColor: 'rgba(59, 130, 246, 0.03)',
                  border: `1px solid ${buyColor}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontFamily: 'Source Code Pro, monospace'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', color: themeTextMuted }}>
                      WITHDRAW ID: <span style={{ color: themeText, fontWeight: 'bold' }}>#{req.id}</span>
                    </span>
                    <span style={{
                      fontSize: '8px',
                      color: '#fff',
                      backgroundColor: buyColor,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      letterSpacing: '0.04em'
                    }}>
                      POSITION #{req.queuePosition || 1}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '10px', color: themeTextMuted }}>Amount Requested:</span>
                    <span style={{ fontSize: '11px', color: themeText, fontWeight: 'bold' }}>
                      {lpFormatted} BLP <span style={{ fontSize: '9px', color: themeTextMuted }}>(~${estUsdc})</span>
                    </span>
                  </div>

                  {/* Queue Details: Requests ahead & LP Ahead */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    paddingTop: '4px',
                    marginTop: '2px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    fontSize: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: themeTextMuted }}>Requests Ahead:</span>
                      <span style={{ color: goldAccent, fontWeight: 'bold' }}>
                        {req.requestsAhead !== undefined ? req.requestsAhead : 0} {req.requestsAhead === 1 ? 'request' : 'requests'}
                      </span>
                    </div>
                    {req.lpAhead !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: themeTextMuted }}>Volume Ahead:</span>
                        <span style={{ color: themeText, fontWeight: 'bold' }}>
                          {(Number(req.lpAhead) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BLP
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.015)',
            border: `1px solid ${themeBorder}`,
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                backgroundColor: 'rgba(188, 137, 97, 0.1)',
                border: `1px solid ${goldAccent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: goldAccent,
                fontSize: '11px',
                fontWeight: 'bold',
                flexShrink: 0
              }}>
                i
              </div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
                Withdrawal Liquidity Queue
              </span>
            </div>

            <span style={{ fontSize: '10px', color: themeTextMuted, lineHeight: '1.4' }}>
              When you request a withdrawal, your BLP tokens enter the on-chain FIFO queue. <strong style={{ color: goldAccent }}>As soon as free liquidity/funds become available in the pool, your USDC is automatically paid out to your wallet.</strong>
            </span>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              border: `1px dashed ${themeBorder}`,
              borderRadius: '4px',
              fontSize: '9.5px',
              fontFamily: 'Source Code Pro, monospace'
            }}>
              <span style={{ color: themeTextMuted }}>Pool Liquidity Queue:</span>
              <span style={{ color: goldAccent, fontWeight: 'bold' }}>READY • 0 WAITING</span>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
