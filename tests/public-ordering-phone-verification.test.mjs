import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizePhilippineMobile, verifiedPhoneIdentity} from '../supabase/functions/public-ordering/phone-verification.mjs'
import {normalizePhilippineMobile as normalizeCheckoutPhone} from '../customer-ordering-preview/phone-number.mjs'

test('normalizes Philippine mobile numbers and rejects other formats', () => {
  for (const input of ['0912 345 6789', '9123456789', '+63 912-345-6789', '639123456789']) {
    assert.equal(normalizePhilippineMobile(input), '+639123456789')
    assert.equal(normalizeCheckoutPhone(input), normalizePhilippineMobile(input))
  }
  for (const input of ['0281234567', '+15551234567', '0912345678', '091234567890', 'abc']) {
    assert.equal(normalizePhilippineMobile(input), null)
    assert.equal(normalizeCheckoutPhone(input), null)
  }
})

test('accepts only a verified Auth user matching the checkout phone', async () => {
  const user = {id:'verified-user', phone:'+639123456789', phone_confirmed_at:'2026-10-27T00:00:00Z'}
  const admin = {auth:{getUser:async token => {
    assert.equal(token, 'good-token')
    return {data:{user}, error:null}
  }}}
  assert.deepEqual(await verifiedPhoneIdentity(admin, 'Bearer good-token', '09123456789'),
    {id:'verified-user', phone:'+639123456789'})
  assert.equal(await verifiedPhoneIdentity(admin, null, '09123456789'), null)
  assert.equal(await verifiedPhoneIdentity(admin, 'Bearer good-token', '09999999999'), null)
  user.phone_confirmed_at = null
  assert.equal(await verifiedPhoneIdentity(admin, 'Bearer good-token', '09123456789'), null)
})
