// M4 — un envelope no renderizable cae a `invalid` ANTES de cualquier dereference.
//
// Contexto (RED de Codex sobre PR #79): `{ run:{}, summary:{} }` pasaba el guard v1
// pero el render hace `payload.rule_results.filter(...)` (y en demo `applyFindingFilters
// (payload.findings)`), y `typeof [] === 'object'` dejaba pasar arrays. El guard v2 exige
// exactamente los campos que la pantalla desreferencia sin protección propia
// (run/summary records planos; rule_results arreglo no vacío; findings arreglo), y el
// camino demo se valida/canonicaliza con la MISMA autoridad que /latest.
//
// LÍMITE REAL DE SSR: `renderToStaticMarkup` demuestra "render sin throw" con un estado
// inicial dado. NO ejecuta useEffect ni monta un ErrorBoundary, así que por sí solo NO
// prueba la ausencia de loop de ErrorBoundary en el navegador ni el disparo de efectos.
// El seguro real es doble: (1) el guard evita el throw en el render; (2) ambos caminos de
// entrada (fetchM4Latest / resolveM4DemoLatest) validan el contrato antes de `phase:'ok'`.
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { fileURLToPath } from 'node:url'
import { loadJsxDefault } from './helpers/renderJsx.mjs'
import { isRenderableM4Payload, isPlainRecord, canonicalizeM4Latest } from '../src/modules/ventas/m4/contract.js'
import { resolveM4DemoLatest } from '../src/modules/ventas/m4/m4Api.js'
import { M4_API_LATEST_FIXTURE, M4_API_FIXTURE_PROVENANCE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const entry = fileURLToPath(new URL('../src/modules/ventas/ScreenVentasM4.jsx', import.meta.url))
const { Component, cleanup } = await loadJsxDefault(entry)
after(() => cleanup())

const CANON = canonicalizeM4Latest(M4_API_LATEST_FIXTURE) // payload real canonicalizado

const render = (initialLoadForTesting) => renderToStaticMarkup(
  h(MemoryRouter, { initialEntries: ['/ventas-clientes'] },
    h(Component, { session: undefined, initialLoadForTesting })))
const asText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const renderOk = (payload, extra = {}) => render({ phase: 'ok', payload, demo: false, ...extra })

// Copys distintivos (subcadenas ASCII-safe presentes en el código).
const COPY_INVALID_TITLE = 'de la fuente de datos'        // "Respuesta inválida de la fuente de datos"
const COPY_INVALID_BODY = 'no se inventan'                // "…no se inventan métricas."
const COPY_UNAVAILABLE = 'Sin fuente de datos disponible'
// Marcas que SOLO aparecen con run/summary reales (no deben verse en estados no-ok).
const DATA_ONLY_MARKS = ['EVIDENCIA FORMAL', 'EVIDENCIA NO FORMAL', 'DATOS:']

// Formas malformadas que el guard debe rechazar (→ invalid, sin tocar sus campos).
const MALFORMED = {
  'payload []': [],
  'payload null': null,
  'payload undefined': undefined,
  'run []': { run: [], summary: {}, rule_results: [{}], findings: [] },
  'summary []': { run: {}, summary: [], rule_results: [{}], findings: [] },
  'sin rule_results': { run: {}, summary: {}, findings: [] },
  'rule_results null': { run: {}, summary: {}, rule_results: null, findings: [] },
  'rule_results {}': { run: {}, summary: {}, rule_results: {}, findings: [] },
  'rule_results [] (vacío)': { run: {}, summary: {}, rule_results: [], findings: [] },
  'findings null': { run: {}, summary: {}, rule_results: [{}], findings: null },
  'findings {}': { run: {}, summary: {}, rule_results: [{}], findings: {} },
}

// ── GUARD PURO — gatea ANTES de cualquier dereference (Codex 3, 8) ───────────
test('isRenderableM4Payload rechaza null/undefined/arrays y shapes incompletos', () => {
  for (const [name, p] of Object.entries(MALFORMED)) {
    assert.equal(isRenderableM4Payload(p), false, `debe rechazar: ${name}`)
  }
  // acepta: mínimo tipado correcto y el payload real canonicalizado
  assert.equal(isRenderableM4Payload({ run: {}, summary: {}, rule_results: [{}], findings: [] }), true)
  assert.equal(isRenderableM4Payload(CANON), true)
})

test('isPlainRecord distingue records de arrays/null', () => {
  assert.equal(isPlainRecord({}), true)
  assert.equal(isPlainRecord([]), false)
  assert.equal(isPlainRecord(null), false)
  assert.equal(isPlainRecord(undefined), false)
  assert.equal(isPlainRecord('x'), false)
})

// ── AUTORIDAD CONTRACTUAL DEL DEMO (Codex 2, casos 8/11/13) ──────────────────
test('resolveM4DemoLatest: fixture malformado NO entra a ok', () => {
  const prov = M4_API_FIXTURE_PROVENANCE
  assert.equal(resolveM4DemoLatest({ payload: { schema_version: 'kold.os.m4.api/1', summary: {} }, provenance: prov }).state, 'invalid')
  // demo "sin findings": el contrato exige findings ⇒ no valida ⇒ no ok
  const { findings, ...sinFindings } = M4_API_LATEST_FIXTURE
  assert.notEqual(resolveM4DemoLatest({ payload: sinFindings, provenance: prov }).state, 'ok')
  assert.equal(resolveM4DemoLatest({ payload: M4_API_LATEST_FIXTURE }).state, 'unavailable') // sin provenance
})

test('resolveM4DemoLatest: fixture válido entra a ok canonicalizado y renderizable', () => {
  const r = resolveM4DemoLatest({ payload: M4_API_LATEST_FIXTURE, provenance: M4_API_FIXTURE_PROVENANCE })
  assert.equal(r.state, 'ok')
  assert.equal(isRenderableM4Payload(r.payload), true)
})

// ── COMPONENTE REAL (SSR) — ningún caso lanza; malformado → invalid (Codex 4,16) ─
test('ningún estado (malformado, no-ok, válido) lanza en SSR', () => {
  for (const [name, payload] of Object.entries(MALFORMED)) {
    assert.doesNotThrow(() => renderOk(payload), `render no debe lanzar: ${name}`)
  }
  for (const phase of ['unavailable', 'error', 'disabled', 'forbidden', 'session_expired', 'schema_mismatch', 'invalid']) {
    assert.doesNotThrow(() => render({ phase, errors: [] }), `render no debe lanzar: phase=${phase}`)
  }
  assert.doesNotThrow(() => render(undefined), 'loading (sin seed) no debe lanzar')
  assert.doesNotThrow(() => renderOk(CANON), 'payload válido no debe lanzar')
})

test('todo payload ok malformado cae a copy neutral de invalid (Codex 14)', () => {
  for (const [name, payload] of Object.entries(MALFORMED)) {
    const txt = asText(renderOk(payload))
    assert.ok(txt.includes(COPY_INVALID_TITLE), `${name}: título neutral`)
    assert.ok(txt.includes(COPY_INVALID_BODY), `${name}: cuerpo honesto`)
    assert.ok(!txt.includes('datos corruptos'), `${name}: sin afirmar corrupción`)
    for (const mark of DATA_ONLY_MARKS) assert.ok(!txt.includes(mark), `${name}: sin "${mark}"`)
  }
})

test('estados no-ok no fabrican métricas ni $0 (Codex 15)', () => {
  for (const phase of ['unavailable', 'error', 'invalid']) {
    const txt = asText(render({ phase, errors: [] }))
    for (const mark of DATA_ONLY_MARKS) assert.ok(!txt.includes(mark), `phase=${phase}: sin "${mark}"`)
    assert.ok(!/\$\s*0(?:[.,]0+)?\b/.test(txt), `phase=${phase}: sin $0 inventado`)
  }
  assert.ok(asText(render({ phase: 'unavailable', errors: [] })).includes(COPY_UNAVAILABLE))
})

// ── HAPPY PATH real + demo válido (Codex 6/12/13) ────────────────────────────
test('payload válido real renderiza el observatorio completo (Codex 12)', () => {
  const txt = asText(renderOk(CANON))
  assert.ok(txt.includes('Ventas y clientes'), 'encabezado real')
  assert.ok(txt.includes('AUDITOR: PASS'), 'estado técnico real del run')
  assert.ok(!txt.includes(COPY_INVALID_TITLE), 'un payload válido NO cae a invalid')
})

test('demo válido renderiza y muestra el banner DEMO (Codex 13)', () => {
  const txt = asText(renderOk(CANON, { demo: true, provenance: M4_API_FIXTURE_PROVENANCE }))
  assert.ok(txt.includes('Ventas y clientes'))
  assert.ok(txt.includes('MODO DEMO'), 'marca el modo demo honestamente')
  assert.ok(!txt.includes(COPY_INVALID_TITLE))
})

// ── RECUPERACIÓN entre estados sin fuga de datos ─────────────────────────────
test('recuperación unavailable ⇄ válido sin arrastrar datos', () => {
  const unavailable = asText(render({ phase: 'unavailable', errors: [] }))
  const ok = asText(renderOk(CANON))
  assert.ok(ok.includes('AUDITOR: PASS') && !ok.includes(COPY_UNAVAILABLE))
  assert.ok(unavailable.includes(COPY_UNAVAILABLE) && !unavailable.includes('AUDITOR: PASS'))
})
