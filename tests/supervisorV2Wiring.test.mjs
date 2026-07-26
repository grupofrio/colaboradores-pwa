// Supervisor V2 · tests de CABLEADO REAL (Codex §15) + semana civil (§14).
// Sin RTL en la infra ⇒ se combinan: (a) lógica pura (civilWeek), (b) aserciones
// de cableado sobre el CÓDIGO FUENTE real de los contenedores/vistas (que detectan
// específicamente las regresiones que Codex encontró: res.ok, links excluidos,
// ORM legacy en V2, gate-antes-de-fetch).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  civilWeekRange, civilWeekday, addDays,
} from '../src/modules/supervisor-ventas/v2/civilWeek.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── §14: semana civil pura (sin Date/Intl device-tz) ─────────────────────────
test('civilWeekday: días conocidos', () => {
  assert.equal(civilWeekday({ y: 2026, m: 1, d: 15 }), 4) // jueves
  assert.equal(civilWeekday({ y: 2026, m: 1, d: 19 }), 1) // lunes
})
test('civilWeekRange: Lun–Dom con todayIndex', () => {
  const w = civilWeekRange('2026-01-15') // jueves
  assert.equal(w.monday, '2026-01-12')
  assert.equal(w.sunday, '2026-01-18')
  assert.equal(w.days.length, 7)
  assert.equal(w.todayIndex, 3) // jueves = índice 3 (Lun=0)
  assert.equal(w.days[0], '2026-01-12')
})
test('civilWeekRange: cambio de mes y de año (aritmética civil)', () => {
  const feb = civilWeekRange('2024-02-29') // bisiesto, jueves
  assert.equal(feb.days.includes('2024-02-29'), true)
  const ny = civilWeekRange('2026-01-01') // jueves
  assert.equal(ny.days.includes('2025-12-29'), true) // la semana cruza el año
})
test('civilWeekRange: fecha inválida ⇒ fallback UTC (no crash)', () => {
  const w = civilWeekRange('no-date')
  assert.equal(w.days.length, 7) // usa la fecha UTC de hoy
})
test('addDays: cruza fin de mes', () => {
  assert.deepEqual(addDays({ y: 2026, m: 1, d: 31 }, 1), { y: 2026, m: 2, d: 1 })
  assert.deepEqual(addDays({ y: 2026, m: 3, d: 1 }, -1), { y: 2026, m: 2, d: 28 })
})

// ── §15: aserciones de cableado sobre el código fuente ───────────────────────
test('wiring: RutasTab consume el contrato phase, NO res.ok', () => {
  const s = src('modules/supervisor-ventas/v2/tabs/RutasTab.jsx')
  assert.ok(/PHASE\.OK/.test(s), 'RutasTab debe usar PHASE.OK')
  assert.ok(!/res\.ok\b/.test(s), 'RutasTab NO debe depender de res.ok')
  assert.ok(/reqIdRef/.test(s), 'RutasTab debe tener request-id monotónico (§6)')
  assert.ok(/dayVersion/.test(s), 'RutasTab debe recargar por versión de fuente (§6)')
})
test('wiring: ClientesTab cuenta fallida solo por phase, con request-id', () => {
  const s = src('modules/supervisor-ventas/v2/tabs/ClientesTab.jsx')
  assert.ok(/PHASE\.OK/.test(s) && /PHASE\.EMPTY/.test(s), 'ClientesTab usa phase')
  assert.ok(!/value\?\.ok\b/.test(s) && !/res\.value\?\.ok/.test(s), 'ClientesTab NO usa .ok')
  assert.ok(/reqIdRef/.test(s) && /dayVersion/.test(s), 'ClientesTab con reqId + versión')
})
test('wiring: MasView NO enlaza rutas excluidas (§2/§3)', () => {
  const s = src('modules/supervisor-ventas/v2/mas/MasView.jsx')
  for (const r of ['/equipo/tareas', '/equipo/notas', '/equipo/nota-rapida', '/equipo/bajas']) {
    assert.ok(!s.includes(`route: '${r}'`), `MasView NO debe declarar el tile ${r}`)
  }
})
test('wiring: rutas legacy excluidas envueltas en V2ExcludedRoute (deep-link seguro)', () => {
  const s = src('App.jsx')
  for (const path of ['/equipo/tareas', '/equipo/notas', '/equipo/nota-rapida', '/equipo/bajas']) {
    const re = new RegExp(`path="${path}"[^\\n]*V2ExcludedRoute`)
    assert.ok(re.test(s), `${path} debe ir por V2ExcludedRoute`)
  }
})
test('wiring: dataSources ya NO exporta classify/RESULT (contrato único)', () => {
  const s = src('modules/supervisor-ventas/v2/dataSources.js')
  assert.ok(!/export function classify/.test(s), 'classify eliminado')
  assert.ok(!/export const RESULT/.test(s), 'RESULT eliminado')
  assert.ok(/normalizeSupervisorV2Response/.test(s), 'usa el normalizador único')
})
test('wiring: V2 no lee route-stops por ORM/sudo (usa el DTO)', () => {
  const s = src('modules/supervisor-ventas/v2/dataSources.js')
  assert.ok(!/readModelSorted|get_records|sudo:\s*1/.test(s), 'sin ORM/sudo en V2 dataSources')
  assert.ok(/getRouteStopsV2/.test(s), 'usa el cliente DTO')
})
test('wiring: Score se ancla en la fecha del SERVIDOR, no en el dispositivo (§14)', () => {
  const svc = src('modules/supervisor-ventas/supvService.js')
  // RED#4: getWeeklyScore ya NO usa civilWeekRange() no-arg (device); resuelve la
  // fecha operativa del servidor y ancla la semana en ella (civilWeekRange(server)).
  assert.ok(/resolveServerOperationalDate/.test(svc), 'resuelve fecha del servidor')
  assert.ok(!/civilWeekRange\(\)/.test(svc), 'sin civilWeekRange() no-arg (device)')
  const screen = src('modules/supervisor-ventas/ScreenScoreSemanal.jsx')
  assert.ok(!/civilWeekRange/.test(screen), 'la pantalla ya no usa civilWeek del dispositivo')
  assert.ok(/data\?\.serverDate/.test(screen), 'todayStr usa data.serverDate')
})
