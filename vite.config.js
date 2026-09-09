import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'

export default defineConfig({
  plugins: [productionForecastPrintInvariant(), react()],
})
