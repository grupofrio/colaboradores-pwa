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

// ── 5/6: sin fetch cruzado (el montaje ES la condición para que haya fetch) ──
test('caso 5 · V2 OFF ⇒ CERO trabajo de la rama V2 (no se monta ⇒ no fetch V2)', () => {
  setSession(SESSION_V2_OFF)
  let v2Fetches = 0
  const V2WithFetch = () => { v2Fetches += 1; return createElement('div', null, 'v2') }
  const legacy = makeSpy('legacy')
  renderGate({ active: 'hoy', legacy: createElement(legacy.Component), children: createElement(V2WithFetch) })
  assert.equal(v2Fetches, 0, 'la rama V2 no debe ejecutarse con el flag OFF')
})

test('caso 6 · V2 ON ⇒ CERO trabajo de la rama legacy (no se monta ⇒ no fetch legacy)', () => {
  setSession(SESSION_V2_ON)
  let legacyFetches = 0
  const LegacyWithFetch = () => { legacyFetches += 1; return createElement('div', null, 'legacy') }
  const v2 = makeSpy('v2')
  renderGate({ active: 'hoy', legacy: createElement(LegacyWithFetch), children: createElement(v2.Component) })
  assert.equal(legacyFetches, 0, 'el entry legacy no debe ejecutarse con el flag ON')
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
