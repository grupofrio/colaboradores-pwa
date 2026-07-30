import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

process.env.VITE_IGUALA_SALES_EMPLOYEE_IDS = '717'

const {
  parseAllowedEmployeeIds,
  readConfiguredVentasIgualaAccess,
  readVentasIgualaAccess,
  readConfiguredVentasIgualaAccessForSession,
} = await import('../src/modules/ventas-iguala/access.js')
const { getModuleById } = await import('../src/modules/registry.js')
const {
  ACCESS_POLICY_RESOLVERS,
  getModuleEntryDecisionForSession,
  getVisibleModulesForSession,
} = await import('../src/lib/navModel.js')

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

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

test('readVentasIgualaAccess treats malformed allowlists as empty', () => {
  for (const allowedEmployeeIds of [null, {}]) {
    assert.deepEqual(
      readVentasIgualaAccess(validSession, allowedEmployeeIds),
      { level: 'none', reason: 'not_authorized' },
    )
  }
})

test('readConfiguredVentasIgualaAccess is a zero-argument fail-closed wrapper', () => {
  assert.equal(readConfiguredVentasIgualaAccess.length, 0)
  assert.deepEqual(
    readConfiguredVentasIgualaAccess(),
    { level: 'none', reason: 'invalid_session' },
  )
})

test('readConfiguredVentasIgualaAccessForSession uses its session argument', () => {
  assert.deepEqual(
    readConfiguredVentasIgualaAccessForSession(validSession),
    { level: 'iguala_sales', reason: 'configured_employee' },
  )
})

const VENTAS_IGUALA = getModuleById('ventas_iguala')

test('a configured session sees ventas_iguala through the session-aware nav model', () => {
  assert.ok(VENTAS_IGUALA)
  assert.equal(typeof ACCESS_POLICY_RESOLVERS.iguala_sales, 'function')
  assert.ok(getVisibleModulesForSession(validSession).some((module) => module.id === 'ventas_iguala'))
  assert.equal(getModuleEntryDecisionForSession(VENTAS_IGUALA, validSession).type, 'direct')
})

test('an unconfigured valid session does not see ventas_iguala', () => {
  const unconfiguredSession = { ...validSession, employee_id: 900 }
  assert.ok(!getVisibleModulesForSession(unconfiguredSession).some((module) => module.id === 'ventas_iguala'))
  assert.equal(getModuleEntryDecisionForSession(VENTAS_IGUALA, unconfiguredSession).type, 'denied')
})

test('App.jsx has a dedicated Ventas Iguala guard using the registered module policy', () => {
  assert.match(appSrc, /function VentasIgualaRoute\(\{ children \}\)/)
  const guard = appSrc.slice(appSrc.indexOf('function VentasIgualaRoute'), appSrc.indexOf('function VentasIgualaRoute') + 500)
  assert.match(guard, /isValidAuthenticatedSession\(session\)/)
  assert.match(guard, /Navigate to="\/login" replace/)
  assert.match(guard, /getModuleById\('ventas_iguala'\)/)
  assert.match(guard, /isModuleVisibleForSession\(module, session\)/)
  assert.match(guard, /Navigate to="\/" replace/)
  assert.match(appSrc, /<Route path="\/ventas-iguala" element=\{\s*<VentasIgualaRoute><ScreenVentasIguala \/><\/VentasIgualaRoute>\s*\} \/>/)
})
