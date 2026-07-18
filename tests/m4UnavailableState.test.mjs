// M4 — estado "sin payload / payload incompleto" renderizado de forma segura.
//
// Regresión del defecto preexistente: tras el guard `!payload`, la vista
// desreferenciaba `payload.run.*` / `payload.summary.*` sin verificar que esos
// objetos existieran. Un payload truthy pero incompleto (p. ej. el camino demo,
// que fija phase:'ok' con un fixture SIN validar, o una regresión del contrato)
// producía `TypeError: Cannot read properties of undefined` → React reintenta el
// render y el ErrorBoundary entra en loop (o congela HMR en dev).
//
// Estas pruebas renderizan el COMPONENTE REAL (no una réplica) vía SSR
// (renderToStaticMarkup + MemoryRouter), inyectando el estado de carga con la
// prop `initialLoad`. El componente nunca debe lanzar y debe mostrar copy
// honesto (sin inventar métricas ni convertir la ausencia en ceros).
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { fileURLToPath } from 'node:url'
import { loadJsxDefault } from './helpers/renderJsx.mjs'
import { isRenderableM4Payload } from '../src/modules/ventas/m4/contract.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const entry = fileURLToPath(new URL('../src/modules/ventas/ScreenVentasM4.jsx', import.meta.url))
const { Component, cleanup } = await loadJsxDefault(entry)
after(() => cleanup())

function render(initialLoad) {
  return renderToStaticMarkup(
    h(MemoryRouter, { initialEntries: ['/ventas-clientes'] },
      h(Component, { session: undefined, initialLoad })),
  )
}
const asText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// Copys honestos distintivos (subcadenas ASCII-safe presentes en el código).
const COPY_INVALID = 'no se muestra nada derivado de datos corruptos'
const COPY_UNAVAILABLE = 'Sin fuente de datos disponible'
const COPY_ERROR = 'Error de red o servidor'
// Marcas que SOLO aparecen cuando hay run/summary reales (no deben verse en no-ok).
const DATA_ONLY_MARKS = ['EVIDENCIA FORMAL', 'EVIDENCIA NO FORMAL', 'DATOS:']

// ── 1. payload undefined en fase 'ok' ───────────────────────────────────────
test('1. payload undefined en ok → estado controlado, sin crash', () => {
  let html
  assert.doesNotThrow(() => { html = render({ phase: 'ok', payload: undefined, demo: false }) })
  assert.match(asText(html), new RegExp(COPY_INVALID))
})

// ── 2. payload null en fase 'ok' ─────────────────────────────────────────────
test('2. payload null en ok → estado controlado, sin crash', () => {
  let html
  assert.doesNotThrow(() => { html = render({ phase: 'ok', payload: null, demo: false }) })
  assert.match(asText(html), new RegExp(COPY_INVALID))
})

// ── 3. backend no disponible ─────────────────────────────────────────────────
test('3. phase unavailable → copy honesto de "sin fuente", sin crash', () => {
  let html
  assert.doesNotThrow(() => { html = render({ phase: 'unavailable', errors: [] }) })
  assert.match(asText(html), new RegExp(COPY_UNAVAILABLE))
})

// ── 4. error de red / servidor ───────────────────────────────────────────────
test('4. phase error (network) → copy de error, sin crash', () => {
  let html
  assert.doesNotThrow(() => { html = render({ phase: 'error', errors: ['network'] }) })
  assert.match(asText(html), new RegExp(COPY_ERROR))
})

