import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { resellerManualCopyLastOrder } from './vite.reseller-manual-copy-last-order.js'
import { resellerAutoOrder10amInvariant } from './vite.reseller-auto-order-10am-invariant.js'
import { payrollMealBreakExemptionInvariant } from './vite.payroll-meal-break-exemption-invariant.js'

export default defineConfig({
  plugins: [payrollMealBreakExemptionInvariant(), resellerAutoOrder10amInvariant(), resellerManualCopyLastOrder(), productionForecastPrintInvariant(), react()],
})
