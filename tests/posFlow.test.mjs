import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_POS_FLOW,
  NIGHT_POS_FLOW,
  buildPosTicketPath,
  canOpenPosPayment,
} from '../src/modules/admin/posFlow.js'

test('ADMIN_POS_FLOW preserves the existing admin POS routes', () => {
  assert.deepEqual(ADMIN_POS_FLOW, {
    backTo: '/admin',
    posRoute: '/admin/pos',
    ticketBasePath: '/admin/ticket',
    title: 'Venta mostrador',
    standalone: false,
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
  })
  assert.equal(buildPosTicketPath(NIGHT_POS_FLOW, 9001), '/pos-nocturno/ticket/9001')
})

test('canOpenPosPayment requires cart lines and a valid customer id', () => {
  assert.equal(canOpenPosPayment([], { id: 44 }), false)
  assert.equal(canOpenPosPayment([{ product_id: 1 }], { id: null }), false)
  assert.equal(canOpenPosPayment([{ product_id: 1 }], { id: 44 }), true)
})
