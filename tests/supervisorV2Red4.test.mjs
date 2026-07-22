// Supervisor V2 · RED#4 — tests de COMPORTAMIENTO (Codex §16) + cableado.
// Reproducen LITERALMENTE los hallazgos: writes que ignoran envelopes, caché sin
// identidad de sesión, cierres parciales con 0 fabricado, Score con fecha del
// dispositivo, y el retiro de Planeación. No son solo scans de strings: la mayoría
// ejercita la lógica pura real; los de cableado auditan el código fuente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizeWriteResponse, WRITE_PHASE } from '../src/modules/supervisor-ventas/v2/normalizeWriteResponse.js'
import { sessionScopeKey } from '../src/modules/supervisor-ventas/v2/sessionScope.js'
import { sourceVersion, routeStopsCacheKey } from '../src/modules/supervisor-ventas/v2/dataSources.js'
import { deriveSituation } from '../src/modules/supervisor-ventas/v2/presentation.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── §7: normalizador de writes — el envelope MANDA, sin éxito optimista ──────
test('write: status ok ⇒ success', () => {
  const r = normalizeWriteResponse({ status: 'ok', code: 'OK', data: { x: 1 } })
  assert.equal(r.ok, true)
  assert.equal(r.phase, WRITE_PHASE.SUCCESS)
})
test('write: status error FORBIDDEN ⇒ forbidden y NO éxito', () => {
  const r = normalizeWriteResponse({ status: 'error', code: 'FORBIDDEN' })
  assert.equal(r.ok, false)
  assert.equal(r.phase, WRITE_PHASE.FORBIDDEN)
})
test('write: UNAUTHORIZED ≠ FORBIDDEN (semántica distinta)', () => {
  assert.equal(normalizeWriteResponse({ status: 'error', code: 'UNAUTHORIZED' }).phase, WRITE_PHASE.UNAUTHORIZED)
  assert.equal(normalizeWriteResponse({ status: 'error', code: 'FORBIDDEN' }).phase, WRITE_PHASE.FORBIDDEN)
})
test('write: status busy ⇒ locked, retryable, NO éxito', () => {
  const r = normalizeWriteResponse({ status: 'busy', code: 'LOCKED' })
  assert.equal(r.ok, false)
  assert.equal(r.phase, WRITE_PHASE.LOCKED)
  assert.equal(r.retryable, true)
})
test('write: CONFLICT es retryable (la UI recarga y re-confirma)', () => {
  const r = normalizeWriteResponse({ status: 'error', code: 'CONFLICT' })
  assert.equal(r.phase, WRITE_PHASE.CONFLICT)
  assert.equal(r.retryable, true)
})
test('write: DATE_NOT_ALLOWED y VALIDATION mapean a su fase', () => {
  assert.equal(normalizeWriteResponse({ status: 'error', code: 'DATE_NOT_ALLOWED' }).phase, WRITE_PHASE.DATE_NOT_ALLOWED)
  assert.equal(normalizeWriteResponse({ status: 'error', code: 'VALIDATION_ERROR' }).phase, WRITE_PHASE.VALIDATION)
  assert.equal(normalizeWriteResponse({ status: 'error', code: 'CONFIRM_REQUIRED' }).phase, WRITE_PHASE.VALIDATION)
})
test('write: code de error DESCONOCIDO ⇒ invalid (jamás éxito)', () => {
  const r = normalizeWriteResponse({ status: 'error', code: 'ALGO_RARO' })
  assert.equal(r.ok, false)
  assert.equal(r.phase, WRITE_PHASE.INVALID)
})
test('write: malformed (null / string / {}) ⇒ NUNCA éxito', () => {
  assert.equal(normalizeWriteResponse(null).ok, false)
  assert.equal(normalizeWriteResponse('nope').ok, false)
  assert.equal(normalizeWriteResponse({}).ok, false)
  assert.equal(normalizeWriteResponse([]).ok, false)
})
test('write: error de red (throw) ⇒ network retryable', () => {
  const r = normalizeWriteResponse(null, { code: 'TypeError', message: 'Failed to fetch' })
  assert.equal(r.phase, WRITE_PHASE.NETWORK)
  assert.equal(r.retryable, true)
})
test('write: payload crudo ok:false ⇒ no éxito', () => {
  assert.equal(normalizeWriteResponse({ ok: false, code: 'VALIDATION_ERROR' }).ok, false)
  assert.equal(normalizeWriteResponse({ ok: true }).ok, true)
})

