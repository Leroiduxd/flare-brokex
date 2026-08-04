import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

const chainId = Number(import.meta.env.VITE_COSTON2_CHAIN_ID || 114);
const rpcUrl = import.meta.env.VITE_COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';
const chainName = import.meta.env.VITE_COSTON2_CHAIN_NAME || 'Flare Testnet Coston2';
const explorerUrl = import.meta.env.VITE_COSTON2_EXPLORER_URL || 'https://coston2-explorer.flare.network';
const currencyName = import.meta.env.VITE_COSTON2_CURRENCY_NAME || 'Coston2 Flare';
const currencySymbol = import.meta.env.VITE_COSTON2_CURRENCY_SYMBOL || 'C2FLR';
const currencyDecimals = Number(import.meta.env.VITE_COSTON2_CURRENCY_DECIMALS || 18);
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

export const customFlareCoston2 = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: {
    name: currencyName,
    symbol: currencySymbol,
    decimals: currencyDecimals,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: explorerUrl },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'Brokex',
  projectId: projectId,
  chains: [customFlareCoston2],
  ssr: false,
});
