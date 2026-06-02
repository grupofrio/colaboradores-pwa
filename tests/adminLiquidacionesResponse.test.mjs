import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeLiquidationListResponse } from '../src/modules/admin/liquidacionesResponse.js'

test('liquidation list response surfaces forbidden envelopes instead of empty rows', () => {
  assert.throws(
    () => normalizeLiquidationListResponse({
      ok: false,
      message: 'Usuario sin permisos para esta operacion.',
      data: { code: 'forbidden' },
    }),
    /Usuario sin permisos/,
  )
})

test('liquidation list response accepts plans inside data envelope', () => {
  assert.deepEqual(
    normalizeLiquidationListResponse({
      ok: true,
      data: {
        plans: [{ id: 17, name: 'R-17' }],
      },
    }),
    [{ id: 17, name: 'R-17' }],
  )
})
