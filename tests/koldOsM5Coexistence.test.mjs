// KOLD OS — CONVIVENCIA M1 (Tower) + M2 (Planeación) + M5 (Inventario y flujo).
// M3 NO está mergeado en main: su convivencia se prueba en su propio PR.
// Estos tests garantizan que agregar M5 NO alteró la autoridad de M1/M2 ni el
// orden del Home (fix Sebastián d7c2bb8) ni el sort por navPriority de la nav.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  getNavModules, getVisibleModulesForSession, getHomeModulesForSession,
  isModuleVisibleForSession, getModuleEntryDecisionForSession,
  buildDesktopNav, buildMobileNav,
} from '../src/lib/navModel.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const navSrc = readFileSync(new URL('../src/lib/navModel.js', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)

const TOWER = getModuleById('torre_operativa')
const M2 = getModuleById('planeacion')
const M5 = getModuleById('inventario-flujo')
const KOLD_IDS = ['torre_operativa', 'planeacion', 'inventario-flujo']

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
test('A. Aida (tower_status=supervisor_ventas): ve Tower, NO ve M2/M5', () => {
  const sess = tower('supervisor_ventas')
  const v = surfaces(sess)
  assert.ok(v.home.includes('torre_operativa'), 've Tower')
  assert.ok(enters(TOWER, sess), 'entra a Tower')
  for (const id of ['planeacion', 'inventario-flujo']) {
    for (const [surface, list] of Object.entries(v)) {
      assert.ok(!list.includes(id), `NO ve ${id} en ${surface}`)
    }
  }
  assert.equal(enters(M2, sess), false)
  assert.equal(enters(M5, sess), false)
})

test('B. admin_plataforma: ve Tower + M2 + M5 y ENTRA a los tres', () => {
  const sess = tower('admin_plataforma')
  const v = surfaces(sess)
  for (const id of KOLD_IDS) {
    assert.ok(v.home.includes(id), `ve ${id} en home`)
    assert.ok(v.nav.includes(id), `ve ${id} en nav`)
    assert.ok(v.rail.includes(id), `ve ${id} en rail`)
    assert.ok(v.mobile.includes(id), `ve ${id} en móvil (directo o Más)`)
  }
  for (const mod of [TOWER, M2, M5]) assert.ok(enters(mod, sess), `entra a ${mod.id}`)
})

test('C. direccion_general SIN tower_status: NO ve Tower, SÍ ve M2/M5', () => {
  const sess = s('direccion_general')
  const v = surfaces(sess)
  assert.ok(!v.home.includes('torre_operativa'), 'Tower exige tower_status, no x_job_key')
  assert.equal(enters(TOWER, sess), false)
  assert.ok(v.home.includes('planeacion') && v.home.includes('inventario-flujo'))
  assert.ok(enters(M2, sess) && enters(M5, sess))
})

test('D. gerente_sucursal: no ve ni entra a ninguno de los tres (v1)', () => {
  const sess = s('gerente_sucursal')
  const v = surfaces(sess)
  for (const id of KOLD_IDS) {
    for (const [surface, list] of Object.entries(v)) {
      assert.ok(!list.includes(id), `gerente NO ve ${id} en ${surface}`)
    }
  }
  for (const mod of [TOWER, M2, M5]) assert.equal(enters(mod, sess), false)
})

test('E. sesión inválida: cero módulos y clic denegado en los tres', () => {
  for (const bad of [null, undefined, {}, { employee_id: 100 }, { session_token: 'h.p.s' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getHomeModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    for (const mod of [TOWER, M2, M5]) {
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

test('I. roles normales conservan sus módulos exactos (sin fuga de M5)', () => {
  assert.deepEqual(ids(getNavModules(s('rol_comun'))), ['kpis', 'encuestas', 'logros'])
  const gerente = ids(getNavModules(s('gerente_sucursal')))
  assert.ok(gerente.includes('gerente') && !gerente.includes('inventario-flujo'))
})

// ── M1/M2 intactos a nivel código ────────────────────────────────────────────
test('J. M1: TowerRoute intacto; M2: M2PlaneacionRoute intacto; M5 tiene el suyo', () => {
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M2PlaneacionRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M5InventarioRoute\(\{ children \}\)/)
  assert.ok(appSrc.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
  assert.ok(appSrc.includes('<Route path="/planeacion" element={<M2PlaneacionRoute>'))
})

test('K. navModel: M5 usa el resolver canónico y conserva fail-closed', () => {
  assert.match(navSrc, /m5:\s*readM5Access/)
  assert.match(navSrc, /return resolveAccessPolicy\(module\.accessPolicy, session\)/)
  assert.match(navSrc, /if \(typeof resolver !== 'function'\) return false/)
})

test('L. la autoridad de Tower sigue siendo tower_status, NO x_job_key', () => {
  assert.equal(isModuleVisibleForSession(TOWER, s('direccion_general')), false)
  assert.equal(isModuleVisibleForSession(TOWER, tower('admin_plataforma')), true)
  assert.equal(isModuleVisibleForSession(TOWER, tower('supervisor_ventas')), true)
})

test('M. las 3 rutas KOLD OS existen una sola vez y no colisionan', () => {
  for (const route of ['/torre/backlog', '/planeacion', '/inventario-flujo']) {
    assert.equal(MODULES.filter((m) => m.route === route).length, 1, route)
  }
})
