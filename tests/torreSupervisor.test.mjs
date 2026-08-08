import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  AGING_FILTERS, HEADER_KPI_KEYS, TORRE_BUCKETS, TORRE_PERIODS, TORRE_SORTS, applyAging,
  applyPeriod, cashForBucket, coverage, fmtActivity, headerKpis, initialTorreFilters,
  periodOf, progressOf, riskTone, routeDetailPath, weekRange,
} from '../src/modules/supervisor-ventas/torre/torreSupervisorModel.js'
import { normalizePayload } from '../src/modules/torre/m1/m1BacklogModel.js'
import { utcTodayStr, zonedTodayStr } from '../src/modules/supervisor-ventas/v2/civilWeek.js'

// Forma REAL medida en producción (sucursal 29), recortada.
const RAW = {
  ok: true,
  data_as_of: '2026-08-02T04:39:15Z',
  role: 'supervisor_ventas',
  kpis: {
    open_routes: 217, open_routes_over_7d: 200, historical_backlog: 200,
    close_candidates: 5, draft_routes: 28,
    cash_pending_amount: 596795, cash_closed_pending_amount: 210267,
  },
  rows: [
    { plan_id: 274, route_name: 'ESTEBAN ALEMAN', age_days: 74, cash_pending_amount: 7735,
      stops_total: 33, stops_done: 33, all_stops_done: true, risk_level: 'high',
      recommended_action: 'Revisar caja', state: 'in_progress',
      last_activity_at: '2026-05-21 18:30:00' },
    { plan_id: 301, route_name: 'MANUEL CRUZ', age_days: 45, cash_pending_amount: 5230,
      stops_total: 40, stops_done: 12, all_stops_done: false, risk_level: 'medium',
      recommended_action: 'Validar cierre con gerente', state: 'in_progress',
      last_activity_at: '' },
  ],
  meta: { total: 217, limit: 50, offset: 0, rejected_params: [] },
}
const data = normalizePayload(RAW, 'supervisor_ventas')

// ── El encabezado dice lo que este puesto necesita ──────────────────────────

test('el número protagonista es el ENVEJECIMIENTO, no el total de abiertas', () => {
  assert.equal(HEADER_KPI_KEYS[0], 'open_routes_over_7d',
    '"abiertas" a secas no dice nada cuando casi todas lo están')
  const [primero, ...resto] = headerKpis(data.kpis)
  assert.equal(primero.value, 200)
  assert.equal(primero.text, '200')
  assert.deepEqual(resto.map((k) => k.key),
    ['cash_pending_amount', 'cash_closed_pending_amount'])
})

test('la etiqueta de dinero es NEUTRA: no afirma por recibir ni por conciliar', () => {
  for (const kpi of headerKpis(data.kpis)) {
    const l = kpi.label.toLowerCase()
    for (const afirmacion of ['por recibir', 'por conciliar', 'recepción', 'por cobrar']) {
      assert.ok(!l.includes(afirmacion), `el KPI afirma "${afirmacion}" sin confirmarlo`)
    }
  }
})

test('un KPI ausente sale como — y NO como cero', () => {
  const sinDatos = headerKpis(normalizePayload({ kpis: {}, rows: [] }, 'supervisor_ventas').kpis)
  for (const kpi of sinDatos) {
    assert.equal(kpi.value, null)
    assert.equal(kpi.text, '—', 'null no es 0: "no vino" y "no hay" son distintos')
  }
})

// ── Período: la Torre abre en la SEMANA EN CURSO, no en el histórico ─────────

test('el arranque es la semana en curso, abiertas, SIN filtro de antigüedad', () => {
  // El bug: arrancaba en bucket:'historical' (>7 días) y Aida no veía su semana.
  const f = initialTorreFilters('2026-08-05') // miércoles
  assert.equal(f.state_bucket, 'open')
  assert.equal(f.bucket, '', 'NO arranca filtrada a >7 días')
  assert.equal(f.date_from, '2026-08-03', 'lunes de esa semana')
  assert.equal(f.date_to, '2026-08-09', 'domingo de esa semana')
  assert.equal(periodOf(f), 'week')
})

