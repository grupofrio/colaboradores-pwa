// KOLD OS · M4 — superficie: registry, visibilidad session-aware, guard, UI honesta.
// Convivencia M1+M2+M4 en tests/koldOsM4Coexistence.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  getNavModules, getVisibleModulesForSession, getHomeModulesForSession,
  isModuleVisibleForSession, getModuleEntryDecisionForSession,
  buildDesktopNav, buildMobileNav, isNavHiddenForPath,
} from '../src/lib/navModel.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const homeSrc = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
const screenSrc = readFileSync(new URL('../src/modules/ventas/ScreenVentasM4.jsx', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)
const VENTAS = getModuleById('ventas-clientes')

// ── Catálogo canónico ────────────────────────────────────────────────────────
test('registry: ventas-clientes con accessPolicy m4, ruta /ventas-clientes, sin duplicados', () => {
  assert.ok(VENTAS)
  assert.equal(VENTAS.label, 'Ventas y clientes')
  assert.equal(VENTAS.route, '/ventas-clientes')
  assert.equal(VENTAS.accessPolicy, 'm4')
  assert.equal(VENTAS.showOnHome, true)
  assert.equal(VENTAS.showInNav, true)
  assert.equal(VENTAS.towerGated, undefined, 'M4 NO es towerGated')
  assert.equal(MODULES.filter((m) => m.route === '/ventas-clientes').length, 1)
})

test('isModuleVisibleForRoles EXCLUYE módulos con accessPolicy (jamás por rol genérico)', () => {
  assert.equal(isModuleVisibleForRoles(VENTAS, ['direccion_general']), false)
  assert.equal(isModuleVisibleForRoles(VENTAS, ['*']), false)
})

// ── La MISMA autoridad decide tarjeta, nav, Más, rail y clic ─────────────────
test('direccion_general: tarjeta + nav móvil/desktop + clic directo', () => {
  const sess = s('direccion_general')
  assert.equal(isModuleVisibleForSession(VENTAS, sess), true)
  assert.ok(ids(getHomeModulesForSession(sess)).includes('ventas-clientes'), 'tarjeta home')
  assert.ok(ids(getNavModules(sess)).includes('ventas-clientes'), 'nav')
  assert.ok(ids(buildDesktopNav(sess, '/').modules).includes('ventas-clientes'), 'rail desktop')
  const mob = buildMobileNav(sess, '/')
  const enMovil = ids(mob.primary).includes('ventas-clientes') || ids(mob.overflow || []).includes('ventas-clientes')
  assert.ok(enMovil, 'nav móvil (directo o en Más)')
  const decision = getModuleEntryDecisionForSession(VENTAS, sess)
  assert.equal(decision.type, 'direct')
  assert.equal(decision.selectedRole, '', 'sin role-context: navega directo')
})

test('admin_plataforma (tower_status): ve tarjeta/nav Y el clic ENTRA — sin asimetría', () => {
  const sess = tower('admin_plataforma')
  assert.equal(isModuleVisibleForSession(VENTAS, sess), true)
  assert.ok(ids(getNavModules(sess)).includes('ventas-clientes'))
  assert.equal(getModuleEntryDecisionForSession(VENTAS, sess).type, 'direct')
})

test('gerente/supervisor/vendedor/chofer: NO ven, NO entran (v1)', () => {
  for (const sess of [s('gerente_sucursal'), s('supervisor_ventas'), s('vendedor'),
    s('chofer'), s('jefe_ruta'), tower('supervisor_ventas')]) {
    assert.equal(isModuleVisibleForSession(VENTAS, sess), false)
    assert.ok(!ids(getNavModules(sess)).includes('ventas-clientes'))
    assert.equal(getModuleEntryDecisionForSession(VENTAS, sess).type, 'denied')
  }
})

test('sesión inválida: cero tarjetas/nav y clic denegado', () => {
  for (const bad of [null, {}, { role: 'direccion_general' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    assert.equal(getModuleEntryDecisionForSession(VENTAS, bad).type, 'denied')
  }
})

test('política desconocida => fail-closed; módulos normales delegan sin bypass', () => {
  const alien = { id: 'x', route: '/x', roles: ['*'], accessPolicy: 'otra', showOnHome: true, showInNav: true }
  assert.equal(isModuleVisibleForSession(alien, s('direccion_general')), false)
  assert.equal(getModuleEntryDecisionForSession(alien, s('direccion_general')).type, 'denied')
  assert.deepEqual(ids(getNavModules(s('rol_comun'))), ['kpis', 'encuestas', 'logros'])
})

test('ScreenHome usa la fuente session-aware (getHomeModulesForSession)', () => {
  assert.match(homeSrc, /getHomeModulesForSession\(session\)/)
  assert.match(homeSrc, /getModuleEntryDecisionForSession\(mod, session\)/)
})

// ── Ruta y guard ─────────────────────────────────────────────────────────────
test('App.jsx: M4VentasRoute (fail-closed) monta /ventas-clientes; gate propio', () => {
  assert.match(appSrc, /function M4VentasRoute\(\{ children \}\)/)
  const block = appSrc.slice(appSrc.indexOf('function M4VentasRoute'), appSrc.indexOf('function M4VentasRoute') + 500)
  assert.match(block, /isValidAuthenticatedSession\(session\)/)
  assert.match(block, /readM4Access\(session\)\.level !== 'global'/)
  assert.ok(appSrc.includes('<Route path="/ventas-clientes" element={<M4VentasRoute><ScreenVentasM4Mount /></M4VentasRoute>} />'))
  assert.ok(!appSrc.includes('path="/ventas-clientes" element={<ModuleRoleRoute'), 'gate propio, no ModuleRoleRoute')
  assert.ok(!/readTowerAccess|resolveTowerRole/.test(block), 'M4 no reutiliza el gate de Tower')
})

test('nav: /ventas-clientes NO está oculta (usa la nav global)', () => {
  assert.equal(isNavHiddenForPath('/ventas-clientes'), false)
})

// ── UI honesta ───────────────────────────────────────────────────────────────
test('demo: la pantalla gatea con isM4DemoAllowed(import.meta.env)', () => {
  assert.match(screenSrc, /isM4DemoAllowed\(import\.meta\.env\)/)
  assert.match(screenSrc, /demoAllowed && new URLSearchParams\(location\.search\)\.get\('demo'\) === '1'/)
})

test('banner de evidencia NO FORMAL se decide por el DATO, no por el modo demo', () => {
  assert.match(screenSrc, /run\.is_production_shell_run !== true/)
  assert.match(screenSrc, /EVIDENCIA NO FORMAL/)
  assert.match(screenSrc, /production_shell_run_blocked_by/)
  assert.match(screenSrc, /auditor_build_sha/)
})

test('la UI muestra veredictos y el copy de lectura', () => {
  assert.match(screenSrc, /M4_VERDICT_LABELS/)
  assert.match(screenSrc, /VerdictTile/)
  assert.match(screenSrc, /Lee los veredictos, no solo los colores/)
  assert.match(screenSrc, /UMBRAL NO APROBADO/)
  assert.match(screenSrc, /M4_CLASSIFICATION_LABELS/)
})

test('KPIs del backend con su contrato; frontera M5/M6/M7/M8; sin números hardcodeados', () => {
  // Los KPIs NO se derivan en la pantalla: se leen de payload.kpis, cada uno
  // con universo/fuente/cobertura/salvedad/corte emitidos por el backend.
  assert.match(screenSrc, /const kpis = payload\?\.kpis \|\| \{\}/)
  assert.match(screenSrc, /kpi\.universe/)
  assert.match(screenSrc, /kpi\.caveat/)
  assert.match(screenSrc, /kpi\.source_model/)
  assert.match(screenSrc, /kpi\.coverage/)
  assert.match(screenSrc, /kpi\.data_as_of/)
  // Las capabilities gobiernan: lo no evaluable se muestra "—", nunca 0.
  assert.match(screenSrc, /const caps = payload\?\.capabilities\?\.features \|\| \{\}/)
  assert.match(screenSrc, /NotEvaluableTile/)
  assert.match(screenSrc, /La verdad de entrega e inventario es de M5/)
  assert.match(screenSrc, /La verdad financiera es de M6/)
  assert.match(screenSrc, /La rentabilidad es de M7/)
  assert.match(screenSrc, /NO ejecuta campañas ni automatización \(eso es M8\)/)
  // Ninguna cifra del fixture vive literal en la pantalla (ni la vieja ni la nueva).
  for (const n of ['14078', '14,078', '12158', '12,158', '6537', '6,537',
    '5621', '5,621', '12606', '12,606', '584', '78']) {
    assert.ok(!screenSrc.includes(n), `número hardcodeado en la pantalla: ${n}`)
  }
})

test('sin botones de acción comercial (read-only estricto)', () => {
  for (const banned of ['editar cliente', 'crear pedido', 'cambiar canal', 'cambiar precio',
    'enviar campaña', 'reactivar cliente', 'cerrar oportunidad']) {
    assert.ok(!screenSrc.toLowerCase().includes(banned), banned)
  }
  assert.match(screenSrc, /M4 observa, no corrige/)
})

test('sin PII renderizada: la pantalla no referencia campos sensibles', () => {
  for (const banned of ['customer_name', 'partner_name', 'salesperson_name', '.phone', '.email', '.vat']) {
    assert.ok(!screenSrc.includes(banned), `${banned} no debe renderizarse`)
  }
})

test('estados de error honestos: disabled/unavailable/forbidden/schema_mismatch/invalid', () => {
  for (const state of ['disabled', 'unavailable', 'session_expired', 'forbidden', 'schema_mismatch', 'invalid', 'error']) {
    assert.ok(screenSrc.includes(`${state}:`), state)
  }
  // El estado "unavailable" nombra el gate REAL (PR sin mergear/desplegar),
  // no inventa una causa ni promete datos que no existen.
  assert.match(screenSrc, /GrupoVeniu\/GrupoFrio#205 \(DRAFT\)/)
})

test('el fixture del demo NO se declara corrida formal', () => {
  assert.equal(M4_API_LATEST_FIXTURE.run.is_production_shell_run, false)
  assert.ok(M4_API_LATEST_FIXTURE.run.production_shell_run_blocked_by.length > 0)
})

test('blindaje: public/ sin JSON de M4', () => {
  const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
  const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  }) : [])
  const hits = walk(publicDir).filter((p) => /m4/i.test(path.basename(p)))
  assert.deepEqual(hits, [], 'ningún artefacto M4 servible desde public/')
})
