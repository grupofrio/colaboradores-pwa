// KOLD OS · M6 — superficie: identidad, registry, nav, acceso, ruta.
//
// El bug de M1: tarjeta visible pero clic bloqueado. La MISMA autoridad
// (readM6Access) decide tarjeta, nav, Más, rail y clic; el route guard revalida.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getModuleById, MODULES, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  isModuleVisibleForSession, getModuleEntryDecisionForSession,
  getHomeModulesForSession, getNavModules,
} from '../src/lib/navModel.js'
import { readM6Access, M6_ALLOWED_JOB_KEYS } from '../src/modules/caja-conciliacion/m6/access.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const M6 = getModuleById('cash-reconciliation')
const ids = (mods) => mods.map((m) => m.id)
const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })

test('identidad: registry con id propio, ruta y accessPolicy m6', () => {
  assert.ok(M6, "el id canónico es 'cash-reconciliation'")
  assert.equal(M6.label, 'Caja y conciliación')
  assert.equal(M6.route, '/caja-conciliacion')
  assert.equal(M6.accessPolicy, 'm6')
  assert.equal(M6.showOnHome, true)
  assert.equal(M6.showInNav, true)
  assert.equal(M6.towerGated, undefined, 'M6 NO es towerGated')
})

test('identidad: NO reutiliza el id de ningún otro módulo', () => {
  // M5 registró su módulo con el id de M4 ('ventas-clientes'): como
  // getModuleById resuelve POR id, dos módulos habrían colisionado al mergear.
  for (const foreign of ['ventas-clientes', 'inventario-flujo', 'ejecucion',
    'recurrencia', 'backlog']) {
    assert.equal(getModuleById(foreign), undefined, `id ajeno vivo: ${foreign}`)
  }
  const all = MODULES.map((m) => m.id)
  assert.equal(new Set(all).size, all.length, 'ningún id duplicado en el registry')
})

test('acceso: SOLO direccion_general (espejo exacto del backend)', () => {
  assert.deepEqual([...M6_ALLOWED_JOB_KEYS], ['direccion_general'])
  assert.equal(readM6Access(s('direccion_general')).level, 'global')
  assert.equal(readM6Access(s('direccion_general')).reason, 'job_key_direccion_general')
})

test('acceso: TODOS los demás roles son denegados (fail-closed)', () => {
  const denegados = ['supervisor_ventas', 'gerente_sucursal', 'jefe_ruta', 'chofer',
    'vendedor', 'almacenista', 'produccion', 'admin_sucursal']
  for (const role of denegados) {
    assert.equal(readM6Access(s(role)).level, 'none', `${role} NO debe entrar`)
    assert.equal(isModuleVisibleForSession(M6, s(role)), false, `${role} ve la tarjeta`)
    assert.equal(getModuleEntryDecisionForSession(M6, s(role)).type, 'denied', `${role} entra`)
  }
})

test('acceso: admin_plataforma NO entra (el backend M6 sólo valida job key)', () => {
  // Divergencia DELIBERADA con M2: M2 acepta admin_plataforma porque su backend
  // también lo hace. El backend M6 sólo compara contra ALLOWED_JOB_KEYS
  // (ALLOWED_TOWER_STATUS existe pero nunca se usa). Aceptarlo aquí mostraría la
  // tarjeta a quien recibiría un 403 = el bug de M1.
  const towerAdmin = s('supervisor_ventas', { employee: { tower_status: 'admin_plataforma' } })
  assert.equal(readM6Access(towerAdmin).level, 'none')
  assert.equal(isModuleVisibleForSession(M6, towerAdmin), false)
  assert.equal(getModuleEntryDecisionForSession(M6, towerAdmin).type, 'denied')
})

test('acceso: sin sesión válida => nada (fail-closed)', () => {
  for (const bad of [null, undefined, {}, { employee_id: 1 }, { session_token: '' },
    { employee_id: 100, session_token: '   ' }]) {
    assert.equal(readM6Access(bad).level, 'none')
    assert.equal(isModuleVisibleForSession(M6, bad), false)
    assert.equal(getModuleEntryDecisionForSession(M6, bad).type, 'denied')
  }
})

test('la MISMA autoridad decide tarjeta, nav y clic (bug de M1)', () => {
  const ok = s('direccion_general')
  assert.equal(isModuleVisibleForSession(M6, ok), true)
  assert.ok(ids(getHomeModulesForSession(ok)).includes('cash-reconciliation'), 'tarjeta home')
  assert.ok(ids(getNavModules(ok)).includes('cash-reconciliation'), 'nav')
  assert.equal(getModuleEntryDecisionForSession(M6, ok).type, 'direct', 'clic')

  const no = s('chofer')
  assert.equal(isModuleVisibleForSession(M6, no), false)
  assert.ok(!ids(getHomeModulesForSession(no)).includes('cash-reconciliation'))
  assert.ok(!ids(getNavModules(no)).includes('cash-reconciliation'))
  assert.equal(getModuleEntryDecisionForSession(M6, no).type, 'denied')
})

test('accessPolicy jamás entra por roles genéricos', () => {
  // isModuleVisibleForRoles debe ignorar los módulos con accessPolicy.
  assert.equal(isModuleVisibleForRoles(M6, ['direccion_general']), false)
  assert.equal(isModuleVisibleForRoles(M6, ['*']), false)
})

test('App.jsx: la ruta está protegida por su propio guard', () => {
  const app = read('../src/App.jsx')
  assert.ok(app.includes('function M6CajaRoute'), 'existe el guard')
  assert.ok(app.includes('<Route path="/caja-conciliacion" element={<M6CajaRoute>'),
    'la ruta usa el guard')
  assert.ok(app.includes("readM6Access(session).level !== 'global'"),
    'el guard revalida con la misma autoridad')
  assert.ok(app.includes('<Navigate to="/login" replace />'), 'sin sesión => login')
  // El guard NO puede aceptar tower_status (el backend no lo valida).
  const guard = app.slice(app.indexOf('function M6CajaRoute'), app.indexOf('function ScreenCajaConciliacionM6Mount'))
  assert.ok(!guard.includes('readAuthoritativeTowerStatus'),
    'el guard de M6 no acepta tower_status: el backend sólo valida job key')
})

test('navModel: el dispatch inline sigue el patrón de main (no un resolver nuevo)', () => {
  const nav = read('../src/lib/navModel.js')
  assert.ok(nav.includes("if (module.accessPolicy === 'm6') return readM6Access(session).level === 'global'"))
  assert.ok(nav.includes("if (module?.accessPolicy === 'm6')"))
  // main NO tiene el mapa ACCESS_POLICY_RESOLVERS (lo introduce M3 (#71), que
  // sigue DRAFT): M6 no lo inventa ni crea un segundo resolver. Se prohíbe la
  // DEFINICIÓN del mapa, no la palabra — el comentario de rebase la nombra a
  // propósito para explicar por qué no está.
  assert.ok(!/(const|let|var)\s+ACCESS_POLICY_RESOLVERS/.test(nav),
    'M6 no crea un segundo resolver: usa el dispatch inline de main')
  assert.ok(nav.includes('M6_REBASE_PLAN'), 'el rebase futuro queda documentado en el código')
  // La línea fail-closed sigue viva DESPUÉS de los dispatch conocidos.
  assert.ok(nav.includes('if (module.accessPolicy) return false'))
})
