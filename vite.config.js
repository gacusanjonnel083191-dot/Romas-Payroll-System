import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { overtimePayrollInvariant } from './vite.overtime-payroll-invariant.js'

export default defineConfig({
  plugins: [overtimePayrollInvariant(), productionForecastPrintInvariant(), react()],
})
