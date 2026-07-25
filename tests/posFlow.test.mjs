import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_POS_FLOW,
  NIGHT_POS_FLOW,
  buildPosTicketPath,
  canOpenPosPayment,
  classifyPosSaleCreateError,
  normalizePosSaleResult,
} from '../src/modules/admin/posFlow.js'

test('ADMIN_POS_FLOW preserves the existing admin POS routes', () => {
  assert.deepEqual(ADMIN_POS_FLOW, {
    backTo: '/admin',
    posRoute: '/admin/pos',
    ticketBasePath: '/admin/ticket',
    title: 'Venta mostrador',
    standalone: false,
    allowSaleCancellation: true,
  })
  assert.equal(buildPosTicketPath(ADMIN_POS_FLOW, 9001), '/admin/ticket/9001')
})

test('NIGHT_POS_FLOW defines the isolated night POS routes', () => {
  assert.deepEqual(NIGHT_POS_FLOW, {
    backTo: '/',
    posRoute: '/pos-nocturno',
    ticketBasePath: '/pos-nocturno/ticket',
    title: 'POS nocturno',
    standalone: true,
    allowSaleCancellation: false,
  })
  assert.equal(buildPosTicketPath(NIGHT_POS_FLOW, 9001), '/pos-nocturno/ticket/9001')
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
