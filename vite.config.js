import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { resellerAutoOrder10amInvariant } from './vite.reseller-auto-order-10am-invariant.js'

export default defineConfig({
  plugins: [resellerAutoOrder10amInvariant(), productionForecastPrintInvariant(), react()],
})
