import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let model = {}
try {
  model = await import('../src/modules/admin/cashShiftHistoryModel.js')
} catch {
  // RED: the first assertion describes the contract before the module exists.
}

let vite

after(async () => {
  await vite?.close()
})

function fullShift({ id, type, versionId, versionNumber = 1, previousVersionId = false } = {}) {
  const isNight = type === 'night'
  return {
    folio: `CT/POS/2026/${String(id).padStart(5, '0')}`,
    version_id: versionId,
    version_number: versionNumber,
    closing_type: previousVersionId ? 'reclose' : 'close',
    responsible: {
      employee_id: 7,
      employee_name: 'Angy',
      user_id: 17,
      user_name: 'Angy',
    },
    closed_or_reclosed_at: isNight ? '2026-07-27 06:02:00' : '2026-07-27 18:03:00',
    evidence: {
      id: 500 + id,
      name: 'arqueo.jpg',
      mimetype: 'image/jpeg',
      file_size: 1234,
      digest: `sha256-${id}`,
      reference: `ir.attachment:${500 + id}`,
    },
    previous_version_id: previousVersionId,
    prior_totals: previousVersionId ? {
      sales_cash: 90,
      sales_card: 10,
      sales_total: 100,
      expenses_total: 5,
      adjustment_income_total: 0,
      adjustment_expense_total: 0,
      expected_cash: 185,
      physical_cash: 180,
      difference: -5,
    } : {},
    reopen_reason: previousVersionId ? 'Corregir cancelación duplicada' : '',
    shift: { id, type, business_date: '2026-07-27', state: 'closed', version: versionNumber },
    scope: {
      company_id: 34,
      company_name: 'Glaciem',
      warehouse_id: 89,
      warehouse_name: 'Iguala',
      analytic_account_id: 12,
      analytic_account_name: 'IGU34',
    },
    period: {
      opened_at: isNight ? '2026-07-26 18:04:00' : '2026-07-27 06:02:00',
      closed_at: isNight ? '2026-07-27 06:02:00' : '2026-07-27 18:03:00',
      timezone: 'America/Mexico_City',
    },
    schedule: { expected_close: isNight ? '2026-07-27 06:00:00' : '2026-07-27 18:00:00', overdue: false },
    totals: { sales_cash: 100, sales_card: 50, sales_total: 150, expenses: 20, expected_cash: 185 },
    opening_fund: 100,
    payments: {
      cash: 100,
      card: 50,
      total: 150,
      rows: [
        { order_id: id * 10 + 1, method: 'cash', amount: 100 },
        { order_id: id * 10 + 2, method: 'card', amount: 50 },
      ],
    },
    products: [{
      product_id: id * 100 + 1,
      sku: 'HIELO-5',
      product_name: 'Hielo 5 kg',
      quantity: 2,
      amount_total: 150,
      weight_per_unit_kg: 5,
      weight_total_kg: 10,
      weight_unknown: false,
      source_line_ids: [id * 1000 + 1],
      sources: [{
        line_id: id * 1000 + 1,
        order_id: id * 10 + 1,
        quantity: 2,
        amount_total: 150,
        weight_total_kg: 10,
      }],
    }],
    product_totals: { quantity: 2, amount_total: 150, weight_total_kg: 10, products_without_weight: 0 },
    sales: [
      { order_id: id * 10 + 1, name: `POS/${id}1`, amount_total: 100, payment_method: 'cash', employee_id: 7, recorded_at: '2026-07-27 05:00:00', channel: 'admin' },
      { order_id: id * 10 + 2, name: `POS/${id}2`, amount_total: 50, payment_method: 'card', employee_id: 8, recorded_at: '2026-07-27 05:10:00', channel: 'day' },
    ],
    cancellations: [{
      order_id: id * 10 + 3,
      name: `POS/${id}3`,
      amount_total: 25,
      payment_method: 'cash',
      employee_id: 7,
      recorded_at: '2026-07-27 05:20:00',
      channel: 'admin',
      reason_code: 'duplicate',
      reason_text: 'Duplicidad',
      cancelled_by_employee_id: 7,
      cancelled_by_user_id: 17,
      cancelled_at: '2026-07-27 05:25:00',
      origin: 'admin',
    }],
    expenses: [{ expense_id: id * 100 + 2, name: 'EXP/1', concept: 'Gasolina', amount: 20, approval_state: 'approved', employee_id: 7, recorded_at: '2026-07-27 05:30:00' }],
    denominations: [{ id: id * 100 + 3, denomination: '100', count: 2, subtotal: 200 }],
    adjustments: [{ id: id * 100 + 4, type: 'income', amount: 5, concept: 'Cambio', actor_employee_id: 7, recorded_at: '2026-07-27 05:40:00' }],
    authorizations: [{ id: id * 100 + 5, level: 'manager', actor_employee_id: 9, authorized_at: '2026-07-27 06:10:00' }],
    physical_cash: 200,
    difference: 15,
    difference_note: 'Sobrante revisado',
    evidence_present: true,
    needs_manager_auth: true,
    needs_director_auth: false,
    printable: true,
  }
}

