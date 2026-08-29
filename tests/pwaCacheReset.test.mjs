import test from 'node:test'
import assert from 'node:assert/strict'

import { resetLegacyPwaState } from '../src/pwa/resetLegacyPwaState.js'

test('resetLegacyPwaState unregisters service workers and deletes caches', async () => {
  const unregisterCalls = []
  const deletedCaches = []

  const fakeGlobal = {
    navigator: {
      serviceWorker: {
        async getRegistrations() {
          return [
            { unregister: async () => { unregisterCalls.push('sw-1'); return true } },
            { unregister: async () => { unregisterCalls.push('sw-2'); return true } },
          ]
        },
      },
    },
    caches: {
      async keys() {
        return ['workbox-precache-v1', 'vite-assets-v1']
      },
      async delete(name) {
        deletedCaches.push(name)
        return true
      },
    },
  }

  const result = await resetLegacyPwaState(fakeGlobal)
  assert.equal(result.reloaded, false)
  assert.deepEqual(unregisterCalls, ['sw-1', 'sw-2'])
  assert.deepEqual(deletedCaches, ['workbox-precache-v1', 'vite-assets-v1'])
})

test('resetLegacyPwaState tolerates missing browser APIs', async () => {
  await assert.doesNotReject(async () => {
    const result = await resetLegacyPwaState({})
    assert.equal(result.reloaded, false)
  })
})

test('resetLegacyPwaState reloads once when buildId changes', async () => {
  const store = new Map()
  const session = new Map()
  let reloads = 0
  const fakeGlobal = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)) },
    },
    sessionStorage: {
      getItem: (k) => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => { session.set(k, String(v)) },
    },
    location: { reload: () => { reloads += 1 } },
    caches: { async keys() { return [] }, async delete() { return true } },
    navigator: { serviceWorker: { async getRegistrations() { return [] } } },
  }

  const first = await resetLegacyPwaState(fakeGlobal, { buildId: 'sha-aaa' })
  assert.equal(first.reloaded, true)
  assert.equal(reloads, 1)
  assert.equal(store.get('gf_pwa_build_id'), 'sha-aaa')

  // Same build after one-shot marker: no second reload in this browsing session.
  const second = await resetLegacyPwaState(fakeGlobal, { buildId: 'sha-aaa' })
  assert.equal(second.reloaded, false)
  assert.equal(reloads, 1)

  // New deploy: reload again.
  session.clear()
  const third = await resetLegacyPwaState(fakeGlobal, { buildId: 'sha-bbb' })
  assert.equal(third.reloaded, true)
  assert.equal(reloads, 2)
  assert.equal(store.get('gf_pwa_build_id'), 'sha-bbb')
})

test('resetLegacyPwaState asks waiting workers to skip waiting before unregister', async () => {
  const messages = []
  const updates = []
  const fakeGlobal = {
    navigator: {
      serviceWorker: {
        async getRegistrations() {
          return [{
            update: async () => { updates.push('sw') },
            waiting: { postMessage: (payload) => { messages.push(payload) } },
            unregister: async () => true,
          }]
        },
      },
    },
    caches: { async keys() { return [] }, async delete() { return true } },
  }
  await resetLegacyPwaState(fakeGlobal)
  assert.deepEqual(updates, ['sw'])
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }])
})

test('vercel.json forces no-store on HTML and service worker entrypoints', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const raw = readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8')
  const cfg = JSON.parse(raw)
  const bySource = Object.fromEntries((cfg.headers || []).map((h) => [h.source, h.headers]))
  for (const source of ['/', '/index.html', '/sw.js', '/manifest.webmanifest']) {
    const headers = bySource[source] || []
    const cache = headers.find((h) => h.key === 'Cache-Control')
    assert.ok(cache, `${source} must set Cache-Control`)
    assert.match(cache.value, /no-store/)
  }
  // Hashed assets remain immutable long-cache.
  const assets = (bySource['/assets/(.*)'] || []).find((h) => h.key === 'Cache-Control')
  assert.match(assets.value, /immutable/)
})
