import test from 'node:test'
import assert from 'node:assert/strict'

import * as liquidaciones from '../src/modules/admin/liquidacionesResponse.js'

const {
  LIQUIDATION_PENDING_REFRESH_WARNING,
  getLiquidationValidationOutcome,
  getLiquidationValidationSuccessTransition,
  normalizeLiquidationListResponse,
  resolveLiquidationHistorySelection,
} = liquidaciones

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

test('liquidation history default date range starts and ends today', () => {
  assert.deepEqual(
    liquidaciones.getDefaultLiquidationHistoryDateRange(new Date('2026-06-03T18:30:00-06:00')),
    {
      dateFrom: '2026-06-03',
      dateTo: '2026-06-03',
    },
  )
})

test('already validated liquidation is a successful validation with distinct copy', () => {
  assert.deepEqual(
    getLiquidationValidationOutcome(42, {
      jsonrpc: '2.0',
      result: {
        ok: true,
        data: { already_validated: true },
      },
    }),
    {
      alreadyValidated: true,
      message: 'Liquidación del plan #42 ya estaba validada',
    },
  )
})

test('newly validated liquidation uses the normal success copy', () => {
  assert.deepEqual(
    getLiquidationValidationOutcome(42, {
      ok: true,
      data: { already_validated: false },
    }),
    {
      alreadyValidated: false,
      message: 'Liquidación del plan #42 validada',
    },
  )
})

test('liquidation validation requires an explicit successful envelope', () => {
  assert.throws(
    () => getLiquidationValidationOutcome(42, {
      data: { already_validated: true },
    }),
    /Respuesta inválida de validación de liquidación/,
  )
})

test('liquidation validation error envelope throws the exact physical receipt error', () => {
  const physicalReceiptError = 'La devolución del picking WH/IN/0042 para Queso Oaxaca requiere 12.00 kg; recibidos 9.00 kg.'

  assert.throws(
    () => getLiquidationValidationOutcome(42, {
      jsonrpc: '2.0',
      result: {
        ok: false,
        message: physicalReceiptError,
      },
    }),
    new RegExp(physicalReceiptError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  )
})

test('liquidation history selection uses plan_id when the list exposes both identifiers', () => {
  const rows = [{ id: 7, plan_id: 42, name: 'R-42' }]

  assert.equal(resolveLiquidationHistorySelection(rows, 42, null), 42)
  assert.equal(resolveLiquidationHistorySelection(rows, null, 42), 42)
  assert.equal(resolveLiquidationHistorySelection(rows, 7, 42), 42)
})

test('successful validation stays committed to history when the pending refresh later fails', () => {
  const normal = getLiquidationValidationSuccessTransition(42, {
    ok: true,
    data: { already_validated: false },
  })
  const alreadyValidated = getLiquidationValidationSuccessTransition(43, {
    ok: true,
    data: { already_validated: true },
  })

  assert.deepEqual(normal, {
    alreadyValidated: false,
    message: 'Liquidación del plan #42 validada',
    historySelectedId: 42,
    view: 'history',
  })
  assert.deepEqual(alreadyValidated, {
    alreadyValidated: true,
    message: 'Liquidación del plan #43 ya estaba validada',
    historySelectedId: 43,
    view: 'history',
  })
  assert.equal(
    LIQUIDATION_PENDING_REFRESH_WARNING,
    'La validación se completó, pero no se pudo actualizar la cola de pendientes.',
  )
})
