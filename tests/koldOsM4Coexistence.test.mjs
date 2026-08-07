// KOLD OS — CONVIVENCIA M1 (Tower) + M2 (Planeación) + M3 (Ejecución) + M4.
// Estos tests garantizan que agregar M4 NO alteró la autoridad de M1/M2/M3 ni el
// orden del Home (fix Sebastián d7c2bb8) ni el sort por navPriority de la nav.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  getNavModules, getVisibleModulesForSession, getHomeModulesForSession,
  isModuleVisibleForSession, getModuleEntryDecisionForSession,
  buildDesktopNav, buildMobileNav, resolveAccessPolicy,
} from '../src/lib/navModel.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const navSrc = readFileSync(new URL('../src/lib/navModel.js', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)

const TOWER = getModuleById('torre_operativa')
const M2 = getModuleById('planeacion')
const M3 = getModuleById('ejecucion')
const M4 = getModuleById('ventas-clientes')
const KOLD_IDS = ['torre_operativa', 'planeacion', 'ejecucion', 'ventas-clientes']

const surfaces = (sess) => {
  const mob = buildMobileNav(sess, '/')
  return {
    home: ids(getHomeModulesForSession(sess)),
    nav: ids(getNavModules(sess)),
    rail: ids(buildDesktopNav(sess, '/').modules),
    mobile: [...ids(mob.primary), ...ids(mob.overflow || [])],
  }
}
const enters = (mod, sess) => getModuleEntryDecisionForSession(mod, sess).type !== 'denied'

// ── Matriz de convivencia ────────────────────────────────────────────────────
test('A. Aida (tower_status=supervisor_ventas): ve Tower, NO ve M2/M3/M4', () => {
  const sess = tower('supervisor_ventas')
  const v = surfaces(sess)
  assert.ok(v.home.includes('torre_operativa'), 've Tower')
  assert.ok(enters(TOWER, sess), 'entra a Tower')
  for (const id of ['planeacion', 'ejecucion', 'ventas-clientes']) {
    for (const [surface, list] of Object.entries(v)) {
      assert.ok(!list.includes(id), `NO ve ${id} en ${surface}`)
    }
  }
  assert.equal(enters(M2, sess), false)
  assert.equal(enters(M3, sess), false)
  assert.equal(enters(M4, sess), false)
})

test('B. admin_plataforma: ve Tower + M2 + M3 + M4 y entra a los cuatro', () => {
  const sess = tower('admin_plataforma')
  const v = surfaces(sess)
  for (const id of KOLD_IDS) {
    assert.ok(v.home.includes(id), `ve ${id} en home`)
    assert.ok(v.nav.includes(id), `ve ${id} en nav`)
    assert.ok(v.rail.includes(id), `ve ${id} en rail`)
    assert.ok(v.mobile.includes(id), `ve ${id} en móvil (directo o Más)`)
  }
  for (const mod of [TOWER, M2, M3, M4]) assert.ok(enters(mod, sess), `entra a ${mod.id}`)
})

test('C. direccion_general SIN tower_status: NO ve Tower, SÍ ve M2/M3/M4', () => {
  const sess = s('direccion_general')
  const v = surfaces(sess)
  assert.ok(!v.home.includes('torre_operativa'), 'Tower exige tower_status, no x_job_key')
  assert.equal(enters(TOWER, sess), false)
  assert.ok(v.home.includes('planeacion') && v.home.includes('ejecucion') && v.home.includes('ventas-clientes'))
  assert.ok(enters(M2, sess) && enters(M3, sess) && enters(M4, sess))
})

test('D. gerente_sucursal: no ve ni entra a ningún módulo KOLD OS (v1)', () => {
  const sess = s('gerente_sucursal')
  const v = surfaces(sess)
  for (const id of KOLD_IDS) {
    for (const [surface, list] of Object.entries(v)) {
      assert.ok(!list.includes(id), `gerente NO ve ${id} en ${surface}`)
    }
  }
  for (const mod of [TOWER, M2, M3, M4]) assert.equal(enters(mod, sess), false)
})

