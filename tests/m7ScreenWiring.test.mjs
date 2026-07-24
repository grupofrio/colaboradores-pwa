// KOLD OS · M7 — el cableado REAL de la pantalla con el controller. Codex marcó
// que el botón "Ver" no recargaba nada (setSelected cosmético). Estas aserciones
// leen la pantalla como texto y fijan que sí re-ancla, con guarda de carrera y
// defensa, y que el claim falso "carga EXACTAMENTE ese run" ya no existe.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const screen = readFileSync(
  new URL('../src/modules/rentabilidad-costos/ScreenRentabilidadCostosM7.jsx', import.meta.url), 'utf8')

test('el botón "Ver" DESPACHA la selección al controller (no setSelected cosmético)', () => {
  assert.match(screen, /dispatch\(selectRunAction\(r\)\)/)
  assert.ok(!/setSelected\(/.test(screen), 'ya no existe el estado local cosmético setSelected')
})

test('findings se piden ANCLADOS: planFindingsRequest(selection, …)', () => {
  assert.match(screen, /planFindingsRequest\(selection,/)
})

test('defensa anti-fallback: se verifica el run_id que ecoa el backend', () => {
  assert.match(screen, /findingsAnchorMismatch\(res\.payload, selection\)/)
  assert.match(screen, /run_mismatch/)
})

test('guarda de carrera: makeSeqGuard + isStale descartan respuestas tardías', () => {
  assert.match(screen, /makeSeqGuard\(\)/)
  assert.match(screen, /guard\.current\.isStale\(token\)/)
})

test('el fixture demo se carga por import DINÁMICO gated, no estático', () => {
  assert.match(screen, /import\('virtual:m7-demo-fixture'\)/)
  assert.ok(!/from '\.\/m7\/fixtures\/apiLatestFixture'/.test(screen),
    'NO debe haber import estático del fixture en la pantalla')
  assert.match(screen, /canLoadM7DemoFixture\(/)
})

test('limpiar selección: clearRunAction disponible en la vista', () => {
  assert.match(screen, /dispatch\(clearRunAction\(\)\)/)
})

test('el claim FALSO "carga EXACTAMENTE ese run" fue retirado', () => {
  assert.ok(!/carga EXACTAMENTE ese run/i.test(screen))
})

test('la vista declara que summary/capacidades siguen siendo la corrida más reciente', () => {
  assert.match(screen, /más reciente/)
  assert.match(screen, /no expone un payload completo por corrida/)
})

test('el export de hallazgos reúne la corrida anclada (todas las páginas)', () => {
  assert.match(screen, /collectAnchoredFindings/)
  assert.match(screen, /runContext: anchor/)
})

test('los exports se BLOQUEAN mientras se prepara (busy)', () => {
  assert.match(screen, /disabled=\{busy\}/)
})
