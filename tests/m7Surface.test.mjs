// KOLD OS · M7 — superficie e integración: identidad propia, UNA autoridad decide
// tarjeta/nav/clic/route-guard, y M1–M6 no se tocan.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MODULES, getModuleById,
} from '../src/modules/registry.js'
import {
  ACCESS_POLICY_RESOLVERS, isModuleVisibleForSession,
  getModuleEntryDecisionForSession, getHomeModulesForSession, getNavModules,
} from '../src/lib/navModel.js'
import { readM7Access, M7_ALLOWED_JOB_KEYS } from '../src/modules/rentabilidad-costos/m7/access.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const M7 = getModuleById('profitability-costs')
const ids = (mods) => mods.map((m) => m.id)
const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })

// ── identidad ────────────────────────────────────────────────────────────────
test('identidad: id, ruta, accessPolicy y roles propios', () => {
  assert.ok(M7, "el id canónico es 'profitability-costs'")
  assert.equal(M7.label, 'Rentabilidad y costos')
  assert.equal(M7.route, '/rentabilidad-costos')
  assert.equal(M7.accessPolicy, 'm7')
  assert.deepEqual(M7.roles, ['direccion_general'])
  assert.equal(M7.showOnHome, true)
  assert.equal(M7.showInNav, true)
  assert.equal(M7.towerGated, undefined, 'M7 NO es towerGated')
})

test('identidad: NO reutiliza el id/ruta de otro módulo (bug de M5)', () => {
  for (const foreign of ['ventas-clientes', 'inventario-flujo', 'cash-reconciliation',
    'ejecucion', 'recurrencia', 'backlog']) {
    assert.notEqual(M7.id, foreign, `M7 reutiliza el id ajeno: ${foreign}`)
  }
  const allIds = MODULES.map((m) => m.id)
  const allRoutes = MODULES.map((m) => m.route)
  assert.equal(new Set(allIds).size, allIds.length, 'id duplicado en el registry')
  assert.equal(new Set(allRoutes).size, allRoutes.length, 'ruta duplicada en el registry')
})

test('el título NO afirma utilidad/margen real/rentabilidad completa', () => {
  const label = `${M7.label} ${M7.shortLabel}`.toLowerCase()
  for (const prohibido of ['utilidad', 'ganancia', 'beneficio neto', 'margen real',
    'rentabilidad completa', 'profit']) {
    assert.ok(!label.includes(prohibido), `el título afirma ${prohibido}`)
  }
})

// ── UNA sola autoridad (el bug de M1) ────────────────────────────────────────
test('m7 está registrado en ACCESS_POLICY_RESOLVERS con su autoridad propia', () => {
  assert.equal(ACCESS_POLICY_RESOLVERS.m7, readM7Access)
})

test('la MISMA autoridad decide tarjeta, home, nav y clic', () => {
  const ok = s('direccion_general')
  assert.equal(isModuleVisibleForSession(M7, ok), true)
  assert.ok(ids(getHomeModulesForSession(ok)).includes('profitability-costs'), 'tarjeta home')
  assert.ok(ids(getNavModules(ok)).includes('profitability-costs'), 'nav')
  assert.equal(getModuleEntryDecisionForSession(M7, ok).type, 'direct', 'clic')

  const no = s('chofer')
  assert.equal(isModuleVisibleForSession(M7, no), false)
  assert.ok(!ids(getHomeModulesForSession(no)).includes('profitability-costs'))
  assert.ok(!ids(getNavModules(no)).includes('profitability-costs'))
  assert.equal(getModuleEntryDecisionForSession(M7, no).type, 'denied')
})

test('roles NO autorizados no ven ni entran (fail-closed)', () => {
  for (const role of ['admin_plataforma', 'gerente_sucursal', 'supervisor_ventas',
    'operaciones', 'finanzas', 'contador', 'comercial', 'vendedor', 'almacenista']) {
    assert.equal(isModuleVisibleForSession(M7, s(role)), false, `${role} ve la tarjeta`)
    assert.equal(getModuleEntryDecisionForSession(M7, s(role)).type, 'denied', `${role} entra`)
  }
  assert.deepEqual([...M7_ALLOWED_JOB_KEYS], ['direccion_general'])
})

test('sin sesión válida: nada (fail-closed)', () => {
  for (const bad of [null, undefined, {}, { employee_id: 1 }, { session_token: '   ' }]) {
    assert.equal(isModuleVisibleForSession(M7, bad), false)
    assert.equal(getModuleEntryDecisionForSession(M7, bad).type, 'denied')
  }
})

// ── el route guard revalida en App.jsx ───────────────────────────────────────
test('App.jsx monta M7 detrás de su propio route guard fail-closed', () => {
  const app = read('../src/App.jsx')
  assert.match(app, /function M7RentabilidadRoute/)
  assert.ok(app.includes("readM7Access(session).level !== 'global'"),
    'el guard usa la MISMA autoridad readM7Access')
  assert.match(app, /path="\/rentabilidad-costos"[^>]*M7RentabilidadRoute/)
})

// ── M1–M6 intactos ───────────────────────────────────────────────────────────
test('los módulos previos siguen presentes y con su ruta (sin regresión)', () => {
  const previos = {
    'cash-reconciliation': '/caja-conciliacion',
    'ventas-clientes': '/ventas-clientes',
    'inventario-flujo': '/inventario-flujo',
  }
  for (const [id, route] of Object.entries(previos)) {
    const m = getModuleById(id)
    assert.ok(m, `desapareció el módulo ${id}`)
    assert.equal(m.route, route, `cambió la ruta de ${id}`)
  }
})

test('los resolvers previos (m2..m6) siguen registrados junto al m7', () => {
  for (const k of ['m2', 'm3', 'm4', 'm5', 'm6', 'm7']) {
    assert.equal(typeof ACCESS_POLICY_RESOLVERS[k], 'function', `falta resolver ${k}`)
  }
})

test('la pantalla publica el subtítulo honesto (sin afirmar rentabilidad)', () => {
  const screen = read('../src/modules/rentabilidad-costos/ScreenRentabilidadCostosM7.jsx')
  assert.match(screen, /Cobertura económica, ingresos observables y camino hacia rentabilidad/)
  assert.match(screen, /observatorio read-only/)
})
