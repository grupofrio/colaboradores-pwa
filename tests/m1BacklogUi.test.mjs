// M1-D Backlog UI — tests node:test (matriz A–I del S/N).
// La lógica vive en el modelo puro m1BacklogModel.js (testeada directo);
// el wiring de la pantalla/ruta se verifica con text-scan (patrón del repo:
// tests/e1TowerStatus.test.mjs no renderiza JSX).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  DEFAULT_FILTERS, DEFAULT_LIMIT,
  applyFilterChange, buildBacklogQuery, classifyError, clearFilters,
  fmtKpiValue, normalizeKpis, normalizePayload, pagination,
  showBranchSelector, toQueryString, visibleBranchOptions, withTimeout,
} from '../src/modules/torre/m1/m1BacklogModel.js'
import { readAuthoritativeTowerStatus } from '../src/modules/torre/e1/loadTowerStatus.js'
import { TOWER_M1_ALLOWED_PARAMS } from '../src/lib/towerM1Route.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src')
const readSrc = (rel) => readFileSync(join(SRC, rel), 'utf-8')
const SCREEN = readSrc('modules/torre/m1/ScreenM1Backlog.jsx')
const APP = readSrc('App.jsx')

const PAYLOAD = {
  ok: true,
  data_as_of: '2026-07-13T18:00:00Z',
  role: 'admin_plataforma',
  scope: { mode: 'all', branch_ids: [] },
  available_branches: [
    { id: 29, display_name: '[IGU34] Iguala Glaciem' },
    { id: 1, display_name: '[CDMX] Ciudad de México' },
  ],
  kpis: {
    open_routes: 193, open_routes_over_7d: 161, historical_backlog: 161,
    close_candidates: 6, draft_routes: 12,
    cash_pending_amount: 535268.4, cash_closed_pending_amount: 17500,
    unresolved_branch_rows: 0,
  },
  rows: [{
    plan_id: 900, route_name: 'R-IGU-04', branch_name: '[IGU34] Iguala Glaciem',
    branch_resolution_source: 'warehouse_branch', state: 'in_progress',
    scheduled_date: '2026-06-02', age_days: 41, stops_total: 15, stops_done: 15,
    all_stops_done: true, cash_pending_flag: true, cash_pending_amount: 18240,
    cash_closed_pending_flag: false, cash_closed_pending_amount: 0,
    close_candidate_flag: true, risk_level: 'high',
    recommended_action: 'Cerrar ruta si caja validada',
    last_activity_at: '2026-07-12 16:20:00',
  }],
  meta: { state_bucket: 'open', bucket: null, limit: 50, offset: 0, total: 193, rejected_params: [] },
}

