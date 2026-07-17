// Codex ronda 2 §6 — POLÍTICA CANÓNICA DE ACCESO (M1 Tower + M2 + M3 + M4).
//
// Estos tests existen porque los cuatro módulos llegaron por PRs distintos y cada
// uno tocó las mismas funciones session-aware. Verifican la CONVIVENCIA: que la
// resolución sea única, que Tower conserve su autoridad intacta y que una
// política desconocida se deniegue sola.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  ACCESS_POLICY_RESOLVERS, resolveAccessPolicy,
  isModuleVisibleForSession, getVisibleModulesForSession, getHomeModulesForSession,
  getNavModules, getModuleEntryDecisionForSession, buildDesktopNav, buildMobileNav,
} from '../src/lib/navModel.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const navSrc = readFileSync(new URL('../src/lib/navModel.js', import.meta.url), 'utf8')
const apiSrc = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const tower = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const ids = (arr) => arr.map((m) => m.id)

const TOWER = getModuleById('torre_operativa')
const M2 = getModuleById('planeacion')
const M3 = getModuleById('ejecucion')
const M4 = getModuleById('ventas-clientes')
const KOLD_MODULES = [TOWER, M2, M3, M4]
const KOLD_IDS = KOLD_MODULES.map((module) => module.id)

// Los 4 módulos KOLD OS y sus superficies, en una sola tabla.
// `mobile` incluye el menú "Más" (overflow): un módulo escondido ahí SIGUE
// siendo visible — si se omitiera, una fuga en "Más" pasaría inadvertida.
const surfaces = (sess) => {
  const mob = buildMobileNav(sess, '/')
  return {
    home: ids(getHomeModulesForSession(sess)),
    nav: ids(getNavModules(sess)),
    rail: ids(buildDesktopNav(sess, '/').modules),
    mobile: [...ids(mob.primary), ...ids(mob.overflow)],
  }
}
const entersInto = (mod, sess) => getModuleEntryDecisionForSession(mod, sess).type !== 'denied'

// ── El registro de políticas ─────────────────────────────────────────────────
test('ACCESS_POLICY_RESOLVERS registra M2-M6; Tower NO entra al registro', () => {
  assert.deepEqual(Object.keys(ACCESS_POLICY_RESOLVERS).sort(), ['m2', 'm3', 'm4', 'm5', 'm6'])
  // Tower conserva su propia autoridad (towerGated + tower_status), no se
  // convierte a accessPolicy ni a x_job_key.
  assert.equal(TOWER.accessPolicy, undefined)
  assert.equal(TOWER.towerGated, true)
})

test('M5 y M6 conservan identidad, rutas y prioridad consecutiva', () => {
  const m5 = getModuleById('inventario-flujo')
  const m6 = getModuleById('cash-reconciliation')
  assert.deepEqual(
    [m5.route, m5.accessPolicy, m5.navPriority],
    ['/inventario-flujo', 'm5', 16],
  )
  assert.deepEqual(
    [m6.route, m6.accessPolicy, m6.navPriority],
    ['/caja-conciliacion', 'm6', 17],
  )
})

test('política desconocida => fail-closed (no cae al camino por rol)', () => {
  const fake = { id: 'fake', route: '/fake', accessPolicy: 'no_existe', roles: ['*'] }
  const sess = s('direccion_general')
  assert.equal(resolveAccessPolicy('no_existe', sess), false)
  assert.equal(isModuleVisibleForSession(fake, sess), false)
  assert.equal(getModuleEntryDecisionForSession(fake, sess).type, 'denied')
  // Aunque sus roles digan '*', la política manda: jamás sale por rol.
  assert.equal(isModuleVisibleForRoles(fake, ['*']), false)
})