function consolidated() {
  return {
    payments: { cash: 200, card: 100, total: 300 },
    sales_total: 300,
    expenses_total: 40,
    adjustment_income_total: 10,
    adjustment_expense_total: 4,
    products: [{
      product_id: 901,
      sku: 'HIELO-5',
      product_name: 'Hielo 5 kg',
      weight_unknown: false,
      quantity: 4,
      amount_total: 300,
      weight_total_kg: 20,
      source_line_ids: [41001, 42001],
    }],
    product_totals: { quantity: 4, amount_total: 300, weight_total_kg: 20, products_without_weight: 0 },
    realized_order_ids: [411, 412, 421, 422],
    payment_order_ids: [411, 412, 421, 422],
    cancelled_order_ids: [413, 423],
    expense_ids: [4102, 4202],
    adjustment_ids: [4104, 4204],
    product_source_line_ids: [41001, 42001],
    shift_arqueos: [
      { shift: { id: 41, type: 'night', business_date: '2026-07-27', state: 'closed' }, version_id: 701, opening_fund: 100, expected_cash: 185, physical_cash: 200, difference: 15, denominations: [{ id: 4103, denomination: '100', count: 2, subtotal: 200 }] },
      { shift: { id: 42, type: 'day', business_date: '2026-07-27', state: 'closed' }, version_id: 702, opening_fund: 100, expected_cash: 185, physical_cash: 200, difference: 15, denominations: [{ id: 4203, denomination: '100', count: 2, subtotal: 200 }] },
    ],
    net_difference: 30,
    business_date: '2026-07-27',
    company_id: 34,
    warehouse_id: 89,
  }
}

function historyPayload() {
  return {
    business_date: '2026-07-27',
    shifts: [
      fullShift({ id: 42, type: 'day', versionId: 702 }),
      fullShift({ id: 41, type: 'night', versionId: 701 }),
    ],
    consolidated: consolidated(),
  }
}

function openUnversionedShift() {
  const shift = fullShift({ id: 43, type: 'night', versionId: false, versionNumber: 0 })
  shift.closing_type = false
  shift.responsible = { employee_id: false, employee_name: '', user_id: false, user_name: '' }
  shift.closed_or_reclosed_at = false
  shift.evidence = false
  shift.shift.state = 'open'
  shift.period.closed_at = false
  shift.denominations = shift.denominations.map(({ denomination, count, subtotal }) => ({ denomination, count, subtotal }))
  shift.adjustments = shift.adjustments.map(({ type, amount, concept }) => ({ type, amount, concept }))
  shift.authorizations = []
  shift.evidence_present = false
  shift.printable = false
  return shift
}

function emptyConsolidated() {
  const value = consolidated()
  value.payments = { cash: 0, card: 0, total: 0 }
  value.sales_total = 0
  value.expenses_total = 0
  value.adjustment_income_total = 0
  value.adjustment_expense_total = 0
  value.products = []
  value.product_totals = { quantity: 0, amount_total: 0, weight_total_kg: 0, products_without_weight: 0 }
  value.realized_order_ids = []
  value.payment_order_ids = []
  value.cancelled_order_ids = []
  value.expense_ids = []
  value.adjustment_ids = []
  value.product_source_line_ids = []
  value.shift_arqueos = []
  value.net_difference = 0
  return value
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.children)
}

function renderedText(renderer) {
  return textOf(renderer.toJSON()).replace(/\s+/g, ' ').trim()
}