test('E. sesión inválida: cero módulos y clic denegado en los cuatro', () => {
  for (const bad of [null, undefined, {}, { employee_id: 100 }, { session_token: 'h.p.s' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getHomeModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    for (const mod of [TOWER, M2, M3, M4]) {
      assert.equal(isModuleVisibleForSession(mod, bad), false)
      assert.equal(getModuleEntryDecisionForSession(mod, bad).type, 'denied')
    }
  }
})

test('F. chofer/auxiliar/vendedor: sin fuga en NINGUNA superficie', () => {
  for (const role of ['chofer', 'auxiliar', 'jefe_ruta', 'vendedor', 'supervisor_ventas']) {
    const v = surfaces(s(role))
    for (const id of KOLD_IDS) {
      for (const [surface, list] of Object.entries(v)) {
        assert.ok(!list.includes(id), `${role} NO debe ver ${id} en ${surface}`)
      }
    }
  }
})

test('G. política desconocida => fail-closed (no cae al camino por rol)', () => {
  const fake = { id: 'fake', route: '/fake', accessPolicy: 'no_existe', roles: ['*'], showOnHome: true, showInNav: true }
  const sess = s('direccion_general')
  assert.equal(isModuleVisibleForSession(fake, sess), false)
  assert.equal(getModuleEntryDecisionForSession(fake, sess).type, 'denied')
  assert.equal(isModuleVisibleForRoles(fake, ['*']), false)
})

// ── Orden: la autorización no reordena (fix Sebastián d7c2bb8) ──────────────
test('H. Home conserva el orden del registry; la nav ordena por navPriority', () => {
  const sess = tower('admin_plataforma')
  const home = getHomeModulesForSession(sess)
  const registryOrder = MODULES.filter((m) => home.some((h) => h.id === m.id)).map((m) => m.id)
  assert.deepEqual(ids(home), registryOrder, 'home = orden del registry')

  const nav = getNavModules(sess)
  const priorities = nav.map((m) => (Number.isFinite(m.navPriority) ? m.navPriority : 100))
  assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b), 'nav ordenada por navPriority')
})

test('I. roles normales conservan sus módulos exactos (sin fuga de M4)', () => {
  assert.deepEqual(ids(getNavModules(s('rol_comun'))), ['kpis', 'encuestas', 'logros'])
  const gerente = ids(getNavModules(s('gerente_sucursal')))
  assert.ok(gerente.includes('gerente') && !gerente.includes('ventas-clientes'))
})

// ── M1/M2/M3 intactos a nivel código ─────────────────────────────────────────
test('J. M1, M2 y M3 conservan sus gates; M4 tiene el suyo', () => {
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M2PlaneacionRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M3EjecucionRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M4VentasRoute\(\{ children \}\)/)
  assert.ok(appSrc.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
  assert.ok(appSrc.includes('<Route path="/planeacion" element={<M2PlaneacionRoute>'))
  assert.ok(appSrc.includes('<Route path="/ejecucion" element={<M3EjecucionRoute>'))
})

test('K. navModel: registro m2/m3/m4 y Tower separado, desconocido fail-closed', () => {
  const vis = navSrc.slice(navSrc.indexOf('export function isModuleVisibleForSession'))
  assert.match(navSrc, /ACCESS_POLICY_RESOLVERS\s*=\s*Object\.freeze\(\{[\s\S]*m2:\s*readM2Access,[\s\S]*m3:\s*readM3Access,[\s\S]*m4:\s*readM4Access,/)
  assert.match(vis, /if \(module\.accessPolicy\) return resolveAccessPolicy\(module\.accessPolicy, session\)/)
  assert.match(vis, /if \(module\.towerGated\) return readAuthoritativeTowerStatus\(session\) != null/)
  assert.equal(resolveAccessPolicy('m4-typo', s('direccion_general')), false)
  const iTower = vis.indexOf('module.towerGated')
  const iPolicy = vis.indexOf('module.accessPolicy')
  assert.ok(iPolicy > -1 && iTower > iPolicy, 'accessPolicy y Tower conservan autoridades separadas')
})

test('L. la autoridad de Tower sigue siendo tower_status, NO x_job_key', () => {
  assert.equal(isModuleVisibleForSession(TOWER, s('direccion_general')), false)
  assert.equal(isModuleVisibleForSession(TOWER, tower('admin_plataforma')), true)
  assert.equal(isModuleVisibleForSession(TOWER, tower('supervisor_ventas')), true)
})

test('M. las 4 rutas KOLD OS existen una sola vez y no colisionan', () => {
  for (const route of ['/torre/backlog', '/planeacion', '/ejecucion', '/ventas-clientes']) {
    assert.equal(MODULES.filter((m) => m.route === route).length, 1, route)
  }
})