// ── Matriz §6 A–F ────────────────────────────────────────────────────────────
test('A. Aida (tower_status=supervisor_ventas): ve Tower, NO ve M2/M3/M4', () => {
  const sess = tower('supervisor_ventas')
  const v = surfaces(sess)
  assert.ok(v.home.includes('torre_operativa'), 've Tower')
  assert.ok(entersInto(TOWER, sess), 'entra a Tower')
  for (const id of ['planeacion', 'ejecucion', 'ventas-clientes']) {
    assert.ok(!v.home.includes(id), `NO ve ${id}`)
    assert.ok(!v.nav.includes(id), `NO ${id} en nav`)
  }
  assert.equal(entersInto(M2, sess), false)
  assert.equal(entersInto(M3, sess), false)
  assert.equal(entersInto(M4, sess), false)
})

test('B. admin_plataforma: ve Tower + M2 + M3 + M4 y ENTRA a los cuatro', () => {
  const sess = tower('admin_plataforma')
  const v = surfaces(sess)
  for (const id of KOLD_IDS) {
    assert.ok(v.home.includes(id), `ve ${id} en home`)
    assert.ok(v.nav.includes(id), `ve ${id} en nav`)
    assert.ok(v.rail.includes(id), `ve ${id} en rail`)
  }
  for (const mod of KOLD_MODULES) {
    assert.ok(entersInto(mod, sess), `entra a ${mod.id}`)
  }
})

test('C. direccion_general SIN tower_status: NO ve Tower, SÍ ve M2/M3/M4', () => {
  const sess = s('direccion_general')
  const v = surfaces(sess)
  assert.ok(!v.home.includes('torre_operativa'), 'Tower exige tower_status, no x_job_key')
  assert.equal(entersInto(TOWER, sess), false)
  assert.ok(v.home.includes('planeacion') && v.home.includes('ejecucion') && v.home.includes('ventas-clientes'))
  assert.ok(entersInto(M2, sess) && entersInto(M3, sess) && entersInto(M4, sess))
})

test('D. gerente_sucursal: no ve ni entra a ningún módulo KOLD OS (v1)', () => {
  const sess = s('gerente_sucursal')
  const v = surfaces(sess)
  for (const id of KOLD_IDS) {
    assert.ok(!v.home.includes(id), `NO ve ${id}`)
    assert.ok(!v.nav.includes(id), `NO ${id} en nav`)
  }
  for (const mod of KOLD_MODULES) assert.equal(entersInto(mod, sess), false)
})

test('E. sesión inválida: cero módulos y clic denegado en los cuatro', () => {
  for (const bad of [null, undefined, {}, { employee_id: 100 }, { session_token: 'h.p.s' }]) {
    assert.deepEqual(getVisibleModulesForSession(bad), [])
    assert.deepEqual(getHomeModulesForSession(bad), [])
    assert.deepEqual(getNavModules(bad), [])
    for (const mod of KOLD_MODULES) {
      assert.equal(isModuleVisibleForSession(mod, bad), false)
      assert.equal(getModuleEntryDecisionForSession(mod, bad).type, 'denied')
    }
  }
})

test('F. chofer/auxiliar: sin fuga de ningún módulo KOLD OS en NINGUNA superficie', () => {
  for (const role of ['chofer', 'auxiliar', 'jefe_ruta', 'supervisor_ventas']) {
    const v = surfaces(s(role))
    for (const id of KOLD_IDS) {
      for (const [surface, list] of Object.entries(v)) {
        assert.ok(!list.includes(id), `${role} NO debe ver ${id} en ${surface}`)
      }
    }
  }
})

// ── G. Orden: la autorización no reordena (fix de Sebastián d7c2bb8) ─────────
test('G. Home conserva el orden del registry; la nav ordena por navPriority', () => {
  const sess = tower('admin_plataforma')
  const home = getHomeModulesForSession(sess)
  const registryOrder = MODULES.filter((m) => home.some((h) => h.id === m.id)).map((m) => m.id)
  assert.deepEqual(ids(home), registryOrder, 'home = orden del registry, sin reordenar')

  const nav = getNavModules(sess)
  const priorities = nav.map((m) => m.navPriority ?? Number.MAX_SAFE_INTEGER)
  assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b), 'nav ordenado por navPriority')
})

