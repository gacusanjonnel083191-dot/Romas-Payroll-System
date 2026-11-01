import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyTurnstileToken} from './turnstile.mjs'

const token = 'valid-token-for-test'
const good = async () => ({ok:true, json:async () => ({success:true, hostname:'rd-business-system.vercel.app', action:'customer_order'})})

test('accepts a verified token for the storefront and intended action', async () => {
  assert.equal(await verifyTurnstileToken(token,'secret','rd-business-system.vercel.app',good),true)
})

test('rejects missing, forged, foreign-host, and failed verification', async () => {
  assert.equal(await verifyTurnstileToken('','secret','rd-business-system.vercel.app',good),false)
  assert.equal(await verifyTurnstileToken(token,'secret','other.example',good),false)
  assert.equal(await verifyTurnstileToken(token,'secret','rd-business-system.vercel.app',async () => ({ok:true,json:async()=>({success:false})})),false)
  assert.equal(await verifyTurnstileToken(token,'secret','rd-business-system.vercel.app',async () => {throw Error('network')}),false)
})
