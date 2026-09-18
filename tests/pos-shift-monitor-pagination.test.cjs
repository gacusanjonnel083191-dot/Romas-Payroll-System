const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync(new URL('../src/App.jsx', `file://${__filename}`), 'utf8')
function extract(start, end) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from)
  assert.ok(from >= 0 && to > from, `missing source: ${start}`)
  return source.slice(from, to)
}
const fetchSource = extract(' async function fetchAllPosRows(', ' async function fetchPosRowsByValues(')
const monitorSource = extract(' async function loadShiftClosingMonitor(', ' function saveCurrentShiftDraftBeforeDateChange(')

function createMonitor({ failSecondPage = false } = {}) {
  const recent = Array.from({ length: 1000 }, (_, i) => ({
    id: `recent-${String(i).padStart(4, '0')}`, outlet_id: 'OUTLET-MALUED',
    business_date: '2026-09-10', status: 'paid', net_total: 1, payment_method: 'cash'
  }))
  const august = [1, 2].map(i => ({ id: `aug-${i}`, outlet_id: 'OUTLET-MALUED', business_date: '2026-08-05', status: 'paid', net_total: 10, payment_method: 'cash' }))
  const closing = { id: 'closing-aug', outlet_id: 'OUTLET-MALUED', business_date: '2026-08-05', total_sales: 20, cash_sales: 20, gcash_sales: 0, transaction_count: 2 }
  const daily = { id: 'daily-aug', sale_date: '2026-08-05', notes: 'SAGS-POS-SHIFT-CLOSING|OUTLET-MALUED|2026-08-05', total_walkin: 20, total_revenue: 20 }
  const tables = { pos_sales: [...recent, ...august], pos_shift_closings: [closing], daily_sales: [daily] }
  const offsets = []
  const supabase = { from(table) {
    return {
      select() { return this }, eq() { return this }, gte() { return this }, lte() { return this },
      order() { return this },
      async range(from, to) {
        offsets.push([table, from])
        if (failSecondPage && table === 'pos_sales' && from === 1000) return { data: null, error: new Error('page unavailable') }
        return { data: tables[table].slice(from, to + 1), error: null }
      }
    }
  } }
  let savedRows = null
  let savedError = ''
  const deps = {
    supabase, POS_OUTLET_ID: 'OUTLET-MALUED', POS_SHIFT_MONITOR_DAYS: 90,
    getPHDateTimeParts: () => ({ date: '2026-09-18' }), getTodayDate: () => '2026-09-18',
    addDaysToDateString: () => '2026-06-20',
    fetchPosSalePaymentsForSales: async sales => { assert.equal(sales.length, 1002); return [] },
    summarizeActivePosSales: sales => ({ transactionCount: sales.length, totalSales: sales.reduce((n, s) => n + s.net_total, 0), cashSales: sales.reduce((n, s) => n + s.net_total, 0), gcashSales: 0 }),
    getPosShiftDailySalesMarker: (outlet, date) => `SAGS-POS-SHIFT-CLOSING|${outlet}|${date}`,
    moneyRound: n => Number(n || 0), safeNum: n => Number(n || 0), dateStringDiffDays: () => 0,
    setShiftClosingLoading() {}, setShiftClosingError: s => { savedError = s }, setShiftClosingRows: rows => { savedRows = rows }
  }
  const factory = new Function('d', `with (d) { ${fetchSource}\n${monitorSource}\nreturn loadShiftClosingMonitor }`)
  return { load: factory(deps), offsets, get rows() { return savedRows }, get error() { return savedError } }
}

test('a completed August shift remains CLOSED + POSTED beyond the first 1,000 sales', async () => {
  const monitor = createMonitor()
  const rows = await monitor.load()
  assert.deepEqual(monitor.offsets.filter(([table]) => table === 'pos_sales'), [['pos_sales', 0], ['pos_sales', 1000]])
  const august = rows.find(row => row.date === '2026-08-05')
  assert.equal(august.statusCode, 'closed')
  assert.equal(august.transactionCount, 2)
  assert.equal(august.totalSales, 20)
  assert.equal(august.issues.length, 0)
})

test('a failed later page reports an error instead of publishing partial review results', async () => {
  const monitor = createMonitor({ failSecondPage: true })
  assert.deepEqual(await monitor.load(), [])
  assert.equal(monitor.rows, null)
  assert.match(monitor.error, /page unavailable/)
})
