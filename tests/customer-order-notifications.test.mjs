import test from 'node:test'
import assert from 'node:assert/strict'
import {countActiveCustomerOrders} from '../src/customerOrders/orderNotifications.mjs'

test('notification count includes active orders and clears after closure', () => {
  const orders = [
    {status:'pending_confirmation'},
    {status:'accepted'},
    {status:'preparing'},
    {status:'ready'},
    {status:'out_for_delivery'},
    {status:'completed'},
    {status:'declined'},
    {status:'cancelled'},
  ]
  assert.equal(countActiveCustomerOrders(orders), 5)
  assert.equal(countActiveCustomerOrders(orders.map(order => ({...order, status:'completed'}))), 0)
  assert.equal(countActiveCustomerOrders(null), 0)
})
