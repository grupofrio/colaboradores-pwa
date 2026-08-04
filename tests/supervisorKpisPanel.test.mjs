// ─── Panel nativo de KPIs del supervisor ─────────────────────────────────────
// Lo que se reemplaza pintaba números ESCRITOS A MANO (82%, 14 visitas, "31
// clientes nuevos") cuando no había dashboard de Metabase para el puesto. Estos
// tests fijan lo contrario: si el backend no lo manda, no se pinta.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  NO_DATA, PERIODS, TODAY_BADGE, TONE_LABELS,
  buildKpiCards, fmtInt, fmtMoney, fmtPct, isEmptyPanel, isSnapshot,
  panelNotices, periodLabel, periodRangeText, toneForCount, toneForPct,
} from '../src/modules/supervisor-ventas/kpis/kpisModel.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const PANEL = () => read('../src/modules/supervisor-ventas/kpis/PanelKpis.jsx')
const PANTALLA = () => read('../src/screens/ScreenKPIs.jsx')

// Payload con los números REALES medidos en producción (sucursal 29, julio).
const REAL = {
  period: { key: 'mes', label: 'Este mes', date_from: '2026-07-01', date_to: '2026-08-04' },
  kpis: {
    visit_coverage: { scheduled: 5838, visited: 4926, pct: 84.4, scope: 'period' },
    conversion: { visited: 4926, bought: 3339, pct: 67.8, scope: 'period' },
    sales: { total: 797786, cash: 715743, credit: 82043, orders: 3348, avg_ticket: 238.29, currency: 'MXN', scope: 'period' },
    collection: { cash: 715743, credit: 82043, cash_pct: 89.7, currency: 'MXN', scope: 'period' },
    cash_pending: { amount: 12500, currency: 'MXN', available: true, scope: 'today' },
    inactive_customers: { count: 143, chain_excluded: 15, available: true, scope: 'today', scope_level: 'company' },
    open_routes: { over_7d: 4, no_visits_today: 1, available: true, scope: 'today' },
  },
  capabilities: { routes_available: true },
  data_notes: {},
}

const VACIO = {
  period: { key: 'hoy', label: 'Hoy', date_from: '2026-08-04', date_to: '2026-08-04' },
  kpis: {
    visit_coverage: { scheduled: null, visited: null, pct: null, scope: 'period' },
    conversion: { visited: null, bought: null, pct: null, scope: 'period' },
    sales: { total: null, cash: null, credit: null, orders: null, avg_ticket: null, currency: null, scope: 'period' },
    collection: { cash: null, credit: null, cash_pct: null, currency: null, scope: 'period' },
    cash_pending: { amount: null, currency: null, available: false, scope: 'today' },
    inactive_customers: { count: null, chain_excluded: null, available: false, scope: 'today' },
    open_routes: { over_7d: null, no_visits_today: null, available: false, scope: 'today' },
  },
  capabilities: { routes_available: false },
  data_notes: {},
}

const card = (payload, key) => buildKpiCards(payload).find((c) => c.key === key)

// ── El mock, fuera ───────────────────────────────────────────────────────────

test('el rol de supervisión ya NO pasa por el mock ni por el iframe', () => {
  const src = PANTALLA()
  const branch = src.slice(src.indexOf('function KPIScreen('), src.indexOf('function KPIScreenLegacy'))
  assert.match(branch, /isBrandLightSession\(getSession\(\)\)/, 'la rama es por rol')
  assert.match(branch, /<PanelKpisSupervisor \/>/)
  assert.ok(!/MetabaseFrame|MockMetabaseDashboard/.test(branch),
    'la rama del supervisor no puede tocar el iframe ni el mock')
})

test('los demás roles conservan su pantalla intacta', () => {
  // Quitarles el mock sin darles fuente los dejaría SIN pantalla. Sigue ahí.
  const src = PANTALLA()
  assert.match(src, /function MockMetabaseDashboard/, 'el mock sigue para los otros roles')
  assert.match(src, /<MetabaseFrame /, 'el embed de Metabase sigue montado')
  const legacy = src.slice(src.indexOf('function KPIScreenLegacy'))
  assert.match(legacy, /MetabaseFrame/, 'la rama legacy es la que lo usa')
})

test('el panel nativo no contiene un solo número escrito a mano', () => {
  const src = PANEL()
  for (const inventado of ['82', '14 visitas', 'Clientes nuevos', 'Devoluciones', '$586', '6.2h']) {
    assert.ok(!src.includes(inventado), `sobrevive un dato del mock: ${inventado}`)
  }
})

// ── null no es 0 ─────────────────────────────────────────────────────────────

