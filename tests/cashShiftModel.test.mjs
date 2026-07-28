import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CASH_SHIFT_DENOMINATIONS,
  calculatePhysicalTotal,
  cashShiftScheduleWarning,
  nextTransitionLabel,
  normalizeAdjustments,
  normalizeCashShift,
  normalizeDenominations,
} from '../src/modules/admin/cashShiftModel.js'

function validShift(overrides = {}) {
  return {
    shift: {
      id: 41,
      type: 'night',
      business_date: '2026-07-27',
      state: 'open',
      version: 0,
    },
    period: {
      opened_at: '2026-07-26 18:04:00',
      closed_at: false,
      timezone: 'America/Mexico_City',
    },
    schedule: {
      expected_close: '2026-07-27 06:00:00',
      overdue: false,
    },
    totals: {
      sales_cash: 800,
      sales_card: 200,
      sales_total: 1000,
      expenses: 100,
      expected_cash: 1200,
    },
    opening_fund: 500,
    physical_cash: 0,
    difference: -1200,
    products: [],
    payments: {},
    sales: [],
    cancellations: [],
    expenses: [],
    denominations: [],
    adjustments: [],
    authorizations: [],
    ...overrides,
  }
}

test('normaliza un turno estricto sin recalcular ni aceptar autoridad local sobre totales', () => {
  const dto = normalizeCashShift(validShift())

  assert.equal(dto.shift.id, 41)
  assert.equal(dto.shift.type, 'night')
  assert.equal(dto.shift.businessDate, '2026-07-27')
  assert.equal(dto.shift.state, 'open')
  assert.deepEqual(dto.totals, {
    salesCash: 800,
    salesCard: 200,
    salesTotal: 1000,
    expenses: 100,
    expectedCash: 1200,
  })
  assert.equal(dto.physicalCash, 0)
  assert.equal(dto.difference, -1200)
})

test('rechaza IDs, fechas, estados, tipos y zona horaria inválidos', () => {
  for (const id of [0, -1, 1.5, true, '__proto__', '41']) {
    assert.throws(
      () => normalizeCashShift(validShift({ shift: { ...validShift().shift, id } })),
      TypeError,
    )
  }
  for (const business_date of ['27/07/2026', '2026-02-30', '', '__proto__']) {
    assert.throws(
      () => normalizeCashShift(validShift({
        shift: { ...validShift().shift, business_date },
      })),
      TypeError,
    )
  }
  for (const state of ['draft', 'cancel', '', '__proto__']) {
    assert.throws(
      () => normalizeCashShift(validShift({ shift: { ...validShift().shift, state } })),
      TypeError,
    )
  }
  assert.throws(
    () => normalizeCashShift(validShift({ shift: { ...validShift().shift, type: 'evening' } })),
    TypeError,
  )
  assert.throws(
    () => normalizeCashShift(validShift({
      period: { ...validShift().period, timezone: 'UTC' },
    })),
    TypeError,
  )
  assert.throws(() => normalizeCashShift({ id: '__proto__' }), TypeError)
})

test('las denominaciones MXN y sus conteos producen matemáticas exactas', () => {
  assert.deepEqual(CASH_SHIFT_DENOMINATIONS, [
    '1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '0.50',
  ])
  assert.equal(calculatePhysicalTotal([{ denomination: '500', count: 2 }]), 1000)
  assert.equal(calculatePhysicalTotal([
    { denomination: '0.50', count: 3 },
    { denomination: '20', count: 2 },
  ]), 41.5)
  assert.deepEqual(normalizeDenominations([
    { denomination: '500', count: 2, subtotal: 1_000_000 },
    { denomination: '20', count: 0 },
  ]), [
    { denomination: '500', count: 2 },
    { denomination: '20', count: 0 },
  ])
})

test('rechaza denominaciones o conteos no canónicos y nunca acepta subtotales cliente', () => {
  for (const lines of [
    [{ denomination: '3', count: 1 }],
    [{ denomination: '500', count: -1 }],
    [{ denomination: '500', count: 1.5 }],
    [{ denomination: '500', count: true }],
    [{ denomination: '500', count: 2_147_483_648 }],
    [{ denomination: 500, count: 1 }],
  ]) {
    assert.throws(() => normalizeDenominations(lines), TypeError)
  }
  assert.equal('subtotal' in normalizeDenominations([
    { denomination: '500', count: 2, subtotal: 123 },
  ])[0], false)
})

test('normaliza ajustes positivos con concepto y rechaza totales o importes inválidos', () => {
  assert.deepEqual(normalizeAdjustments([
    { type: 'income', concept: 'Cambio recuperado', amount: 20, total: 999 },
    { type: 'expense', concept: 'Compra de bolsas', amount: 5.5 },
  ]), [
    { type: 'income', concept: 'Cambio recuperado', amount: 20 },
    { type: 'expense', concept: 'Compra de bolsas', amount: 5.5 },
  ])
  for (const lines of [
    [{ type: 'income', concept: '', amount: 10 }],
    [{ type: 'other', concept: 'X', amount: 10 }],
    [{ type: 'expense', concept: 'X', amount: 0 }],
    [{ type: 'expense', concept: 'X', amount: -1 }],
    [{ type: 'expense', concept: 'X', amount: true }],
  ]) {
    assert.throws(() => normalizeAdjustments(lines), TypeError)
  }
})

test('etiqueta las transiciones día/noche con la fecha operativa correcta', () => {
  assert.equal(
    nextTransitionLabel({ type: 'night', businessDate: '2026-07-27' }),
    'Cerrar Noche 27 y abrir Día 27',
  )
  assert.equal(
    nextTransitionLabel({ type: 'day', businessDate: '2026-07-27' }),
    'Cerrar Día 27 y abrir Noche 28',
  )
})

test('avisa por referencia 06:00/18:00 en México sin bloquear ni cerrar automáticamente', () => {
  assert.deepEqual(cashShiftScheduleWarning({
    type: 'night',
    businessDate: '2026-07-27',
    now: '2026-07-27T11:59:00.000Z', // 05:59 America/Mexico_City
  }), { overdue: false, expectedClose: '2026-07-27 06:00', automatic: false })
  assert.deepEqual(cashShiftScheduleWarning({
    type: 'night',
    businessDate: '2026-07-27',
    now: '2026-07-27T12:01:00.000Z', // 06:01 America/Mexico_City
  }), { overdue: true, expectedClose: '2026-07-27 06:00', automatic: false })
  assert.deepEqual(cashShiftScheduleWarning({
    type: 'day',
    businessDate: '2026-07-27',
    now: '2026-07-28T00:01:00.000Z', // 18:01 America/Mexico_City
  }), { overdue: true, expectedClose: '2026-07-27 18:00', automatic: false })
})

test('DTO estricto rechaza booleanos de horario que no sean booleanos reales', () => {
  assert.throws(() => normalizeCashShift(validShift({
    schedule: { ...validShift().schedule, overdue: 'false' },
  })), TypeError)
})
