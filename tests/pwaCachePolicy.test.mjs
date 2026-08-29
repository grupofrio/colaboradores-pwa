import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  PWA_CACHE_ID,
  activatePwaCaches,
  obsoleteCacheNames,
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
