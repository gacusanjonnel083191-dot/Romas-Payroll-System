import test from 'node:test'
import assert from 'node:assert/strict'
import {readLimitedBody} from '../supabase/functions/public-ordering/request-body.mjs'

test('reads a request within the byte limit', async () => {
  const request = new Request('https://example.test', {method:'POST', body:'{"action":"config"}'})
  assert.equal(await readLimitedBody(request, 32_000), '{"action":"config"}')
})

test('rejects a body with a declared oversized length before reading', async () => {
  let reads = 0
  const body = new ReadableStream({pull(controller) { reads++; controller.enqueue(new Uint8Array(1)); controller.close() }}, {highWaterMark:0})
  const request = new Request('https://example.test', {method:'POST', headers:{'content-length':'32001'}, body, duplex:'half'})
  assert.equal(await readLimitedBody(request, 32_000), null)
  assert.equal(reads, 0)
})

test('stops an unannounced oversized stream at the byte limit', async () => {
  let reads = 0
  const body = new ReadableStream({pull(controller) {
    reads++
    controller.enqueue(new Uint8Array(10_000))
  }})
  const request = new Request('https://example.test', {method:'POST', body, duplex:'half'})
  assert.equal(await readLimitedBody(request, 32_000), null)
  assert.ok(reads <= 5)
})

test('counts UTF-8 bytes rather than JavaScript characters', async () => {
  const request = new Request('https://example.test', {method:'POST', body:'é'.repeat(10)})
  assert.equal(await readLimitedBody(request, 19), null)
})
