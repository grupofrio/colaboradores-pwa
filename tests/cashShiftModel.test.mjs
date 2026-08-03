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
  normalizePendingCashShiftList,
  normalizePendingCashShiftPreview,
} from '../src/modules/admin/cashShiftModel.js'

function validShift(overrides = {}) {
  return {
    folio: 'CT/POS/2026/00041',
    version_id: false,
    version_number: 0,
    closing_type: false,
    responsible: {
      employee_id: false,
      employee_name: '',
      user_id: false,
      user_name: '',
    },
    closed_or_reclosed_at: false,
    evidence: false,
    previous_version_id: false,
    prior_totals: {},
    reopen_reason: '',
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
    scope: {
      company_id: 34,
      company_name: 'Glaciem',
      warehouse_id: 89,
      warehouse_name: 'Iguala',
      analytic_account_id: 12,
      analytic_account_name: 'IGU34',
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
    product_totals: {
      quantity: 0,
      amount_total: 0,
      weight_total_kg: 0,
      products_without_weight: 0,
    },
    payments: { cash: 800, card: 200, total: 1000, rows: [] },
    sales: [],
    cancellations: [],
    expenses: [],
    denominations: [],
    adjustments: [],
    authorizations: [],
    difference_note: '',
    evidence_present: false,
    needs_manager_auth: false,
    needs_director_auth: false,
    printable: false,
    ...overrides,
  }
}

test('normaliza un turno estricto sin recalcular ni aceptar autoridad local sobre totales', () => {
  const dto = normalizeCashShift(validShift())

  assert.equal(dto.shift.id, 41)
  assert.equal(dto.shift.type, 'night')
  assert.equal(dto.shift.businessDate, '2026-07-27')
  assert.equal(dto.shift.state, 'open')
  assert.equal(dto.period.timezone, 'America/Mexico_City')
  assert.deepEqual(dto.totals, {
    salesCash: 800,
    salesCard: 200,
    salesTotal: 1000,
    expenses: 100,
    expectedCash: 1200,
  })
  assert.equal(dto.physicalCash, 0)
  assert.equal(dto.difference, -1200)
  assert.equal(Object.hasOwn(dto, 'boundary'), false)
})

test('el contrato v2 añade frontera sin cambiar la lectura v1 existente', () => {
  const v1 = normalizeCashShift(validShift())
  assert.equal(Object.hasOwn(v1, 'boundary'), false)

  const v2 = normalizeCashShift(validShift({
    shift: { ...validShift().shift, state: 'pending_count' },
    boundary: {
      operational_closed_at: '2026-07-27 06:00:00',
      scheduled_boundary_at: '2026-07-27 06:00:00',
      executed_at: '2026-07-27 06:03:00',
      origin: 'scheduler',
      late_execution: true,
      separation_confirmed: false,
      separation_exception_note: '',
      next_shift_id: 42,
    },
  }), { contractVersion: 'v2' })

  assert.equal(v2.shift.state, 'pending_count')
  assert.deepEqual(v2.boundary, {
    operationalClosedAt: '2026-07-27 06:00:00',
    scheduledBoundaryAt: '2026-07-27 06:00:00',
    executedAt: '2026-07-27 06:03:00',
    origin: 'scheduler',
    lateExecution: true,
    separationConfirmed: false,
    separationExceptionNote: '',
    nextShiftId: 42,
  })
})

test('v2 admite automatic_settlement y v1 conserva sus enums cerrados', () => {
  const v2 = normalizeCashShift(validShift({
    closing_type: 'automatic_settlement',
    version_id: 701,
    version_number: 1,
    closed_or_reclosed_at: '2026-07-27 06:15:00',
    shift: { ...validShift().shift, state: 'closed', version: 1 },
    boundary: {
      operational_closed_at: '2026-07-27 06:00:00',
      scheduled_boundary_at: '2026-07-27 06:00:00',
      executed_at: '2026-07-27 06:03:00',
      origin: 'movement_guard',
      late_execution: true,
      separation_confirmed: true,
      separation_exception_note: 'Entrega tardía',
      next_shift_id: 42,
    },
  }), { contractVersion: 'v2' })
  assert.equal(v2.closingType, 'automatic_settlement')
  assert.throws(() => normalizeCashShift(validShift({ closing_type: 'automatic_settlement' })), TypeError)
})

test('normaliza la lista mínima v2 de arqueos pendientes con shape y prototipos seguros', () => {
  const response = {
    shifts: [{
      shift_id: 41,
      shift_type: 'night',
      business_date: '2026-07-27',
      state: 'pending_count',
      expected_version: 0,
      expected_cash: 212,
      operational_closed_at: '2026-07-27 06:00:00',
      scheduled_boundary_at: '2026-07-27 06:00:00',
      boundary_executed_at: '2026-07-27 06:03:00',
      late_execution: true,
      next_shift_id: 42,
    }],
  }
  assert.deepEqual(normalizePendingCashShiftList(response), [{
    shiftId: 41,
    shiftType: 'night',
    businessDate: '2026-07-27',
    state: 'pending_count',
    expectedVersion: 0,
    expectedCash: 212,
    operationalClosedAt: '2026-07-27 06:00:00',
    scheduledBoundaryAt: '2026-07-27 06:00:00',
    boundaryExecutedAt: '2026-07-27 06:03:00',
    lateExecution: true,
    nextShiftId: 42,
  }])

  let reads = 0
  assert.throws(() => normalizePendingCashShiftList({
    shifts: [{
      ...response.shifts[0],
      get unexpected() { reads += 1; return true },
    }],
  }), TypeError)
  assert.equal(reads, 0)
  assert.throws(() => normalizePendingCashShiftList({
    shifts: [{ ...response.shifts[0], state: 'closed' }],
  }), TypeError)
})

test('normaliza el formulario v2 de arqueo pendiente sin inventar efectivo físico', () => {
  const dto = normalizePendingCashShiftPreview({
    form_kind: 'pending_count',
    expected_version: 0,
    shift: { id: 41, type: 'night', business_date: '2026-07-27', state: 'pending_count' },
    opening_fund: 0,
    totals: { sales_cash: 212, sales_card: 0, sales_total: 212, expenses: 0, expected_cash: 212 },
    denominations: [],
    adjustments: [],
    notes_required: true,
    boundary: {
      operational_closed_at: '2026-07-27 06:00:00',
      scheduled_boundary_at: '2026-07-27 06:00:00',
      executed_at: '2026-07-27 06:03:00',
      late_execution: true,
      separation_confirmed: false,
      separation_exception_note: '',
      next_shift_id: 42,
    },
  })
  assert.equal(dto.expectedVersion, 0)
  assert.equal(dto.totals.expectedCash, 212)
  assert.equal(Object.hasOwn(dto, 'physicalCash'), false)
  assert.equal(dto.boundary.separationConfirmed, false)
})

test('acepta la zona IANA autoritativa configurada por la sucursal', () => {
  const dto = normalizeCashShift(validShift({
    period: { ...validShift().period, timezone: 'America/Tijuana' },
  }))

  assert.equal(dto.period.timezone, 'America/Tijuana')
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
      period: { ...validShift().period, timezone: 'America/Iguala' },
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
    [
      { denomination: '500', count: 1 },
      { denomination: '500', count: 2 },
    ],
  ]) {
    assert.throws(() => normalizeDenominations(lines), TypeError)
  }
  assert.equal('subtotal' in normalizeDenominations([
    { denomination: '500', count: 2, subtotal: 123 },
  ])[0], false)
  let subtotalReads = 0
  assert.throws(() => normalizeDenominations([{
    denomination: '500',
    count: 2,
    get subtotal() { subtotalReads += 1; return 1000 },
  }]), TypeError)
  assert.equal(subtotalReads, 0)
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
  assert.throws(() => normalizeCashShift(validShift({ printable: 'false' })), TypeError)
})

