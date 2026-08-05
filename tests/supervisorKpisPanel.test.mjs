// ─── Panel de KPIs v2 (embudo) del supervisor ────────────────────────────────
// El panel evolucionó al diseño v2: embudo de círculos + caídas con semáforo en
// palabra + barras ETIQUETADAS + calidad en texto plano + prospección
// "próximamente". La regla de siempre sigue: `null` dice "Sin dato", un `0` real
// se pinta, y nada se inventa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  NO_DATA, FUNNEL_MIN_D, FUNNEL_MAX_D,
  buildFunnel, funnelDiameter, deltaView, buildBars, hasSeries,
  buildQuality, qualityHighRatioNote,
  fmtMoney, fmtInt, fmtPct, collectionPercentageLabels,
} from '../src/modules/supervisor-ventas/kpis/kpisModel.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const PANEL = () => read('../src/modules/supervisor-ventas/kpis/PanelKpis.jsx')
const PANTALLA = () => read('../src/screens/ScreenKPIs.jsx')

// Payload real (sucursal 29, semana 07-28/08-03), con los bloques v2.
const REAL = {
  period: { key: 'semana', label: 'Esta semana', date_from: '2026-07-28', date_to: '2026-08-03' },
  funnel: {
    agendados: 1184, visitados: 1019, compraron: 688,
    coverage_pct: 86.1, conversion_pct: 67.5,
    coverage_tone: 'good', conversion_tone: 'watch', per_100_agendados: 58,
  },
  kpis: {
    sales: { total: 797786, cash: 715743, credit: 82043, orders: 3348, avg_ticket: 238.29, currency: 'MXN' },
    collection: { cash: 715743, credit: 82043, cash_pct: 89.7, currency: 'MXN' },
  },
  buyers_delta: { current: 688, previous: 620, delta_abs: 68, delta_pct: 11.0, direction: 'up' },
  sales_delta: { current: 797786, previous: 810000, delta_abs: -12214, delta_pct: -1.5, direction: 'down' },
  buyers_series: [
    { label: 'Mié 30', value: 90, is_current: false },
    { label: 'Jue 31', value: 110, is_current: false },
    { label: 'Vie 1', value: 105, is_current: false },
    { label: 'Sáb 2', value: 60, is_current: false },
    { label: 'Dom 3', value: 0, is_current: true },
  ],
  quality: {
    available: true, a_revisar: 616, total_visitas: 1019,
    routes: [
      { route: 'RICARDO MIRANDA', seller: 'Ricardo', count: 40 },
      { route: 'ESTEBAN ALEMAN', seller: 'Esteban', count: 33 },
    ],
    definition: 'Visitas marcadas en menos de 1 minuto Y con check-in a más de 300 m del cliente. NO es prueba: es para revisar con el vendedor.',
  },
  quality_series: [
    { label: 'Mié 30', value: 80, is_current: false },
    { label: 'Jue 31', value: 90, is_current: false },
    { label: 'Vie 1', value: 70, is_current: true },
  ],
  quality_yesterday: 90,
  prospection: { available: false, status: 'coming_soon' },
  data_notes: { quality_high_ratio: 'El 60.5% de las visitas cae en a revisar; dato posiblemente sucio.' },
  capabilities: { routes_available: true },
}

const VACIO = {
  period: { key: 'hoy', label: 'Hoy', date_from: '2026-08-05', date_to: '2026-08-05' },
  funnel: { agendados: null, visitados: null, compraron: null, coverage_pct: null, conversion_pct: null, coverage_tone: 'unknown', conversion_tone: 'unknown', per_100_agendados: null },
  kpis: { sales: { total: null, orders: null, avg_ticket: null, currency: null }, collection: { cash: null, credit: null, cash_pct: null } },
  buyers_delta: { direction: 'none', delta_pct: null },
  sales_delta: { direction: 'none', delta_pct: null },
  buyers_series: [],
  quality: { available: false },
  quality_series: [], quality_yesterday: null,
  prospection: { available: false, status: 'coming_soon' },
  data_notes: {},
}

// ── Embudo: geometría ────────────────────────────────────────────────────────

