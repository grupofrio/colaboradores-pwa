// Supervisor V2 · Integridad de ejecución.
// (a) modelo puro ejecutado de verdad; (b) cableado de fuente y ruta.
//
// Lo que estos casos protegen es UNA regla: los dos porcentajes se leen juntos.
// Si alguien pinta "verificadas" solo, la pantalla vuelve a premiar al que deja
// de generar evidencia — que es el incentivo perverso que el backend evita.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import {
  unwrapIntegrity, unavailableReason, integrityRows, pctLabel, toneKey, toneWord,
  evidenceCaption, blindWarning, blindReasons, thresholdsCaption, periodCaption,
} from '../src/modules/supervisor-ventas/v2/equipo/integridadModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// La vista PURA se renderiza de verdad (SSR). Los tests que importan son los que
// miran el HTML resultante, no los que describen el código.
const IntegridadView = (await loadJsxDefault(
  fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/equipo/IntegridadView.jsx', import.meta.url)),
)).Component
const renderView = (props) => renderToStaticMarkup(createElement(IntegridadView, props))

/** Aísla la tarjeta de UN vendedor. Cortar por índice de texto no sirve: el
 *  `<article data-tone=…>` del siguiente abre antes de que aparezca su nombre. */
const cardFor = (html, name) => {
  const card = html.split('<article').find((chunk) => chunk.includes(name))
  assert.ok(card, `no se renderizó la tarjeta de ${name}`)
  return card
}

// ── (a) modelo puro ──────────────────────────────────────────────────────────

test('unwrapIntegrity: acepta payload directo o dentro de .data, rechaza el resto', () => {
  const payload = { available: true, sellers: [] }
  assert.deepEqual(unwrapIntegrity(payload), payload)
  assert.deepEqual(unwrapIntegrity({ ok: true, data: payload }), payload)
  assert.equal(unwrapIntegrity(null), null)
  assert.equal(unwrapIntegrity({ ok: true }), null, 'sin available no es un payload de integridad')
  assert.equal(unwrapIntegrity({ data: { sellers: [] } }), null, 'available es obligatorio')
})

test('unavailableReason: available:false declara el MOTIVO, no una lista vacía', () => {
  assert.equal(unavailableReason({ available: false, reason: 'sin_fuente_de_paradas' }),
    'sin_fuente_de_paradas')
  assert.equal(unavailableReason({ available: false }), 'no_disponible',
    'sin reason declarada, tampoco se finge disponibilidad')
  assert.equal(unavailableReason({ available: true, sellers: [] }), null)
})

test('pctLabel: null NO es 0% — sin base no hay porcentaje', () => {
  assert.equal(pctLabel(null), '—')
  assert.equal(pctLabel(undefined), '—')
  assert.equal(pctLabel(''), '—')
  assert.equal(pctLabel(0), '0%', 'un cero REAL sí se pinta')
  assert.equal(pctLabel(87.5), '87.5%')
})

test('integrityRows: respeta el orden del servidor (no reordena por banderas)', () => {
  // Orden del backend: primero la ceguera, luego lo peor verificado. Reordenar
  // por "más banderas" escondería a quien no deja rastro, que es lo grave.
  const sellers = [
    { seller_id: 1, tone: 'sin_evidencia', a_revisar: 0 },
    { seller_id: 2, tone: 'bad', a_revisar: 9 },
    { seller_id: 3, tone: 'ok', a_revisar: 1 },
  ]
  assert.deepEqual(integrityRows({ sellers }).map((r) => r.seller_id), [1, 2, 3])
  assert.deepEqual(integrityRows({}), [])
  assert.deepEqual(integrityRows(null), [])
})

test('toneKey/toneWord: el veredicto viene del servidor; sin_evidencia es su propio estado', () => {
  assert.equal(toneKey({ tone: 'ok' }), 'ok')
  assert.equal(toneKey({ tone: 'sin_evidencia' }), 'blind')
  assert.notEqual(toneKey({ tone: 'sin_evidencia' }), 'ok', 'ceguera nunca es aprobado')
  assert.notEqual(toneKey({ tone: 'sin_evidencia' }), 'bad', 'tampoco es una acusación')
  assert.equal(toneKey({}), 'none')
  assert.equal(toneWord({ tone_word: 'Confiable' }), 'Confiable')
  assert.equal(toneWord({}), 'Sin visitas', 'sin palabra del servidor no se inventa un veredicto')
})

test('blindWarning: un 100% sobre poca evidencia se declara, no se aplaude', () => {
  // Caso real que motivó todo: 3 de 40 visitas con rastro, todas correctas.
  const cegado = { tone: 'sin_evidencia', visitas: 40, evaluables: 3, pct_verificadas: 100, pct_con_evidencia: 7.5 }
  const aviso = blindWarning(cegado)
  assert.ok(aviso && aviso.length > 0, 'con evidencia escasa hay aviso explícito')
  assert.match(aviso, /no representa la ruta/)
  assert.equal(blindWarning({ tone: 'ok', pct_verificadas: 100 }), null,
    'con evidencia suficiente no se estorba con avisos')
})

