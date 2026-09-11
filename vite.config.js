import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { resellerManualCopyLastOrder } from './vite.reseller-manual-copy-last-order.js'

export default defineConfig({
  plugins: [resellerManualCopyLastOrder(), productionForecastPrintInvariant(), react()],
})