test('weekRange: Lun–Dom que contiene la fecha; tz-neutral (civil)', () => {
  assert.deepEqual(weekRange('2026-08-03'), { date_from: '2026-08-03', date_to: '2026-08-09' }, 'un lunes')
  assert.deepEqual(weekRange('2026-08-09'), { date_from: '2026-08-03', date_to: '2026-08-09' }, 'un domingo')
})

test('cambiar a Histórico limpia el rango de semana (ejes excluyentes)', () => {
  // "esta semana" + ">7 días" = vacío; por eso elegir histórico saca las fechas.
  const d = applyPeriod('historical', '2026-08-05')
  assert.equal(d.bucket, 'historical')
  assert.equal(d.date_from, '')
  assert.equal(d.date_to, '')
  assert.equal(periodOf({ bucket: 'historical' }), 'historical')
})

test('volver a Semana en curso repone el rango y quita la antigüedad', () => {
  const d = applyPeriod('week', '2026-08-05')
  assert.equal(d.bucket, '')
  assert.equal(d.date_from, '2026-08-03')
  assert.equal(d.date_to, '2026-08-09')
})

test('elegir una antigüedad concreta también sale de la semana; "toda" la reanuda', () => {
  const historico = applyAging('historical', '2026-08-05')
  assert.equal(historico.bucket, 'historical')
  assert.equal(historico.date_from, '', 'un chip de antigüedad no convive con el rango de semana')

  const toda = applyAging('', '2026-08-05')
  assert.equal(toda.bucket, '')
  assert.equal(toda.date_from, '2026-08-03', 'quitar la antigüedad vuelve a la semana en curso')
})

test('hay exactamente dos períodos y el primero es la semana', () => {
  assert.deepEqual(TORRE_PERIODS.map((p) => p.value), ['week', 'historical'])
})

// ── Avance: separar "ya terminó" de "va a medias" ───────────────────────────

test('el avance distingue la ruta terminada en piso', () => {
  const terminada = progressOf(data.rows[0])
  assert.equal(terminada.label, '33/33')
  assert.equal(terminada.pct, 100)
  assert.ok(terminada.finished)
  assert.equal(terminada.note, 'terminada en piso')

  const media = progressOf(data.rows[1])
  assert.equal(media.label, '12/40')
  assert.equal(media.pct, 30)
  assert.ok(!media.finished)
  assert.equal(media.note, '')
})

test('sin paradas no se inventa un 0%', () => {
  const p = progressOf({ stops_total: 0, stops_done: 0 })
  assert.equal(p.pct, null, 'no hay avance que medir')
  assert.equal(p.label, '—')
})

// ── Caja según el bucket que se mira ────────────────────────────────────────

test('el monto que se muestra depende del bucket', () => {
  const row = { cash_pending_amount: 100, cash_closed_pending_amount: 900 }
  assert.equal(cashForBucket(row, 'open'), 100)
  assert.equal(cashForBucket(row, 'draft'), 100)
  assert.equal(cashForBucket(row, 'closed_cash_pending'), 900,
    'en cerradas el dinero atado es el otro campo')
})

// ── Riesgo legible, no solo un color ────────────────────────────────────────

test('el riesgo lleva ETIQUETA, no solo color', () => {
  for (const nivel of ['high', 'medium', 'low', 'unknown', 'inventado']) {
    const tono = riskTone(nivel)
    assert.ok(tono.label && tono.label.length > 1, `${nivel} sin etiqueta legible`)
    assert.match(tono.fg, /^#[0-9a-f]{6}$/i)
  }
  assert.equal(riskTone('catastrofico').label, 'Sin evaluar', 'un nivel desconocido no se inventa')
})

test('los tonos de riesgo cumplen AA sobre su propio fondo', () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  for (const [nivel, tono] of Object.entries({ high: riskTone('high'), medium: riskTone('medium'), low: riskTone('low'), unknown: riskTone('unknown') })) {
    assert.ok(ratio(tono.fg, tono.bg) >= 4.5, `${nivel}: ${ratio(tono.fg, tono.bg).toFixed(2)}:1`)
  }
})

// ── Honestidad sobre cuántas filas se están mirando ─────────────────────────

