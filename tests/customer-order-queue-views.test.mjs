import test from 'node:test'
import assert from 'node:assert/strict'
import {ordersForView, finalStatusEvent} from '../src/customerOrders/orderQueueViews.mjs'

test('cancelled and declined orders stay out of active work and can be viewed separately', () => {
  const orders = ['pending_confirmation','accepted','preparing','ready','out_for_delivery','completed','cancelled','declined']
    .map((status,index) => ({id:index,status}))
  assert.deepEqual(ordersForView(orders,'pending').map(order=>order.status),['pending_confirmation'])
  assert.deepEqual(ordersForView(orders,'processing').map(order=>order.status),
    ['accepted','preparing','ready','out_for_delivery'])
  assert.deepEqual(ordersForView(orders,'completed').map(order=>order.status),['completed'])
  assert.deepEqual(ordersForView(orders,'voided').map(order=>order.status),['cancelled','declined'])
  assert.deepEqual(ordersForView(orders,'voided','cancelled').map(order=>order.status),['cancelled'])
  assert.deepEqual(ordersForView(orders,'voided','declined').map(order=>order.status),['declined'])
})

test('final void event identifies the staff action even after other audit events', () => {
  const order = {status:'cancelled',events:[
    {new_status:'accepted',actor_name:'Sheryl'},
    {old_status:'accepted',new_status:'cancelled',actor_name:'Jonnel'},
    {old_status:'cancelled',new_status:'cancelled',actor_name:null,note:'Later system event'},
  ]}
  assert.equal(finalStatusEvent(order).actor_name,'Jonnel')
  assert.equal(finalStatusEvent({...order,events:order.events.slice(0,2)}).actor_name,'Jonnel')
  assert.equal(finalStatusEvent({...order,status:'accepted'}),null)
})