test('G. la autorización NO filtra por superficie ni ordena', () => {
  const sess = tower('admin_plataforma')
  const visible = getVisibleModulesForSession(sess)
  // getVisibleModulesForSession = solo autorización, en orden del registry.
  const registryOrder = MODULES.filter((m) => visible.some((v) => v.id === m.id)).map((m) => m.id)
  assert.deepEqual(ids(visible), registryOrder)
  // Home y nav son subconjuntos suyos, cada uno con su metadata.
  assert.ok(getHomeModulesForSession(sess).every((m) => m.showOnHome !== false))
  assert.ok(getNavModules(sess).every((m) => m.showInNav !== false))
})

// ── M1 intacto ───────────────────────────────────────────────────────────────
test('M1: TowerRoute sigue siendo la autoridad de /torre, sin tocar', () => {
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M2PlaneacionRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M3EjecucionRoute\(\{ children \}\)/)
  assert.match(appSrc, /function M4VentasRoute\(\{ children \}\)/)
  // Cada guard revalida con SU contrato: ninguno reutiliza el de Tower.
  const m3Block = appSrc.slice(appSrc.indexOf('function M3EjecucionRoute'),
                              appSrc.indexOf('function M3EjecucionRoute') + 400)
  assert.match(m3Block, /readM3Access\(session\)\.level !== 'global'/)
  assert.ok(!/readTowerAccess|resolveTowerRole/.test(m3Block), 'M3 no reutiliza el gate de Tower')
})

test('M1: la autoridad de Tower sigue siendo tower_status, NO x_job_key', () => {
  assert.match(navSrc, /readAuthoritativeTowerStatus/)
  // Un direccion_general sin tower_status no ve Tower (probado en C): la
  // conversión a x_job_key habría hecho pasar ese caso.
  assert.equal(isModuleVisibleForSession(TOWER, s('direccion_general')), false)
  assert.equal(isModuleVisibleForSession(TOWER, tower('admin_plataforma')), true)
  assert.equal(isModuleVisibleForSession(TOWER, tower('supervisor_ventas')), true)
})

test('las 4 rutas KOLD OS existen una sola vez y no colisionan', () => {
  for (const route of ['/torre/backlog', '/planeacion', '/ejecucion', '/ventas-clientes']) {
    assert.equal(MODULES.filter((m) => m.route === route).length, 1, route)
    assert.equal((appSrc.match(new RegExp(`path=["']${route}["']`, 'g')) || []).length, 1, `${route} en App`)
  }
  assert.equal(new Set(KOLD_IDS).size, KOLD_IDS.length, 'sin módulos KOLD OS duplicados')
})

test('M3 y M4 conservan handlers directos Odoo y nunca dependen de n8n', () => {
  assert.match(apiSrc, /directKoldOsM2,\s*\n\s*directKoldOsM3,\s*\n\s*directKoldOsM4,/)
  for (const [name, pathGuard] of [['directKoldOsM3', 'isKoldOsM3Path'], ['directKoldOsM4', 'isKoldOsM4Path']]) {
    const start = apiSrc.indexOf(`async function ${name}`)
    const nextHandler = apiSrc.indexOf('\nasync function ', start + 1)
    const block = apiSrc.slice(start, nextHandler)
    const executable = block.replace(/\/\/.*$/gm, '')
    assert.ok(start >= 0, `${name} existe`)
    assert.match(block, new RegExp(`${pathGuard}\\(cleanPath\\)`))
    assert.match(block, /method !== 'GET'/)
    assert.match(block, /odooHttp\('GET'/)
    assert.doesNotMatch(executable, /n8n|N8N/)
  }
})
