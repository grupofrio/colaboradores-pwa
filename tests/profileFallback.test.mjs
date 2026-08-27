import test from 'node:test'
import assert from 'node:assert/strict'

import { buildProfileEmployeeFromSession, resolveProfileEmployeeData } from '../src/screens/profileFallback.js'

test('buildProfileEmployeeFromSession creates a minimal profile from a valid session', () => {
  const employee = buildProfileEmployeeFromSession({
    employee_id: 694,
    role: 'almacenista_entregas',
    name: 'Carlos Valencia',
    company_id: 34,
    company: 'GLACIEM',
  })

  assert.deepEqual(employee, {
    id: 694,
    name: 'Carlos Valencia',
    job_id: [0, 'Almacenista entregas'],
    department_id: [0, 'Sin dato'],
    work_location_id: [0, 'Sin dato'],
    company_id: [34, 'GLACIEM'],
    mobile_phone: '',
    image_128: null,
    date_start: null,
    remaining_leaves: 0,
    partner_id: [0, 'Carlos Valencia'],
  })
})

test('resolveProfileEmployeeData falls back to session data when profile payload is empty', () => {
  const employee = resolveProfileEmployeeData({
    session: {
      employee_id: 694,
      role: 'almacenista_entregas',
      name: 'Carlos Valencia',
      company_id: 34,
      company: 'GLACIEM',
    },
    response: { success: true, data: {} },
  })

  assert.equal(employee?.id, 694)
  assert.equal(employee?.name, 'Carlos Valencia')
  assert.equal(employee?.job_id?.[1], 'Almacenista entregas')
})
