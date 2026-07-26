// Supervisor V2 · CONTRATO DE `/equipo` — pruebas de COMPORTAMIENTO.
//
// Ejercita el gate REAL (SupervisorV2Gate.jsx, empaquetado con esbuild y
// renderizado con react-dom/server dentro de un MemoryRouter REAL), no un scan
// de código: se monta el árbol, se observa qué experiencia queda montada y se
// cuentan los montajes de cada rama con espías. La decisión del flag se dirige
// por la sesión real que lee `getSession()` (localStorage `gf_session`).
//
// LÍMITES DECLARADOS (no se simulan aquí):
//   · El rol lo impone `ModuleRoleRoute` en App.jsx (envuelve al gate). El gate
//     NO es capa de autorización: se PRUEBA que ignora el rol a propósito.
//   · La autoridad de seguridad final es el guard + rol + flags del BACKEND.
//   · Sin jsdom/RTL en la suite ⇒ no hay click real ni back/forward del
//     navegador; se cubre montaje, redirect declarado y cambio de flag.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

const { Component: SupervisorV2Gate } = await loadJsxDefault(fileURLToPath(
  new URL('../src/modules/supervisor-ventas/v2/SupervisorV2Gate.jsx', import.meta.url),
))

// ── Sesión inyectable: el gate lee getSession() → localStorage `gf_session` ──
function setSession(value) {
  const store = new Map()
  if (value !== undefined) store.set('gf_session', JSON.stringify(value))
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}
/** Flag V2 ON = global (capabilities.supervisorV2) Y sucursal (branch.supervisor_v2_enabled). */
const SESSION_V2_ON = { capabilities: { supervisorV2: true }, branch: { supervisor_v2_enabled: true } }
const SESSION_V2_OFF = { capabilities: { supervisorV2: false }, branch: { supervisor_v2_enabled: false } }
const SESSION_FLAG_MISSING = { employee_id: 718 } // sin capabilities ni branch

// ── Espías de MONTAJE: cada rama cuenta cuántas veces se renderiza ───────────
function makeSpy(label) {
  const spy = { calls: 0 }
  spy.Component = function SpyMarker() {
    spy.calls += 1
    return createElement('div', { 'data-branch': label }, `branch:${label}`)
  }
  return spy
}

/** Monta el gate dentro de un Router real y devuelve el HTML resultante. */
function renderGate(props, { path = '/equipo' } = {}) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path, element: createElement(SupervisorV2Gate, props) }),
        // Destino del redirect fail-closed: marca observable.
        createElement(Route, { path: '/equipo', element: createElement('div', null, 'ENTRY-ROUTE') }),
      ),
    ),
  )
}

// ── 1/2/3: qué experiencia monta el gate en `/equipo` ────────────────────────
test('caso 1 · V2 ON ⇒ monta la experiencia V2 (y NO el entry legacy)', () => {
  setSession(SESSION_V2_ON)
  const v2 = makeSpy('v2')
  const legacy = makeSpy('legacy')
  const html = renderGate({
    active: 'hoy',
    legacy: createElement(legacy.Component),
    children: createElement(v2.Component),
  })
  assert.match(html, /branch:v2/)
  assert.doesNotMatch(html, /branch:legacy/)
  assert.equal(v2.calls, 1)
  assert.equal(legacy.calls, 0)
})

test('caso 2 · V2 OFF ⇒ monta ScreenSupervisorOperationsEntry (legacy), NO la V2', () => {
  setSession(SESSION_V2_OFF)
  const v2 = makeSpy('v2')
  const legacy = makeSpy('legacy')
  const html = renderGate({
    active: 'hoy',
    legacy: createElement(legacy.Component),
    children: createElement(v2.Component),
  })
  assert.match(html, /branch:legacy/)
  assert.doesNotMatch(html, /branch:v2/)
  assert.equal(legacy.calls, 1)
  assert.equal(v2.calls, 0)
})

test('caso 3 · flag ausente ⇒ fail-closed al legacy (nunca V2 por omisión)', () => {
  setSession(SESSION_FLAG_MISSING)
  const v2 = makeSpy('v2')
  const legacy = makeSpy('legacy')
  const html = renderGate({
    active: 'hoy',
    legacy: createElement(legacy.Component),
    children: createElement(v2.Component),
  })
  assert.match(html, /branch:legacy/)
  assert.equal(v2.calls, 0)
})

test('caso 3b · flag PARCIAL (global ON, sucursal OFF) ⇒ fail-closed al legacy', () => {
  setSession({ capabilities: { supervisorV2: true }, branch: { supervisor_v2_enabled: false } })
  const v2 = makeSpy('v2')
  const legacy = makeSpy('legacy')
  renderGate({ active: 'hoy', legacy: createElement(legacy.Component), children: createElement(v2.Component) })
  assert.equal(v2.calls, 0)
  assert.equal(legacy.calls, 1)
})

