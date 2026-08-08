// Supervisor · Recuperación / inactivos escopado a sucursal + acción "agregar".
// (a) modelo puro ejecutado; (b) cableado de fuente y escritura.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  KIND_RECOVERY, KIND_INACTIVE, unwrapRecovery, recoveryUnavailable, recoveryCustomers,
  daysLabel, tomorrowPlanOptions, planOptionSubtitle, addResultMessage,
} from '../src/modules/supervisor-ventas/recuperacionModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── (a) modelo puro ──────────────────────────────────────────────────────────

test('unwrapRecovery: payload directo o en .data; rechaza lo que no trae available', () => {
  const p = { available: true, kind: 'recovery', customers: [], total: 0 }
  assert.deepEqual(unwrapRecovery(p), p)
  assert.deepEqual(unwrapRecovery({ ok: true, data: p }), p)
  assert.equal(unwrapRecovery(null), null)
  assert.equal(unwrapRecovery({ ok: true }), null, 'sin available no es un payload válido')
})

test('recoveryUnavailable: declara el motivo en vez de fingir lista vacía', () => {
  assert.equal(recoveryUnavailable({ available: false, reason: 'sin_fuente' }), 'sin_fuente')
  assert.equal(recoveryUnavailable({ available: false }), 'no_disponible')
  assert.equal(recoveryUnavailable({ available: true, customers: [] }), null)
})

test('daysLabel: sin dato NO se inventa', () => {
  assert.match(daysLabel({ days_since_last_order: 74 }), /74 días/)
  assert.equal(daysLabel({ days_since_last_order: 0 }), null)
  assert.equal(daysLabel({}), null)
})

test('tomorrowPlanOptions: solo filas con plan de mañana MATERIALIZADO (plan_id)', () => {
  // Un plan operativo sin materializar no tiene id que reciba al cliente ⇒ no es
  // destino válido. Ofrecerlo llevaría a add_customer contra un id inexistente.
  const rw = {
    week: '2026-W32',
    rows: [
      { key: 'SP:1', tipo: 'SP', name: 'Centro', tomorrow: { plan_id: 501 } },
      { key: 'P:2', tipo: 'P', name: 'Norte', tomorrow: { plan_id: null } },   // sin materializar
      { key: 'SO:3', tipo: 'SO', name: 'Solo Aida', tomorrow: { plan_id: 502 } },
      { key: 'SP:9', tipo: 'SP', name: 'Dup', tomorrow: { plan_id: 501 } },     // duplicado
    ],
  }
  const opts = tomorrowPlanOptions(rw)
  assert.deepEqual(opts.map((o) => o.plan_id), [501, 502], 'solo materializados, sin duplicar')
  assert.equal(opts[0].label, 'Centro')
  assert.deepEqual(tomorrowPlanOptions({ data: rw }).map((o) => o.plan_id), [501, 502], 'acepta envelope .data')
  assert.deepEqual(tomorrowPlanOptions(null), [])
})

test('planOptionSubtitle: traduce el tipo a palabra', () => {
  assert.equal(planOptionSubtitle({ tipo: 'SP' }), 'Subpolígono')
  assert.equal(planOptionSubtitle({ tipo: 'P' }), 'Polígono')
  assert.equal(planOptionSubtitle({ tipo: 'SO' }), 'Solo')
  assert.equal(planOptionSubtitle({}), 'Plan de mañana', 'sin tipo no se inventa una etiqueta')
})

test('addResultMessage: solo declara éxito si el server lo confirma', () => {
  assert.equal(addResultMessage({ ok: true }, 'ABARROTES').tone, 'ok')
  assert.equal(addResultMessage({ data: { ok: true } }, 'X').tone, 'ok')
  const fail = addResultMessage({ ok: false, code: 'writes_disabled' }, 'ABARROTES')
  assert.equal(fail.tone, 'error')
  assert.match(fail.text, /writes_disabled/, 'el código del server viaja al usuario, no un "listo" falso')
  assert.equal(addResultMessage(null, 'X').tone, 'error', 'sin respuesta no se canta victoria')
})

test('los kinds son exactamente recovery/inactive', () => {
  assert.equal(KIND_RECOVERY, 'recovery')
  assert.equal(KIND_INACTIVE, 'inactive')
})

// ── (b) cableado ─────────────────────────────────────────────────────────────

test('la lista sale del endpoint V2 token-only, NO del listado de compañía', () => {
  const scr = src('modules/supervisor-ventas/ScreenClientesRecuperacion.jsx')
  assert.match(scr, /getBranchRecovery/, 'usa el wrapper V2')
  assert.ok(!scr.includes("from '../admin/api'"), 'ya no usa el listado admin de compañía')
  assert.ok(!scr.includes('getInactiveCustomers') && !scr.includes('getRecoveryCustomers'),
    'no quedan las funciones del listado viejo')
  assert.ok(!scr.includes('company_id') && !scr.includes('companyId'),
    'el cliente NO manda company_id: el alcance sale del token')
})

test('el wrapper V2 va por kind y sin company_id', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.match(api, /getBranchRecovery/)
  assert.match(api, /\/pwa-supv\/customers-recovery\?/)
  const shim = src('lib/api.js')
  assert.match(shim, /'\/pwa-supv\/customers-recovery'/)
  assert.match(shim, /\/gf\/salesops\/supervisor\/v2\/customers\/recovery/)
})

test('la acción de agregar NO finge éxito: usa addResultMessage', () => {
  const scr = src('modules/supervisor-ventas/ScreenClientesRecuperacion.jsx')
  assert.match(scr, /addCustomerToRoutePlan/, 'la escritura pasa por el endpoint seguro')
  assert.match(scr, /addResultMessage/, 'el acuse depende de lo que confirme el server')
  // El destino sale de routes-week (planes materializados), no de una lista inventada.
  assert.match(scr, /tomorrowPlanOptions/)
  assert.match(scr, /getRoutesWeek/)
})
