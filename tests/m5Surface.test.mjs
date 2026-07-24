// KOLD OS · M5 — superficie: registry, visibilidad session-aware, guard, UI honesta.
// Convivencia M1+M2+M5 en tests/koldOsM5Coexistence.test.mjs.
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
import { M5_API_LATEST_FIXTURE } from '../src/modules/inventario/m5/fixtures/apiLatestFixture.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const homeSrc = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
const screenSrc = readFileSync(new URL('../src/modules/inventario/ScreenInventarioM5.jsx', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)
const INVENTARIO = getModuleById('inventario-flujo')

// ── Catálogo canónico ────────────────────────────────────────────────────────
test('registry: inventario-flujo con accessPolicy m5, ruta única y sin duplicados', () => {
  assert.ok(INVENTARIO)
  assert.equal(INVENTARIO.label, 'Inventario y flujo')
  assert.equal(INVENTARIO.route, '/inventario-flujo')
  assert.equal(INVENTARIO.accessPolicy, 'm5')
  assert.equal(INVENTARIO.showOnHome, true)
  assert.equal(INVENTARIO.showInNav, true)
  assert.equal(INVENTARIO.towerGated, undefined, 'M5 NO es towerGated')
  assert.equal(MODULES.filter((m) => m.route === '/inventario-flujo').length, 1)
})

test('isModuleVisibleForRoles EXCLUYE módulos con accessPolicy (jamás por rol genérico)', () => {
  assert.equal(isModuleVisibleForRoles(INVENTARIO, ['direccion_general']), false)
  assert.equal(isModuleVisibleForRoles(INVENTARIO, ['*']), false)
})

// ── La MISMA autoridad decide tarjeta, nav, Más, rail y clic ─────────────────
test('direccion_general: tarjeta + nav móvil/desktop + clic directo', () => {
  const sess = s('direccion_general')
  assert.equal(isModuleVisibleForSession(INVENTARIO, sess), true)
  assert.ok(ids(getHomeModulesForSession(sess)).includes('inventario-flujo'), 'tarjeta home')
  assert.ok(ids(getNavModules(sess)).includes('inventario-flujo'), 'nav')
  assert.ok(ids(buildDesktopNav(sess, '/').modules).includes('inventario-flujo'), 'rail desktop')
  const mob = buildMobileNav(sess, '/')
  const enMovil = ids(mob.primary).includes('inventario-flujo') || ids(mob.overflow || []).includes('inventario-flujo')
  assert.ok(enMovil, 'nav móvil (directo o en Más)')
  const decision = getModuleEntryDecisionForSession(INVENTARIO, sess)
  assert.equal(decision.type, 'direct')
  assert.equal(decision.selectedRole, '', 'sin role-context: navega directo')
})

test('admin_plataforma (tower_status): ve tarjeta/nav Y el clic ENTRA — sin asimetría', () => {
  const sess = tower('admin_plataforma')
  assert.equal(isModuleVisibleForSession(INVENTARIO, sess), true)
  assert.ok(ids(getNavModules(sess)).includes('inventario-flujo'))
  assert.equal(getModuleEntryDecisionForSession(INVENTARIO, sess).type, 'direct')
})

test('gerente/supervisor/vendedor/chofer: NO ven, NO entran (v1)', () => {
  for (const sess of [s('gerente_sucursal'), s('supervisor_ventas'), s('vendedor'),
    s('chofer'), s('jefe_ruta'), tower('supervisor_ventas')]) {
    assert.equal(isModuleVisibleForSession(INVENTARIO, sess), false)
    assert.ok(!ids(getNavModules(sess)).includes('inventario-flujo'))
    assert.equal(getModuleEntryDecisionForSession(INVENTARIO, sess).type, 'denied')
  }
})

test('sesión inválida: cero tarjetas/nav y clic denegado', () => {
  for (const bad of [null, {}, { role: 'direccion_general' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    assert.equal(getModuleEntryDecisionForSession(INVENTARIO, bad).type, 'denied')
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
test('App.jsx: M5InventarioRoute (fail-closed) monta /inventario-flujo; gate propio', () => {
  assert.match(appSrc, /function M5InventarioRoute\(\{ children \}\)/)
  const block = appSrc.slice(appSrc.indexOf('function M5InventarioRoute'), appSrc.indexOf('function M5InventarioRoute') + 500)
  assert.match(block, /isValidAuthenticatedSession\(session\)/)
  assert.match(block, /readM5Access\(session\)\.level !== 'global'/)
  assert.ok(appSrc.includes('<Route path="/inventario-flujo" element={<M5InventarioRoute><ScreenInventarioM5Mount /></M5InventarioRoute>} />'))
  assert.ok(!appSrc.includes('path="/inventario-flujo" element={<ModuleRoleRoute'), 'gate propio, no ModuleRoleRoute')
  assert.ok(!/readTowerAccess|resolveTowerRole/.test(block), 'M5 no reutiliza el gate de Tower')
})

test('nav: /inventario-flujo NO está oculta (usa la nav global)', () => {
  assert.equal(isNavHiddenForPath('/inventario-flujo'), false)
})

// ── UI honesta ───────────────────────────────────────────────────────────────
test('demo: la pantalla gatea con isM5DemoAllowed(import.meta.env)', () => {
  assert.match(screenSrc, /isM5DemoAllowed\(import\.meta\.env\)/)
  assert.match(screenSrc, /demoAllowed && new URLSearchParams\(location\.search\)\.get\('demo'\) === '1'/)
})

test('banner de evidencia NO FORMAL se decide por el DATO, no por el modo demo', () => {
  assert.match(screenSrc, /run\.is_production_shell_run !== true/)
  assert.match(screenSrc, /EVIDENCIA NO FORMAL/)
  assert.match(screenSrc, /production_shell_run_blocked_by/)
  assert.match(screenSrc, /auditor_build_sha/)
})

test('la UI muestra veredictos y el copy de lectura', () => {
  assert.match(screenSrc, /M5_VERDICT_LABELS/)
  assert.match(screenSrc, /VerdictTile/)
  assert.match(screenSrc, /Lee los veredictos, no solo los colores/)
  assert.match(screenSrc, /UMBRAL NO APROBADO/)
  assert.match(screenSrc, /M5_CLASSIFICATION_LABELS/)
})

test('KPIs del backend con su contrato; fronteras declaradas; sin números hardcodeados', () => {
  // Los KPIs NO se derivan en la pantalla: se leen de payload.kpis.
  assert.match(screenSrc, /const kpis = payload\?\.kpis \|\| \{\}/)
  assert.match(screenSrc, /kpi\.universe/)
  assert.match(screenSrc, /kpi\.caveat/)
  assert.match(screenSrc, /kpi\.source_model/)
  // Las capabilities gobiernan: lo no evaluable se muestra "—", nunca 0.
  assert.match(screenSrc, /const caps = payload\?\.capabilities\?\.features \|\| \{\}/)
  assert.match(screenSrc, /NotEvaluableTile/)
  assert.match(screenSrc, /No existe modelo de inventario por vehículo/)
  assert.match(screenSrc, /La verdad financiera es de M6/)
  assert.match(screenSrc, /La rentabilidad es de M7/)
  assert.match(screenSrc, /M5 observa, no corrige/)
  // Ninguna cifra del fixture vive literal en la pantalla.
  for (const n of ['9056', '9,056', '2905', '2,905', '6151', '6,151', '39607', '39,607',
    '44418', '44,418', '5637', '5,637', '7748', '7,748']) {
    assert.ok(!screenSrc.includes(n), `número hardcodeado en la pantalla: ${n}`)
  }
})

// Un filtro que el backend rechaza no puede quedarse callado: la pantalla lo
// mostraría aplicado sobre una lista que no lo cumple.
test('rejected_params: la pantalla lo hace visible, no lo ignora', () => {
  assert.match(screenSrc, /rejected_params/)
  assert.match(screenSrc, /table\.rejected\?\.length > 0/)
  assert.match(screenSrc, /El backend RECHAZÓ/)
  assert.match(screenSrc, /role="alert"/)
  // page/page_size no son filtros del usuario: no deben alarmar.
  assert.match(screenSrc, /p !== 'page' && p !== 'page_size'/)
})

test('sin botones de acción comercial (read-only estricto)', () => {
  for (const banned of ['editar cliente', 'crear pedido', 'cambiar canal', 'cambiar precio',
    'enviar campaña', 'reactivar cliente', 'cerrar oportunidad']) {
    assert.ok(!screenSrc.toLowerCase().includes(banned), banned)
  }
  assert.match(screenSrc, /M5 observa, no corrige/)
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
  assert.match(screenSrc, /GrupoVeniu\/GrupoFrio#208/)
})

test('el fixture del demo NO se declara corrida formal', () => {
  assert.equal(M5_API_LATEST_FIXTURE.run.is_production_shell_run, false)
  assert.ok(M5_API_LATEST_FIXTURE.run.production_shell_run_blocked_by.length > 0)
})

test('blindaje: public/ sin JSON de M5', () => {
  const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
  const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  }) : [])
  const hits = walk(publicDir).filter((p) => /m5/i.test(path.basename(p)))
  assert.deepEqual(hits, [], 'ningún artefacto M5 servible desde public/')
})
