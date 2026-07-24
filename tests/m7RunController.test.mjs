// KOLD OS · M7 — controller de corrida seleccionada (autoridad ÚNICA, código real
// que usa la pantalla). Cubre el BLOCKER de Codex: la selección re-ancla findings
// y export; jamás cae a latest; carrera protegida; summary/capabilities siguen
// siendo latest (el backend no expone payload por corrida histórica).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  runContextFromLatest, runContextFromRunsItem, initSelection, m7SelectionReducer,
  selectRunAction, clearRunAction, planFindingsRequest, planRunsRequest,
  findingsAnchorMismatch, selectedRunContext, isLatestSelected, makeSeqGuard,
} from '../src/modules/rentabilidad-costos/m7/runController.js'
import { M7_API_LATEST_FIXTURE } from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const LATEST = M7_API_LATEST_FIXTURE
const LATEST_RUN = LATEST.run.run_id
const LATEST_SCOPE = LATEST.run.scope_key

// una corrida histórica B, distinta de la latest.
const RUN_B = {
  run_id: 'bbbbbbbb1111bbbbbbbb2222bbbbbbbb3333bbbbbbbb4444bbbbbbbb5555bbbb',
  scope_key: 'ssssssss1111ssssssss2222ssssssss3333ssssssss4444ssssssss5555ssss',
  finished_at: '2026-05-01T00:00:00Z', is_production_shell_run: false,
  measurement_method: 'xml_rpc_read_only', auditor_build_sha: 'deadbeefcafe', finding_count: 12,
}

// ── contexto de corrida ──────────────────────────────────────────────────────
test('runContextFromLatest expone el scope económico COMPLETO (isLatest)', () => {
  const c = runContextFromLatest(LATEST)
  assert.equal(c.run_id, LATEST_RUN)
  assert.equal(c.isLatest, true)
  assert.ok(c.full, 'latest trae scope completo')
  assert.ok(Array.isArray(c.full.currency_ids) && c.full.currency_ids.length >= 2)
})

test('runContextFromRunsItem es PARCIAL: metadata sí, scope económico NO', () => {
  const c = runContextFromRunsItem(RUN_B, LATEST_RUN)
  assert.equal(c.run_id, RUN_B.run_id)
  assert.equal(c.isLatest, false)
  assert.equal(c.full, null, 'el backend no expone scope por corrida histórica')
})

// ── reducer: la única transición ─────────────────────────────────────────────
test('estado inicial: anclado a la corrida latest', () => {
  const s = initSelection(LATEST)
  assert.equal(isLatestSelected(s), true)
  assert.equal(selectedRunContext(s).run_id, LATEST_RUN)
})

test('SELECT re-ancla a la corrida histórica; CLEAR vuelve a latest', () => {
  let s = initSelection(LATEST)
  s = m7SelectionReducer(s, selectRunAction(RUN_B))
  assert.equal(isLatestSelected(s), false)
  assert.equal(selectedRunContext(s).run_id, RUN_B.run_id)
  s = m7SelectionReducer(s, clearRunAction())
  assert.equal(isLatestSelected(s), true)
  assert.equal(selectedRunContext(s).run_id, LATEST_RUN)
})

test('SELECT de un item sin run_id NO cambia el ancla (no se ancla a la nada)', () => {
  const s = initSelection(LATEST)
  const s2 = m7SelectionReducer(s, selectRunAction({ scope_key: 'x' }))
  assert.equal(selectedRunContext(s2).run_id, LATEST_RUN)
})

// ── BLOCKER: findings SIEMPRE anclados al run seleccionado ────────────────────
test('planFindingsRequest ancla run_id+scope_key de la corrida vista', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  const p = planFindingsRequest(s, {})
  assert.equal(p.run_id, RUN_B.run_id)
  assert.equal(p.scope_key, RUN_B.scope_key)
})

test('seleccionada A con latest B: la petición lleva A, no B', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  const p = planFindingsRequest(s, {})
  assert.equal(p.run_id, RUN_B.run_id)
  assert.notEqual(p.run_id, LATEST_RUN)
})

test('cambiar filtro CONSERVA el run anclado', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  const p = planFindingsRequest(s, { verdict: 'riesgo' })
  assert.equal(p.run_id, RUN_B.run_id)
  assert.equal(p.verdict, 'riesgo')
})

test('cambiar página CONSERVA run + scope', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  const p = planFindingsRequest(s, { page: 3, page_size: 25 })
  assert.equal(p.run_id, RUN_B.run_id)
  assert.equal(p.scope_key, RUN_B.scope_key)
  assert.equal(p.page, 3)
})

test('limpiar selección: la petición vuelve a la corrida latest', () => {
  let s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  s = m7SelectionReducer(s, clearRunAction())
  assert.equal(planFindingsRequest(s, {}).run_id, LATEST_RUN)
})

// ── DEFENSA anti-fallback silencioso ─────────────────────────────────────────
test('findingsAnchorMismatch: run_id devuelto ≠ anclado ⇒ mismatch', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  assert.equal(findingsAnchorMismatch({ run_id: LATEST_RUN, scope_key: LATEST_SCOPE }, s), true)
  assert.equal(findingsAnchorMismatch({ run_id: RUN_B.run_id, scope_key: RUN_B.scope_key }, s), false)
})

test('findingsAnchorMismatch: scope_key devuelto ≠ anclado ⇒ mismatch', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  assert.equal(findingsAnchorMismatch({ run_id: RUN_B.run_id, scope_key: 'otro' }, s), true)
})

// ── selección para EXPORT ────────────────────────────────────────────────────
test('el export usa el contexto de la corrida anclada (A, no B)', () => {
  const s = m7SelectionReducer(initSelection(LATEST), selectRunAction(RUN_B))
  const ctx = selectedRunContext(s)
  assert.equal(ctx.run_id, RUN_B.run_id)
  assert.equal(ctx.isLatest, false)
})

// ── /runs plan ───────────────────────────────────────────────────────────────
test('planRunsRequest sólo deja pasar params soportados por /runs', () => {
  const p = planRunsRequest({ run_id: 'r', scope_key: 's', verdict: 'riesgo', page: 2 })
  assert.equal(p.run_id, 'r'); assert.equal(p.scope_key, 's'); assert.equal(p.page, 2)
  assert.ok(!('verdict' in p), 'verdict no es param de runs')
})

// ── guarda de carrera ────────────────────────────────────────────────────────
test('makeSeqGuard: una respuesta tardía (A) NO pisa la vigente (B)', () => {
  const g = makeSeqGuard()
  const tokenA = g.next()   // seleccionar A
  const tokenB = g.next()   // seleccionar B (más nueva)
  assert.equal(g.isStale(tokenA), true, 'A quedó obsoleta')
  assert.equal(g.isStale(tokenB), false, 'B es la vigente')
})

test('makeSeqGuard: la respuesta vigente sí se aplica', () => {
  const g = makeSeqGuard()
  const t = g.next()
  assert.equal(g.isStale(t), false)
})
