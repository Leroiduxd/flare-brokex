import { createChart, CandlestickSeries } from 'lightweight-charts';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><div id="container"></div>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;

const chart = createChart(document.getElementById('container'));
try {
  chart.addSeries(CandlestickSeries, {
    upColor: '#3b82f6',
    downColor: '#ef4444',
    borderVisible: false,
    wickUpColor: '#3b82f6',
    wickDownColor: '#ef4444',
  });
  console.log("Success");
} catch (e) {
  console.error("Error:", e);
}
