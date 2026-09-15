import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { resellerManualCopyLastOrder } from './vite.reseller-manual-copy-last-order.js'
import { resellerAutoOrder10amInvariant } from './vite.reseller-auto-order-10am-invariant.js'
import { payrollMealBreakExemptionInvariant } from './vite.payroll-meal-break-exemption-invariant.js'
import { employeeOTFilingInvariant } from './vite.employee-ot-filing-invariant.js'

export default defineConfig({
  plugins: [payrollMealBreakExemptionInvariant(), employeeOTFilingInvariant(), resellerAutoOrder10amInvariant(), resellerManualCopyLastOrder(), productionForecastPrintInvariant(), react()],
})