test('el diámetro es proporcional a √(valor/agendados)', () => {
  // Agendados = 100% = diámetro máximo. La mitad del valor NO es la mitad del
  // diámetro sino √0.5 ≈ 0.707, porque lo proporcional es el ÁREA.
  assert.equal(funnelDiameter(1184, 1184), FUNNEL_MAX_D)
  const mitad = funnelDiameter(592, 1184)
  assert.ok(Math.abs(mitad - FUNNEL_MAX_D * Math.SQRT1_2) <= 1, `mitad del valor ⇒ ~71% del diámetro, no 50% (${mitad})`)
})

test('un círculo diminuto conserva el mínimo legible', () => {
  assert.equal(funnelDiameter(1, 100000), FUNNEL_MIN_D)
  assert.equal(funnelDiameter(0, 1184), FUNNEL_MIN_D)
})

test('sin agendados el diámetro cae al mínimo, no revienta', () => {
  for (const bad of [null, undefined, 0, -5, NaN]) {
    assert.equal(funnelDiameter(100, bad), FUNNEL_MIN_D, String(bad))
  }
})

test('el embudo trae 3 círculos, 2 caídas y el cierre', () => {
  const f = buildFunnel(REAL)
  assert.deepEqual(f.circles.map((c) => c.key), ['agendados', 'visitados', 'compraron'])
  assert.deepEqual(f.circles.map((c) => c.value), [1184, 1019, 688])
  assert.ok(f.circles[0].diameter >= f.circles[1].diameter)
  assert.ok(f.circles[1].diameter >= f.circles[2].diameter)
  assert.equal(f.closing, 'De cada 100 agendados, 58 compraron')
  assert.ok(f.hasData)
})

test('las caídas llevan semáforo EN PALABRA + ícono, no solo color', () => {
  const f = buildFunnel(REAL)
  const [cov, conv] = f.drops
  assert.equal(cov.pct, 86.1)
  assert.equal(cov.toneWord, 'Bien')
  assert.ok(cov.toneIcon && cov.toneIcon !== '')
  assert.equal(conv.toneWord, 'Atención')
  assert.equal(conv.tone, 'watch')
})

test('embudo sin datos: valores null y cierre honesto, nunca 0', () => {
  const f = buildFunnel(VACIO)
  assert.equal(f.circles[0].value, null)
  assert.equal(f.drops[0].pct, null)
  assert.equal(f.drops[0].toneWord, 'Sin dato')
  assert.equal(f.closing, 'Sin agendados en el período')
  assert.ok(!f.hasData)
})

// ── Deltas ───────────────────────────────────────────────────────────────────

test('delta con flecha ▲/▼ y tono', () => {
  const up = deltaView(REAL.buyers_delta)
  assert.ok(up.show)
  assert.equal(up.arrow, '▲')
  assert.equal(up.tone, 'good')
  const down = deltaView(REAL.sales_delta)
  assert.equal(down.arrow, '▼')
  assert.equal(down.tone, 'bad')
})

test('sin comparativo no se inventa flecha', () => {
  const v = deltaView(VACIO.buyers_delta)
  assert.ok(!v.show)
  assert.match(v.text, /sin comparativo/)
})

// ── Barras etiquetadas ───────────────────────────────────────────────────────

test('las barras traen etiqueta, número y marca de "hoy"', () => {
  const bars = buildBars(REAL.buyers_series)
  assert.equal(bars.length, 5)
  assert.equal(bars[0].label, 'Mié 30')
  assert.equal(bars[0].valueText, '90')
  assert.ok(bars[4].isCurrent, 'el último es hoy')
})

test('una barra de valor 0 real se pinta (altura mínima), no desaparece', () => {
  const bars = buildBars(REAL.buyers_series)
  const hoy = bars[4]
  assert.equal(hoy.value, 0)
  assert.equal(hoy.valueText, '0', 'un 0 real se muestra como 0')
  assert.ok(hoy.height >= 3, 'la barra de 0 sigue siendo visible')
  assert.ok(!hoy.missing)
})

test('un día sin dato (null) NO es una barra de 0', () => {
  const bars = buildBars([{ label: 'Lun', value: null, is_current: false }])
  assert.equal(bars[0].value, null)
  assert.equal(bars[0].valueText, NO_DATA)
  assert.ok(bars[0].missing)
})

test('la altura se normaliza contra el máximo de la serie', () => {
  const bars = buildBars([{ label: 'a', value: 50 }, { label: 'b', value: 100 }])
  assert.ok(bars[1].height > bars[0].height)
})

