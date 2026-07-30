import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseAllowedEmployeeIds,
  readConfiguredVentasIgualaAccess,
  readVentasIgualaAccess,
} from '../src/modules/ventas-iguala/access.js'

const validSession = {
  employee_id: 717,
  session_token: 'authenticated-session-token',
}

test('parseAllowedEmployeeIds returns unique safe positive integer IDs', () => {
  assert.deepEqual(
    parseAllowedEmployeeIds('717, 900,717,foo,0,-1'),
    [717, 900],
  )
})

test('readVentasIgualaAccess grants configured employees Igualas sales access', () => {
  assert.deepEqual(
    readVentasIgualaAccess(validSession, [717]),
    { level: 'iguala_sales', reason: 'configured_employee' },
  )
})

test('readVentasIgualaAccess fails closed for unconfigured employees', () => {
  assert.deepEqual(
    readVentasIgualaAccess(validSession, [900]),
    { level: 'none', reason: 'not_authorized' },
  )
})

test('readVentasIgualaAccess fails closed for invalid sessions', () => {
  assert.deepEqual(
    readVentasIgualaAccess({ employee_id: 717 }, [717]),
    { level: 'none', reason: 'invalid_session' },
  )
})

test('readVentasIgualaAccess fails closed with an empty configuration', () => {
  assert.deepEqual(
    readVentasIgualaAccess(validSession),
    { level: 'none', reason: 'not_authorized' },
  )
})

test('readConfiguredVentasIgualaAccess is a zero-argument fail-closed wrapper', () => {
  assert.equal(readConfiguredVentasIgualaAccess.length, 0)
  assert.deepEqual(
    readConfiguredVentasIgualaAccess(),
    { level: 'none', reason: 'invalid_session' },
  )
})
