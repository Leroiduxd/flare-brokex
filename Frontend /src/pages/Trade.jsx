import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import TopNav from '../components/TopNav'
import Chart from '../components/Chart'
import OrderBook from '../components/OrderBook'
import Positions from '../components/Positions'
import OrderPanel from '../components/OrderPanel'
import Ticker from '../components/Ticker'
import MarketSelector from '../components/MarketSelector'

export default function Trade() {
  const [isMarketSelectorOpen, setIsMarketSelectorOpen] = useState(false)
  const isDragging = useRef(false)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return

      const windowHeight = window.innerHeight
      const mouseY = e.clientY
      const tickerHeight = 40
      const bottomOffset = 55 // gap (5) + ticker (40) + padding (10)
      const topOffset = 65 // nav (50) + gap (5) + padding (10)
      const totalFixed = topOffset + bottomOffset + 5 // + gap between chart and positions

      let newHeight = windowHeight - mouseY - bottomOffset

      // 1. Snapping: much more sensitive to opening
      const minOpenHeight = 180
      const snapThreshold = 80 // Small pull needed to open

      if (newHeight < snapThreshold) {
        newHeight = 40
      } else if (newHeight < minOpenHeight) {
        newHeight = minOpenHeight
      }

      // 2. Chart constraint: Chart must be at least 40% of window height
      const maxPositionsHeight = (windowHeight * 0.6) - totalFixed

      if (newHeight > maxPositionsHeight) {
        newHeight = maxPositionsHeight
      }

      // Final safety check
      if (newHeight >= 40) {
        document.documentElement.style.setProperty('--positions-height', `${newHeight}px`)
      }
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = 'default'
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div className="app-layout">
      <Sidebar />
      <TopNav onOpenMarket={() => setIsMarketSelectorOpen(true)} />
      <Chart />
      <OrderBook />
      <div
        className="resizer"
        onMouseDown={(e) => {
          isDragging.current = true
          document.body.style.cursor = 'ns-resize'
        }}
      />
      <Positions />
      <OrderPanel />
      <Ticker />
      <MarketSelector isOpen={isMarketSelectorOpen} onClose={() => setIsMarketSelectorOpen(false)} />
    </div>
  )
}
