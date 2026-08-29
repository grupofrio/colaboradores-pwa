import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  PWA_CACHE_ID,
  activatePwaCaches,
  obsoleteCacheNames,
  reloadOnceForStaleChunk,
} from '../src/pwa/cachePolicy.js'

test('obsoleteCacheNames keeps the current cache id and drops workbox leftovers', () => {
  assert.deepEqual(
    obsoleteCacheNames([
      PWA_CACHE_ID,
      `${PWA_CACHE_ID}-https://staging.example`,
      'workbox-precache-v1',
      'vite-assets-v1',
      'unrelated-cache',
    ]),
    ['workbox-precache-v1', 'vite-assets-v1'],
  )
})

test('activatePwaCaches deletes obsolete caches and claims clients', async () => {
  const deleted = []
  let claimed = 0
  const runtime = {
    caches: {
      async keys() {
        return ['workbox-precache-v1', PWA_CACHE_ID, 'vite-runtime']
      },
      async delete(name) {
        deleted.push(name)
        return true
      },
    },
    clients: {
      async claim() {
        claimed += 1
      },
    },
  }
  const result = await activatePwaCaches(runtime)
  assert.deepEqual(result.deleted, ['workbox-precache-v1', 'vite-runtime'])
  assert.equal(claimed, 1)
  assert.deepEqual(deleted, ['workbox-precache-v1', 'vite-runtime'])
})

test('reloadOnceForStaleChunk reloads once on a leftover dynamic import hash', () => {
  let reloads = 0
  const store = new Map()
  const runtime = {
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
    },
    location: { reload: () => { reloads += 1 } },
  }
  assert.equal(
    reloadOnceForStaleChunk(runtime, new Error('Failed to fetch dynamically imported module: https://staging.example/assets/ScreenTicket-old.js'), { buildId: 'build-a' }),
    true,
  )
  assert.equal(reloads, 1)
  assert.equal(
    reloadOnceForStaleChunk(runtime, new Error('Failed to fetch dynamically imported module: https://staging.example/assets/ScreenTicket-old.js'), { buildId: 'build-a' }),
    false,
  )
  assert.equal(reloads, 1)
  assert.equal(reloadOnceForStaleChunk(runtime, new Error('No hay existencias suficientes'), { buildId: 'build-a' }), false)
})

test('reloadOnceForStaleChunk matches ChunkLoadError without the word module', () => {
  let reloads = 0
  const store = new Map()
  const runtime = {
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
    },
    location: { reload: () => { reloads += 1 } },
  }
  const err = new Error('Failed to fetch dynamically imported index-DREfNA8J.js')
  err.name = 'ChunkLoadError'
  assert.equal(reloadOnceForStaleChunk(runtime, err, { buildId: 'build-b' }), true)
  assert.equal(reloads, 1)
  assert.equal(reloadOnceForStaleChunk(runtime, err, { buildId: 'build-b' }), false)
  assert.equal(reloadOnceForStaleChunk(runtime, err, { buildId: 'build-c' }), true)
  assert.equal(reloads, 2)
})

test('vite PWA policy versions caches and never caches HTML or SaleOps', () => {
  const vite = readFileSync(fileURLToPath(new URL('../vite.config.js', import.meta.url)), 'utf8')
  assert.match(vite, /selfDestroying:\s*true/)
  assert.match(vite, /registerType:\s*'autoUpdate'/)
  assert.match(vite, /cleanupOutdatedCaches:\s*true/)
  assert.match(vite, /skipWaiting:\s*true/)
  assert.match(vite, /clientsClaim:\s*true/)
  assert.match(vite, /PWA_CACHE_ID/)
  assert.match(vite, /navigateFallback:\s*null/)
  assert.match(vite, /handler:\s*'NetworkOnly'/)
  assert.match(vite, /\/odoo-api\//)
})
