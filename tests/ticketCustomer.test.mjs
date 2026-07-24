import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PUBLIC_TICKET_CUSTOMER,
  resolveTicketCustomerName,
} from '../src/modules/admin/ticketCustomer.js'

test('resolves the sale customer from supported sale-detail payload shapes', () => {
  const cases = [
    [{ partner_name: '  Cliente directo  ' }, 'Cliente directo'],
    [{ partner_id: [61100, 'Abarrotes Centro'] }, 'Abarrotes Centro'],
    [{ partner_id: { id: 61100, display_name: 'Palapa Norte' } }, 'Palapa Norte'],
    [{ customer_name: 'Cliente alterno' }, 'Cliente alterno'],
    [{ customer: 'Mostrador Especial' }, 'Mostrador Especial'],
  ]

  for (const [order, expected] of cases) {
    assert.equal(resolveTicketCustomerName(order), expected)
  }
})

test('prefers the canonical partner name and falls back to VENTA PUBLICO', () => {
  assert.equal(
    resolveTicketCustomerName({
      partner_name: 'Cliente canónico',
      partner_id: [1, 'Cliente secundario'],
    }),
    'Cliente canónico',
  )

  for (const order of [null, {}, { partner_name: '   ' }, { partner_id: 61100 }]) {
    assert.equal(resolveTicketCustomerName(order), PUBLIC_TICKET_CUSTOMER)
  }
  assert.equal(PUBLIC_TICKET_CUSTOMER, 'VENTA PUBLICO')
})