test('history model exposes the strict operational history contract', () => {
  assert.equal(typeof model.normalizeCashShiftHistory, 'function')
  assert.equal(typeof model.operationalHistorySections, 'function')
  assert.equal(typeof model.validateOperationalHistoryDate, 'function')
  assert.equal(typeof model.mexicoBusinessDate, 'function')
})

test('orders Noche, Día and server Consolidado for operational date 27', () => {
  const normalized = model.normalizeCashShiftHistory(historyPayload(), '2026-07-27')
  assert.deepEqual(
    model.operationalHistorySections(normalized).map((row) => row.label),
    ['Noche 27', 'Día 27', 'Consolidado 27'],
  )
  assert.equal(normalized.consolidated.salesTotal, 300)
  assert.equal(normalized.consolidated.netDifference, 30)
  assert.equal('openingFund' in normalized.consolidated, false)
  assert.equal('physicalCash' in normalized.consolidated, false)
  assert.equal('expectedCash' in normalized.consolidated, false)
  assert.equal('denominations' in normalized.consolidated, false)
})

test('fails closed on duplicate or incoherent consolidated movement IDs', () => {
  const duplicate = historyPayload()
  duplicate.consolidated.expense_ids = [4102, 4102]
  assert.throws(() => model.normalizeCashShiftHistory(duplicate, '2026-07-27'), TypeError)

  const incoherent = historyPayload()
  incoherent.consolidated.payment_order_ids = [411, 412]
  assert.throws(() => model.normalizeCashShiftHistory(incoherent, '2026-07-27'), TypeError)

  const mismatchedDate = historyPayload()
  mismatchedDate.shifts[0].shift.business_date = '2026-07-26'
  assert.throws(() => model.normalizeCashShiftHistory(mismatchedDate, '2026-07-27'), TypeError)

  const missingArqueo = historyPayload()
  missingArqueo.consolidated.shift_arqueos.pop()
  assert.throws(() => model.normalizeCashShiftHistory(missingArqueo, '2026-07-27'), TypeError)

  const wrongScope = historyPayload()
  wrongScope.consolidated.warehouse_id = 999
  assert.throws(() => model.normalizeCashShiftHistory(wrongScope, '2026-07-27'), TypeError)
})

test('consolidated IDs are the exact union of persisted snapshots without comparing money', () => {
  const families = [
    ['realized_order_ids', 999001],
    ['payment_order_ids', 999002],
    ['cancelled_order_ids', 999003],
    ['expense_ids', 999004],
    ['adjustment_ids', 999005],
    ['product_source_line_ids', 999006],
  ]
  for (const [field, extra] of families) {
    const withExtra = historyPayload()
    withExtra.consolidated[field].push(extra)
    assert.throws(() => model.normalizeCashShiftHistory(withExtra, '2026-07-27'), TypeError, `${field} extra`)

    const omitted = historyPayload()
    omitted.consolidated[field].pop()
    assert.throws(() => model.normalizeCashShiftHistory(omitted, '2026-07-27'), TypeError, `${field} omitted`)
  }

  const duplicateAcrossShifts = historyPayload()
  duplicateAcrossShifts.shifts[0].sales[0].order_id = duplicateAcrossShifts.shifts[1].sales[0].order_id
  duplicateAcrossShifts.shifts[0].payments.rows[0].order_id = duplicateAcrossShifts.shifts[1].payments.rows[0].order_id
  assert.throws(() => model.normalizeCashShiftHistory(duplicateAcrossShifts, '2026-07-27'), TypeError)

  const onlyOpen = {
    business_date: '2026-07-27',
    shifts: [openUnversionedShift()],
    consolidated: emptyConsolidated(),
  }
  assert.equal(model.normalizeCashShiftHistory(onlyOpen, '2026-07-27').shifts.length, 1)

  const reopened = historyPayload()
  reopened.shifts[0].shift.state = 'reopened'
  reopened.consolidated.shift_arqueos[1].shift.state = 'reopened'
  assert.equal(model.normalizeCashShiftHistory(reopened, '2026-07-27').shifts[1].shift.state, 'reopened')

  const serverMoney = historyPayload()
  serverMoney.consolidated.sales_total = 9876.54
  serverMoney.consolidated.payments.total = 1234.56
  const normalized = model.normalizeCashShiftHistory(serverMoney, '2026-07-27')
  assert.equal(normalized.consolidated.salesTotal, 9876.54)
  assert.equal(normalized.consolidated.payments.total, 1234.56)
})

