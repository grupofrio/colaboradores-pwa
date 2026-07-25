import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getHomeModulesForSession, getNavModules, getVisibleModulesForSession,
  isModuleVisibleForSession,
  buildMobileNav, buildDesktopNav, isNavHiddenForPath, resolveActiveId,
  HOME_ANCHOR, PROFILE_ANCHOR,
} from '../src/lib/navModel.js'
import { getModuleById, MODULES } from '../src/modules/registry.js'
import { getModuleEntryDecisionForSession, getModuleEntryDecision } from '../src/lib/roleContext.js'

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

test('Home conserva el orden histórico del registry y agrega Torre al final', () => {
  assert.deepEqual(ids(getHomeModulesForSession(towerSession('supervisor_ventas'))), [
    'kpis', 'encuestas', 'logros', 'supervisor_ventas', 'torre_operativa',
  ])
})

test('Home respeta showOnHome:false sin ocultar el módulo de la navegación', () => {
  const previous = TOWER.showOnHome
  TOWER.showOnHome = false
  try {
    const sess = towerSession('supervisor_ventas')
    assert.ok(!ids(getHomeModulesForSession(sess)).includes('torre_operativa'))
    assert.ok(ids(getNavModules(sess)).includes('torre_operativa'))
  } finally {
    TOWER.showOnHome = previous
  }
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

// ── Entrada del home (clic): MISMA autoridad que la tarjeta ─────────────────
// getModuleEntryDecisionForSession es la función PURA que consume
// ScreenHome.handleModule. Para towerGated autoriza por tower_status
// AUTORITATIVO (no x_job_key); para el resto delega en la lógica por rol.
// allowed = (type !== 'denied'); route = TOWER.route; reason encoded by type.
const entry = (session) => getModuleEntryDecisionForSession(TOWER, session)

test('CLAVE: admin_plataforma con x_job_key ajeno (direccion_general) ENTRA por tower_status', () => {
  const sess = towerSession('admin_plataforma', 'direccion_general')
  const d = entry(sess)
  assert.equal(d.type, 'direct', 'autorizado (allowed) vía tower_status')
  assert.equal(d.selectedRole, '', 'sin role-context: navega directo a la ruta')
  assert.equal(TOWER.route, '/torre/backlog', 'ruta destino')
  // Contraste: la vía SOLO-x_job_key habría DENEGADO (direccion_general ∉ roles).
  // Ésa era exactamente la incoherencia YELLOW que reportó Codex.
  assert.equal(getModuleEntryDecision(TOWER, sess).type, 'denied')
})

test('supervisor_ventas con tower_status: ENTRA (direct, sin role-context)', () => {
  const d = entry(towerSession('supervisor_ventas'))
  assert.equal(d.type, 'direct')
  assert.equal(d.selectedRole, '')
})

test('supervisor_ventas SIN tower_status (solo x_job_key): NO entra a Torre', () => {
  assert.equal(entry(roleSession('supervisor_ventas')).type, 'denied')
})

test('gerente_sucursal (sin tower_status): NO entra a Torre', () => {
  assert.equal(entry(roleSession('gerente_sucursal')).type, 'denied')
})

test('tower_status mal-case / inválido en el clic: NO entra (strict-case, fail-closed)', () => {
  for (const ts of ['ADMIN_PLATAFORMA', 'Supervisor_Ventas', '', ' ', 'chofer', null, 123]) {
    assert.equal(entry(towerSession(ts)).type, 'denied', `ts=${JSON.stringify(ts)}`)
  }
  assert.equal(entry(towerSession('  supervisor_ventas  ')).type, 'direct', 'trim sí, case no')
})

test('sesión inválida en el clic: NO entra a Torre aunque traiga tower_status', () => {
  for (const bad of [null, {}, { employee: { tower_status: 'admin_plataforma' } },
    { employee_id: 1, session_token: 'x', exp: 1 }]) {
    assert.equal(entry(bad).type, 'denied')
  }
})

test('módulo NORMAL: getModuleEntryDecisionForSession delega en la lógica por rol', () => {
  // Universal (kpis): decisión idéntica a getModuleEntryDecision con sesión válida.
  const kpis = getModuleById('kpis')
  const sess = roleSession('gerente_sucursal')
  assert.deepEqual(getModuleEntryDecisionForSession(kpis, sess), getModuleEntryDecision(kpis, sess))
  // No autorizado por rol: sigue denegado (delegación intacta, sin bypass).
  const admin = getModuleById('admin_sucursal')
  assert.equal(getModuleEntryDecisionForSession(admin, roleSession('supervisor_ventas')).type, 'denied')
  // Autorizado por rol: entra (gerente_sucursal ∈ admin_sucursal.roles).
  assert.notEqual(getModuleEntryDecisionForSession(admin, roleSession('gerente_sucursal')).type, 'denied')
})

test('ScreenHome.handleModule usa la decisión session-aware (no la de solo-x_job_key)', () => {
  const home = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
  assert.match(home, /getModuleEntryDecisionForSession\(mod, session\)/, 'el clic usa la fuente session-aware')
  assert.ok(!/getModuleEntryDecision\(mod, session\)/.test(home), 'el clic ya no se autoriza por x_job_key directo')
})

test('registry: torre_operativa declara showOnHome/showInNav EXPLÍCITOS (=true)', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(TOWER, 'showOnHome'), true, 'showOnHome declarado')
  assert.equal(Object.prototype.hasOwnProperty.call(TOWER, 'showInNav'), true, 'showInNav declarado')
  assert.equal(TOWER.showOnHome, true)
  assert.equal(TOWER.showInNav, true)
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

// ── Política Etapa 0A: /torre/backlog RECUPERA nav; /torre (E1) sigue oculto ──
test('/torre/backlog recupera la nav global (M1); /torre (E1) sigue oculto', () => {
  assert.equal(isNavHiddenForPath('/torre/backlog'), false, 'M1 recupera el sidebar')
  assert.equal(isNavHiddenForPath('/torre'), true, 'la E1 Tower sigue full-screen/oculta')
})

// ── ScreenHome usa la fuente única session-aware de Home ────────────────────
test('ScreenHome deriva las tarjetas de getHomeModulesForSession', () => {
  const home = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
  assert.match(home, /getHomeModulesForSession\(session\)/, 'home usa la fuente session-aware')
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