test('sin dato se dice "Sin dato", NUNCA 0', () => {
  for (const key of ['visit_coverage', 'conversion', 'sales', 'collection',
    'cash_pending', 'inactive_customers', 'open_routes']) {
    const c = card(VACIO, key)
    assert.equal(c.value, NO_DATA, key)
    assert.ok(!/^0/.test(c.value), `${key} pinta un cero inventado`)
  }
})

test('un CERO real sí se pinta como cero', () => {
  // "No hay caja pendiente" es una buena noticia y es un dato. No se puede
  // confundir con "no pude leer la caja".
  const p = structuredClone(REAL)
  p.kpis.cash_pending = { amount: 0, currency: 'MXN', available: true, scope: 'today' }
  p.kpis.open_routes = { over_7d: 0, no_visits_today: 0, available: true, scope: 'today' }
  assert.equal(card(p, 'cash_pending').value, '$0')
  assert.equal(card(p, 'open_routes').value, '0')
  assert.equal(card(p, 'open_routes').tone, 'good')
})

test('los formateadores distinguen ausencia de cero', () => {
  assert.equal(fmtPct(null), NO_DATA)
  assert.equal(fmtPct(0), '0%')
  assert.equal(fmtInt(null), NO_DATA)
  assert.equal(fmtInt(0), '0')
  assert.equal(fmtMoney(null, 'MXN'), NO_DATA)
  assert.equal(fmtMoney(0, 'MXN'), '$0')
  for (const basura of [undefined, NaN, Infinity, 'x', {}, []]) {
    assert.equal(fmtPct(basura), NO_DATA)
    assert.equal(fmtMoney(basura, 'MXN'), NO_DATA)
  }
})

test('sin moneda única NO se inventa un símbolo', () => {
  // El backend manda currency:null cuando conviven varias: poner "$" ahí sería
  // sumar monedas distintas, que es justo lo que el contrato evita.
  assert.equal(fmtMoney(1000, null), '1,000')
  assert.equal(fmtMoney(1000, 'USD'), '1,000 USD')
})

// ── Las siete tarjetas, siempre ──────────────────────────────────────────────

test('las siete tarjetas están aunque falten datos', () => {
  // Una tarjeta que desaparece deja sin saber si el indicador está bien o si el
  // sistema no pudo leerlo.
  for (const payload of [REAL, VACIO, {}, null]) {
    const keys = buildKpiCards(payload).map((c) => c.key)
    assert.deepEqual(keys, ['visit_coverage', 'conversion', 'sales', 'collection',
      'cash_pending', 'inactive_customers', 'open_routes'])
  }
})

test('las tarjetas pintan los números reales de producción', () => {
  assert.equal(card(REAL, 'visit_coverage').value, '84.4%')
  assert.match(card(REAL, 'visit_coverage').detail, /4,926 de 5,838/)
  assert.equal(card(REAL, 'conversion').value, '67.8%')
  assert.match(card(REAL, 'conversion').detail, /3,339 compraron de 4,926/)
  assert.equal(card(REAL, 'sales').value, '$797,786')
  assert.match(card(REAL, 'sales').detail, /3,348 pedidos/)
  assert.equal(card(REAL, 'inactive_customers').value, '143')
})

test('el detalle de conversión habla de CLIENTES, no de pedidos', () => {
  // 3,348 pedidos en 3,339 paradas: decir "3,339 pedidos" sería falso.
  const d = card(REAL, 'conversion').detail
  assert.ok(!/pedido/i.test(d), `la conversión no cuenta pedidos: "${d}"`)
  assert.match(d, /compraron/)
})

test('"contado vs crédito" NO se llama cobranza a secas', () => {
  // `cash` es efectivo cobrado EN LA RUTA y `credit` es crédito OTORGADO: no es
  // recuperación de cartera vencida.
  const c = card(REAL, 'collection')
  assert.ok(!/cobranza/i.test(c.title), 'el título no puede prometer recuperación de cartera')
  assert.match(c.detail, /cobrado en ruta/)
  assert.match(c.detail, /crédito otorgado/)
})

// ── Foto de hoy ──────────────────────────────────────────────────────────────

test('los tres KPIs de saldo llevan la etiqueta "al día de hoy"', () => {
  for (const key of ['cash_pending', 'inactive_customers', 'open_routes']) {
    assert.ok(isSnapshot(card(REAL, key)), key)
  }
  for (const key of ['visit_coverage', 'conversion', 'sales', 'collection']) {
    assert.ok(!isSnapshot(card(REAL, key)), key)
  }
  assert.equal(TODAY_BADGE, 'al día de hoy')
})