test('uses Mexico civil date and rejects invalid or future operational dates', () => {
  const instant = Date.parse('2026-07-28T04:30:00Z') // 27th at 22:30 Mexico City
  assert.equal(model.mexicoBusinessDate(instant), '2026-07-27')
  assert.equal(model.validateOperationalHistoryDate('2026-07-27', instant), '2026-07-27')
  assert.throws(() => model.validateOperationalHistoryDate('2026-07-28', instant), /futura/i)
  assert.throws(() => model.validateOperationalHistoryDate('2026-02-30', instant), /válida/i)
})

test('allows only the authoritative active shift date when it is still civilly future', () => {
  const instant = Date.parse('2026-07-27T04:30:00Z') // 26th at 22:30 Mexico City
  assert.equal(
    model.validateOperationalHistoryDate('2026-07-27', instant, '2026-07-27'),
    '2026-07-27',
  )
  assert.throws(
    () => model.validateOperationalHistoryDate('2026-07-28', instant, '2026-07-27'),
    /futura/i,
  )
  assert.throws(
    () => model.validateOperationalHistoryDate('2026-07-27', instant, 'fecha-inválida'),
    /válida/i,
  )
})

test('print view includes exact snapshot audit fields and obeys printable gate', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: PrintView } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftPrintView.jsx')
  const onPrintCalls = []
  const payload = historyPayload()
  payload.shifts.forEach((shift) => { shift.period.timezone = 'America/Tijuana' })
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PrintView, {
      cashShift: model.normalizeCashShiftHistory(payload, '2026-07-27').shifts[0],
      onPrint: () => onPrintCalls.push('print'),
    }))
  })
  const text = renderedText(renderer)
  for (const expected of [
    'CT/POS/2026/00041', 'Angy', 'Fecha operativa', 'Noche', 'America/Tijuana',
    'Pagos', 'Productos', 'Gastos', 'Cancelaciones', 'Ventas y tickets', 'Ajustes',
    'Fondo inicial', 'Denominación', 'Físico', 'Esperado', 'Diferencia', 'Sobrante revisado',
    'ir.attachment:541', 'sha256-41', 'Autorizaciones', 'Versión 1',
  ]) assert.match(text, new RegExp(expected))
  const printButton = renderer.root.findAllByType('button').find((item) => textOf(item) === 'Imprimir')
  await act(async () => printButton.props.onClick())
  assert.equal(onPrintCalls.length, 1)

  await act(async () => renderer.update(React.createElement(PrintView, {
    cashShift: { ...model.normalizeCashShiftHistory(historyPayload(), '2026-07-27').shifts[0], printable: false },
    onPrint: () => onPrintCalls.push('blocked'),
  })))
  assert.equal(renderer.root.findAllByType('button').some((item) => textOf(item) === 'Imprimir'), false)
})

test('history UI rejects future Mexico date without an API call and ignores stale session response', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: History } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftHistory.jsx')
  const requestA = deferred()
  const calls = []
  const loader = ({ businessDate }) => {
    calls.push(businessDate)
    return requestA.promise
  }
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(History, {
      accessMode: 'manage',
      sessionIdentity: 'A',
      loadHistory: loader,
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  assert.deepEqual(calls, ['2026-07-27'])
  const date = renderer.root.findByProps({ name: 'cashShiftBusinessDate' })
  await act(async () => date.props.onChange({ target: { value: '2026-07-28' } }))
  assert.match(renderedText(renderer), /fecha operativa no puede ser futura/i)
  assert.equal(calls.length, 1)

  await act(async () => {
    renderer.update(React.createElement(History, {
      accessMode: 'manage',
      sessionIdentity: 'B',
      loadHistory: async () => ({ data: historyPayload() }),
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  await act(async () => { requestA.resolve({ data: historyPayload() }); await flush() })
  assert.match(renderedText(renderer), /Noche 27/)
})

test('history UI starts on the exact future active shift date and blocks every other future date', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: History } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftHistory.jsx')
  const calls = []
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(History, {
      accessMode: 'manage',
      sessionIdentity: 'future-active-day',
      activeBusinessDate: '2026-07-27',
      loadHistory: async ({ businessDate }) => {
        calls.push(businessDate)
        return { data: historyPayload() }
      },
      now: () => Date.parse('2026-07-27T04:30:00Z'),
    }))
    await flush()
  })
  assert.deepEqual(calls, ['2026-07-27'])
  assert.match(renderedText(renderer), /Noche 27/)
  const date = renderer.root.findByProps({ name: 'cashShiftBusinessDate' })
  assert.equal(date.props.max, '2026-07-27')
  await act(async () => date.props.onChange({ target: { value: '2026-07-28' } }))
  assert.match(renderedText(renderer), /fecha operativa no puede ser futura/i)
  assert.deepEqual(calls, ['2026-07-27'])
})