test('rechaza datetimes con forma correcta pero fecha u hora semánticamente inválidas', () => {
  for (const opened_at of [
    '2026-02-30 18:00:00',
    '2026-07-27 24:00:00',
    '2026-07-27 18:60:00',
    '2026-07-27T18:00:00+25:00',
  ]) {
    assert.throws(() => normalizeCashShift(validShift({
      period: { ...validShift().period, opened_at },
    })), TypeError)
  }
})

test('normaliza metadatos versionados e IDs históricos sin perder la fotografía del servidor', () => {
  const dto = normalizeCashShift(validShift({
    version_id: 701,
    version_number: 2,
    closing_type: 'reclose',
    previous_version_id: 700,
    closed_or_reclosed_at: '2026-07-27 06:04:00',
    responsible: {
      employee_id: 717,
      employee_name: 'Angélica Jaimes',
      user_id: 44,
      user_name: 'angy',
    },
    evidence: {
      id: 991,
      name: 'arqueo.webp',
      mimetype: 'image/webp',
      file_size: 2000,
      digest: 'abc123',
      reference: 'ir.attachment:991',
    },
    prior_totals: {
      sales_cash: 600,
      sales_card: 200,
      sales_total: 800,
      expenses_total: 50,
      adjustment_income_total: 20,
      adjustment_expense_total: 5,
      expected_cash: 1065,
      physical_cash: 1060,
      difference: -5,
    },
    shift: { ...validShift().shift, version: 2, state: 'closed' },
    denominations: [{
      id: 801,
      denomination: '500',
      count: 2,
      subtotal: 1000,
    }],
    adjustments: [{
      id: 802,
      type: 'expense',
      amount: 25,
      concept: 'Compra de bolsas',
      actor_employee_id: 717,
      recorded_at: '2026-07-27 06:03:00',
    }],
    authorizations: [{
      id: 803,
      level: 'manager',
      actor_employee_id: 717,
      authorized_at: '2026-07-27 06:05:00',
    }],
    printable: true,
  }))

  assert.equal(dto.folio, 'CT/POS/2026/00041')
  assert.equal(dto.versionId, 701)
  assert.equal(dto.versionNumber, 2)
  assert.equal(dto.closingType, 'reclose')
  assert.equal(dto.previousVersionId, 700)
  assert.equal(dto.closedOrReclosedAt, '2026-07-27 06:04:00')
  assert.deepEqual(dto.responsible, {
    employeeId: 717,
    employeeName: 'Angélica Jaimes',
    userId: 44,
    userName: 'angy',
  })
  assert.deepEqual(dto.evidence, {
    id: 991,
    name: 'arqueo.webp',
    mimetype: 'image/webp',
    fileSize: 2000,
    digest: 'abc123',
    reference: 'ir.attachment:991',
  })
  assert.deepEqual(dto.priorTotals, {
    salesCash: 600,
    salesCard: 200,
    salesTotal: 800,
    expensesTotal: 50,
    adjustmentIncomeTotal: 20,
    adjustmentExpenseTotal: 5,
    expectedCash: 1065,
    physicalCash: 1060,
    difference: -5,
  })
  assert.deepEqual(dto.denominations, [{
    id: 801,
    denomination: '500',
    count: 2,
    subtotal: 1000,
  }])
  assert.deepEqual(dto.adjustments, [{
    id: 802,
    type: 'expense',
    amount: 25,
    concept: 'Compra de bolsas',
    actor_employee_id: 717,
    recorded_at: '2026-07-27 06:03:00',
  }])
  assert.deepEqual(dto.authorizations, [{
    id: 803,
    level: 'manager',
    actor_employee_id: 717,
    authorized_at: '2026-07-27 06:05:00',
  }])
  assert.equal(dto.printable, true)
})

