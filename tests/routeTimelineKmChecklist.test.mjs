// ─── Timeline de ruta: kilometraje y checklist reales ────────────────────────
// Los tres hitos decían "No expuesto por el contrato v1". El dato SÍ existía en
// gf.route.plan; lo que faltaba era exponerlo. Estos tests fijan la regla más
// delicada del cambio: el backend manda `null` cuando no hay captura, NUNCA 0,
// porque el campo de Odoo es Float con default 0.0 y un 0 se leería como
// "salió con el odómetro en cero".
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveRouteTimeline, formatKm } from '../src/modules/supervisor-ventas/v2/presentation.js'

const paso = (t, key) => t.find((s) => s.key === key)
const ruta = (over = {}) => ({
  departure: { status: 'on_time' },
  stops: { total: 10, done: 3 },
  close: { stage: 'open' },
  ...over,
})

test('ya no queda ningún hito diciendo "No expuesto"', () => {
  const src = readFileSync(new URL('../src/modules/supervisor-ventas/v2/presentation.js', import.meta.url), 'utf8')
  assert.ok(!src.includes('No expuesto por el contrato v1'),
    'el contrato ya acredita kilometraje y checklist')
})

test('con lecturas reales se pinta el kilometraje y el recorrido', () => {
  const t = deriveRouteTimeline(ruta({
    close: { stage: 'closed' },
    odometer: { departure_km: 381555, arrival_km: 381712.5, traveled_km: 157.5 },
  }))
  assert.equal(paso(t, 'km_inicial').status, 'done')
  assert.match(paso(t, 'km_inicial').detail, /381,555 km/)
  assert.equal(paso(t, 'km_final').status, 'done')
  assert.match(paso(t, 'km_final').detail, /recorrido 157\.5 km/)
})

test('sin captura NO se pinta un cero: se dice que falta', () => {
  // Caso vivo de hoy: ruta en curso, salida capturada, regreso todavía no.
  const t = deriveRouteTimeline(ruta({ odometer: { departure_km: 437120, arrival_km: null, traveled_km: null } }))
  assert.equal(paso(t, 'km_inicial').status, 'done')
  const final = paso(t, 'km_final')
  assert.equal(final.status, 'unknown', 'la ruta no ha cerrado: todavía no falta nada')
  assert.ok(!/0 km/.test(final.detail), `no puede insinuar un odómetro en cero: "${final.detail}"`)
  assert.ok(!/recorrido/.test(final.detail), 'sin km final no hay recorrido que afirmar')
})

test('una ruta CERRADA sin km final sí queda pendiente', () => {
  const t = deriveRouteTimeline(ruta({
    close: { stage: 'closed' },
    odometer: { departure_km: 437120, arrival_km: null, traveled_km: null },
  }))
  assert.equal(paso(t, 'km_final').status, 'pending')
  assert.match(paso(t, 'km_final').detail, /Sin captura al cerrar/)
})

test('una ruta que NO ha salido no "debe" kilometraje inicial', () => {
  const t = deriveRouteTimeline(ruta({ departure: { status: 'not_departed' }, odometer: {} }))
  assert.equal(paso(t, 'km_inicial').status, 'unknown', 'antes de salir no falta nada')
  assert.match(paso(t, 'km_inicial').detail, /Aún no corresponde/)
})

test('el checklist completo muestra sus conteos', () => {
  const t = deriveRouteTimeline(ruta({
    checklist: { id: 448, state: 'completed', checks_total: 14, checks_answered: 14, checks_passed: 13, checks_required_pending: 0 },
  }))
  const c = paso(t, 'checklist')
  assert.equal(c.status, 'done')
  assert.match(c.detail, /Completado/)
  assert.match(c.detail, /14\/14 puntos/)
  assert.ok(!/pendiente/.test(c.detail), 'con 0 obligatorios pendientes no se menciona ninguno')
})

test('los obligatorios pendientes se dicen, aunque el checklist esté en curso', () => {
  const c = paso(deriveRouteTimeline(ruta({
    checklist: { state: 'in_progress', checks_total: 14, checks_answered: 9, checks_required_pending: 2 },
  })), 'checklist')
  assert.equal(c.status, 'pending')
  assert.match(c.detail, /En progreso · 9\/14 puntos · 2 obligatorio\(s\) pendiente\(s\)/)
})

test('SIN checklist ligado NO es un incumplimiento', () => {
  // ~66% de los planes en producción no tienen checklist: el flujo es de
  // adopción reciente. Marcar eso como falta sería acusar de algo que no pasó.
  const c = paso(deriveRouteTimeline(ruta({ checklist: {} })), 'checklist')
  assert.equal(c.status, 'unknown', 'ausencia ≠ incumplimiento')
  assert.match(c.detail, /Sin checklist ligado/)
})

test('un estado de checklist desconocido se conserva, no se disfraza', () => {
  const c = paso(deriveRouteTimeline(ruta({ checklist: { state: 'escalated' } })), 'checklist')
  assert.equal(c.status, 'pending')
  assert.match(c.detail, /escalated/)
})

test('con la capability apagada los hitos dicen "no disponible", no "sin captura"', () => {
  const t = deriveRouteTimeline(ruta({ odometer: {}, checklist: {} }),
    { odometer_available: false, checklist_available: false })
  for (const key of ['km_inicial', 'km_final', 'checklist']) {
    assert.equal(paso(t, key).status, 'not_available', key)
    assert.match(paso(t, key).detail, /no disponible/, key)
  }
})

test('una ruta sin los bloques nuevos (backend viejo) no revienta', () => {
  const t = deriveRouteTimeline(ruta())
  assert.equal(t.length, 14, 'siguen siendo 14 hitos')
  for (const key of ['km_inicial', 'km_final', 'checklist']) {
    assert.ok(paso(t, key), `falta el hito ${key}`)
    assert.ok(typeof paso(t, key).detail === 'string')
  }
})

test('formatKm distingue el cero del vacío', () => {
  assert.equal(formatKm(null), '')
  assert.equal(formatKm(undefined), '')
  assert.equal(formatKm('abc'), '')
  assert.equal(formatKm(1234.5), '1,234.5 km')
})
