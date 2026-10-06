import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const loader = source.slice(source.indexOf('async function loadFoundationData('))
const bindings = loader.match(/const \[([\s\S]*?)\] = await Promise\.all\(\[/)?.[1]
const queryList = loader.match(/\] = await Promise\.all\(\[([\s\S]*?)\n \]\)/)?.[1]

test('Foundation invoice and payment responses map to their matching queries', () => {
  assert.ok(bindings && queryList)
  const names = bindings.split(',').map(name => name.trim()).filter(Boolean)
  const tables = [...queryList.matchAll(/foundationSelect\('([^']+)'/g)].map(match => match[1])
  assert.equal(names.length, tables.length)
  assert.equal(tables[names.indexOf('allReceivablesRes')], 'delivery_invoices')
  assert.equal(tables[names.indexOf('resellerPaymentsRes')], 'reseller_payments')
  assert.equal(tables[names.indexOf('productionLogsRes')], 'production_logs')
  assert.ok(names.indexOf('allReceivablesRes') < names.indexOf('resellerPaymentsRes'))
})