test('normaliza profundamente payments y filas sin ejecutar getters ni permitir contaminación', () => {
  const dto = normalizeCashShift(validShift({
    payments: {
      cash: 100,
      card: 20,
      total: 120,
      rows: [{ order_id: 501, method: 'cash', amount: 100 }],
    },
    products: [{
      product_id: 80,
      sku: '',
      product_name: 'Bolsa',
      quantity: 1,
      amount_total: 100,
      weight_per_unit_kg: 0,
      weight_total_kg: 0,
      weight_unknown: true,
      source_line_ids: [91],
      sources: [{
        line_id: 91,
        order_id: 501,
        quantity: 1,
        amount_total: 100,
        weight_total_kg: 0,
      }],
    }],
    product_totals: {
      quantity: 1,
      amount_total: 100,
      weight_total_kg: 0,
      products_without_weight: 1,
    },
  }))
  assert.deepEqual(dto.payments, {
    cash: 100,
    card: 20,
    total: 120,
    rows: [{ order_id: 501, method: 'cash', amount: 100 }],
  })
  assert.deepEqual(dto.products, [
    {
      product_id: 80,
      sku: '',
      product_name: 'Bolsa',
      quantity: 1,
      amount_total: 100,
      weight_per_unit_kg: 0,
      weight_total_kg: 0,
      weight_unknown: true,
      source_line_ids: [91],
      sources: [{
        line_id: 91,
        order_id: 501,
        quantity: 1,
        amount_total: 100,
        weight_total_kg: 0,
      }],
    },
  ])

  let getterReads = 0
  const maliciousPayments = {
    cash: 100,
    get rows() { getterReads += 1; return [] },
  }
  assert.throws(() => normalizeCashShift(validShift({ payments: maliciousPayments })), TypeError)
  assert.equal(getterReads, 0)

  const polluted = Object.create({ inherited_total: 999 })
  polluted.cash = 100
  assert.throws(() => normalizeCashShift(validShift({ payments: polluted })), TypeError)
})

