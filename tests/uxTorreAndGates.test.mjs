// KOLD OS · Etapa 0A — /torre parse seguro (AJUSTE 2), política de rutas (AJUSTE 1)
// y evidencia de los gates 3-4 (M1 leyenda, M3 affordance).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchTowerStatus, TOWER_STATUS_ERROR_KINDS } from '../src/modules/torre/e1/loadTowerStatus.js'
import { isNavHiddenForPath } from '../src/lib/navModel.js'

const VALID = JSON.stringify({
  version: '1', generated_for_role: 'supervisor_ventas', data_as_of: '2026-07-17T00:00:00Z',
  read_only: true, role_gate: { is_gated: false }, modules: [],
})

// Response mock configurable (body leído UNA sola vez como texto).
function mkRes({ ok = true, status = 200, ctype = 'application/json', body = '' }) {
  return { ok, status, headers: { get: () => ctype }, text: async () => body }
}
const impl = (res) => async () => res

// ── AJUSTE 2 — los 7 casos de parseo ─────────────────────────────────────────
test('200 + HTML (SPA rewrite) ⇒ NOT_PUBLISHED, jamás "Unexpected token"', async () => {
  const html = '<!doctype html><html><body>app</body></html>'
  await assert.rejects(
    fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ ctype: 'text/html', body: html })) }),
    (e) => e.kind === TOWER_STATUS_ERROR_KINDS.NOT_PUBLISHED && !/Unexpected token/.test(e.message))
})

test('404 ⇒ NOT_PUBLISHED', async () => {
  await assert.rejects(
    fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ ok: false, status: 404 })) }),
    (e) => e.kind === TOWER_STATUS_ERROR_KINDS.NOT_PUBLISHED)
})

test('500 ⇒ HTTP_ERROR', async () => {
  await assert.rejects(
    fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ ok: false, status: 500 })) }),
    (e) => e.kind === TOWER_STATUS_ERROR_KINDS.HTTP_ERROR)
})

test('content-type incorrecto ⇒ INVALID_RESPONSE', async () => {
  await assert.rejects(
    fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ ctype: 'text/plain', body: 'run 1 2 3' })) }),
    (e) => e.kind === TOWER_STATUS_ERROR_KINDS.INVALID_RESPONSE)
})

test('JSON inválido ⇒ INVALID_RESPONSE', async () => {
  await assert.rejects(
    fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ body: '{ not json' })) }),
    (e) => e.kind === TOWER_STATUS_ERROR_KINDS.INVALID_RESPONSE)
})

test('respuesta vacía ⇒ INVALID_RESPONSE', async () => {
  await assert.rejects(
    fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ body: '   ' })) }),
    (e) => e.kind === TOWER_STATUS_ERROR_KINDS.INVALID_RESPONSE)
})

test('JSON válido ⇒ documento parseado', async () => {
  const doc = await fetchTowerStatus('supervisor_ventas', { base: '/e1', fetchImpl: impl(mkRes({ body: VALID })) })
  assert.equal(doc.generated_for_role, 'supervisor_ventas')
})

// ── AJUSTE 1 — las tres familias de rutas ────────────────────────────────────
test('familia /torre (E1): oculta EXACTA de la nav', () => {
  assert.equal(isNavHiddenForPath('/torre'), true)
})
test('familia /torre/backlog (M1): nav global VISIBLE', () => {
  assert.equal(isNavHiddenForPath('/torre/backlog'), false)
  assert.equal(isNavHiddenForPath('/torre/backlog?state_bucket=open'), false)
})
test('familia /torres/* (requisiciones): operativo full-screen (oculto)', () => {
  assert.equal(isNavHiddenForPath('/torres'), false)       // raíz conserva nav
  assert.equal(isNavHiddenForPath('/torres/requisicion/9'), true) // subruta operativa oculta
})

// ── Gate 3 — M1 declara que los KPIs son totales globales ────────────────────
test('M1 muestra leyenda de totales globales vs tabla filtrada', () => {
  const m1 = readFileSync(new URL('../src/modules/torre/m1/ScreenM1Backlog.jsx', import.meta.url), 'utf8')
  assert.match(m1, /data-testid="m1-filter-legend"/)
  assert.match(m1, /totales globales/i)
  assert.match(m1, /tabla de abajo\s*[\s\S]{0,40}filtrada/i)
})

// ── Gate 4 — M3 tiene affordance de desplazamiento ───────────────────────────
test('M3 muestra affordance de desplazamiento horizontal', () => {
  const m3 = readFileSync(new URL('../src/modules/ejecucion/ScreenEjecucionM3.jsx', import.meta.url), 'utf8')
  assert.match(m3, /data-testid="m3-scroll-hint"/)
  assert.match(m3, /Desliza horizontalmente/i)
})

// ── Gate 1 — TowerStatusBoard usa StateScreen controlado (no error crudo) ────
test('TowerStatusBoard renderiza StateScreen y no expone el mensaje crudo', () => {
  const board = readFileSync(new URL('../src/modules/torre/e1/TowerStatusBoard.jsx', import.meta.url), 'utf8')
  assert.match(board, /StateScreen/)
  assert.match(board, /aún no está publicado/i)
  assert.ok(!/No se pudo cargar el estado: \{state\.error\}/.test(board), 'ya no pinta el error crudo')
})