// ── §5/§6: identidad de sesión en las claves de caché ────────────────────────
test('sessionScopeKey: dos empleados/tokens distintos ⇒ claves distintas', () => {
  const a = sessionScopeKey({ odoo_employee_token: 'AAAAAAAAAAAA', employee_id: 1, company_id: 34 })
  const b = sessionScopeKey({ odoo_employee_token: 'BBBBBBBBBBBB', employee_id: 2, company_id: 34 })
  assert.notEqual(a, b)
})
test('sessionScopeKey: misma sesión ⇒ clave estable', () => {
  const s = { odoo_employee_token: 'tok1234567890', employee_id: 1 }
  assert.equal(sessionScopeKey(s), sessionScopeKey(s))
})
test('sessionScopeKey: cambio de sucursal/company/warehouse ⇒ clave distinta', () => {
  const base = { odoo_employee_token: 'tok1234567890', employee_id: 1, company_id: 34, warehouse_id: 89 }
  assert.notEqual(sessionScopeKey(base), sessionScopeKey({ ...base, warehouse_id: 90 }))
  assert.notEqual(sessionScopeKey(base), sessionScopeKey({ ...base, company_id: 35 }))
})
test('routeStopsCacheKey: incluye contrato DTO y difiere por plan/ruta/branch', () => {
  const dc = { date: '2026-01-15', branch: { branch_config_id: 29, company_id: 34 }, generated_at: 'g1' }
  const k = routeStopsCacheKey({ dayControl: dc, planId: 10, routeId: 5 })
  assert.match(k, /route_stops\/1/)
  assert.notEqual(k, routeStopsCacheKey({ dayControl: dc, planId: 11, routeId: 5 }))
  assert.notEqual(k, routeStopsCacheKey({ dayControl: dc, planId: 10, routeId: 6 }))
  const dc2 = { ...dc, branch: { branch_config_id: 30, company_id: 34 } }
  assert.notEqual(k, routeStopsCacheKey({ dayControl: dc2, planId: 10, routeId: 5 }))
})
test('sourceVersion: difiere por sucursal y company', () => {
  const a = sourceVersion({ date: 'd', branch: { branch_config_id: 1, company_id: 34 }, generated_at: 'g' })
  const b = sourceVersion({ date: 'd', branch: { branch_config_id: 2, company_id: 34 }, generated_at: 'g' })
  const c = sourceVersion({ date: 'd', branch: { branch_config_id: 1, company_id: 35 }, generated_at: 'g' })
  assert.notEqual(a, b)
  assert.notEqual(a, c)
})

// ── §11: cierres parcialmente desconocidos (sin 0 fabricado) ─────────────────
test('cierres: suma PARCIAL declarada, sin coaccionar null a 0', () => {
  // closed/corte_done presentes; liquidated/validated AUSENTES.
  const dc = { generated_at: 'g', summary: { close: { closed: 2, corte_done: 1 } }, routes: [] }
  const s = deriveSituation(dc)
  assert.equal(s.cerradas.available, true)
  assert.equal(s.cerradas.value, 3) // solo lo conocido (2+1), no +0+0
  assert.equal(s.cerradas.partial, true)
  assert.deepEqual([...s.cerradas.missing].sort(), ['liquidated', 'validated'])
  assert.equal(s.cerradas.source, 'day_control.summary.close')
})
test('cierres: bloque close ausente ⇒ no disponible (jamás 0)', () => {
  const s = deriveSituation({ generated_at: 'g', summary: {}, routes: [] })
  assert.equal(s.cerradas.available, false)
  assert.equal(s.cerradas.value, null)
})
test('cierres: todas las etapas presentes ⇒ suma NO parcial', () => {
  const dc = { generated_at: 'g', summary: { close: { closed: 1, corte_done: 1, liquidated: 1, validated: 1 } }, routes: [] }
  const s = deriveSituation(dc)
  assert.equal(s.cerradas.value, 4)
  assert.equal(s.cerradas.partial, false)
})

// ── §15/§16: aserciones de cableado sobre el código fuente real ──────────────
test('wiring: MasView NO declara Pronóstico ni Agregar cliente (§4)', () => {
  const s = src('modules/supervisor-ventas/v2/mas/MasView.jsx')
  assert.ok(!s.includes("route: '/equipo/pronostico'"), 'Pronóstico retirado')
  assert.ok(!s.includes("route: '/equipo/planes/clientes'"), 'Agregar cliente retirado')
})
test('wiring: App.jsx envuelve pronostico/planes en V2ExcludedRoute (§4)', () => {
  const s = src('App.jsx')
  assert.match(s, /path="\/equipo\/pronostico"[^\n]*V2ExcludedRoute/)
  assert.match(s, /path="\/equipo\/planes\/clientes"[^\n]*V2ExcludedRoute/)
})
test('wiring: Score NO usa civilWeekRange() del dispositivo (§14)', () => {
  const svc = src('modules/supervisor-ventas/supvService.js')
  assert.ok(/resolveServerOperationalDate/.test(svc), 'ancla en fecha del servidor')
  assert.ok(!/civilWeekRange\(\)/.test(svc), 'sin civilWeekRange() no-arg (device)')
  const screen = src('modules/supervisor-ventas/ScreenScoreSemanal.jsx')
  assert.ok(!/civilWeekRange/.test(screen), 'la pantalla ya no importa civilWeek')
  assert.ok(/serverDate/.test(screen) && /score-unavailable/.test(screen), 'usa serverDate + estado unavailable')
})
test('wiring: ≥3 writes V2 pasan por normalizeWriteResponse (§7)', () => {
  const s = src('lib/api.js')
  const uses = (s.match(/normalizeWriteResponse\(/g) || []).length
  assert.ok(uses >= 3, `esperados ≥3 usos (publish/customers/forecast), hubo ${uses}`)
})
test('wiring: useOperationalDay con identidad de sesión + invalidador + reqSeq (§5)', () => {
  const s = src('modules/supervisor-ventas/v2/useOperationalDay.js')
  assert.ok(/sessionScopeKey/.test(s))
  assert.ok(/invalidateOperationalDayCacheForSessionChange/.test(s))
  assert.ok(/reqSeq/.test(s))
})
test('wiring: forecast adapter exige expected_write_date + confirm_replace_all (§9)', () => {
  const s = src('lib/api.js')
  assert.ok(/expected_write_date requerido/.test(s))
  assert.ok(/confirm_empty_replace/.test(s))
})
