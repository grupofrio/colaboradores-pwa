import test from 'node:test'
import assert from 'node:assert/strict'

import { isTicketFromMyWarehouse, getTicketWarehouseId } from '../src/modules/entregas/dispatchTicketGuard.js'

test('ticket propio del almacén 94 se permite', () => {
  assert.equal(isTicketFromMyWarehouse({ id: 1, warehouse_id: 94 }, 94), true)
  assert.equal(isTicketFromMyWarehouse({ id: 1, warehouse_id: [94, 'CEDIS Guadalajara'] }, 94), true)
})

test('ticket ajeno se deniega', () => {
  assert.equal(isTicketFromMyWarehouse({ id: 2, warehouse_id: 76 }, 94), false)
  assert.equal(getTicketWarehouseId({ warehouse_id: 76 }), 76)
})

test('sin almacén conocido (ticket o sesión) se deniega fail-closed', () => {
  assert.equal(isTicketFromMyWarehouse({ id: 3 }, 94), false)
  assert.equal(isTicketFromMyWarehouse({ id: 3, warehouse_id: 0 }, 94), false)
  assert.equal(isTicketFromMyWarehouse({ id: 3, warehouse_id: 94 }, 0), false)
  assert.equal(isTicketFromMyWarehouse(null, 94), false)
})
