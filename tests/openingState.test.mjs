import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractOpeningStateSnapshot,
  resolveOpeningReadySlotCount,
} from '../src/modules/produccion/openingState.js'

test('extractOpeningStateSnapshot unwraps jsonrpc result.data payloads', () => {
  const snapshot = extractOpeningStateSnapshot({
    jsonrpc: '2.0',
    result: {
      ok: true,
      data: {
        operations: { ready_slot_count: 16 },
      },
    },
  })

  assert.equal(snapshot?.operations?.ready_slot_count, 16)
})

test('resolveOpeningReadySlotCount prefers opening-state operations count even when tank summary is stale', () => {
  const readySlotsCount = resolveOpeningReadySlotCount({
    openingState: {
      operations: { ready_slot_count: 16 },
    },
    tankData: {
      ready_slots_count: 0,
    },
  })

  assert.equal(readySlotsCount, 16)
})

test('resolveOpeningReadySlotCount preserves an explicit zero from opening-state', () => {
  const readySlotsCount = resolveOpeningReadySlotCount({
    openingState: {
      operations: { ready_slot_count: 0 },
    },
    tankData: {
      ready_slots_count: 9,
    },
  })

  assert.equal(readySlotsCount, 0)
})
