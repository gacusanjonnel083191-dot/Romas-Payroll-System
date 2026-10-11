import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
function extract(name, end, scope) {
  const start = source.indexOf(`async function ${name}(`)
  const stop = source.indexOf(end, start)
  assert.ok(start > 0 && stop > start)
  return new Function('scope', `with(scope) { ${source.slice(start, stop)}; return ${name} }`)(scope)
}

for (const [name, end] of [
  ['saveInvoiceSettlement', '// Record Payment with Partial Support'],
  ['recordPaymentNew', 'async function loadCashReconciliations'],
  ['recordInvoicePayment', '// Cross-check Returns'],
]) {
  for (const filter of ['unpaid', 'active', 'partial']) {
    for (const amount of [40, 100]) {
      test(`${name}: ${amount === 100 ? 'full' : 'partial'} payment retains ${filter} and refreshes invoices`, async () => {
        const state = { filter, refreshed:0, form:{ inv:true }, amount:{ inv:amount } }
        const writes = []
        const round = n => Math.round(Number(n || 0) * 100) / 100
        const scope = {
          paymentAmount:state.amount, paymentMethod:{}, paymentNotes:{},
          settlementRows:{ inv:[{ item_id:'item', original_quantity:10, actual_quantity:10, returned_quantity:2, reseller_price:12.5 }] },
          settlementCrates:{}, today:'2026-10-11', adminRole:'admin',
          safeNum:(n, fallback=0) => Number(n ?? fallback), moneyRound:round, php:n=>`PHP ${n}`,
          getInvoiceBalance:inv=>round(inv.total_amount - inv.paid_amount),
          getSettlementCrateSummary:()=>({}),
          getSettlementSummary:()=>({ cashReceived:amount, dueBeforeCash:100, actualQty:10, returnedQty:2, returnsCredit:25, adjustedGross:125, finalTotal:100, newPaidTotal:amount, finalBalance:100-amount, newStatus:amount === 100 ? 'paid':'partial' }),
          supabase:{ from(table) {
            const query = {
              select:()=>query, eq:()=>query, in:()=>query,
              insert:payload=>{ writes.push({ table, operation:'insert', payload }); return query },
              update:payload=>{ writes.push({ table, operation:'update', payload }); return query },
              delete:()=>query,
              single:async()=>({ data:{ id:'return' }, error:null }),
              then:resolve=>Promise.resolve({ data:table === 'reseller_returns' ? []:[{ id:'payment' }], error:null }).then(resolve),
            }
            return query
          } },
          setInvoiceFilter:value=>{ state.filter=value },
          setShowPaymentFormMap:update=>{ state.form=update(state.form) },
          setPaymentAmount:update=>{ state.amount=update(state.amount) },
          setPaymentMethod:()=>{}, setPaymentNotes:()=>{}, setSettlementRows:()=>{}, setSettlementCrates:()=>{}, setSettlementSaving:()=>{},
          loadDeliveryInvoices:async()=>{ state.refreshed++ }, loadOnlinePayments:async()=>{},
          logAudit:async()=>{}, showToast:()=>{}, refreshFoundationAfterDataChange:()=>{},
          setTimeout:()=>{},
        }
        const save = extract(name, end, scope)
        await save({ id:'inv', reseller_id:'reseller', reseller_name:'Test outlet', invoice_number:'TEST', total_amount:100, paid_amount:0 })
        assert.equal(state.filter, filter)
        assert.equal(state.refreshed, 1)
        assert.equal(state.form.inv, false)
        assert.equal(state.amount.inv, '')
        const invoice = writes.find(w=>w.table === 'delivery_invoices').payload
        assert.equal(invoice.paid_amount, amount)
        assert.equal(invoice.status, amount === 100 ? 'paid':'partial')
        assert.equal(writes.find(w=>w.table === 'reseller_payments').payload.amount, amount)
        if (name === 'saveInvoiceSettlement') {
          assert.equal(invoice.total_amount, 100)
          assert.equal(invoice.returns_amount, 25)
          assert.equal(writes.find(w=>w.table === 'reseller_return_items').payload[0].returned_quantity, 2)
        }
      })
    }
  }
}
