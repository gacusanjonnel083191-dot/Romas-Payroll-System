const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

test('update details follow the current owner role', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/appUpdateNotice.js'), 'utf8')
    .replace('const CURRENT_BUILD_ID = __APP_BUILD_ID__', "const CURRENT_BUILD_ID = 'old-build'")
    .replace('export const installAppUpdateNotice', 'const installAppUpdateNotice')
    .replace('} catch {', '} catch (error) { throw error;')
  assert.match(source, /CURRENT_BUILD_ID = 'old-build'/)
  const elements = new Map()
  const listeners = new Map()
  const document = {
    getElementById: id => elements.get(id) || null,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, remove() { elements.delete(this.id) } }),
    body: { appendChild(element) {
      elements.set(element.id, element)
      elements.set('romas-apply-update', { addEventListener() {} })
    } },
  }
  let role = 'manager'
  const window = {
    __ROMA_AI_BRIDGE__: { getContext: () => ({ adminMode: true, isOwner: role === 'owner' }) },
    addEventListener: (name, handler) => listeners.set(name, handler),
    setInterval() {},
    location: { reload() {} },
  }
  let fetched = false
  const fetch = async () => { fetched = true; return { ok: true, json: async () => ({ buildId: 'new-build', summary: 'Private change details' }) } }
  const notice = vm.runInNewContext(`${source}\n({ installAppUpdateNotice, checkForUpdate })`, { window, document, fetch, Date, Intl })
  notice.installAppUpdateNotice()
  await notice.checkForUpdate()
  assert.equal(fetched, true)
  assert.ok(elements.has('romas-app-update-notice'), [...elements.keys()].join(','))
  assert.doesNotMatch(elements.get('romas-app-update-notice').innerHTML, /Private change details|What's new/)
  role = 'owner'
  listeners.get('roma-ai-context-ready')()
  assert.match(elements.get('romas-app-update-notice').innerHTML, /Private change details/)
  role = 'hr'
  listeners.get('roma-ai-context-ready')()
  assert.doesNotMatch(elements.get('romas-app-update-notice').innerHTML, /Private change details|What's new/)
})