test('evidenceCaption: ancla el porcentaje a su base real', () => {
  assert.equal(evidenceCaption({ visitas: 40, evaluables: 3 }),
    '3 de 40 visitas terminadas dejaron rastro suficiente para juzgarlas.')
  assert.match(evidenceCaption({ visitas: 0, evaluables: 0 }), /Sin visitas terminadas/)
})

test('blindReasons: solo los motivos con conteo, de mayor a menor', () => {
  const rows = blindReasons({ motivos_no_verificable: { sin_identidad: 2, sin_checkin: 7, sin_duracion: 0 } })
  assert.deepEqual(rows.map((r) => r.key), ['sin_checkin', 'sin_identidad'],
    'los ceros no ocupan espacio y el mayor va primero')
  assert.equal(rows[0].count, 7)
  assert.match(rows[0].label, /check-in/)
  assert.deepEqual(blindReasons({}), [])
  assert.deepEqual(blindReasons(null), [])
})

test('thresholdsCaption: los umbrales se LEEN del servidor, no se hardcodean', () => {
  const txt = thresholdsCaption({ thresholds: { max_checkin_distance_m: 300, min_visit_duration_min: 1 } })
  assert.match(txt, /300 m/)
  assert.match(txt, /1 minuto/)
  // Si dirección mueve el umbral, la pantalla lo sigue sola.
  assert.match(thresholdsCaption({ thresholds: { max_checkin_distance_m: 150, min_visit_duration_min: 3 } }), /150 m/)
  assert.equal(thresholdsCaption({}), null, 'sin umbrales declarados no se inventa la definición')
})

test('periodCaption: rango del servidor, y un solo día se dice como día', () => {
  assert.equal(periodCaption({ period: { date_from: '2026-08-03', date_to: '2026-08-09' } }),
    'Del 2026-08-03 al 2026-08-09')
  assert.equal(periodCaption({ period: { date_from: '2026-08-07', date_to: '2026-08-07' } }), 'Día 2026-08-07')
  assert.equal(periodCaption({}), null)
})

// ── (b) la vista RENDERIZADA (no escaneo de fuente) ──────────────────────────

const PAYLOAD_CEGADO = {
  available: true,
  period: { date_from: '2026-08-03', date_to: '2026-08-09' },
  thresholds: { max_checkin_distance_m: 300, min_visit_duration_min: 1 },
  total: { visitas: 40, verificadas: 3, a_revisar: 0, no_verificables: 37, evaluables: 3,
    pct_verificadas: 100, pct_con_evidencia: 7.5,
    motivos_no_verificable: { sin_identidad: 0, sin_checkin: 30, sin_duracion: 7 } },
  sellers: [
    // El caso peligroso: 100% verificadas sobre casi nada de evidencia.
    { seller_id: 7, seller_name: 'VENDEDOR CIEGO', tone: 'sin_evidencia', tone_word: 'Sin evidencia suficiente',
      visitas: 40, verificadas: 3, a_revisar: 0, no_verificables: 37, evaluables: 3,
      pct_verificadas: 100, pct_con_evidencia: 7.5,
      motivos_no_verificable: { sin_identidad: 0, sin_checkin: 30, sin_duracion: 7 } },
    { seller_id: 8, seller_name: 'VENDEDOR SANO', tone: 'ok', tone_word: 'Confiable',
      visitas: 20, verificadas: 19, a_revisar: 1, no_verificables: 0, evaluables: 20,
      pct_verificadas: 95, pct_con_evidencia: 100,
      motivos_no_verificable: { sin_identidad: 0, sin_checkin: 0, sin_duracion: 0 } },
  ],
}

test('render: un 100% sobre poca evidencia NO se pinta como bueno', () => {
  const card = cardFor(renderView({ payload: PAYLOAD_CEGADO }), 'VENDEDOR CIEGO')
  assert.match(card, /data-tone="blind"/, 'la ceguera tiene su propio tono, ni ok ni bad')
  assert.ok(!card.includes('data-tone="ok"'), 'jamás verde con 3 de 40 visitas')
  assert.match(card, /Sin evidencia suficiente/, 'el veredicto va en PALABRA, no solo en color')
  assert.match(card, /data-testid="ie-blind-warning"/, 'y con aviso explícito')
  assert.match(card, /no representa la ruta/)
})

test('render: el 100% aparece SIEMPRE junto a su cobertura de evidencia', () => {
  const card = cardFor(renderView({ payload: PAYLOAD_CEGADO }), 'VENDEDOR CIEGO')
  assert.match(card, /100%/, 'se muestra la calidad de lo evaluable')
  assert.match(card, /7\.5%/, 'y en la misma tarjeta, cuánto del trabajo dejó rastro')
  assert.match(card, /3 de 40 visitas/, 'con la base escrita en palabras')
})