// ── 4: nunca las dos ─────────────────────────────────────────────────────────
test('caso 4 · exactamente UNA experiencia montada en cada estado del flag', () => {
  for (const session of [SESSION_V2_ON, SESSION_V2_OFF, SESSION_FLAG_MISSING]) {
    setSession(session)
    const v2 = makeSpy('v2')
    const legacy = makeSpy('legacy')
    const html = renderGate({
      active: 'hoy',
      legacy: createElement(legacy.Component),
      children: createElement(v2.Component),
    })
    assert.equal(v2.calls + legacy.calls, 1, 'ni doble render ni cero render')
    const marks = html.match(/branch:(v2|legacy)/g) || []
    assert.equal(marks.length, 1)
  }
})

// ── 5/6: cero EFECTOS de la rama no elegida ─────────────────────────────────
// El montaje es la condición para que haya efectos: si la rama no se monta, sus
// loaders no corren. NO se asevera "cero fetch a URLs /v2/*": ese prefijo es la
// versión del CONTRATO de API, no una marca de superficie V2 (ver allowlist).
test('caso 5 · V2 OFF ⇒ CERO efectos de la rama V2 (no se monta ⇒ no corre su loader)', () => {
  setSession(SESSION_V2_OFF)
  let v2Effects = 0
  const V2WithEffect = () => { v2Effects += 1; return createElement('div', null, 'v2') }
  const legacy = makeSpy('legacy')
  renderGate({ active: 'hoy', legacy: createElement(legacy.Component), children: createElement(V2WithEffect) })
  assert.equal(v2Effects, 0, 'la rama V2 no debe ejecutarse con el flag OFF')
})

test('caso 6 · V2 ON ⇒ CERO efectos de la rama legacy (no se monta ⇒ no corre su loader)', () => {
  setSession(SESSION_V2_ON)
  let legacyEffects = 0
  const LegacyWithEffect = () => { legacyEffects += 1; return createElement('div', null, 'legacy') }
  const v2 = makeSpy('v2')
  renderGate({ active: 'hoy', legacy: createElement(LegacyWithEffect), children: createElement(v2.Component) })
  assert.equal(legacyEffects, 0, 'el entry legacy no debe ejecutarse con el flag ON')
})

// ── ALLOWLIST de APIs compartidas del fallback legacy ────────────────────────
// Declarada por FUNCIÓN IMPORTADA (no por string de URL): con V2 OFF, el árbol
// legacy solo puede alcanzar estas lecturas seguras y compartidas. Cualquier
// import de escritura o de superficie V2 dentro de ese árbol rompe el test.
const SHARED_READ_ALLOWLIST = Object.freeze({
  // day-control read-only: MISMA fuente de verdad que V2 (no se duplica).
  sharedDayControlRead: ['requestSupervisorDayControl', 'loadSupervisorOperationDays', 'loadDayControlState'],
  // resúmenes legacy del hub comercial (lecturas propias de la experiencia legacy).
  legacyExperienceRead: ['getDayOverview', 'getYesterdaySummary'],
})
const V2_ONLY_SURFACE = Object.freeze([
  'SupervisorV2Shell', 'HoyTab', 'RadarTab', 'RutasTab', 'PendientesTab', 'MasTab',
  'useOperationalDay', 'SupervisorV2Gate',
])
const WRITE_FUNCTIONS = Object.freeze([
  'updateForecastLines', 'confirmForecast', 'cancelForecast', 'deleteForecast',
  'addCustomerToRoutePlan', 'removeCustomerFromRoutePlan', 'publishRoutePlan',
  'saveRoutePlanDraft', 'ensureDailyRoutePlan',
])

const readSrc = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')
const LEGACY_TREE = [
  'modules/supervisor-ventas/ScreenSupervisorOperationsEntry.jsx',
  'modules/supervisor-ventas/dayControl/controller.js',
  'modules/supervisor-ventas/dayControl/api.js',
  'modules/supervisor-ventas/dayControl/state.js',
  'modules/supervisor-ventas/ScreenSupervisorToday.jsx',
]

test('legacy: el árbol real del fallback NO importa superficie exclusiva de V2', () => {
  for (const rel of LEGACY_TREE) {
    const src = readSrc(rel)
    for (const symbol of V2_ONLY_SURFACE) {
      assert.equal(
        new RegExp(`import[^\\n]*\\b${symbol}\\b`).test(src), false,
        `${rel} no debe importar ${symbol} (superficie V2)`,
      )
    }
  }
})

test('legacy: el árbol real del fallback NO importa NINGUNA función de escritura', () => {
  for (const rel of LEGACY_TREE) {
    const src = readSrc(rel)
    for (const fn of WRITE_FUNCTIONS) {
      assert.equal(src.includes(fn), false, `${rel} no debe alcanzar el write ${fn}`)
    }
  }
})