test('an invalid operational filter immediately invalidates old history success and failure', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: History } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftHistory.jsx')
  for (const settle of ['resolve', 'reject']) {
    const pending = deferred()
    let renderer
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(History, {
        accessMode: 'manage',
        sessionIdentity: `filter-${settle}`,
        loadHistory: async () => pending.promise,
        now: () => Date.parse('2026-07-28T04:30:00Z'),
      }))
      await flush()
    })
    const date = renderer.root.findByProps({ name: 'cashShiftBusinessDate' })
    await act(async () => date.props.onChange({ target: { value: '2026-07-28' } }))
    assert.match(renderedText(renderer), /fecha operativa no puede ser futura/i)
    await act(async () => {
      if (settle === 'resolve') pending.resolve({ data: historyPayload() })
      else pending.reject(new Error('old request'))
      await flush()
    })
    assert.match(renderedText(renderer), /fecha operativa no puede ser futura/i)
    assert.doesNotMatch(renderedText(renderer), /Noche 27|No se pudo cargar un historial operativo válido/i)
    await act(async () => renderer.unmount())
  }
})

test('history detail is single-flight and a version from session A cannot publish in session B', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: History } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftHistory.jsx')
  const pendingDetail = deferred()
  let detailCalls = 0
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(History, {
      accessMode: 'manage',
      sessionIdentity: 'detail-A',
      loadHistory: async () => ({ data: historyPayload() }),
      loadDetail: async () => { detailCalls += 1; return pendingDetail.promise },
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  const detailButton = renderer.root.findAllByType('button').find((item) => /Ver detalle Noche 27/.test(textOf(item)))
  await act(async () => {
    detailButton.props.onClick()
    detailButton.props.onClick()
    await flush()
  })
  assert.equal(detailCalls, 1)

  const empty = historyPayload()
  empty.shifts = []
  empty.consolidated.shift_arqueos = []
  await act(async () => {
    renderer.update(React.createElement(History, {
      accessMode: 'manage',
      sessionIdentity: 'detail-B',
      loadHistory: async () => ({ data: empty }),
      loadDetail: async () => { throw new Error('must-not-load') },
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  await act(async () => {
    pendingDetail.resolve({ data: fullShift({ id: 41, type: 'night', versionId: 701 }) })
    await flush()
  })
  assert.doesNotMatch(renderedText(renderer), /REPORTE DE CORTE POS/)
})

test('changing operational date immediately invalidates a pending exact-version detail', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: History } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftHistory.jsx')
  const pendingDetail = deferred()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(History, {
      accessMode: 'manage',
      sessionIdentity: 'detail-filter',
      loadHistory: async () => ({ data: historyPayload() }),
      loadDetail: async () => pendingDetail.promise,
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  const detailButton = renderer.root.findAllByType('button').find((item) => /Ver detalle Noche 27/.test(textOf(item)))
  await act(async () => { detailButton.props.onClick(); await flush() })
  const date = renderer.root.findByProps({ name: 'cashShiftBusinessDate' })
  await act(async () => date.props.onChange({ target: { value: '2026-07-28' } }))
  await act(async () => {
    pendingDetail.resolve({ data: fullShift({ id: 41, type: 'night', versionId: 701 }) })
    await flush()
  })
  assert.match(renderedText(renderer), /fecha operativa no puede ser futura/i)
  assert.doesNotMatch(renderedText(renderer), /REPORTE DE CORTE POS/)
})

test('legacy history is lazy, read-only, manage-only and ignores stale detail/session responses', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: Legacy } = await vite.ssrLoadModule('/src/modules/admin/components/LegacyCashClosingHistory.jsx')
  const calls = []
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Legacy, {
      accessMode: 'authorize',
      sessionIdentity: 'A',
      loadHistory: async (input) => { calls.push(['history', input]); return { data: {} } },
      loadDetail: async (input) => { calls.push(['detail', input]); return { data: {} } },
    }))
    await flush()
  })
  assert.equal(calls.length, 0)
  assert.doesNotMatch(renderedText(renderer), /Cerrar día|Crear cierre/i)

  await act(async () => {
    renderer.update(React.createElement(Legacy, {
      accessMode: 'manage',
      sessionIdentity: 'B',
      loadHistory: async (input) => {
        calls.push(['history', input])
        return { data: { total_count: 1, count: 1, limit: 25, offset: 0, closings: [{ closing_id: 9, name: 'CC/9', date: '2026-07-20', state: 'closed', difference: 0 }] } }
      },
      loadDetail: async () => ({ data: { closing_id: 9, name: 'CC/9', date: '2026-07-20', state: 'closed', denominations: [] } }),
    }))
    await flush()
  })
  assert.equal(calls.length, 1)
  assert.match(renderedText(renderer), /Cierres diarios anteriores/)
  assert.doesNotMatch(renderedText(renderer), /Cerrar día|Crear cierre/i)
})

