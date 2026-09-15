'use strict'

const fs = require('fs')
const { applyEgressOptimization } = require('./scripts/supabase-egress-optimizer.cjs')

const path = 'src/App.jsx'
const source = fs.readFileSync(path, 'utf8')
const optimized = applyEgressOptimization(source)

if (optimized !== source) {
  fs.writeFileSync(path, optimized, 'utf8')
  console.log('Supabase egress optimization applied: Foundation is on-demand/guarded and attendance validation is pending-only/lazy.')
} else {
  console.log('Supabase egress optimization already present; no source changes were needed.')
}
