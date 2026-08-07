import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { NotificationProvider } from './context/NotificationContext'
import { PriceProvider } from './context/PriceContext'
import { DataProvider } from './context/DataContext'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { wagmiConfig } from './config/wagmi'

const queryClient = new QueryClient()

// Prevent pinch-to-zoom gestures on mobile devices
if (typeof window !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#BC8961',
          accentColorForeground: '#000000',
          borderRadius: 'medium',
          overlayBlur: 'small',
        })}>
          <NotificationProvider>
            <DataProvider>
              <PriceProvider>
                <App />
              </PriceProvider>
            </DataProvider>
          </NotificationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