test('declara sobre cuántas filas habla cuando el endpoint topa', () => {
  const parcial = coverage(50, 217)
  assert.ok(parcial.partial)
  assert.match(parcial.text, /50 de 217/)

  const completo = coverage(12, 12)
  assert.ok(!completo.partial)
  assert.match(completo.text, /12 en total/)
})

// ── Filtros y orden coherentes con el contrato ──────────────────────────────

test('los buckets cubren los dos huérfanos, que dejan de ser un número', () => {
  const valores = TORRE_BUCKETS.map((b) => b.value)
  assert.deepEqual(valores, ['open', 'draft', 'closed_cash_pending'])
})

test('la antigüedad usa los buckets del contrato', () => {
  assert.deepEqual(AGING_FILTERS.map((a) => a.value), ['', 'day', 'recent', 'historical'])
})

test('el orden por sucursal NO se ofrece: es una sola sucursal', () => {
  const valores = TORRE_SORTS.map((s) => s.value)
  assert.ok(!valores.includes('branch_name'), 'ordenar por sucursal no ordena nada aquí')
  assert.deepEqual(valores, ['age_days', 'cash_pending_amount', 'scheduled_date'])
})

// ── Navegación: solo lectura ────────────────────────────────────────────────

test('el CTA NAVEGA al detalle y tolera un plan sin id', () => {
  assert.equal(routeDetailPath({ plan_id: 274 }), '/equipo/rutas?plan=274')
  assert.equal(routeDetailPath({ plan_id: null }), '/equipo/rutas')
  assert.equal(routeDetailPath(null), '/equipo/rutas')
})

test('última actividad vacía no se disfraza de fecha', () => {
  assert.equal(fmtActivity(''), '—')
  assert.equal(fmtActivity(null), '—')
  assert.notEqual(fmtActivity('2026-05-21 18:30:00'), '—')
})

// ── Reglas duras de la superficie (se leen del código) ──────────────────────

function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const PANTALLA = () => readFileSync(new URL('../src/modules/supervisor-ventas/torre/ScreenTorreSupervisor.jsx', import.meta.url), 'utf8')