test('legacy: su única API de datos es la lectura COMPARTIDA de day-control', () => {
  // Efecto real: el entry ejecuta `loadSupervisorOperationDays`, que desemboca en
  // `requestSupervisorDayControl` — un POST de LECTURA al contrato compartido.
  const entry = readSrc('modules/supervisor-ventas/ScreenSupervisorOperationsEntry.jsx')
  assert.match(entry, /loadSupervisorOperationDays/)
  assert.ok(SHARED_READ_ALLOWLIST.sharedDayControlRead.includes('loadSupervisorOperationDays'))

  const api = readSrc('modules/supervisor-ventas/dayControl/api.js')
  // Read-only: expone UNA operación y no escribe.
  assert.match(api, /export function requestSupervisorDayControl/)
  assert.equal(/update|create|delete|confirm|cancel|publish/i.test(api), false,
    'el datasource compartido no debe exponer escrituras')
})

test('legacy: NO existe un datasource duplicado de day-control', () => {
  // El fallback reutiliza el módulo compartido; no hay una segunda copia de las
  // reglas ni una segunda fuente de verdad.
  const controller = readSrc('modules/supervisor-ventas/dayControl/controller.js')
  assert.match(controller, /from '\.\/state\.js'/)
  const api = readSrc('modules/supervisor-ventas/dayControl/api.js')
  assert.equal((api.match(/export const SUPERVISOR_DAY_CONTROL_PATH/g) || []).length, 1)
})

// ── 7/8: `/equipo/hoy` como CAPACIDAD V2 ─────────────────────────────────────
test('caso 7 · /equipo/hoy con V2 OFF ⇒ redirect a /equipo (no monta la home)', () => {
  setSession(SESSION_V2_OFF)
  const hoy = makeSpy('hoy')
  const html = renderGate(
    { active: 'hoy', v2Only: true, shell: false, children: createElement(hoy.Component) },
    { path: '/equipo/hoy' },
  )
  assert.equal(hoy.calls, 0, 'la home no se monta con V2 OFF')
  assert.doesNotMatch(html, /branch:hoy/)
})

test('caso 8 · /equipo/hoy con V2 ON ⇒ monta la home SIN anidar el shell V2', () => {
  setSession(SESSION_V2_ON)
  const hoy = makeSpy('hoy')
  const html = renderGate(
    { active: 'hoy', v2Only: true, shell: false, children: createElement(hoy.Component) },
    { path: '/equipo/hoy' },
  )
  assert.equal(hoy.calls, 1)
  assert.match(html, /branch:hoy/)
  // shell={false} ⇒ el árbol es SOLO la pantalla; sin la navegación del shell V2.
  assert.doesNotMatch(html, /supervisor-v2-shell/)
})

// ── 9/10: fronteras de autoridad ─────────────────────────────────────────────
test('caso 9 · el gate NO es autorización: decide experiencia, no permiso', () => {
  // Con V2 ON monta la experiencia V2 aunque la sesión no traiga rol alguno: el
  // rol lo impone ModuleRoleRoute (fuera del gate) y el backend es la autoridad.
  setSession({ ...SESSION_V2_ON, role: undefined })
  const v2 = makeSpy('v2')
  renderGate({ active: 'hoy', legacy: createElement('div'), children: createElement(v2.Component) })
  assert.equal(v2.calls, 1, 'el gate no filtra por rol (no es su responsabilidad)')
})

test('caso 10 · sesión ausente/corrupta ⇒ fail-closed al legacy, sin lanzar', () => {
  // Sin `gf_session` en absoluto.
  setSession(undefined)
  const v2 = makeSpy('v2')
  const legacy = makeSpy('legacy')
  assert.doesNotThrow(() => renderGate({
    active: 'hoy', legacy: createElement(legacy.Component), children: createElement(v2.Component),
  }))
  assert.equal(v2.calls, 0)
  assert.equal(legacy.calls, 1)

  // localStorage con JSON inválido ⇒ misma decisión segura.
  globalThis.localStorage = { getItem: () => '{{{no-json', setItem: () => {}, removeItem: () => {} }
  const v2b = makeSpy('v2')
  const legacyB = makeSpy('legacy')
  renderGate({ active: 'hoy', legacy: createElement(legacyB.Component), children: createElement(v2b.Component) })
  assert.equal(v2b.calls, 0)
  assert.equal(legacyB.calls, 1)
})

// ── Cambio de flag en caliente (misma sesión, distinto estado) ───────────────
test('cambio de flag ⇒ el gate cambia de experiencia (sin quedar pegado)', () => {
  setSession(SESSION_V2_OFF)
  const a = makeSpy('legacy')
  const b = makeSpy('v2')
  renderGate({ active: 'hoy', legacy: createElement(a.Component), children: createElement(b.Component) })
  assert.equal(a.calls, 1)
  setSession(SESSION_V2_ON)
  renderGate({ active: 'hoy', legacy: createElement(a.Component), children: createElement(b.Component) })
  assert.equal(b.calls, 1, 'tras encender el flag monta la V2')
  assert.equal(a.calls, 1, 'el legacy no se volvió a montar')
})
