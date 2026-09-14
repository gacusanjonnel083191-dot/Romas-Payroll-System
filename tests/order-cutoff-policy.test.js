import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { enforceResellerAutoOrder10am } from '../vite.reseller-auto-order-10am-invariant.js'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const builtApp = enforceResellerAutoOrder10am(app, '/src/App.jsx')

function extractFunction(name) {
 const start = builtApp.indexOf(`function ${name}(`)
 assert.ok(start >= 0, `${name} exists`)
 const end = builtApp.indexOf('\n}', start)
 assert.ok(end > start)
 return builtApp.slice(start, end + 2)
}

const context = vm.createContext({ Date, Intl })
for (const name of ['PH_TIME_ZONE', 'ORDER_CUTOFF_TIME', 'ORDER_CUTOFF_LABEL']) {
 vm.runInContext(builtApp.match(new RegExp(`const ${name} = [^\\r\\n]+`))[0], context)
}
for (const name of ['safeNum', 'formatDateLocal', 'getPHDateTimeParts', 'getPHDateOffsetString', 'getOrderCutoffStatus', 'getDefaultResellerOrderDeliveryDate']) {
 vm.runInContext(extractFunction(name), context)
}

for (const time of ['12:59:00', '13:00:00', '13:01:00', '23:59:59']) {
 test(`manual orders and invoice edits remain unlocked at ${time} Philippine time`, () => {
  context.asOf = new Date(`2026-09-14T${time}+08:00`)
  for (const date of ['2026-09-14', '2026-09-15', '2026-09-16']) {
   context.deliveryDate = date
   assert.equal(vm.runInContext('getOrderCutoffStatus(deliveryDate, asOf).locked', context), false)
  }
  assert.equal(vm.runInContext('getOrderCutoffStatus(null, asOf).locked', context), false)
  assert.equal(vm.runInContext('getDefaultResellerOrderDeliveryDate(asOf)', context), '2026-09-15')
 })
}

test('tomorrow rolls over at Philippine midnight without skipping a delivery day', () => {
 context.asOf = new Date('2026-09-15T00:00:00+08:00')
 assert.equal(vm.runInContext('getDefaultResellerOrderDeliveryDate(asOf)', context), '2026-09-16')
})

test('automatic-order timing remains unchanged and manual deadline copy is removed', () => {
 assert.ok(builtApp.includes("getPHDateTimeParts().totalMinutes >= minutesFromTime('10:00')"))
 assert.ok(builtApp.includes('value="10:00 AM every day (fixed)"'))
 assert.equal(builtApp.includes('Manual orders remain open until 1:00 PM.'), false)
 assert.equal(builtApp.includes('Manual order deadline:'), false)
})

test('database migration removes only the manual cutoff block and preserves staff review', () => {
 const original = readFileSync(new URL('../supabase/migrations/20260909050000_reseller_automatic_ordering.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
 const migration = readFileSync(new URL('../supabase/migrations/20260914060612_remove_manual_order_cutoff.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
 const block = migration.match(/\$cutoff\$([\s\S]*?)\$cutoff\$/)[1]
 const guard = original.split('create or replace function private.guard_reseller_order_write()')[1].split('$$;')[0]
 assert.equal(guard.split(block).length - 1, 1)
 const updated = guard.replace(block, '')
 assert.equal(updated.includes("time '13:00'"), false)
 assert.ok(updated.includes("if v_auto then raise exception 'Automatic orders must be changed through staff review.' using errcode='42501'; end if;"))
 assert.ok(updated.includes("if tg_op='DELETE' then return old; else return new; end if;"))
})