test('hasSeries distingue serie con dato de serie vacía o toda null', () => {
  assert.ok(hasSeries(REAL.buyers_series))
  assert.ok(!hasSeries([]))
  assert.ok(!hasSeries([{ label: 'x', value: null }]))
})

// ── Etiquetas de porcentaje de cobranza ─────────────────────────────────────

test('los porcentajes pequeños de cobranza salen de su segmento', () => {
  assert.deepEqual(collectionPercentageLabels(10), {
    cash: { inside: '', outside: 'Contado 10%' },
    credit: { inside: '90%', outside: '' },
  })
  assert.deepEqual(collectionPercentageLabels(17), {
    cash: { inside: '', outside: 'Contado 17%' },
    credit: { inside: '83%', outside: '' },
  })
  assert.deepEqual(collectionPercentageLabels(18), {
    cash: { inside: '18%', outside: '' },
    credit: { inside: '82%', outside: '' },
  })
  assert.deepEqual(collectionPercentageLabels(90), {
    cash: { inside: '90%', outside: '' },
    credit: { inside: '', outside: 'Crédito 10%' },
  })
  assert.deepEqual(collectionPercentageLabels(83), {
    cash: { inside: '83%', outside: '' },
    credit: { inside: '', outside: 'Crédito 17%' },
  })
  assert.deepEqual(collectionPercentageLabels(82), {
    cash: { inside: '82%', outside: '' },
    credit: { inside: '18%', outside: '' },
  })
  assert.deepEqual(collectionPercentageLabels(0), {
    cash: { inside: '', outside: 'Contado 0%' },
    credit: { inside: '100%', outside: '' },
  })
  assert.deepEqual(collectionPercentageLabels(100), {
    cash: { inside: '100%', outside: '' },
    credit: { inside: '', outside: 'Crédito 0%' },
  })
})

test('la colocación de porcentajes rechaza datos inválidos o fuera de rango', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, -0.1, 100.1, '10']) {
    assert.equal(collectionPercentageLabels(value), null, String(value))
  }
})

// ── Calidad ──────────────────────────────────────────────────────────────────

test('calidad: número, total, definición en español y chips de vendedores', () => {
  const q = buildQuality(REAL)
  assert.ok(q.available)
  assert.equal(q.aRevisar, '616')
  assert.equal(q.totalVisitas, '1,019')
  assert.equal(q.routesCount, 2)
  assert.deepEqual(q.sellers, ['Ricardo', 'Esteban'])
  assert.match(q.definition, /1 minuto/)
  assert.match(q.definition, /300 m/)
  assert.match(q.definition, /NO es prueba/)
})

test('la advertencia de proporción anómala se expone', () => {
  assert.match(qualityHighRatioNote(REAL), /60\.5%/)
  assert.equal(qualityHighRatioNote(VACIO), null)
})

test('calidad no disponible no inventa números', () => {
  const q = buildQuality(VACIO)
  assert.ok(!q.available)
  assert.equal(q.aRevisar, NO_DATA)
  assert.deepEqual(q.routes, [])
})

// ── Prospección: RETIRADA hasta fase 2 ───────────────────────────────────────

test('prospección ya NO se renderiza en el panel (retirada hasta fase 2)', () => {
  const src = PANEL()
  assert.ok(!src.includes('testid="prospection"'), 'no debe quedar la card de prospección')
  assert.ok(!/Próximamente/.test(src), 'no debe quedar el texto "Próximamente"')
  assert.ok(!/prospectionComingSoon/.test(src), 'no debe importar/usar prospectionComingSoon')
})

// ── Delta de "Hoy": parcial, no alarma ───────────────────────────────────────

test('en "Hoy" el delta se etiqueta parcial (no ▼% que asusta)', () => {
  const v = deltaView(REAL.sales_delta, 'hoy')
  assert.ok(v.partial, 'hoy => partial')
  assert.match(v.text, /parcial/i)
  assert.ok(!/%/.test(v.text), 'no muestra % en hoy')
})

test('en Semana/Mes el delta sigue mostrando ▲/▼ completo', () => {
  const wk = deltaView(REAL.sales_delta, 'semana')
  assert.ok(!wk.partial)
  assert.equal(wk.arrow, '▼')
  const mo = deltaView(REAL.buyers_delta, 'mes')
  assert.ok(!mo.partial)
  assert.equal(mo.arrow, '▲')
})