test('legacy detail from session A is ignored after session B and requests stay single-flight', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: Legacy } = await vite.ssrLoadModule('/src/modules/admin/components/LegacyCashClosingHistory.jsx')
  const pendingDetail = deferred()
  let detailCalls = 0
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Legacy, {
      accessMode: 'manage',
      sessionIdentity: 'legacy-A',
      loadHistory: async () => ({ data: { total_count: 1, count: 1, limit: 25, offset: 0, closings: [{ closing_id: 9, name: 'CC/9', date: '2026-07-20', state: 'closed', difference: 0 }] } }),
      loadDetail: async () => { detailCalls += 1; return pendingDetail.promise },
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  const row = renderer.root.findAllByType('button').find((item) => /CC\/9/.test(textOf(item)))
  await act(async () => { row.props.onClick(); row.props.onClick(); await flush() })
  assert.equal(detailCalls, 1)
  await act(async () => {
    renderer.update(React.createElement(Legacy, {
      accessMode: 'manage',
      sessionIdentity: 'legacy-B',
      loadHistory: async () => ({ data: { total_count: 0, count: 0, limit: 25, offset: 0, closings: [] } }),
      loadDetail: async () => { throw new Error('must-not-load') },
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  await act(async () => {
    pendingDetail.resolve({ data: { closing_id: 9, name: 'CC/9', date: '2026-07-20', state: 'closed', denominations: [] } })
    await flush()
  })
  assert.doesNotMatch(renderedText(renderer), /CC\/9/)
})

test('legacy filter and pagination changes immediately invalidate old history and detail', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: Legacy } = await vite.ssrLoadModule('/src/modules/admin/components/LegacyCashClosingHistory.jsx')
  const pendingHistory = deferred()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Legacy, {
      accessMode: 'manage',
      sessionIdentity: 'legacy-filter',
      loadHistory: async () => pendingHistory.promise,
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  const toDate = renderer.root.findByProps({ name: 'legacyDateTo' })
  await act(async () => toDate.props.onChange({ target: { value: '2026-07-28' } }))
  await act(async () => {
    pendingHistory.resolve({ data: { total_count: 1, count: 1, limit: 25, offset: 0, closings: [{ closing_id: 9, name: 'CC/9', date: '2026-07-20', state: 'closed', difference: 0 }] } })
    await flush()
  })
  assert.match(renderedText(renderer), /fecha operativa no puede ser futura/i)
  assert.doesNotMatch(renderedText(renderer), /CC\/9/)

  const pendingDetail = deferred()
  await act(async () => {
    renderer.update(React.createElement(Legacy, {
      accessMode: 'manage',
      sessionIdentity: 'legacy-detail-filter',
      loadHistory: async () => ({ data: { total_count: 30, count: 1, limit: 25, offset: 0, closings: [{ closing_id: 10, name: 'CC/10', date: '2026-07-20', state: 'closed', difference: 0 }] } }),
      loadDetail: async () => pendingDetail.promise,
      now: () => Date.parse('2026-07-28T04:30:00Z'),
    }))
    await flush()
  })
  const row = renderer.root.findAllByType('button').find((item) => /CC\/10/.test(textOf(item)))
  await act(async () => { row.props.onClick(); await flush() })
  const next = renderer.root.findAllByType('button').find((item) => textOf(item) === 'Siguiente')
  await act(async () => { next.props.onClick(); await flush() })
  await act(async () => {
    pendingDetail.resolve({ data: { closing_id: 10, name: 'CC/10', date: '2026-07-20', state: 'closed', denominations: [] } })
    await flush()
  })
  assert.doesNotMatch(renderedText(renderer), /CIERRE DIARIO ANTERIOR · SOLO LECTURA/)
})

test('dashboard exposes three manage-only tabs and loads history and legacy only when selected', async () => {
  vite = vite || await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  const { default: Dashboard } = await vite.ssrLoadModule('/src/modules/admin/components/CashShiftDashboard.jsx')
  const calls = []
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Dashboard, {
      accessMode: 'manage',
      scopeReady: true,
      sessionIdentity: 'manage-A',
      loadActive: async () => openUnversionedShift(),
      loadHistory: async ({ businessDate }) => { calls.push(`operational:${businessDate}`); return { data: historyPayload() } },
      loadLegacyHistory: async () => { calls.push('legacy'); return { data: { total_count: 0, count: 0, limit: 25, offset: 0, closings: [] } } },
      loadLegacyDetail: async () => { calls.push('legacy-detail'); return { data: {} } },
      historyNow: () => Date.parse('2026-07-27T04:30:00Z'),
      scheduleRefresh: () => 1,
      cancelRefresh: () => {},
    }))
    await flush()
  })
  const tabs = renderer.root.findAll((node) => node.props.role === 'tab')
  assert.deepEqual(tabs.map((tab) => textOf(tab)), ['Turno activo', 'Historial operativo', 'Cierres diarios anteriores'])
  assert.deepEqual(calls, [])
  await act(async () => { tabs[1].props.onClick(); await flush() })
  assert.deepEqual(calls, ['operational:2026-07-27'])
  const updatedTabs = renderer.root.findAll((node) => node.props.role === 'tab')
  await act(async () => { updatedTabs[2].props.onClick(); await flush() })
  assert.deepEqual(calls, ['operational:2026-07-27', 'legacy'])

  await act(async () => {
    renderer.update(React.createElement(Dashboard, {
      accessMode: 'authorize',
      scopeReady: true,
      sessionIdentity: 'auth-B',
      loadHistory: async () => { calls.push('forbidden-operational'); return {} },
      loadLegacyHistory: async () => { calls.push('forbidden-legacy'); return {} },
    }))
    await flush()
  })
  assert.equal(renderer.root.findAll((node) => node.props.role === 'tab').length, 0)
  assert.deepEqual(calls, ['operational:2026-07-27', 'legacy'])
})

test('print stylesheet hides app navigation, tabs, controls and preserves report tables', () => {
  const css = fs.readFileSync(new URL('../src/modules/admin/cashShift.css', import.meta.url), 'utf8')
  assert.match(css, /@media print/)
  assert.match(css, /cash-shift-tabs/)
  assert.match(css, /cash-shift-print-hide/)
  assert.match(css, /cash-shift-print-report/)
  assert.match(css, /break-inside:\s*avoid/)
  assert.match(css, /\.cash-shift-print-report\s+dt[^}]*color:\s*#111/i)
  assert.match(css, /\.cash-shift-print-report\s+\.cash-shift-muted[^}]*color:\s*#111/i)
  assert.match(css, /\.cash-shift-print-report\s+\.cash-shift-info[^}]*color:\s*#111/i)
  assert.match(css, /\.cash-shift-print-report\s+\.cash-shift-eyebrow[^}]*color:\s*#111/i)
  assert.match(css, /\.cash-shift-print-report\s+h[1-6][^}]*color:\s*#111/i)
})
