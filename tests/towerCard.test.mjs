import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getNavModules, getVisibleModulesForSession, isModuleVisibleForSession,
  buildMobileNav, buildDesktopNav, isNavHiddenForPath, resolveActiveId,
  HOME_ANCHOR, PROFILE_ANCHOR,
} from '../src/lib/navModel.js'
import { getModuleById, MODULES } from '../src/modules/registry.js'

const ids = (arr) => arr.map((m) => m.id)
const TOWER = getModuleById('torre_operativa')

// Sesión con rol AUTORITATIVO tower_status (como la entrega Odoo al login).
const towerSession = (tower_status, role = 'supervisor_ventas') => ({
  employee_id: 718, session_token: 'h.p.s', role,
  employee: { tower_status },
})
// Sesión con SOLO x_job_key (sin tower_status) — como Angélica/otros.
const roleSession = (role) => ({ employee_id: 100, session_token: 'h.p.s', role })

// ── El módulo existe y es towerGated ────────────────────────────────────────
test('registry: torre_operativa existe, es towerGated y apunta a /torre/backlog', () => {
  assert.ok(TOWER, 'módulo torre_operativa en el registry')
  assert.equal(TOWER.route, '/torre/backlog')
  assert.equal(TOWER.label, 'Torre operativa')
  assert.equal(TOWER.shortLabel, 'Torre')
  assert.equal(TOWER.towerGated, true)
  assert.deepEqual(TOWER.roles, ['admin_plataforma', 'supervisor_ventas'])
})

// ── Autoridad = tower_status, NO x_job_key ──────────────────────────────────
test('Aida (tower_status supervisor_ventas): ve la tarjeta Torre', () => {
  const sess = towerSession('supervisor_ventas')
  assert.ok(isModuleVisibleForSession(TOWER, sess))
  assert.ok(ids(getVisibleModulesForSession(sess)).includes('torre_operativa'), 'tarjeta en home')
  assert.ok(ids(getNavModules(sess)).includes('torre_operativa'), 'entrada en nav')
})

test('admin_plataforma (tower_status): ve la tarjeta Torre', () => {
  const sess = towerSession('admin_plataforma', 'direccion_general')
  assert.ok(isModuleVisibleForSession(TOWER, sess))
  assert.ok(ids(getNavModules(sess)).includes('torre_operativa'))
})

test('CLAVE: rol x_job_key supervisor_ventas SIN tower_status => NO ve Torre', () => {
  // Un supervisor cuyo Odoo NO resolvió tower_status (null) no debe ver Tower,
  // aunque su x_job_key coincida con roles del módulo. Autoridad = tower_status.
  const sess = roleSession('supervisor_ventas')
  assert.equal(isModuleVisibleForSession(TOWER, sess), false)
  assert.ok(!ids(getNavModules(sess)).includes('torre_operativa'))
  assert.ok(!ids(getVisibleModulesForSession(sess)).includes('torre_operativa'))
})

test('Angélica (gerente_sucursal, sin tower_status): NO ve Torre', () => {
  const sess = roleSession('gerente_sucursal')
  assert.ok(!ids(getVisibleModulesForSession(sess)).includes('torre_operativa'))
  assert.ok(!ids(getNavModules(sess)).includes('torre_operativa'))
})

test('chofer/jefe_ruta/vendedor/caja/común: NO ven Torre', () => {
  for (const role of ['jefe_ruta', 'auxiliar_ruta', 'almacenista_entregas', 'auxiliar_admin', 'operador_barra', 'rol_comun']) {
    assert.ok(!ids(getVisibleModulesForSession(roleSession(role))).includes('torre_operativa'), role)
  }
})

test('tower_status inválido / mal-case / vacío => NO ve Torre (strict-case)', () => {
  for (const ts of ['ADMIN_PLATAFORMA', 'Supervisor_Ventas', 'gerente_sucursal', '', ' ', 'chofer', null, 123]) {
    assert.equal(isModuleVisibleForSession(TOWER, towerSession(ts)), false, `ts=${JSON.stringify(ts)}`)
  }
  // con whitespace alrededor del valor canónico SÍ (trim, sin normalizar case)
  assert.equal(isModuleVisibleForSession(TOWER, towerSession('  supervisor_ventas  ')), true)
})

// ── Sesión inválida => nada ─────────────────────────────────────────────────
test('sesión inválida: no ve Torre aunque traiga employee.tower_status', () => {
  assert.equal(isModuleVisibleForSession(TOWER, { employee: { tower_status: 'supervisor_ventas' } }), false, 'sin employee_id/token')
  assert.equal(isModuleVisibleForSession(TOWER, null), false)
  assert.equal(isModuleVisibleForSession(TOWER, {}), false)
})

// ── Colocación en la nav (móvil/desktop) + estado activo ────────────────────
test('Aida móvil: Torre visible (Equipo antes por prioridad); overflow a Más', () => {
  const sess = towerSession('supervisor_ventas')
  const m = buildMobileNav(sess, '/')
  // navPriority: Equipo(10) < Torre(15) < KPIs(30) < Encuestas(40) < Premios(50)
  const nav = ids(getNavModules(sess))
  assert.deepEqual(nav, ['supervisor_ventas', 'torre_operativa', 'kpis', 'encuestas', 'logros'])
  // móvil: Inicio + [Equipo, Torre] directos + Más + Yo
  assert.deepEqual(ids(m.primary), ['supervisor_ventas', 'torre_operativa'])
  assert.equal(m.hasMore, true)
})

test('Aida desktop: Torre en el rail', () => {
  const d = buildDesktopNav(towerSession('supervisor_ventas'), '/')
  assert.ok(ids(d.modules).includes('torre_operativa'))
})

test('estado activo: en /torre/backlog el item Torre resuelve activo', () => {
  const items = [HOME_ANCHOR, TOWER, PROFILE_ANCHOR]
  assert.equal(resolveActiveId(items, '/torre/backlog'), 'torre_operativa')
  assert.equal(resolveActiveId(items, '/torre/backlog?state_bucket=open'), 'torre_operativa')
})

// ── Política full-screen: /torre/backlog sigue ocultando la nav global ──────
test('/torre/backlog sigue oculto para la nav global (pantalla full-screen)', () => {
  assert.equal(isNavHiddenForPath('/torre/backlog'), true)
  assert.equal(isNavHiddenForPath('/torre'), true)
})

// ── ScreenHome usa la fuente única session-aware ────────────────────────────
test('ScreenHome deriva las tarjetas de getVisibleModulesForSession', () => {
  const home = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
  assert.match(home, /getVisibleModulesForSession\(session\)/, 'home usa la fuente session-aware')
  assert.ok(!/getModulesForRoles\(getEffectiveJobKeys/.test(home), 'ya no usa la fuente solo-roles')
})

// ── App.jsx: la ruta sigue guardada por TowerRoute (autoridad final) ────────
test('la ruta /torre/backlog sigue detrás de TowerRoute (no ModuleRoleRoute)', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.ok(app.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
  assert.ok(!/moduleId="torre_operativa"/.test(app), 'la tarjeta NO cambia el guard de la ruta')
})

// ── El registry no rompe: exactamente un módulo /torre ──────────────────────
test('registry: exactamente un módulo con route /torre/backlog (torre_operativa)', () => {
  const tower = MODULES.filter((m) => m.route === '/torre/backlog')
  assert.equal(tower.length, 1)
  assert.equal(tower[0].id, 'torre_operativa')
})