// ── null ≠ 0 en formateadores ────────────────────────────────────────────────

test('los formateadores distinguen ausencia de cero', () => {
  assert.equal(fmtPct(null), NO_DATA)
  assert.equal(fmtPct(0), '0%')
  assert.equal(fmtInt(null), NO_DATA)
  assert.equal(fmtInt(0), '0')
  assert.equal(fmtMoney(null, 'MXN'), NO_DATA)
  assert.equal(fmtMoney(0, 'MXN'), '$0')
  assert.equal(fmtMoney(1000, null), '1,000', 'sin moneda no se inventa símbolo')
})

// ── Panel: fuente ────────────────────────────────────────────────────────────

test('el panel v2 renderiza el embudo (horizontal), las barras y calidad', () => {
  const src = PANEL()
  assert.match(src, /testid="funnel"/)
  assert.match(src, /testid="funnel-row"/)
  assert.match(src, /testid="buyers-bars"/)
  assert.match(src, /testid="quality-review"/)
  assert.match(src, /buildFunnel\(payload\)/)
})

test('el embudo es HORIZONTAL (fila), apila solo en móvil angosto', () => {
  const src = PANEL()
  // clase de fila con flex-direction:row (desktop/tablet)
  assert.match(src, /\.kpis-funnel\{[^}]*flex-direction:row/)
  // media query de móvil angosto que apila en columna
  assert.match(src, /max-width:560px/)
  assert.match(src, /\.kpis-funnel\{[^}]*flex-direction:column/)
  // conector con flecha → (horizontal) que cambia a ↓ en móvil (\\2192 / \\2193 en fuente)
  assert.match(src, /\.kpis-arrow::before\{content:"\\\\2192"\}/)
  assert.match(src, /content:"\\\\2193"/)
})

test('el switcher recarga TODO al cambiar de período', () => {
  const src = PANEL()
  assert.match(src, /useEffect\(\(\) => load\(period\), \[period, load\]\)/)
  assert.match(src, /getSupervisorKpis\(key\)/)
})

test('el panel v2 NO reintrodujo el mock ni el iframe', () => {
  const src = PANEL()
  for (const muerto of ['MetabaseFrame', 'MockMetabaseDashboard', '82%', '14 visitas']) {
    assert.ok(!src.includes(muerto), `revive algo del mock: ${muerto}`)
  }
})

test('los demás roles conservan su pantalla (rama por rol intacta)', () => {
  const src = PANTALLA()
  assert.match(src, /isBrandLightSession\(getSession\(\)\)/)
  assert.match(src, /<PanelKpisSupervisor \/>/)
  assert.match(src, /function MockMetabaseDashboard/, 'el mock sigue para otros roles')
  assert.match(src, /<MetabaseFrame /)
})

test('estados honestos: error ofrece reintentar, vacío no', () => {
  const src = PANEL()
  const err = src.slice(src.indexOf("status === 'error'"), src.indexOf('const { payload }'))
  assert.match(err, /actionLabel="Reintentar"/)
  const vacio = src.slice(src.indexOf('testid="kpis-empty"'))
  assert.ok(!/actionLabel/.test(vacio.slice(0, 400)), 'el vacío no reintenta')
  assert.match(vacio, /No es un error/)
})

test('el panel separa las etiquetas exteriores de los porcentajes interiores de cobranza', () => {
  const src = PANEL()
  assert.match(src, /const labels = collectionPercentageLabels\(cashPct\)/)
  assert.match(src, /labels\.cash\.outside\s*\?\s*\([\s\S]{0,100}testid="collection-cash-outside-label"[\s\S]{0,100}\{labels\.cash\.outside\}/)
  assert.match(src, /labels\.credit\.outside\s*\?\s*\([\s\S]{0,100}testid="collection-credit-outside-label"[\s\S]{0,100}\{labels\.credit\.outside\}/)

  const collection = src.slice(src.indexOf('height: 22'), src.indexOf('Contado {fmtMoney'))
  assert.match(collection, /\{labels\.cash\.outside\s*\?\s*''\s*:\s*labels\.cash\.inside\}/)
  assert.match(collection, /\{labels\.credit\.outside\s*\?\s*''\s*:\s*labels\.credit\.inside\}/)
})
