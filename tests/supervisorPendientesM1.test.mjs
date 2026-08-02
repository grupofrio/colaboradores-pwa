import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildM1Accommodation, groupByRecommendedAction, countByRisk, distributeByAge, sumCash,
  REZAGO_MIN_DAYS,
} from '../src/modules/supervisor-ventas/v2/pendientes/m1Accommodation.js'
import { normalizePayload } from '../src/modules/torre/m1/m1BacklogModel.js'

// Forma REAL medida en producción (sucursal 29, 2026-08-02), recortada.
const RAW_MAIN = {
  ok: true,
  data_as_of: '2026-08-02T04:39:15Z',
  role: 'supervisor_ventas',
  scope: { mode: 'branch', branch_ids: [29] },
  kpis: {
    open_routes: 214, open_routes_over_7d: 198, historical_backlog: 198,
    close_candidates: 5, draft_routes: 28,
    cash_pending_amount: 596795, cash_closed_pending_amount: 210267,
  },
  rows: [
    { plan_id: 274, route_name: 'ESTEBAN ALEMAN', age_days: 74, cash_pending_amount: 7735,
      risk_level: 'high', recommended_action: 'Revisar caja', all_stops_done: true, state: 'in_progress' },
    { plan_id: 301, route_name: 'MANUEL CRUZ', age_days: 45, cash_pending_amount: 5230,
      risk_level: 'high', recommended_action: 'Validar cierre con gerente', state: 'in_progress' },
    { plan_id: 340, route_name: 'RICARDO MIRANDA', age_days: 31, cash_pending_amount: 0,
      risk_level: 'medium', recommended_action: 'Validar cierre con gerente', state: 'in_progress' },
    { plan_id: 402, route_name: 'RUTA NUEVA', age_days: 3, cash_pending_amount: 1200,
      risk_level: 'low', recommended_action: 'Seguimiento normal', state: 'in_progress' },
  ],
  meta: { total: 214, limit: 200, offset: 0, rejected_params: [] },
}
const RAW_CAND = {
  ok: true, role: 'supervisor_ventas', kpis: RAW_MAIN.kpis,
  rows: [{ plan_id: 501, route_name: 'CANDIDATA', age_days: 67, cash_pending_amount: 0,
    risk_level: 'high', recommended_action: 'Cerrar ruta si caja validada', close_candidate_flag: true }],
  meta: { total: 5, limit: 50, offset: 0, rejected_params: [] },
}

const main = normalizePayload(RAW_MAIN, 'supervisor_ventas')
const cand = normalizePayload(RAW_CAND, 'supervisor_ventas')
const acc = buildM1Accommodation(main, cand.rows)

// ── Los conteos de arriba salen de los KPIs, no de contar filas ─────────────

test('el veredicto usa los KPIs del backend, no la página de filas', () => {
  assert.equal(acc.verdict.closeCandidates, 5, 'aunque solo se cargaron 4 filas')
  assert.equal(acc.verdict.openRoutes, 214, 'aunque rows.length sea 4')
  assert.equal(acc.verdict.cashPending, 596795)
  assert.equal(acc.verdict.dataAsOf, '2026-08-02T04:39:15Z')
})

test('las candidatas salen de su propia consulta, no de filtrar la página', () => {
  // La página principal no trae ninguna con close_candidate_flag; si el acomodo
  // las filtrara de ahí, saldrían 0 y la sección "asa" quedaría vacía.
  assert.equal(acc.candidates.length, 1)
  assert.equal(acc.candidates[0].plan_id, 501)
  assert.ok(!main.rows.some((r) => r.close_candidate_flag), 'la página principal no las trae')
})

// ── Agrupación por la acción que YA emite el backend ────────────────────────

test('se agrupa por recommended_action tal cual, sin reinterpretar', () => {
  const groups = groupByRecommendedAction(main.rows)
  assert.deepEqual(groups.map((g) => g.action), [
    'Validar cierre con gerente', // 2 — primero por conteo
    'Revisar caja',               // 1 — empate resuelto alfabéticamente
    'Seguimiento normal',
  ])
  assert.equal(groups[0].count, 2)
  assert.equal(groups[0].cash, 5230)
})

test('una acción vacía no crea un bucket fantasma', () => {
  const groups = groupByRecommendedAction([{ recommended_action: '', age_days: 1 }, { age_days: 2 }])
  assert.deepEqual(groups, [])
})

// ── Riesgo: honesto sobre cuántas filas está contando ───────────────────────

test('el riesgo se cuenta sobre las filas cargadas y se declara parcial', () => {
  assert.deepEqual(acc.risk.counts, { high: 2, medium: 1, low: 1 })
  assert.equal(acc.risk.rowsCounted, 4)
  assert.equal(acc.risk.total, 214)
  assert.equal(acc.risk.partial, true, 'el contrato no da conteo total por riesgo')
})

test('sin parcialidad cuando la página cubre el total', () => {
  const completo = normalizePayload({ ...RAW_MAIN, meta: { ...RAW_MAIN.meta, total: 4 } }, 'supervisor_ventas')
  assert.equal(buildM1Accommodation(completo, []).risk.partial, false)
})

