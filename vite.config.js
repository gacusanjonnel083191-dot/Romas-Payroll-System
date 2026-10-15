import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { PRODUCTS } from './customer-ordering-preview/catalog.mjs'
import { productionForecastPrintInvariant } from './vite.production-forecast-print-invariant.js'
import { resellerManualCopyLastOrder } from './vite.reseller-manual-copy-last-order.js'
import { payrollMealBreakExemptionInvariant } from './vite.payroll-meal-break-exemption-invariant.js'
import { payrollAdjustmentDedupInvariant } from './vite.payroll-adjustment-dedup-invariant.js'
import { employeeOTFilingInvariant } from './vite.employee-ot-filing-invariant.js'
import { payrollOverbreakDeductionInvariant } from './vite.payroll-overbreak-deduction-invariant.js'
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

const customerOrderingAssets = () => ({
  name: 'customer-ordering-assets',
  generateBundle() {
    const paths = new Set(['logo.png', ...PRODUCTS.map(product => product.cleanImage.replace(/^\.\/assets\//, ''))])
    for (const path of paths) {
      this.emitFile({
        type: 'asset',
        fileName: `customer-ordering-preview/assets/${path}`,
        source: readFileSync(resolve(import.meta.dirname, 'customer-ordering-preview/assets', path)),
      })
    }
  },
})

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        customerOrderStaff: resolve(import.meta.dirname, 'public-ordering-staff.html'),
        customerOrdering: resolve(import.meta.dirname, 'customer-ordering-preview/index.html'),
      },
    },
  },
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [appUpdateMetadata(), customerOrderingAssets(), payrollMealBreakExemptionInvariant(), payrollAdjustmentDedupInvariant(), employeeOTFilingInvariant(), payrollOverbreakDeductionInvariant(), noScheduleGraceInvariant(), resellerManualCopyLastOrder(), productionForecastPrintInvariant(), react()],
})
