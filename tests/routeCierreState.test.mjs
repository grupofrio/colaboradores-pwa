import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getCierreState } from '../src/modules/ruta/routeControlService.js'

const CIERRE_STORAGE_KEY = 'gf_ruta_cierre'

function withCierreStorage(cache, callback) {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map([[CIERRE_STORAGE_KEY, JSON.stringify(cache)]])

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  })

  try {
    return callback(values)
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
  }
}

test('getCierreState overrides stale cache for closed and reconciled plans without backend liquidation', () => {
  for (const state of ['closed', 'reconciled']) {
    const cierreState = withCierreStorage({
      701: { corteDone: true, liquidacionDone: true, closed: true },
    }, () => getCierreState(701, {
      id: 701,
      state,
      corte_validated: false,
      liquidacion_done_at: null,
    }))

    assert.equal(cierreState.corteDone, false)
    assert.equal(cierreState.liquidacionDone, false)
    assert.equal(cierreState.closed, true)
  }
})

test('getCierreState honors a backend liquidation timestamp even when the route is reconciled', () => {
  const cierreState = withCierreStorage({
    702: { corteDone: false, liquidacionDone: false },
  }, () => getCierreState(702, {
    id: 702,
    state: 'reconciled',
    corte_validated: true,
    liquidacion_done_at: '2026-07-28T17:42:00.000Z',
  }))

  assert.equal(cierreState.corteDone, true)
  assert.equal(cierreState.liquidacionDone, true)
  assert.equal(cierreState.closed, true)
})

test('getCierreState does not mutate the cached object while applying backend state', () => {
  const cache = {
    703: { corteDone: false, liquidacionDone: false, closed: false, updatedAt: 'stale' },
  }
  const serializedCache = JSON.stringify(cache)
  const originalParse = JSON.parse
  let cierreState

  withCierreStorage(cache, () => {
    JSON.parse = (value, ...args) => (
      value === serializedCache ? cache : originalParse(value, ...args)
    )
    try {
      cierreState = getCierreState(703, {
        id: 703,
        state: 'reconciled',
        corte_validated: true,
        liquidacion_done_at: '2026-07-28T17:42:00.000Z',
      })
    } finally {
      JSON.parse = originalParse
    }
  })

  assert.notEqual(cierreState, cache[703])
  assert.deepEqual(cache[703], {
    corteDone: false,
    liquidacionDone: false,
    closed: false,
    updatedAt: 'stale',
  })
})