test('valida y conserva el esquema exacto de snapshots live de productos y movimientos', () => {
  const snapshot = {
    products: [{
      product_id: 80,
      sku: 'BOLSA-5',
      product_name: 'Bolsa de hielo 5 kg',
      quantity: 2,
      amount_total: 100,
      weight_per_unit_kg: 5,
      weight_total_kg: 10,
      weight_unknown: false,
      source_line_ids: [91],
      sources: [{
        line_id: 91,
        order_id: 501,
        quantity: 2,
        amount_total: 100,
        weight_total_kg: 10,
      }],
    }],
    product_totals: {
      quantity: 2,
      amount_total: 100,
      weight_total_kg: 10,
      products_without_weight: 0,
    },
    payments: {
      cash: 100,
      card: 0,
      total: 100,
      rows: [{ order_id: 501, method: 'cash', amount: 100 }],
    },
    sales: [{
      order_id: 501,
      name: 'S00501',
      amount_total: 100,
      payment_method: 'cash',
      employee_id: 717,
      recorded_at: '2026-07-26 18:30:00',
      channel: 'night',
    }],
    cancellations: [{
      order_id: 502,
      name: 'S00502',
      amount_total: 50,
      payment_method: 'card',
      employee_id: 717,
      recorded_at: '2026-07-26 19:00:00',
      channel: 'night',
      reason_code: 'duplicate',
      reason_text: 'Duplicidad',
      cancelled_by_employee_id: 717,
      cancelled_by_user_id: 44,
      cancelled_at: '2026-07-26 19:05:00',
      origin: 'night',
    }, {
      order_id: 503,
      name: 'S00503',
      amount_total: 25,
      payment_method: 'cash',
      employee_id: 717,
      recorded_at: '2026-07-26 20:30:00',
      channel: 'admin',
      reason_code: false,
      reason_text: 'Cliente llamó para cancelar',
      cancelled_by_employee_id: 717,
      cancelled_by_user_id: 44,
      cancelled_at: '2026-07-26 20:35:00',
      origin: 'admin',
    }, {
      order_id: 504,
      name: 'S00504',
      amount_total: 30,
      payment_method: 'cash',
      employee_id: 717,
      recorded_at: '2026-07-27 11:00:00',
      channel: 'day',
      reason_code: 'out_of_stock',
      reason_text: 'Falta de stock',
      cancelled_by_employee_id: 717,
      cancelled_by_user_id: 44,
      cancelled_at: '2026-07-27 11:05:00',
      origin: 'day',
    }, {
      order_id: 505,
      name: 'S00505',
      amount_total: 40,
      payment_method: 'transfer',
      employee_id: false,
      recorded_at: '2026-07-27 12:00:00',
      channel: 'legacy_pwa',
      reason_code: false,
      reason_text: false,
      cancelled_by_employee_id: false,
      cancelled_by_user_id: false,
      cancelled_at: false,
      origin: false,
    }],
    expenses: [{
      expense_id: 601,
      name: 'Gasto 601',
      concept: 'Compra de bolsas',
      amount: 25,
      approval_state: 'approved',
      employee_id: 717,
      recorded_at: '2026-07-26 20:00:00',
    }],
  }
  const dto = normalizeCashShift(validShift(snapshot))
  assert.deepEqual(dto.products, snapshot.products)
  assert.deepEqual(dto.productTotals, snapshot.product_totals)
  assert.deepEqual(dto.payments, snapshot.payments)
  assert.deepEqual(dto.sales, snapshot.sales)
  assert.deepEqual(dto.cancellations, snapshot.cancellations)
  assert.deepEqual(dto.expenses, snapshot.expenses)
})

