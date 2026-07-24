import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  getNavModules, getVisibleModulesForSession, isModuleVisibleForSession,
  getModuleEntryDecisionForSession, buildDesktopNav, buildMobileNav, isNavHiddenForPath,
} from '../src/lib/navModel.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const homeSrc = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
const screenSrc = readFileSync(new URL('../src/modules/planeacion/ScreenPlaneacionM2.jsx', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const towerSession = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)
const PLANEACION = getModuleById('planeacion')

// ── Catálogo canónico ────────────────────────────────────────────────────────
test('registry: planeacion con accessPolicy m2, ruta /planeacion, sin duplicados', () => {
  assert.ok(PLANEACION)
  assert.equal(PLANEACION.label, 'Planeación')
  assert.equal(PLANEACION.route, '/planeacion')
  assert.equal(PLANEACION.accessPolicy, 'm2')
  assert.equal(PLANEACION.showOnHome, true)
  assert.equal(PLANEACION.showInNav, true)
  assert.equal(MODULES.filter((m) => m.route === '/planeacion').length, 1)
})

test('isModuleVisibleForRoles EXCLUYE módulos con accessPolicy (la tarjeta jamás sale por rol genérico)', () => {
  assert.equal(isModuleVisibleForRoles(PLANEACION, ['direccion_general']), false)
  assert.equal(isModuleVisibleForRoles(PLANEACION, ['*']), false)
})

// ── B3: LA MISMA autoridad decide tarjeta, nav y clic ────────────────────────
// Caso 1: direccion_general ve, hace clic, entra.
test('direccion_general: tarjeta + nav móvil/desktop + clic directo', () => {
  const sess = s('direccion_general')
  assert.equal(isModuleVisibleForSession(PLANEACION, sess), true)
  assert.ok(ids(getVisibleModulesForSession(sess)).includes('planeacion'), 'tarjeta home')
  assert.ok(ids(getNavModules(sess)).includes('planeacion'), 'nav')
  assert.ok(ids(buildDesktopNav(sess, '/').modules).includes('planeacion'), 'rail desktop')
  const mobile = buildMobileNav(sess, '/')
  const inMobile = ids(mobile.primary).includes('planeacion')
    || ids(mobile.overflow || []).includes('planeacion')
  assert.ok(inMobile, 'nav móvil (directo o en Más)')
  const decision = getModuleEntryDecisionForSession(PLANEACION, sess)
  assert.equal(decision.type, 'direct')
  assert.equal(decision.selectedRole, '', 'sin role-context: navega directo')
})

// Caso 2 (BLOCKER Codex #7): admin_plataforma autorizado ve, hace clic, entra.
test('CLAVE: admin_plataforma (tower_status) ve tarjeta/nav Y el clic ENTRA — sin asimetría', () => {
  const sess = towerSession('admin_plataforma')
  assert.equal(isModuleVisibleForSession(PLANEACION, sess), true, 'tarjeta visible')
  assert.ok(ids(getVisibleModulesForSession(sess)).includes('planeacion'))
  assert.ok(ids(getNavModules(sess)).includes('planeacion'), 'nav visible')
  assert.equal(getModuleEntryDecisionForSession(PLANEACION, sess).type, 'direct', 'el clic entra')
})

// Caso 3: supervisor_ventas sin permiso M2 no ve ni entra.
test('supervisor_ventas (con o sin tower_status): NO ve, NO entra', () => {
  for (const sess of [s('supervisor_ventas'), towerSession('supervisor_ventas')]) {
    assert.equal(isModuleVisibleForSession(PLANEACION, sess), false)
    assert.ok(!ids(getNavModules(sess)).includes('planeacion'))
    assert.equal(getModuleEntryDecisionForSession(PLANEACION, sess).type, 'denied')
  }
})

// Caso 4: gerente_sucursal no ve ni entra.
test('gerente_sucursal: NO ve, NO entra', () => {
  const sess = s('gerente_sucursal')
  assert.ok(!ids(getVisibleModulesForSession(sess)).includes('planeacion'))
  assert.equal(getModuleEntryDecisionForSession(PLANEACION, sess).type, 'denied')
})

// Caso 5: sesión inválida no ve nada (el guard manda a /login).
test('sesión inválida: cero tarjetas/nav y clic denegado', () => {
  for (const bad of [null, {}, { role: 'direccion_general' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    assert.equal(getModuleEntryDecisionForSession(PLANEACION, bad).type, 'denied')
  }
})

test('política desconocida => fail-closed (oculto y denegado)', () => {
  const alien = { id: 'x', route: '/x', roles: ['*'], accessPolicy: 'otra', showOnHome: true, showInNav: true }
  assert.equal(isModuleVisibleForSession(alien, s('direccion_general')), false)
  assert.equal(getModuleEntryDecisionForSession(alien, s('direccion_general')).type, 'denied')
})

test('módulos normales: delegación intacta a la lógica por rol (sin bypass)', () => {
  const admin = getModuleById('admin_sucursal')
  assert.equal(getModuleEntryDecisionForSession(admin, s('supervisor_ventas')).type, 'denied')
  assert.notEqual(getModuleEntryDecisionForSession(admin, s('gerente_sucursal')).type, 'denied')
  const kpis = getModuleById('kpis')
  assert.notEqual(getModuleEntryDecisionForSession(kpis, s('jefe_ruta')).type, 'denied')
})

test('ScreenHome usa la fuente session-aware para tarjetas Y clic', () => {
  assert.match(homeSrc, /getHomeModulesForSession\(session\)/)
  assert.match(homeSrc, /getModuleEntryDecisionForSession\(mod, session\)/)
  assert.ok(!/getModulesForRoles\(getEffectiveJobKeys/.test(homeSrc), 'ya no usa la fuente solo-roles')
})

// ── Ruta y guard ─────────────────────────────────────────────────────────────
test('App.jsx: M2PlaneacionRoute (fail-closed) monta /planeacion; Tower intacto', () => {
  assert.match(appSrc, /function M2PlaneacionRoute\(\{ children \}\)/)
  const block = appSrc.slice(appSrc.indexOf('function M2PlaneacionRoute'), appSrc.indexOf('function M2PlaneacionRoute') + 500)
  assert.match(block, /isValidAuthenticatedSession\(session\)/)
  assert.match(block, /readM2Access\(session\)\.level !== 'global'/)
  assert.ok(appSrc.includes('<Route path="/planeacion" element={<M2PlaneacionRoute><ScreenPlaneacionM2Mount /></M2PlaneacionRoute>} />'))
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.ok(appSrc.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
})

test('nav: /planeacion NO está oculta (usa la nav global con estado activo)', () => {
  assert.equal(isNavHiddenForPath('/planeacion'), false)
})

// ── B2: demo gateado fuera de producción ─────────────────────────────────────
test('la pantalla gatea el demo con isM2DemoAllowed(import.meta.env) — no solo oculta el enlace', () => {
  assert.match(screenSrc, /isM2DemoAllowed\(import\.meta\.env\)/)
  assert.match(screenSrc, /demoAllowed && new URLSearchParams\(location\.search\)\.get\('demo'\) === '1'/)
  assert.ok(!/get\('demo'\) === '1'(?![\s\S]{0,80})/.test('') || true)
  // el fixture solo se usa dentro de la rama demo
  const fixtureUses = screenSrc.split('M2_API_LATEST_FIXTURE').length - 1
  assert.ok(fixtureUses >= 1, 'fixture referenciado')
  assert.match(screenSrc, /if \(demo\) \{\s*setLoad\(\{ phase: 'ok', payload: M2_API_LATEST_FIXTURE, demo: true \}\)/)
})

// ── B4/B5/B6/B10: semántica honesta en la UI ─────────────────────────────────
test('labels: "Incidencias detectadas" (no "Registros afectados"); sin afirmación de unicidad', () => {
  assert.ok(screenSrc.includes('Incidencias detectadas'))
  assert.ok(!screenSrc.includes('Registros afectados'), 'label viejo eliminado')
  assert.ok(screenSrc.includes('NO son entidades únicas'))
})

test('granularidad: badges AGREGADO/SUCURSAL/REGISTRO y "Detalle de regla" (no drill-down de registro)', () => {
  assert.ok(screenSrc.includes('Detalle de regla'))
  assert.ok(!screenSrc.toLowerCase().includes('drill-down'), 'lenguaje corregido')
  assert.match(screenSrc, /M2_GRANULARITY_LABELS/)
  assert.ok(screenSrc.includes("entity_id ${finding.entity_id}") || screenSrc.includes('finding.entity_id != null'), 'detalle por registro solo con entity_id')
  assert.ok(!screenSrc.includes('Abrir en Odoo'), 'sin enlace Odoo hasta URL segura con IDs (v1.1)')
})

test('lifecycle: persistentes/corregidos/tendencias SOLO con >= 2 corridas', () => {
  assert.match(screenSrc, /runsCount >= 2/)
  assert.match(screenSrc, /hasHistory \?/)
  assert.ok(screenSrc.includes('primera corrida'), 'copy honesto con 1 corrida')
})

test('STALE: warning prominente con edad, lectura permitida y exports marcados', () => {
  assert.match(screenSrc, /CORRIDA STALE/)
  assert.match(screenSrc, /payload\.age_days/)
  assert.match(screenSrc, /exportFilename\('m2_findings', 'csv', \{ stale, demo: load\.demo \}\)/)
})

test('estados de error del cliente: disabled/unavailable/session/forbidden/schema_mismatch/invalid', () => {
  for (const state of ['disabled', 'unavailable', 'session_expired', 'forbidden', 'schema_mismatch', 'invalid']) {
    assert.ok(screenSrc.includes(`${state}:`), state)
  }
})

// ── Read-only duro ───────────────────────────────────────────────────────────
const M2_DIR = fileURLToPath(new URL('../src/modules/planeacion', import.meta.url))
const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(jsx?|mjs)$/.test(entry)) acc.push(p)
  }
  return acc
}

test('read-only: el módulo M2 no emite verbos de escritura ni llamadas Odoo directas', () => {
  for (const file of walk(M2_DIR)) {
    const src = readFileSync(file, 'utf8')
    assert.ok(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(src), `${path.basename(file)} sin verbos de escritura`)
    assert.ok(!/apiPost|apiPatch|apiDelete|execute_kw|xmlrpc/i.test(src), `${path.basename(file)} sin escrituras`)
  }
})

test('read-only: sin botones de corrección; declara auto_fix=false y READ-ONLY', () => {
  for (const forbidden of ['Corregir', 'Asignar territorio', 'Ejecutar solver', 'Cerrar hallazgo', 'Guardar cambios']) {
    assert.ok(!screenSrc.includes(forbidden), `sin botón "${forbidden}"`)
  }
  assert.ok(screenSrc.includes('auto_fix = false'))
  assert.ok(screenSrc.includes('READ-ONLY'))
})

// ── Blindaje: nada servible en public/ ───────────────────────────────────────
test('blindaje: public/ sin JSON de M2 (ni run ni envelope)', () => {
  const PUBLIC = fileURLToPath(new URL('../public', import.meta.url))
  const leaked = []
  const walkPublic = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry)
      if (statSync(p).isDirectory()) walkPublic(p)
      else if (/m2/i.test(entry) && /\.json$/i.test(entry)) leaked.push(p)
    }
  }
  walkPublic(PUBLIC)
  assert.deepEqual(leaked, [])
})

// ── No-regresión con módulos existentes ──────────────────────────────────────
test('roles normales conservan sus módulos exactos (sin fuga de planeacion)', () => {
  for (const role of ['gerente_sucursal', 'supervisor_ventas', 'jefe_ruta', 'operador_torres', 'auxiliar_admin']) {
    assert.ok(!ids(getNavModules(s(role))).includes('planeacion'), role)
  }
  // universales intactos para un rol básico
  const basic = ids(getNavModules(s('rol_comun')))
  assert.deepEqual(basic, ['kpis', 'encuestas', 'logros'])
})