test('la etiqueta sigue puesta aunque el selector esté en Mes', () => {
  // Es el caso que importa: en "Mes" sin etiqueta se leerían como del mes.
  assert.equal(REAL.period.key, 'mes')
  assert.ok(isSnapshot(card(REAL, 'cash_pending')))
})

test('el panel PINTA la etiqueta, no solo la calcula', () => {
  const src = PANEL()
  assert.match(src, /isSnapshot\(card\) && \(/)
  assert.match(src, /\{TODAY_BADGE\}/)
})

// ── Semáforo ─────────────────────────────────────────────────────────────────

test('el semáforo lleva PALABRA, no solo color', () => {
  assert.match(PANEL(), /\{TONE_LABELS\[card\.tone\]\}/, 'se pinta la etiqueta del tono')
  for (const tone of ['good', 'watch', 'bad', 'unknown']) {
    assert.ok(TONE_LABELS[tone], tone)
  }
})

test('sin dato NO se pinta verde ni rojo', () => {
  assert.equal(toneForPct(null), 'unknown')
  assert.equal(toneForCount(null), 'unknown')
  assert.equal(card(VACIO, 'visit_coverage').tone, 'unknown')
  assert.equal(TONE_LABELS.unknown, 'Sin dato')
})

test('los umbrales del semáforo', () => {
  assert.equal(toneForPct(84.4), 'good')
  assert.equal(toneForPct(67.8), 'watch')
  assert.equal(toneForPct(31), 'bad')
  assert.equal(toneForCount(0), 'good')
  assert.equal(toneForCount(60, { watchAt: 1, badAt: 50 }), 'bad')
})

// ── Estados ──────────────────────────────────────────────────────────────────

test('vacío y error son estados DISTINTOS', () => {
  assert.ok(isEmptyPanel(VACIO), 'todo en Sin dato ⇒ vacío')
  assert.ok(!isEmptyPanel(REAL))
  const src = PANEL()
  // El de error invita a reintentar; el de vacío NO, porque no hay nada que reintentar.
  const err = src.slice(src.indexOf('testid="kpis-error"'), src.indexOf('const { payload }'))
  assert.match(err, /actionLabel="Reintentar"/)
  const vacio = src.slice(src.indexOf('testid="kpis-empty"'))
  assert.ok(!/actionLabel/.test(vacio.slice(0, 400)), 'el vacío no ofrece reintentar')
  assert.match(vacio, /No es un error/)
})

test('el error NO pinta ceros mientras tanto', () => {
  const src = PANEL()
  const err = src.slice(src.indexOf("status === 'error'"), src.indexOf('const { payload }'))
  assert.match(err, /StateScreen/)
  assert.ok(!/buildKpiCards/.test(err), 'no se pintan tarjetas sobre un error')
})

// ── Advertencias del contrato ────────────────────────────────────────────────

test('la advertencia de KoldScore se muestra, no se esconde', () => {
  const p = structuredClone(REAL)
  p.data_notes.inactive_accuracy = 'PENDIENTE: el conteo viene inflado…'
  const n = panelNotices(p)
  assert.equal(n.length, 1)
  assert.equal(n[0].key, 'inactive_accuracy')
  assert.match(n[0].text, /puede venir alto/)
})

test('si el backend no puede leer rutas, se dice', () => {
  assert.ok(panelNotices(VACIO).some((x) => x.key === 'routes'), 'la capability en false se avisa')
})

// ── Período ──────────────────────────────────────────────────────────────────

test('el switcher conserva los tres períodos', () => {
  assert.deepEqual(PERIODS.map((p) => p.key), ['hoy', 'semana', 'mes'])
})

test('se muestra el período que devolvió el BACKEND, no el que se pidió', () => {
  // Si el backend degrada a "hoy", el panel tiene que decir "hoy".
  assert.equal(periodLabel(REAL), 'Este mes')
  assert.equal(periodRangeText(REAL), '2026-07-01 al 2026-08-04')
  assert.equal(periodRangeText(VACIO), '2026-08-04', 'un solo día no se pinta como rango')
})

test('cambiar de período recarga desde el backend', () => {
  const src = PANEL()
  assert.match(src, /useEffect\(\(\) => load\(period\), \[period, load\]\)/,
    'el período es dependencia de la carga')
  assert.match(src, /getSupervisorKpis\(key\)/)
})

test('el período viaja por NOMBRE, nunca por fechas', () => {
  const api = read('../src/lib/api.js')
  const bloque = api.slice(api.indexOf("cleanPath === '/pwa-supv/kpis'"))
  const corte = bloque.slice(0, bloque.indexOf('})'))
  assert.match(corte, /period: query\.get\('period'\)/)
  assert.ok(!/date_from|date_to/.test(corte), 'mandar fechas es inútil: el backend las rechaza')
})
