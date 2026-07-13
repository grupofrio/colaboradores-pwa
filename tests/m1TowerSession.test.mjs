// M1-D prereqs (C.1 sesión tower_status + C.2 directTower) — tests node:test.
// Sesión REALISTA: se construye desde la forma exacta de la respuesta de
// /api/employee-sign-in (os_api employee_login.py => response.employee.tower_status),
// no solo sesiones sintéticas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  sanitizeTowerStatus,
  buildSessionEmployee,
} from '../src/modules/torre/e1/employeeSessionFields.js'
import {
  readAuthoritativeTowerStatus,
  ALLOWED_TOWER_STATUS,
} from '../src/modules/torre/e1/loadTowerStatus.js'
import {
  TOWER_M1_BACKLOG_PATH,
  TOWER_M1_ALLOWED_PARAMS,
  isTowerM1Path,
  filterTowerM1Params,
} from '../src/lib/towerM1Route.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src')
const readSrc = (rel) => readFileSync(join(SRC, rel), 'utf-8')

// Forma real de la respuesta del sign-in (campos relevantes)
const signInResult = (towerStatus) => ({
  status: 200,
  case: 1,
  api_key: 'k',
  user_id: 7,
  employee_has_user: true,
  gf_employee_token: 'tok-empleado',
  employee: {
    id: 718,
    name: 'Supervisora Prueba',
    job_title: 'Supervisor de ventas',
    company_id: [34, 'GLACIEM'],
    tower_status: towerStatus,
  },
})

test('sanitizeTowerStatus: normaliza forma y es fail-closed', () => {
  assert.equal(sanitizeTowerStatus('admin_plataforma'), 'admin_plataforma')
  assert.equal(sanitizeTowerStatus('  Supervisor_Ventas  '), 'supervisor_ventas')
  for (const bad of [null, undefined, 123, {}, [], '', '   ', 'x'.repeat(65)]) {
    assert.equal(sanitizeTowerStatus(bad), null, `debe ser null: ${String(bad).slice(0, 12)}`)
  }
})

test('buildSessionEmployee persiste id + tower_status desde la respuesta real', () => {
  const res = signInResult('supervisor_ventas')
  assert.deepEqual(buildSessionEmployee(res.employee, res.employee.id), {
    id: 718,
    tower_status: 'supervisor_ventas',
  })
  const sinRol = signInResult(null)
  assert.deepEqual(buildSessionEmployee(sinRol.employee, 0), {
    id: 0,
    tower_status: null,
  })
})

test('sesión realista: /torre autoriza admin y supervisor; fail-closed el resto', () => {
  for (const role of ['admin_plataforma', 'supervisor_ventas']) {
    const res = signInResult(role)
    const session = { employee: buildSessionEmployee(res.employee, res.employee.id) }
    assert.equal(readAuthoritativeTowerStatus(session), role,
      `el gate debe autorizar ${role} con sesión construida desde el sign-in real`)
  }
  // null / desconocido / mayúsculas-fuera-de-allowlist / basura => redirección
  for (const bad of [null, undefined, 'gerente_sucursal', 'ADMIN', 'direccion_general', '  ']) {
    const res = signInResult(bad)
    const session = { employee: buildSessionEmployee(res.employee, res.employee.id) }
    assert.equal(readAuthoritativeTowerStatus(session), null,
      `fail-closed para tower_status=${String(bad)}`)
  }
  // sin employee (p.ej. sesión bypass actual): redirección
  assert.equal(readAuthoritativeTowerStatus({}), null)
  assert.equal(readAuthoritativeTowerStatus({ employee: {} }), null)
})

test('la allowlist del gate NO se amplió', () => {
  assert.deepEqual([...ALLOWED_TOWER_STATUS].sort(),
    ['admin_plataforma', 'supervisor_ventas'])
})

test('wiring: ScreenLogin persiste session.employee saneado (no un valor inventado)', () => {
  const src = readSrc('screens/ScreenLogin.jsx')
  assert.match(src, /from ["']\.\.\/modules\/torre\/e1\/employeeSessionFields["']/)
  assert.match(src, /employee:\s*buildSessionEmployee\(employee,\s*employeeId\)/)
})

test('wiring: roleContext preserva claves de sesión (employee sobrevive al normalize)', () => {
  assert.match(readSrc('lib/roleContext.js'), /\.\.\.session/)
})

test('towerM1Route: path exacto y allowlist de params del contrato', () => {
  assert.equal(TOWER_M1_BACKLOG_PATH, '/pwa-tower/m1-backlog')
  assert.ok(isTowerM1Path('/pwa-tower/m1-backlog'))
  assert.ok(!isTowerM1Path('/pwa-tower/m1-backlog/extra'))
  assert.ok(!isTowerM1Path('/pwa-supv/branch-configs'))
  const q = new URLSearchParams(
    'state_bucket=open&close_candidate=1&limit=50&offset=0&sort=age_days'
    + '&bucket=historical&date_from=2026-07-01&date_to=2026-07-13&branch_id=29'
    + '&employee_id=9&company_id=34&domain=%5B%5D&evil=1')
  assert.deepEqual(filterTowerM1Params(q), {
    bucket: 'historical',
    state_bucket: 'open',
    date_from: '2026-07-01',
    date_to: '2026-07-13',
    limit: '50',
    offset: '0',
    sort: 'age_days',
    branch_id: '29',
    close_candidate: '1',
  })
  for (const prohibido of ['employee_id', 'company_id', 'domain', 'evil']) {
    assert.ok(!TOWER_M1_ALLOWED_PARAMS.includes(prohibido),
      `param prohibido jamás en la allowlist: ${prohibido}`)
  }
  // objeto plano también soportado y vacíos fuera
  assert.deepEqual(filterTowerM1Params({ limit: '', close_candidate: '1' }),
    { close_candidate: '1' })
})

test('wiring: api.js rutea Tower M1 directo a Odoo, sin fallback n8n ni retries', () => {
  const src = readSrc('lib/api.js')
  assert.match(src, /from ['"]\.\/towerM1Route\.js['"]/)
  assert.match(src, /async function directTower\(/)
  assert.match(src, /directTower,/, 'directTower registrado en directHandlers')
  assert.match(src, /odooHttp\('GET',\s*TOWER_M1_BACKLOG_PATH,\s*filterTowerM1Params\(query\)\)/)
  assert.match(src, /method_not_allowed/, 'métodos no-GET jamás caen a n8n en esta ruta')
  // el header de empleado lo agrega buildBaseHeaders a TODA llamada odooHttp
  assert.match(src, /X-GF-Employee-Token/)
  const handlerBlock = src.slice(src.indexOf('async function directTower('),
    src.indexOf('async function routeDirect('))
  assert.ok(!/N8N_BASE|retry|setTimeout/.test(handlerBlock),
    'directTower no usa n8n ni reintentos')
})
