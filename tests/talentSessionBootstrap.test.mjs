import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

import { fetchMe, talentFetch } from '../src/modules/talento/talentoApi.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem(key) { return store.get(key) ?? null },
    setItem(key, value) { store.set(key, String(value)) },
    removeItem(key) { store.delete(key) },
  }
}

function okJson(payload = { ok: true }) {
  return { ok: true, status: 200, async json() { return payload } }
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
})

test('Talent bootstrap uses the fresh in-memory mobile token, never stale storage', async () => {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'stale-web-session',
    gf_employee_token: 'stale-mobile-token',
  }))
  let headers
  globalThis.fetch = async (_url, options) => {
    headers = options.headers
    return okJson({ ok: true, talent_rh: true })
  }

  await fetchMe({
    session_token: 'fresh-web-session',
    odoo_employee_token: 'fresh-mobile-token',
  })

  assert.equal(headers['X-GF-Employee-Token'], 'fresh-mobile-token')
})

test('Talent never upgrades a generic PWA session token into an employee credential', async () => {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'generic-web-session-only',
  }))
  let headers
  globalThis.fetch = async (_url, options) => {
    headers = options.headers
    return okJson()
  }

  await talentFetch('/pwa-talento/me')

  assert.equal(headers['X-GF-Employee-Token'], '')
})

test('App bootstraps Talent with the current React session and persists login before state publication', async () => {
  const source = await readFile(fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8')
  assert.match(source, /fetchMe\(session\)/)
  const loginBody = source.slice(source.indexOf('function login(sessionData)'), source.indexOf('function logout()'))
  const persist = loginBody.indexOf("localStorage.setItem('gf_session', JSON.stringify(next))")
  const publish = loginBody.indexOf('setSession(next)')
  assert.ok(persist >= 0, 'login must persist the new session synchronously')
  assert.ok(persist < publish, 'persistence must happen before React state can bootstrap children')
})