test('render: los motivos de ceguera son accionables (qué pedirle al vendedor)', () => {
  const html = renderView({ payload: PAYLOAD_CEGADO })
  assert.match(html, /data-reason="sin_checkin"/)
  assert.match(html, /30 sin check-in/, 'el motivo mayor va primero y con su conteo')
  assert.ok(!html.includes('data-reason="sin_identidad"'), 'los motivos en cero no ocupan espacio')
})

test('render: el vendedor con evidencia completa sí obtiene su verde', () => {
  const card = cardFor(renderView({ payload: PAYLOAD_CEGADO }), 'VENDEDOR SANO')
  assert.match(card, /data-tone="ok"/)
  assert.match(card, /Confiable/)
  assert.ok(!card.includes('data-testid="ie-blind-warning"'), 'sin ceguera no se estorba con avisos')
})

test('render: el orden en pantalla es el del servidor (ceguera primero)', () => {
  const html = renderView({ payload: PAYLOAD_CEGADO })
  assert.ok(html.indexOf('VENDEDOR CIEGO') < html.indexOf('VENDEDOR SANO'),
    'quien no deja rastro encabeza; ordenar por banderas lo escondería')
})

test('render: un porcentaje nulo se pinta "—", nunca 0%', () => {
  const html = renderView({
    payload: {
      available: true,
      total: { visitas: 0, evaluables: 0, verificadas: 0, a_revisar: 0, no_verificables: 0,
        pct_verificadas: null, pct_con_evidencia: null },
      sellers: [{ seller_id: 1, seller_name: 'SIN VISITAS', tone: 'none', tone_word: 'Sin visitas',
        visitas: 0, evaluables: 0, verificadas: 0, a_revisar: 0, no_verificables: 0,
        pct_verificadas: null, pct_con_evidencia: null, motivos_no_verificable: {} }],
    },
  })
  const metrics = [...html.matchAll(/data-metric="VERIFICADAS"[^>]*>([^<]*)</g)].map((m) => m[1])
  assert.ok(metrics.length > 0)
  for (const v of metrics) assert.equal(v, '—', 'sin base no hay porcentaje: "—", no "0%"')
})

test('render: los umbrales mostrados son los que declaró el servidor', () => {
  const html = renderView({
    payload: { ...PAYLOAD_CEGADO, thresholds: { max_checkin_distance_m: 150, min_visit_duration_min: 3 } },
  })
  assert.match(html, /150 m/)
  assert.match(html, /3 minuto/)
  assert.ok(!html.includes('300 m'), 'no queda ningún umbral hardcodeado en la vista')
})

test('la vista no recalcula el semáforo en el cliente', () => {
  const view = src('modules/supervisor-ventas/v2/equipo/IntegridadView.jsx')
  const model = src('modules/supervisor-ventas/v2/equipo/integridadModel.js')
  // Los umbrales del backend (90/70/80/50) no deben reaparecer como números aquí:
  // dos verdades distintas sobre el mismo dato es peor que ninguna.
  for (const source of [view, model]) {
    assert.doesNotMatch(source, /pct_verificadas\s*[><]=?\s*\d/,
      'el veredicto lo emite el servidor (tone), no una comparación local')
    assert.doesNotMatch(source, /pct_con_evidencia\s*[><]=?\s*\d/)
  }
})

// ── (c) cableado ─────────────────────────────────────────────────────────────

test('cableado: wrapper → shim → endpoint V2, con el periodo por nombre', () => {
  const modApi = src('modules/supervisor-ventas/api.js')
  assert.match(modApi, /getExecutionIntegrity/)
  assert.match(modApi, /\/pwa-supv\/execution-integrity\?period=/)

  const libApi = src('lib/api.js')
  assert.match(libApi, /'\/pwa-supv\/execution-integrity'/)
  assert.match(libApi, /\/gf\/salesops\/supervisor\/v2\/execution-integrity/)
  // El cliente NO manda fechas: las resuelve el backend con la tz de la sucursal.
  const shim = libApi.slice(libApi.indexOf("'/pwa-supv/execution-integrity'"))
    .slice(0, 400)
  assert.doesNotMatch(shim, /date_from|date_to/)
})

test('la ruta /equipo/integridad es v2Only y va bajo el rol del módulo', () => {
  const app = src('App.jsx')
  const line = app.split('\n').find((l) => l.includes('path="/equipo/integridad"'))
  assert.ok(line, 'la ruta existe')
  assert.match(line, /moduleId="supervisor_ventas"/)
  assert.match(line, /v2Only/, 'no hay pantalla legacy equivalente: sin V2 no debe montarse')
})

test('el acceso desde Más apunta a la ruta real (regla anti-placeholder)', () => {
  const mas = src('modules/supervisor-ventas/v2/mas/MasView.jsx')
  const tile = mas.split('\n').find((l) => l.includes("label: 'Integridad'"))
  assert.ok(tile, 'hay tile de Integridad')
  assert.match(tile, /route: '\/equipo\/integridad'/)
})