test('la Torre es SOLO LECTURA: ningún control ejecuta acciones', () => {
  const src = sinComentarios(PANTALLA())
  for (const prohibido of ['POST', 'api(', 'onClose(', 'cerrarRuta', 'mutate']) {
    assert.ok(!src.includes(prohibido), `la vista contiene "${prohibido}"`)
  }
  // Todo onClick o navega, o cambia filtro, o recarga.
  const handlers = [...src.matchAll(/onClick=\{\(\)\s*=>\s*([a-zA-Z_.]+)\(/g)].map((m) => m[1])
  for (const h of handlers) {
    assert.ok(['setFilter', 'patchFilters', 'goOffset', 'reload', 'navigate', 'onOpen'].includes(h),
      `handler inesperado: ${h}`)
  }
})

test('la Torre NO reconstruye el fetch ni re-clasifica buckets', () => {
  const src = PANTALLA()
  const hook = readFileSync(new URL('../src/modules/torre/m1/useM1BacklogQuery.js', import.meta.url), 'utf8')

  assert.ok(!src.includes("from '../../../lib/api'"), 'la pantalla no llama a la API directo')
  for (const pieza of ['buildBacklogQuery', 'normalizePayload', 'classifyError', 'TOWER_M1_BACKLOG_PATH']) {
    assert.ok(hook.includes(pieza), `el hook no reutiliza ${pieza}`)
  }
  assert.ok(src.includes("torre/m1/m1BacklogModel"), 'la pantalla reutiliza el modelo compartido')
})

test('la semana arranca en la tz de la SUCURSAL, no en UTC (Codex P2)', () => {
  const src = PANTALLA()
  assert.match(src, /zonedTodayStr\(BRANCH_TIME_ZONE\)/,
    'la fecha de referencia sale de la tz de la sucursal')
  assert.match(src, /America\/Mexico_City/, 'la tz operativa es la de la plaza')
  assert.doesNotMatch(src, /utcTodayStr\(\)/, 'ya NO se deriva de UTC (bug de domingo por la tarde)')
})

test('zonedTodayStr: domingo por la tarde de México NO salta a lunes', () => {
  // Domingo 2026-08-09 23:00 en México (UTC-6) = lunes 2026-08-10 05:00 UTC.
  const ms = Date.UTC(2026, 7, 10, 5, 0, 0)
  assert.equal(utcTodayStr(ms), '2026-08-10', 'en UTC ya es lunes (el bug)')
  assert.equal(zonedTodayStr('America/Mexico_City', ms), '2026-08-09',
    'en la sucursal sigue siendo domingo: la Torre no abre la semana siguiente')
  // La semana en curso derivada es la que contiene ese domingo, no la siguiente.
  assert.deepEqual(weekRange(zonedTodayStr('America/Mexico_City', ms)),
    { date_from: '2026-08-03', date_to: '2026-08-09' })
  assert.equal(zonedTodayStr('zona/invalida', ms), utcTodayStr(ms), 'tz inválida cae a UTC, no revienta')
})

test('el hook no dispara I/O dentro del updater de setState (Codex P2)', () => {
  const hook = readFileSync(new URL('../src/modules/torre/m1/useM1BacklogQuery.js', import.meta.url), 'utf8')
  // El fetch (load) no debe vivir dentro de setFilters(prev => …): en StrictMode
  // el updater puede correr dos veces y duplicar la petición.
  assert.doesNotMatch(hook, /setFilters\(\s*\(prev\)\s*=>/, 'sin updater con función (ni I/O dentro)')
  assert.match(hook, /const applyNext = useCallback/, 'el siguiente estado se calcula fuera del updater')
  assert.match(hook, /filtersRef/, 'con un ref al filtro vivo para evitar closures obsoletos')
})

test('arranca en la SEMANA EN CURSO, no en el histórico', () => {
  // Este test decía lo contrario ("arranca por el envejecimiento") y fijaba el
  // default que la auditoría marcó como el bug: Aida abría y no veía su semana.
  // El encabezado sigue titulando el envejecimiento (KPI protagonista), pero las
  // FILAS arrancan en la semana; el histórico es una vista aparte, explícita.
  const src = PANTALLA()
  assert.ok(!src.includes("bucket: 'historical'"),
    'ya NO arranca filtrada a >7 días')
  assert.match(src, /initialTorreFilters\(today\)/,
    'el arranque sale del modelo puro (semana en curso)')
  assert.match(src, /TORRE_PERIODS/, 'el histórico es un período seleccionable, no el default')
})

test('la Torre NO repite lo que ya vive en Pendientes', () => {
  const src = sinComentarios(PANTALLA())
  // El acomodo por acción, las candidatas como sección y el rezago plegado son
  // de Pendientes. Aquí "candidatas" solo existe como filtro, no como bucket.
  assert.ok(!src.includes('groupByRecommendedAction'), 'el acomodo por acción es de Pendientes')
  assert.ok(!src.includes('buildM1Accommodation'), 'la Torre no arma el acomodo')
  assert.ok(!src.includes('REZAGO'), 'el rezago plegado es de Pendientes')
})

test('los estados son honestos: nunca tabla en ceros ni JSON crudo', () => {
  const src = PANTALLA()
  for (const estado of ['feature_disabled', 'no_branch_scope', 'forbidden', 'session_expired', 'error', 'empty']) {
    assert.ok(src.includes(estado), `falta el estado ${estado}`)
  }
  assert.ok(src.includes('StateScreen'), 'los estados salen por StateScreen')
  assert.ok(!src.includes('JSON.stringify'), 'nunca se pinta el payload crudo')
})

test('el ruteo ramifica por el tower_status AUTORITATIVO, no por session.role', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const mount = app.slice(app.indexOf('function ScreenM1BacklogMount'), app.indexOf('function M2PlaneacionRoute'))

  assert.match(mount, /readAuthoritativeTowerStatus\(session\) === 'supervisor_ventas'/)
  assert.ok(mount.includes('<ScreenTorreSupervisor />'), 'el supervisor ve la curada')
  assert.ok(mount.includes('<ScreenM1Backlog session={session} />'),
    'dirección (y cualquier otro valor) sigue viendo la cruda: fail-closed')
  assert.ok(!mount.includes('session.role'), 'el rol no sale de session.role')
})