// ── 5. payload incompleto (el defecto real) ─────────────────────────────────
test('5. payload incompleto en ok (sin run / sin summary) → invalid, sin crash', () => {
  const sinRun = { phase: 'ok', payload: { schema_version: 'kold.os.m4.api/1', summary: {} }, demo: false }
  const sinSummary = { phase: 'ok', payload: { schema_version: 'kold.os.m4.api/1', run: { technical_state: 'PASS' } }, demo: false }
  for (const st of [sinRun, sinSummary]) {
    let html
    assert.doesNotThrow(() => { html = render(st) })
    const txt = asText(html)
    assert.match(txt, new RegExp(COPY_INVALID))
    // No debe haber renderizado nada derivado del run/summary a medias.
    for (const mark of DATA_ONLY_MARKS) assert.ok(!txt.includes(mark), `no debe mostrar "${mark}" con payload incompleto`)
  }
})

// ── 6. payload válido: el happy path sigue funcionando ──────────────────────
test('6. payload válido → render completo real, sin invalid ni crash', () => {
  let html
  assert.doesNotThrow(() => { html = render({ phase: 'ok', payload: M4_API_LATEST_FIXTURE, demo: false }) })
  const txt = asText(html)
  assert.ok(txt.includes('Ventas y clientes'), 'muestra el encabezado real')
  assert.ok(txt.includes('AUDITOR: PASS'), 'muestra el estado técnico real del run')
  assert.ok(!txt.includes(COPY_INVALID), 'un payload válido NO debe caer en invalid')
})

// ── 7. ninguna forma incompleta dispara el ErrorBoundary (no loop) ──────────
test('7. ninguna forma malformada lanza (no hay loop de ErrorBoundary)', () => {
  const malformed = [
    undefined, null, {}, { summary: {} }, { run: {} },
    { run: null, summary: {} }, { run: {}, summary: null },
    { schema_version: 'kold.os.m4.api/1' }, 'no-objeto', 42,
  ]
  for (const payload of malformed) {
    assert.doesNotThrow(
      () => render({ phase: 'ok', payload, demo: false }),
      `render no debe lanzar con payload=${JSON.stringify(payload)}`,
    )
  }
})

// ── 8. el guard decide ANTES de cualquier acceso a propiedades ──────────────
test('8. isRenderableM4Payload gatea antes de desreferenciar', () => {
  for (const bad of [undefined, null, {}, { summary: {} }, { run: {} }, { run: null, summary: {} }, { run: {}, summary: null }, 'x', 0, []]) {
    assert.equal(isRenderableM4Payload(bad), false, `debe ser false para ${JSON.stringify(bad)}`)
  }
  assert.equal(isRenderableM4Payload({ run: {}, summary: {} }), true)
  assert.equal(isRenderableM4Payload(M4_API_LATEST_FIXTURE), true)
})

// ── 9. copy honesto: sin datos inventados ni ceros fabricados ───────────────
test('9. estado no-ok no fabrica métricas ni ceros', () => {
  const txt = asText(render({ phase: 'unavailable', errors: [] }))
  assert.match(txt, new RegExp(COPY_UNAVAILABLE))
  // No debe pintar pills/datos que solo existen con run/summary reales.
  for (const mark of DATA_ONLY_MARKS) assert.ok(!txt.includes(mark), `no debe fabricar "${mark}"`)
  // No debe convertir la ausencia en un cero comercial.
  assert.ok(!/\$\s*0(?:[.,]0+)?\b/.test(txt), 'no debe mostrar montos $0 inventados')
})

// ── 10. recuperación: de un estado no-ok a uno válido (y viceversa) ─────────
test('10. recuperación entre estados: unavailable ⇄ válido sin fuga de datos', () => {
  const unavailable = asText(render({ phase: 'unavailable', errors: [] }))
  const ok = asText(render({ phase: 'ok', payload: M4_API_LATEST_FIXTURE, demo: false }))
  // Al llegar un payload válido (p. ej. tras reintento), se muestra la data real…
  assert.ok(ok.includes('AUDITOR: PASS'))
  assert.ok(!ok.includes(COPY_UNAVAILABLE))
  // …y al volver a no-ok no se arrastra la data del render anterior.
  assert.ok(unavailable.includes(COPY_UNAVAILABLE))
  assert.ok(!unavailable.includes('AUDITOR: PASS'))
})
