import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Markets from './pages/Markets'
import Trade from './pages/Trade'
import Portfolio from './pages/Portfolio'
import Vault from './pages/Vault'
import useIsMobile from './hooks/useIsMobile'
import MobileMarkets from './mobile/pages/MobileMarkets'
import MobileTrade from './mobile/pages/MobileTrade'
import MobilePortfolio from './mobile/pages/MobilePortfolio'
import MobileVault from './mobile/pages/MobileVault'
import './App.css'

function App() {
  const isMobile = useIsMobile();

  return (
    <Router>
      <Routes>
        <Route path="/" element={isMobile ? <MobileTrade /> : <Trade />} />
        <Route path="/portfolio" element={isMobile ? <MobileTrade /> : <Portfolio />} />
        <Route path="/market" element={isMobile ? <MobileTrade /> : <Markets />} />
        <Route path="/vault" element={isMobile ? <MobileTrade /> : <Vault />} />
        <Route path="*" element={isMobile ? <MobileTrade /> : <Trade />} />
      </Routes>
    </Router>
  )
}

export default App