test('rechaza IDs, enums, importes y timestamps inválidos en cualquier snapshot nested', () => {
  const product = {
    product_id: 80,
    sku: 'BOLSA-5',
    product_name: 'Bolsa',
    quantity: 2,
    amount_total: 100,
    weight_per_unit_kg: 5,
    weight_total_kg: 10,
    weight_unknown: false,
    source_line_ids: [91],
    sources: [{
      line_id: 91, order_id: 501, quantity: 2, amount_total: 100, weight_total_kg: 10,
    }],
  }
  const sale = {
    order_id: 501,
    name: 'S00501',
    amount_total: 100,
    payment_method: 'cash',
    employee_id: 717,
    recorded_at: '2026-07-26 18:30:00',
    channel: 'night',
  }
  const expense = {
    expense_id: 601,
    name: 'Gasto 601',
    concept: 'Bolsas',
    amount: 25,
    approval_state: 'approved',
    employee_id: 717,
    recorded_at: '2026-07-26 20:00:00',
  }
  const invalidSnapshots = [
    { products: [{ ...product, product_id: '__proto__' }] },
    { products: [{ ...product, unexpected: true }] },
    { payments: { cash: 100, card: 0, total: 100, rows: [{ order_id: '501', method: 'cash', amount: 100 }] } },
    { payments: { cash: 100, card: 0, total: 100, rows: [{ order_id: 501, method: 'wire', amount: 100 }] } },
    { sales: [{ ...sale, employee_id: 'bad' }] },
    { sales: [{ ...sale, recorded_at: '2026-02-30 18:00:00' }] },
    { cancellations: [{
      ...sale,
      reason_code: 'other',
      reason_text: 'Otro',
      cancelled_by_employee_id: 717,
      cancelled_by_user_id: 44,
      cancelled_at: '2026-07-26 19:05:00',
      origin: 'night',
    }] },
    { expenses: [{ ...expense, expense_id: true }] },
    { expenses: [{ ...expense, amount: Number.POSITIVE_INFINITY }] },
    { denominations: [{ denomination: '500', count: 2_147_483_648, subtotal: 0 }] },
    { adjustments: [{ type: 'income', amount: 0, concept: 'Cambio' }] },
    { authorizations: [{
      id: 803,
      level: 'manager',
      actor_employee_id: 'bad',
      authorized_at: '2026-07-27 06:05:00',
    }] },
    { authorizations: [{
      id: 803,
      level: 'director',
      actor_employee_id: 717,
      authorized_at: '2026-07-27 25:00:00',
    }] },
  ]
  for (const override of invalidSnapshots) {
    assert.throws(() => normalizeCashShift(validShift(override)), TypeError)
  }
})

test('prior_totals solo acepta vacío o los nueve importes finitos del backend', () => {
  const valid = {
    sales_cash: 600,
    sales_card: 200,
    sales_total: 800,
    expenses_total: 50,
    adjustment_income_total: 20,
    adjustment_expense_total: 5,
    expected_cash: 1065,
    physical_cash: 1060,
    difference: -5,
  }
  assert.deepEqual(normalizeCashShift(validShift({ prior_totals: {} })).priorTotals, {})

  for (const prior_totals of [
    { ...valid, sales_cash: '600' },
    { ...valid, sales_cash: true },
    { ...valid, unknown_total: 1 },
    Object.fromEntries(Object.entries(valid).slice(1)),
    Object.assign(Object.create({ sales_cash: 600 }), valid),
  ]) {
    assert.throws(() => normalizeCashShift(validShift({ prior_totals })), TypeError)
  }

  let reads = 0
  const accessor = {
    ...valid,
    get difference() { reads += 1; return -5 },
  }
  assert.throws(() => normalizeCashShift(validShift({ prior_totals: accessor })), TypeError)
  assert.equal(reads, 0)
})

test('rechaza campos desconocidos en root y cada objeto estructural del DTO full', () => {
  const evidence = {
    id: 991,
    name: 'arqueo.webp',
    mimetype: 'image/webp',
    file_size: 2000,
    digest: 'abc123',
    reference: 'ir.attachment:991',
  }
  const invalid = [
    { unknown_root: true },
    { responsible: { ...validShift().responsible, unknown: true } },
    { evidence: { ...evidence, unknown: true } },
    { shift: { ...validShift().shift, unknown: true } },
    { scope: { ...validShift().scope, unknown: true } },
    { period: { ...validShift().period, unknown: true } },
    { schedule: { ...validShift().schedule, unknown: true } },
    { totals: { ...validShift().totals, unknown: true } },
  ]
  for (const override of invalid) {
    assert.throws(() => normalizeCashShift(validShift(override)), TypeError)
  }
})

test('rechaza IDs históricos y de alcance que no sean enteros positivos reales', () => {
  for (const version_id of ['701', true, -1, 1.5]) {
    assert.throws(() => normalizeCashShift(validShift({ version_id })), TypeError)
  }
  assert.throws(() => normalizeCashShift(validShift({
    scope: { ...validShift().scope, company_id: '__proto__' },
  })), TypeError)
  assert.throws(() => normalizeCashShift(validShift({
    responsible: { ...validShift().responsible, employee_id: '717' },
  })), TypeError)
})
