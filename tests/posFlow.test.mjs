import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_POS_FLOW,
  NIGHT_POS_FLOW,
  buildPosTicketPath,
  canCancelPosOrder,
  canOpenPosPayment,
  classifyPosSaleCreateError,
  normalizePosSaleResult,
  submitPosCancellation,
} from '../src/modules/admin/posFlow.js'
import * as posFlow from '../src/modules/admin/posFlow.js'

const NIGHT_CANCEL_REASONS = [
  { code: 'duplicate', label: 'Duplicidad' },
  { code: 'error', label: 'Error' },
  { code: 'customer_cancelled', label: 'Canceló' },
  { code: 'out_of_stock', label: 'Falta de stock' },
]

test('ADMIN_POS_FLOW preserves the existing admin POS routes', () => {
  assert.deepEqual(ADMIN_POS_FLOW, {
    backTo: '/admin',
    posRoute: '/admin/pos',
    ticketBasePath: '/admin/ticket',
    title: 'Venta mostrador',
    standalone: false,
    allowSaleCancellation: true,
    cancellationMode: 'free-text',
  })
  assert.equal(buildPosTicketPath(ADMIN_POS_FLOW, 9001), '/admin/ticket/9001')
})

test('NIGHT_POS_FLOW defines the isolated night POS routes', () => {
  assert.deepEqual(NIGHT_POS_FLOW, {
    backTo: '/',
    posRoute: '/pos-nocturno',
    ticketBasePath: '/pos-nocturno/ticket',
    salesRoute: '/pos-nocturno/ventas',
    title: 'POS nocturno',
    standalone: true,
    allowSaleCancellation: true,
    cancellationMode: 'closed-reasons',
    cancelReasons: NIGHT_CANCEL_REASONS,
  })
  assert.equal(buildPosTicketPath(NIGHT_POS_FLOW, 9001), '/pos-nocturno/ticket/9001')
})

test('NIGHT_POS_FLOW and its closed cancellation reasons are immutable', () => {
  assert.equal(Object.isFrozen(NIGHT_POS_FLOW), true)
  assert.equal(Object.isFrozen(NIGHT_POS_FLOW.cancelReasons), true)
  assert.equal(
    NIGHT_POS_FLOW.cancelReasons.every((reason) => Object.isFrozen(reason)),
    true,
  )
})

test('DAY_POS_FLOW defines the frozen standalone day contract with shared reasons', () => {
  assert.deepEqual(posFlow.DAY_POS_FLOW, {
    backTo: '/',
    posRoute: '/pos-diurno',
    ticketBasePath: '/pos-diurno/ticket',
    salesRoute: '/pos-diurno/ventas',
    title: 'POS día',
    standalone: true,
    posScope: 'day',
    defaultCustomerName: 'VENTA PUBLICO IGUALA',
    allowSaleCancellation: true,
    cancellationMode: 'closed-reasons',
    cancelReasons: NIGHT_CANCEL_REASONS,
  })
  assert.equal(Object.isFrozen(posFlow.DAY_POS_FLOW), true)
  assert.equal(posFlow.DAY_POS_FLOW.cancelReasons, NIGHT_POS_FLOW.cancelReasons)
  assert.equal(Object.isFrozen(posFlow.DAY_POS_FLOW.cancelReasons), true)
  assert.equal(
    posFlow.DAY_POS_FLOW.cancelReasons.every((reason) => Object.isFrozen(reason)),
    true,
  )
  assert.equal(
    buildPosTicketPath(posFlow.DAY_POS_FLOW, 9001),
    '/pos-diurno/ticket/9001',
  )
  assert.equal(
    { ...posFlow.DAY_POS_FLOW }.cancelReasons,
    NIGHT_POS_FLOW.cancelReasons,
  )
})

test('normalizePosScope accepts only omitted or the exact day scalar', () => {
  assert.equal(posFlow.normalizePosScope(undefined), undefined)
  assert.equal(posFlow.normalizePosScope('day'), 'day')

  for (const value of [null, '', ' day ', 'DAY', 'night', 1, true, [], {}]) {
    assert.throws(
      () => posFlow.normalizePosScope(value),
      { name: 'TypeError', message: 'El alcance del POS no es válido.' },
      String(value),
    )
  }
})

test('canCancelPosOrder preserves admin free-text eligibility', () => {
  const eligibleOrder = { id: 9001, state: 'sale', can_cancel: false }

  assert.equal(canCancelPosOrder(ADMIN_POS_FLOW, eligibleOrder, true), true)
  assert.equal(canCancelPosOrder(ADMIN_POS_FLOW, { ...eligibleOrder, state: 'cancel' }, true), false)
  assert.equal(canCancelPosOrder(ADMIN_POS_FLOW, { ...eligibleOrder, state: 'done' }, true), false)
  assert.equal(canCancelPosOrder(ADMIN_POS_FLOW, eligibleOrder, false), false)
  assert.equal(
    canCancelPosOrder({ ...ADMIN_POS_FLOW, allowSaleCancellation: false }, eligibleOrder, true),
    false,
  )
})

