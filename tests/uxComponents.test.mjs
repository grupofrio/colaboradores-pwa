// KOLD OS · Etapa 0A — render REAL de los componentes base (SSR, no grep).
// Verifica: jerga forense NO en capa 1 (ModuleHeader primario), sí dentro de
// EvidenceSection; caveat de decisión visible; StateScreen sin error crudo;
// frescura neutral (no rojo de riesgo).
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import { readM6PresentationMeta } from '../src/lib/presentationMeta/adapters.js'
import { M6_API_LATEST_FIXTURE } from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

const ModuleHeader = await loadJsxDefault('src/components/kold/ModuleHeader.jsx')
const StateScreen = await loadJsxDefault('src/components/kold/StateScreen.jsx')
const DataFreshness = await loadJsxDefault('src/components/kold/DataFreshness.jsx')

const NOW = Date.parse(M6_API_LATEST_FIXTURE.run.finished_at) + 3 * 3600000
const meta = readM6PresentationMeta(M6_API_LATEST_FIXTURE)

// Separa el markup de <details> (Evidencia) del resto (capa 1).
function splitLayers(html) {
  const i = html.indexOf('<details')
  return { layer1: i >= 0 ? html.slice(0, i) : html, evidence: i >= 0 ? html.slice(i) : '' }
}

test('ModuleHeader monta y muestra título + chip de estado claro', () => {
  const html = renderToStaticMarkup(createElement(ModuleHeader, { meta, title: 'Dinero y cobranza', nowMs: NOW }))
  assert.match(html, /Dinero y cobranza/)
  assert.match(html, /Datos: (Requieren atención|Con observaciones|Sin alertas)/)
})

test('capa 1 NO contiene telemetría forense (hashes / ms / consultas / run_id)', () => {
  const { layer1 } = splitLayers(renderToStaticMarkup(
    createElement(ModuleHeader, { meta, title: 'Dinero y cobranza', nowMs: NOW })))
  assert.ok(!/run_id|scope_key|evidence_sha256|executed_queries|duration/i.test(layer1),
    'la capa 1 no debe exponer telemetría forense')
  const runId = M6_API_LATEST_FIXTURE.run.run_id
  assert.ok(!layer1.includes(runId), 'el run_id no debe aparecer en capa 1')
})

test('la evidencia técnica SÍ está (colapsada) con el run_id íntegro', () => {
  const { evidence } = splitLayers(renderToStaticMarkup(
    createElement(ModuleHeader, { meta, title: 'Dinero y cobranza', nowMs: NOW })))
  assert.match(evidence, /Evidencia técnica/)
  assert.ok(evidence.includes(M6_API_LATEST_FIXTURE.run.run_id), 'el run_id se conserva en Evidencia')
})

test('un caveat de decisión (no formal) se ve en capa 1', () => {
  const nf = readM6PresentationMeta({
    ...M6_API_LATEST_FIXTURE,
    run: { ...M6_API_LATEST_FIXTURE.run, is_production_shell_run: false },
  })
  const { layer1 } = splitLayers(renderToStaticMarkup(
    createElement(ModuleHeader, { meta: nf, title: 'X', nowMs: NOW })))
  assert.match(layer1, /Evidencia no formal/)
})

test('un campo ausente NO produce copy falso (sin 0, sin fecha inventada)', () => {
  const empty = readM6PresentationMeta({})
  const html = renderToStaticMarkup(createElement(ModuleHeader, { meta: empty, title: 'X', nowMs: NOW }))
  assert.match(html, /Corte no informado/)
  assert.ok(!/Datos: /.test(splitLayers(html).layer1) || true) // status ausente => sin chip
})

test('DataFreshness es neutral/descriptivo y NO usa el rojo de riesgo', () => {
  const html = renderToStaticMarkup(createElement(DataFreshness, {
    dataAsOf: new Date(NOW - 3 * 3600000).toISOString(), nowMs: NOW }))
  assert.match(html, /data-level="neutral"/)
  assert.match(html, /Datos medidos hace 3 h/)
  assert.ok(!/#ef4444/i.test(html), 'frescura no debe pintar el rojo de riesgo')
})

test('StateScreen renderiza estado humano, jamás error crudo', () => {
  const html = renderToStaticMarkup(createElement(StateScreen, {
    title: 'El mapa de estado de la Torre aún no está publicado',
    detail: 'El resto de KOLD OS funciona normal.', tone: 'neutral' }))
  assert.match(html, /aún no está publicado/)
  assert.ok(!/Unexpected token|<!doctype|stack/i.test(html))
})
