import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

process.env.VITE_IGUALA_SALES_EMPLOYEE_IDS = '717,718'

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

const sugeySession = {
  employee_id: 718,
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

test('Sugey has configured Igualas sales access and sees ventas_iguala directly', () => {
  assert.deepEqual(
    readConfiguredVentasIgualaAccessForSession(sugeySession),
    { level: 'iguala_sales', reason: 'configured_employee' },
  )
  assert.ok(getVisibleModulesForSession(sugeySession).some((module) => module.id === 'ventas_iguala'))
  assert.equal(getModuleEntryDecisionForSession(VENTAS_IGUALA, sugeySession).type, 'direct')
})

test('Vite build embeds both configured Igualas sales IDs and still denies 900', async () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'ventas-iguala-access-build-'))
  const entry = fileURLToPath(new URL('../src/modules/ventas-iguala/access.js', import.meta.url))

  try {
    await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        enforce: 'pre',
        name: 'stub-ventas-iguala-session-reader',
        resolveId(id) {
          return id === '../../lib/api.js' ? '\0ventas-iguala-test-api' : null
        },
        load(id) {
          return id === '\0ventas-iguala-test-api'
            ? 'export function getSession() { return null }'
            : null
        },
      }],
      build: {
        emptyOutDir: true,
        lib: {
          entry,
          fileName: 'ventas-iguala-access',
          formats: ['es'],
        },
        minify: false,
        outDir,
      },
    })

    const bundlePath = path.join(outDir, 'ventas-iguala-access.js')
    assert.match(readFileSync(bundlePath, 'utf8'), /717,718/)

    const builtAccess = await import(`${pathToFileURL(bundlePath).href}?build=${Date.now()}`)
    assert.deepEqual(
      builtAccess.readConfiguredVentasIgualaAccessForSession(sugeySession),
      { level: 'iguala_sales', reason: 'configured_employee' },
    )
    assert.deepEqual(
      builtAccess.readConfiguredVentasIgualaAccessForSession({ ...sugeySession, employee_id: 900 }),
      { level: 'none', reason: 'not_authorized' },
    )
  } finally {
    rmSync(outDir, { force: true, recursive: true })
  }
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
