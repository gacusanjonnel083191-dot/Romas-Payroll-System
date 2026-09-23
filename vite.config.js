import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { resellerManualCopyLastOrder } from './vite.reseller-manual-copy-last-order.js'
import { payrollMealBreakExemptionInvariant } from './vite.payroll-meal-break-exemption-invariant.js'
import { employeeOTFilingInvariant } from './vite.employee-ot-filing-invariant.js'
import { noScheduleGraceInvariant } from './vite.no-schedule-grace-invariant.js'

const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'development'
const releaseSummary = process.env.VERCEL_GIT_COMMIT_MESSAGE || 'General improvements and fixes.'
const releasedAt = new Date().toISOString()

const appUpdateMetadata = () => ({
  name: 'app-update-metadata',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'app-update.json',
      source: JSON.stringify({ buildId, summary: releaseSummary, releasedAt }, null, 2),
    })
  },
})

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [appUpdateMetadata(), payrollMealBreakExemptionInvariant(), employeeOTFilingInvariant(), noScheduleGraceInvariant(), resellerManualCopyLastOrder(), productionForecastPrintInvariant(), react()],
})
