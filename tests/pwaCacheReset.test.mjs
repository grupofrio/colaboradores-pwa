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

  await resetLegacyPwaState(fakeGlobal)

  assert.deepEqual(unregisterCalls, ['sw-1', 'sw-2'])
  assert.deepEqual(deletedCaches, ['workbox-precache-v1', 'vite-assets-v1'])
})

test('resetLegacyPwaState tolerates missing browser APIs', async () => {
  await assert.doesNotReject(async () => {
    await resetLegacyPwaState({})
  })
})