// ── A. Gate / ruta ────────────────────────────────────────────────────────────
test('A: gate autoriza admin y supervisor; rol inválido/ausente redirige (fail-closed)', () => {
  for (const role of ['admin_plataforma', 'supervisor_ventas']) {
    assert.equal(readAuthoritativeTowerStatus({ employee: { tower_status: role } }), role)
  }
  for (const bad of [null, 'gerente_sucursal', 'ADMIN_PLATAFORMA', undefined]) {
    assert.equal(readAuthoritativeTowerStatus({ employee: { tower_status: bad } }), null)
  }
  assert.equal(readAuthoritativeTowerStatus({}), null)
  // wiring: ruta /torre/backlog montada detrás de TowerRoute, lazy y sin menú
  assert.match(APP, /path="\/torre\/backlog"/)
  assert.match(APP, /<TowerRoute><ScreenM1BacklogMount \/><\/TowerRoute>/)
  assert.match(APP, /lazy\(\(\) => import\('\.\/modules\/torre\/m1\/ScreenM1Backlog'\)\)/)
  assert.ok(!/to=["']\/torre\/backlog/.test(APP), 'sin link de menú general a /torre/backlog')
})

// ── B. Request base ───────────────────────────────────────────────────────────
test('B: sin filtros no manda params vacíos ni prohibidos; usa api()+directTower', () => {
  const q = buildBacklogQuery({ ...DEFAULT_FILTERS }, 0, 'admin_plataforma')
  assert.deepEqual(q, { state_bucket: 'open', limit: '50', offset: '0' })
  for (const v of Object.values(q)) assert.notEqual(v, '')
  for (const k of Object.keys(q)) {
    assert.ok(TOWER_M1_ALLOWED_PARAMS.includes(k), `param fuera de contrato: ${k}`)
  }
  for (const prohibido of ['employee_id', 'company_id', 'domain']) {
    assert.ok(!(prohibido in q))
    assert.ok(!new RegExp(`${prohibido}\\s*[:=]`).test(SCREEN), `la pantalla no arma ${prohibido}`)
  }
  assert.equal(toQueryString(q), '?state_bucket=open&limit=50&offset=0')
  // wiring: la pantalla usa api() con TOWER_M1_BACKLOG_PATH (directTower) y no fetch directo
  assert.match(SCREEN, /api\('GET', `\$\{TOWER_M1_BACKLOG_PATH\}\$\{toQueryString\(query\)\}`\)/)
  assert.ok(!/fetch\(/.test(SCREEN), 'sin fetch directo fuera del patrón del repo')
})

// ── C. Admin ──────────────────────────────────────────────────────────────────
test('C: available_branches alimenta el selector; branch_id se envía; catálogo vacío manejado', () => {
  const opts = visibleBranchOptions('admin_plataforma', PAYLOAD)
  assert.deepEqual(opts.map((b) => b.id), [29, 1])
  assert.equal(showBranchSelector('admin_plataforma'), true)
  const q = buildBacklogQuery({ ...DEFAULT_FILTERS, branch_id: '29' }, 0, 'admin_plataforma')
  assert.equal(q.branch_id, '29')
  // catálogo vacío => [] (selector deshabilitado en UI, sin crash)
  assert.deepEqual(visibleBranchOptions('admin_plataforma', { ...PAYLOAD, available_branches: [] }), [])
  assert.deepEqual(visibleBranchOptions('admin_plataforma', {}), [])
  assert.match(SCREEN, /disabled=\{branches\.length === 0\}/)
})

// ── D. Supervisor ─────────────────────────────────────────────────────────────
test('D: supervisor sin selector; available_branches ignorado; jamás manda branch_id', () => {
  assert.equal(showBranchSelector('supervisor_ventas'), false)
  // aunque la clave apareciera por accidente, se ignora
  assert.deepEqual(visibleBranchOptions('supervisor_ventas', PAYLOAD), [])
  const q = buildBacklogQuery({ ...DEFAULT_FILTERS, branch_id: '29' }, 0, 'supervisor_ventas')
  assert.ok(!('branch_id' in q), 'la UI de supervisor nunca envía branch_id')
})

// ── E. F-1 close_candidate ────────────────────────────────────────────────────
test('E: close_candidate activado manda "1"; desactivado ausente; sin filtro inverso; vacío válido', () => {
  const on = buildBacklogQuery({ ...DEFAULT_FILTERS, close_candidate: true }, 0, 'admin_plataforma')
  assert.equal(on.close_candidate, '1')
  const off = buildBacklogQuery({ ...DEFAULT_FILTERS, close_candidate: false }, 0, 'admin_plataforma')
  assert.ok(!('close_candidate' in off))
  // no existe representación de filtro inverso ("0"/"false") en el builder
  assert.ok(!/close_candidate.*['"]0['"]/.test(readSrc('modules/torre/m1/m1BacklogModel.js')))
  // estado vacío válido (rows []) se clasifica como empty, no error
  const empty = normalizePayload({ ...PAYLOAD, rows: [], meta: { ...PAYLOAD.meta, total: 0 } }, 'admin_plataforma')
  assert.equal(empty.status, 'empty')
  assert.equal(empty.total, 0)
})

// ── F. Estados ────────────────────────────────────────────────────────────────
test('F: clasificación de errores → estados de UI (401 central, retry manual en 5xx)', () => {
  assert.deepEqual(classifyError({ status: 503, code: 'feature_disabled' }),
    { state: 'feature_disabled', retryable: true })
  assert.equal(classifyError({ status: 503, code: 'unavailable' }).state, 'feature_disabled')
  const nbs = classifyError({ status: 403, code: 'no_branch_scope', reason: 'multiple_branch_configs' })
  assert.equal(nbs.state, 'no_branch_scope')
  assert.equal(nbs.retryable, false)
  assert.equal(nbs.reason, 'multiple_branch_configs')
  assert.equal(classifyError({ status: 403, code: 'forbidden' }).state, 'forbidden')
  assert.equal(classifyError({ status: 401, code: 'invalid_session' }).state, 'session_expired')
  assert.equal(classifyError({ status: 0, code: 'no_session' }).state, 'session_expired')
  const e500 = classifyError({ status: 500, code: 'internal_error' })
  assert.equal(e500.state, 'error')
  assert.equal(e500.retryable, true)
  const net = classifyError({ status: 0, code: 'network' })
  assert.equal(net.retryable, true)
  // 401 mantiene flujo central: la pantalla NO hace logout propio
  assert.ok(!/expireSession|removeItem\('gf_session'\)/.test(SCREEN),
    'la pantalla no duplica el manejo central de sesión')
  // success/empty desde payload
  assert.equal(normalizePayload(PAYLOAD, 'admin_plataforma').status, 'success')
})

test('F: timeout produce error clasificable y retryable (sin loop automático)', async () => {
  const never = new Promise(() => {})
  await assert.rejects(withTimeout(never, 10), (e) => e.code === 'timeout')
  const info = classifyError({ code: 'timeout', status: 0 })
  assert.equal(info.state, 'error')
  assert.equal(info.retryable, true)
  // resuelve normal cuando la promesa gana la carrera
  assert.equal(await withTimeout(Promise.resolve('ok'), 50), 'ok')
  // sin retries automáticos en la pantalla (solo botón manual)
  assert.ok(!/setInterval|retryCount|attempt\+\+/.test(SCREEN))
})

// ── G. Concurrencia ───────────────────────────────────────────────────────────
test('G: última petición gana (requestSeq) + unmount invalida respuestas', () => {
  // simulación del patrón exacto de la pantalla
  const seq = { current: 0 }
  const results = []
  const start = () => ++seq.current
  const apply = (requestId, value) => {
    if (requestId !== seq.current) return false
    results.push(value)
    return true
  }
  const r1 = start() // petición vieja
  const r2 = start() // petición nueva
  assert.equal(apply(r1, 'vieja'), false, 'respuesta vieja NO sobrescribe')
  assert.equal(apply(r2, 'nueva'), true)
  assert.deepEqual(results, ['nueva'])
  // unmount: flag `alive` (NO el contador) invalida lo que esté en vuelo
  const alive = { current: true }
  const applyAlive = (requestId, value) => {
    if (requestId !== seq.current || !alive.current) return false
    results.push(value); return true
  }
  const r3 = start()
  alive.current = false // cleanup de unmount
  assert.equal(applyAlive(r3, 'post-unmount'), false)
  // wiring en pantalla: guardas de secuencia + montaje presentes
  assert.match(SCREEN, /const requestId = \+\+requestSeq\.current/)
  const guards = SCREEN.match(/requestId !== requestSeq\.current \|\| !alive\.current/g) || []
  assert.ok(guards.length >= 2, 'guarda (seq + montaje) tras éxito y tras error')
  // el unmount NO invalida requestSeq (StrictMode-safe): usa alive, no el contador
  assert.match(SCREEN, /return \(\) => \{ alive\.current = false \}/)
  assert.ok(!/requestSeq\.current \+= 1/.test(SCREEN),
    'la carga inicial no debe ser invalidada por el cleanup de unmount (bug StrictMode)')
  assert.match(SCREEN, /useEffect\(\(\) => \{ load\(\{ \.\.\.DEFAULT_FILTERS \}, 0\) \}, \[load\]\)/)
})

// ── H. Paginación ─────────────────────────────────────────────────────────────
test('H: paginación usa meta.total filtrado; next/prev; filtros resetean offset', () => {
  const p1 = pagination(0, 50, 193, 50)
  assert.deepEqual([p1.from, p1.to, p1.total, p1.canPrev, p1.canNext], [1, 50, 193, false, true])
  assert.equal(p1.nextOffset, 50)
  const p4 = pagination(150, 43, 193, 50)
  assert.deepEqual([p4.from, p4.to, p4.canPrev, p4.canNext], [151, 193, true, false])
  assert.equal(p4.prevOffset, 100)
  const empty = pagination(0, 0, 0, 50)
  assert.deepEqual([empty.from, empty.to, empty.total, empty.canPrev, empty.canNext], [0, 0, 0, false, false])
  // cambio de filtro reinicia offset
  const changed = applyFilterChange({ ...DEFAULT_FILTERS }, 'bucket', 'historical')
  assert.equal(changed.offset, 0)
  assert.equal(changed.filters.bucket, 'historical')
  const cleared = clearFilters()
  assert.deepEqual(cleared.filters, { ...DEFAULT_FILTERS })
  assert.equal(cleared.offset, 0)
})

// ── I. Compatibilidad aditiva ─────────────────────────────────────────────────
test('I: claves desconocidas en payload/rows/kpis no rompen; KPIs con fallback — y sin NaN', () => {
  const noisy = {
    ...PAYLOAD,
    future_key: { nested: true },
    kpis: { ...PAYLOAD.kpis, new_metric: 42, weird: 'x' },
    rows: [{ ...PAYLOAD.rows[0], extra_field: 'zzz', another: { a: 1 } }],
    meta: { ...PAYLOAD.meta, new_meta: true },
  }
  const n = normalizePayload(noisy, 'admin_plataforma')
  assert.equal(n.status, 'success')
  assert.equal(n.rows[0].route_name, 'R-IGU-04')
  assert.equal(n.total, 193)
  // KPI ausente => '—'; jamás NaN
  const cards = normalizeKpis({ open_routes: 'not-a-number' }, 'supervisor_ventas')
  const open = cards.find((c) => c.key === 'open_routes')
  assert.equal(fmtKpiValue(open), '—')
  for (const c of cards) assert.ok(!String(fmtKpiValue(c)).includes('NaN'))
  // KPI diagnóstico SOLO admin
  assert.ok(normalizeKpis({}, 'admin_plataforma').some((c) => c.key === 'unresolved_branch_rows'))
  assert.ok(!normalizeKpis({}, 'supervisor_ventas').some((c) => c.key === 'unresolved_branch_rows'))
  // payload totalmente vacío tampoco truena
  const blank = normalizePayload({}, 'supervisor_ventas')
  assert.equal(blank.status, 'empty')
})

// ── Accesibilidad y alcance (wiring) ─────────────────────────────────────────
test('a11y + alcance: labels/aria/tabla semántica presentes; sin writes ni endpoints inventados', () => {
  assert.match(SCREEN, /aria-live="polite"/)
  assert.match(SCREEN, /aria-pressed=\{filters\.close_candidate\}/)
  assert.match(SCREEN, /<label htmlFor=\{id\}/)
  assert.match(SCREEN, /scope="col"/)
  assert.match(SCREEN, /<caption/)
  assert.match(SCREEN, /prefers-reduced-motion/)
  assert.match(SCREEN, /focus-visible/)
  assert.match(SCREEN, /aria-label="Volver a la Torre"/)
  assert.match(SCREEN, /aria-label="Actualizar backlog"/)
  // KPIs no se recalculan desde rows (no hay reduce/suma sobre rows para KPIs)
  assert.ok(!/rows\.(reduce|filter\(.*cash)/.test(SCREEN))
  // solo GET al endpoint del contrato; sin POST/write
  assert.ok(!/api\('POST'/.test(SCREEN))
  assert.ok(!/pwa-tower\/(?!m1-backlog)/.test(SCREEN), 'ningún endpoint inventado')
})
