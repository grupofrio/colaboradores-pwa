import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  clampGerentePilotWriteCapabilities,
} from '../src/modules/admin/gerentePilotCaps.js'
import { buildSupervisorV2SessionProjection } from '../src/modules/supervisor-ventas/v2/sessionProjection.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

test('ScreenLogin stores gf_employee_token as odoo_employee_token (canonical identity)', () => {
  const src = read('src/screens/ScreenLogin.jsx')
  assert.match(src, /odoo_employee_token:\s*result\?\.gf_employee_token/)
  assert.match(src, /buildSupervisorV2SessionProjection\(result\)/)
})

test('api.js getEmployeeToken reads odoo_employee_token then gf_employee_token', () => {
  const src = read('src/lib/api.js')
  assert.match(src, /session\.odoo_employee_token \|\| session\.gf_employee_token/)
  assert.match(src, /headers\['X-GF-Employee-Token'\] = employeeToken/)
  assert.match(src, /expireSession\(\)/)
  assert.match(src, /res\.status === 401/)
})

test('Admin hub boot hits token-authenticated today-sales (not a second login)', () => {
  const panel = read('src/modules/admin/ScreenAdminPanel.jsx')
  const hub = read('src/modules/admin/components/HubV2.jsx')
  const api = read('src/modules/admin/api.js')
  assert.match(panel, /getTodaySales/)
  assert.match(hub, /getDashboardData/)
  assert.match(api, /\/pwa-admin\/today-sales/)
  assert.doesNotMatch(panel, /employee-sign-in/)
  assert.doesNotMatch(hub, /employee-sign-in/)
})

test('session projection is additive and never strips employee token keys', () => {
  const result = {
    gf_employee_token: 'tok-from-signin',
    capabilities: { gerenteV2: true },
    branch: { gerente_v2_enabled: true },
  }
  const projected = buildSupervisorV2SessionProjection(result)
  // Projection only returns capabilities/branch — ScreenLogin merges onto payload
  // that already has odoo_employee_token. Ensure projection does not invent a
  // blank token field that could overwrite the merge.
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'odoo_employee_token'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'gf_employee_token'), false)
  assert.equal(projected.capabilities.gerenteV2, true)
})

test('Gerente pilot clamps Admin write caps while reads stay available', () => {
  const session = {
    role: 'gerente_sucursal',
    additional_job_keys: [],
    odoo_employee_token: 'present',
    employee_id: 717,
    company_id: 34,
    warehouse_id: 89,
  }
  const upstream = {
    cashClosingWrite: true,
    saleCancel: true,
    saleCreate: true,
    cashShiftManage: true,
    cashShiftAuthorize: true,
    cashShiftRead: true,
    cashClosingRead: true,
    daySales: true,
  }
  const clamped = clampGerentePilotWriteCapabilities(session, upstream)
  assert.equal(clamped.cashClosingWrite, false)
  assert.equal(clamped.saleCancel, false)
  assert.equal(clamped.saleCreate, false)
  assert.equal(clamped.cashShiftManage, false)
  assert.equal(clamped.cashShiftAuthorize, false)
  assert.equal(clamped.cashShiftRead, true)
  assert.equal(clamped.cashClosingRead, true)
  assert.equal(clamped.daySales, true)
  assert.equal(clamped.gerenteWritesEnabled, false)
})

test('Gerente pilot write clamp lifts only when server sets gerenteWritesEnabled', () => {
  const session = { role: 'gerente_sucursal', additional_job_keys: [] }
  const clamped = clampGerentePilotWriteCapabilities(session, {
    gerenteWritesEnabled: true,
    cashClosingWrite: true,
    cashShiftManage: true,
  })
  assert.equal(clamped.cashClosingWrite, true)
  assert.equal(clamped.cashShiftManage, true)
})

test('auxiliar_admin dual-role is not clamped by gerente pilot', () => {
  const session = {
    role: 'gerente_sucursal',
    additional_job_keys: ['auxiliar_admin'],
  }
  const clamped = clampGerentePilotWriteCapabilities(session, {
    cashClosingWrite: true,
    cashShiftManage: true,
  })
  assert.equal(clamped.cashClosingWrite, true)
  assert.equal(clamped.cashShiftManage, true)
})

test('pwa-admin flat proxy no longer spreads IncomingMessage (P0 regression)', () => {
  const src = read('api/pwa-admin.js')
  assert.doesNotMatch(src, /\{\s*\.\.\.\s*req\s*[,}]/)
  assert.match(src, /buildPwaAdminProxyRequest/)
  assert.match(src, /headers:\s*req\.headers/)
})