test('un risk_level desconocido no se cuenta como bajo', () => {
  assert.deepEqual(countByRisk([{ risk_level: 'catastrofico' }, { risk_level: null }]),
    { high: 0, medium: 0, low: 0 })
})

// ── Rezago: separado, y con el corte declarado ──────────────────────────────

test('el rezago son las de +30 días, con su caja y su distribución', () => {
  assert.equal(REZAGO_MIN_DAYS, 30)
  assert.equal(acc.rezago.count, 3, '74, 45 y 31 días; la de 3 días NO')
  assert.equal(acc.rezago.cash, 12965)
  const bands = Object.fromEntries(acc.rezago.bands.map((b) => [b.key, b.count]))
  assert.deepEqual(bands, { '30_60': 2, '61_90': 1, '90_mas': 0 })
})

test('las bandas de antigüedad no se solapan ni pierden filas', () => {
  const rows = [{ age_days: 30 }, { age_days: 60 }, { age_days: 61 }, { age_days: 90 }, { age_days: 91 }]
    .map((r) => ({ ...r, cash_pending_amount: 0 }))
  const bands = distributeByAge(rows)
  assert.equal(bands.reduce((a, b) => a + b.count, 0), rows.length)
})

test('sumCash tolera basura sin inventar montos', () => {
  assert.equal(sumCash(null), 0)
  assert.equal(sumCash([{ cash_pending_amount: null }, {}, { cash_pending_amount: 10 }]), 10)
})

// ── Reglas duras de la superficie ───────────────────────────────────────────

// Los comentarios EXPLICAN las reglas y por tanto citan lo prohibido. Se escanea
// el código sin comentarios, si no el test se caza a sí mismo.
function withoutComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test('la vista es SOLO LECTURA: ningún control ejecuta acciones', () => {
  const src = withoutComments(readFileSync(new URL('../src/modules/supervisor-ventas/v2/pendientes/M1BacklogSection.jsx', import.meta.url), 'utf8'))

  // Nada de verbos de escritura ni llamadas de red desde la vista.
  for (const prohibido of ['api(', 'fetch(', 'onClose(', 'onCerrar', 'POST', 'mutate']) {
    assert.ok(!src.includes(prohibido), `la vista contiene "${prohibido}"`)
  }
  // Los CTA solo navegan.
  const handlers = [...src.matchAll(/onClick=\{\(\) => ([a-zA-Z?.]+)\(/g)].map((m) => m[1])
  for (const h of handlers) {
    assert.ok(/onOpenRoute\??\.?/.test(h) || h === 'setOpen', `handler inesperado: ${h}`)
  }
})

test('la etiqueta de dinero es NEUTRA: no afirma "por recibir" ni "por conciliar"', () => {
  const src = withoutComments(readFileSync(new URL('../src/modules/supervisor-ventas/v2/pendientes/M1BacklogSection.jsx', import.meta.url), 'utf8'))

  assert.ok(src.includes('caja pendiente'), 'usa la etiqueta neutra acordada')
  for (const afirmacion of ['por recibir', 'por conciliar', 'por cobrar', 'sin depositar']) {
    assert.ok(!src.toLowerCase().includes(afirmacion), `afirma "${afirmacion}" sin confirmación del backend`)
  }
})

test('el rezago nace PLEGADO y se rotula "no es de hoy"', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/pendientes/M1BacklogSection.jsx', import.meta.url), 'utf8')

  assert.match(src, /useState\(false\)/, 'arranca cerrado')
  assert.ok(src.includes('No es de hoy'), 'lo dice explícitamente')
})

test('se declara que gerencia no puede ver lo que su bucket recomienda', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/pendientes/M1BacklogSection.jsx', import.meta.url), 'utf8')
  assert.ok(src.includes('m1-nota-gerente'))
  assert.ok(src.includes('todavía no tiene acceso'))
})

// ── El contenedor: fuentes independientes y sin fetch propio ────────────────

test('la pestaña conserva los pendientes del día junto al backlog', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/tabs/PendientesTab.jsx', import.meta.url), 'utf8')

  assert.ok(src.includes('<M1BacklogSection'), 'monta el backlog')
  assert.ok(src.includes('<PendientesView'), 'conserva la vista diaria')
  assert.ok(src.includes('derivePendientes'), 'sigue usando la consolidación de day-control')
  // El día operativo NO puede tumbar el backlog: son contratos distintos.
  assert.match(src, /dayReady \? \(/, 'day-control gatea solo su bloque')
})

test('el hook reutiliza el cliente y la normalización de M1, no los reconstruye', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/pendientes/useM1Backlog.js', import.meta.url), 'utf8')

  assert.ok(src.includes("from '../../../torre/m1/m1BacklogModel'"), 'usa el modelo existente')
  assert.ok(src.includes('TOWER_M1_BACKLOG_PATH'), 'usa la ruta declarada')
  assert.ok(src.includes('normalizePayload') && src.includes('classifyError'))
  assert.ok(!/state_bucket:\s*'(draft|closed)/.test(src), 'no re-clasifica buckets')
})