test('canCancelPosOrder requires a safe order id for every cancellation mode', () => {
  for (const id of [undefined, null, 0, -1, 1.5, 'unsafe', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(canCancelPosOrder(ADMIN_POS_FLOW, { id, state: 'sale' }, true), false)
    assert.equal(
      canCancelPosOrder(NIGHT_POS_FLOW, { id, state: 'sale', can_cancel: true }, true),
      false,
    )
  }

  assert.equal(
    canCancelPosOrder(NIGHT_POS_FLOW, { order_id: '9001', state: 'sale', can_cancel: true }, true),
    true,
  )
})

test('canCancelPosOrder trusts the night backend boolean without amount thresholds', () => {
  for (const amount_total of [0, 4999.99, 5000, 5001, 1000000]) {
    assert.equal(
      canCancelPosOrder(NIGHT_POS_FLOW, {
        id: 9001,
        state: 'sale',
        amount_total,
        can_cancel: true,
      }, true),
      true,
    )
    assert.equal(
      canCancelPosOrder(NIGHT_POS_FLOW, {
        id: 9001,
        state: 'sale',
        amount_total,
        can_cancel: false,
      }, true),
      false,
    )
  }

  for (const malformed of [undefined, null, 1, 'true']) {
    assert.equal(
      canCancelPosOrder(NIGHT_POS_FLOW, {
        id: 9001,
        state: 'sale',
        amount_total: 1,
        can_cancel: malformed,
      }, true),
      false,
    )
  }
})

test('canCancelPosOrder rejects terminal night states despite malformed approval', () => {
  for (const state of ['cancel', 'done']) {
    assert.equal(
      canCancelPosOrder(NIGHT_POS_FLOW, { id: 9001, state, can_cancel: true }, true),
      false,
    )
  }
})

test('canCancelPosOrder requires normalized sale state for night authorization', () => {
  assert.equal(
    canCancelPosOrder(NIGHT_POS_FLOW, {
      id: 9001,
      state: ' SALE ',
      can_cancel: true,
    }, true),
    true,
  )

  for (const state of ['draft', 'sent', '', 'unknown', null, undefined]) {
    assert.equal(
      canCancelPosOrder(NIGHT_POS_FLOW, { id: 9001, state, can_cancel: true }, true),
      false,
      String(state),
    )
    assert.equal(
      canCancelPosOrder(ADMIN_POS_FLOW, { id: 9001, state, can_cancel: false }, true),
      true,
      `admin ${String(state)}`,
    )
  }
})

test('submitPosCancellation rejects flows that do not allow cancellation', async () => {
  const calls = []

  await assert.rejects(
    submitPosCancellation({
      flow: { ...NIGHT_POS_FLOW, allowSaleCancellation: false },
      orderId: 9001,
      reasonCode: 'duplicate',
      cancelFn: (...args) => calls.push(args),
    }),
  )

  assert.deepEqual(calls, [])
})

test('submitPosCancellation submits one allowed closed reason code', async () => {
  const calls = []
  const expected = { ok: true }

  const result = await submitPosCancellation({
    flow: NIGHT_POS_FLOW,
    orderId: '9001',
    reasonCode: 'duplicate',
    reason: 'free text must not leak',
    cancelFn: async (...args) => {
      calls.push(args)
      return expected
    },
  })

  assert.equal(result, expected)
  assert.deepEqual(calls, [[9001, { reasonCode: 'duplicate' }]])
})

test('submitPosCancellation carries the day flow scope to cancellation', async () => {
  const calls = []

  await submitPosCancellation({
    flow: posFlow.DAY_POS_FLOW,
    orderId: 9001,
    reasonCode: 'duplicate',
    cancelFn: async (...args) => calls.push(args),
  })

  assert.deepEqual(calls, [[9001, { reasonCode: 'duplicate', posScope: 'day' }]])
})

test('submitPosCancellation rejects missing and unknown closed reason codes without calling', async () => {
  for (const reasonCode of [undefined, '', 'unknown', ' duplicate ']) {
    const calls = []

    await assert.rejects(
      submitPosCancellation({
        flow: NIGHT_POS_FLOW,
        orderId: 9001,
        reasonCode,
        cancelFn: (...args) => calls.push(args),
      }),
    )

    assert.deepEqual(calls, [], String(reasonCode))
  }
})

test('submitPosCancellation trims admin free text and rejects empty text', async () => {
  const calls = []

  await submitPosCancellation({
    flow: ADMIN_POS_FLOW,
    orderId: '9001',
    reason: '  Captura duplicada  ',
    cancelFn: async (...args) => calls.push(args),
  })

  assert.deepEqual(calls, [[9001, 'Captura duplicada']])

  await assert.rejects(
    submitPosCancellation({
      flow: ADMIN_POS_FLOW,
      orderId: 9002,
      reason: '   ',
      cancelFn: (...args) => calls.push(args),
    }),
  )
  assert.equal(calls.length, 1)
})

test('submitPosCancellation rejects unsafe order ids before invoking either cancellation mode', async () => {
  const invalidOrderIds = [
    null,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    'not-an-order-id',
  ]
  const submissions = [
    { flow: NIGHT_POS_FLOW, reasonCode: 'duplicate' },
    { flow: ADMIN_POS_FLOW, reason: 'Captura duplicada' },
  ]

  for (const orderId of invalidOrderIds) {
    for (const submission of submissions) {
      const calls = []

      await assert.rejects(
        submitPosCancellation({
          ...submission,
          orderId,
          cancelFn: (...args) => calls.push(args),
        }),
      )

      assert.deepEqual(calls, [], `${String(orderId)} / ${submission.flow.cancellationMode}`)
    }
  }
})

test('canOpenPosPayment requires cart lines and a valid customer id', () => {
  assert.equal(canOpenPosPayment([], { id: 44 }), false)
  assert.equal(canOpenPosPayment([{ product_id: 1 }], { id: null }), false)
  assert.equal(canOpenPosPayment([{ product_id: 1 }], { id: 44 }), true)
})

test('canOpenPosPayment requires the current customer catalog when readiness is provided', () => {
  const cart = [{ product_id: 1 }]
  const customer = { id: 44 }

  assert.equal(canOpenPosPayment(cart, customer, { loading: false, catalogCustomerId: 44 }), true)
  assert.equal(canOpenPosPayment(cart, customer, { loading: true, catalogCustomerId: 44 }), false)
  assert.equal(canOpenPosPayment(cart, customer, { loading: false, catalogCustomerId: null }), false)
  assert.equal(canOpenPosPayment(cart, customer, { loading: false, catalogCustomerId: 45 }), false)
})

test('buildPosTicketPath accepts only safe positive integer ids', () => {
  assert.equal(buildPosTicketPath(ADMIN_POS_FLOW, '9001'), '/admin/ticket/9001')
  assert.equal(
    buildPosTicketPath(ADMIN_POS_FLOW, Number.MAX_SAFE_INTEGER),
    `/admin/ticket/${Number.MAX_SAFE_INTEGER}`,
  )

  for (const invalidId of [
    true,
    false,
    0,
    -1,
    1.5,
    Infinity,
    NaN,
    '',
    ' ',
    '-1',
    '1.5',
    'Infinity',
    String(Number.MAX_SAFE_INTEGER + 1),
    null,
    undefined,
  ]) {
    assert.equal(buildPosTicketPath(ADMIN_POS_FLOW, invalidId), '', String(invalidId))
  }
})

test('normalizePosSaleResult marks direct and nested positive ids as created', () => {
  assert.deepEqual(normalizePosSaleResult({ id: '9001' }), {
    status: 'created',
    orderId: 9001,
  })
  assert.deepEqual(normalizePosSaleResult({ ok: true, data: { order_id: 9002 } }), {
    status: 'created',
    orderId: 9002,
  })
})

test('normalizePosSaleResult preserves explicit backend errors', () => {
  assert.deepEqual(normalizePosSaleResult({ ok: false, error: 'Sin stock' }), {
    status: 'error',
    message: 'Sin stock',
  })
  assert.deepEqual(normalizePosSaleResult({ data: { success: false, message: 'Cliente inválido' } }), {
    status: 'error',
    message: 'Cliente inválido',
  })
  assert.deepEqual(normalizePosSaleResult({ status: 'error', user_message: 'No autorizado' }), {
    status: 'error',
    message: 'No autorizado',
  })
})

test('normalizePosSaleResult marks missing or invalid ids as uncertain', () => {
  for (const response of [
    { ok: true, data: {} },
    { success: true },
    { data: { order_id: true } },
  ]) {
    const result = normalizePosSaleResult(response)
    assert.equal(result.status, 'uncertain')
    assert.match(result.message, /Venta creada pero sin folio/)
    assert.match(result.message, /no vuelvas a cobrar/i)
  }
})

test('classifyPosSaleCreateError treats transport, timeout and 5xx failures as uncertain', () => {
  for (const error of [
    { code: 'network', status: 0, message: 'Network failed' },
    { code: 'timeout', message: 'Request timed out' },
    { status: 503, message: 'Service unavailable' },
  ]) {
    const result = classifyPosSaleCreateError(error)
    assert.equal(result.status, 'uncertain')
    assert.match(result.message, /no vuelvas a cobrar/i)
    assert.match(result.message, /verifica la venta/i)
  }
})

test('classifyPosSaleCreateError treats a bare browser fetch TypeError as uncertain', () => {
  const result = classifyPosSaleCreateError(new TypeError('Failed to fetch'))

  assert.equal(result.status, 'uncertain')
  assert.match(result.message, /no vuelvas a cobrar/i)
  assert.match(result.message, /verifica la venta/i)
})

test('classifyPosSaleCreateError preserves known 4xx backend errors', () => {
  assert.deepEqual(classifyPosSaleCreateError({ status: 400, message: 'Cliente inválido' }), {
    status: 'error',
    message: 'Cliente inválido',
  })
})
