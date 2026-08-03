// Regresión del bug "Operación no carga la info" (2026-08-01).
//
// `getDayControl()` resuelve por routeDirect al endpoint Odoo v2 y `odooJson`
// devuelve el ENVELOPE de servicio {status:'ok', data:{ok:true, ...}}. El
// payload del contrato vive en `.data`. Antes se pasaba el envelope entero a la
// vista: `envelope.ok` es `undefined` (no `false`), así que `isUsablePayload` lo
// daba por bueno, el estado quedaba LIVE y la pantalla pintaba ceros y "Fecha
// operativa no disponible" — sin error visible. Medido en producción con la
// sesión real de Aida: /equipo mostraba $23,121 y 5 rutas mientras /equipo/hoy
// mostraba todo en cero, con el MISMO endpoint respondiendo 200.
import test from 'node:test'
import assert from 'node:assert/strict'

import { runOperationsHome, unwrapContractPayload, RUN_STATUS } from '../src/modules/supervisor-ventas/dayControl/runController.js'

// Forma real medida en producción (recortada).
const PAYLOAD = {
  ok: true,
  contract: 'gf.salesops.supervisor.day_control/1',
  date: '2026-08-01',
  timezone: 'America/Mexico_City',
  branch: { branch_config_id: 29, name: 'Iguala Glaciem' },
  summary: { routes_total: 5, departed: 5, sales_day_amount: 23121.0, sales_day_available: true },
  routes: [{ plan_id: 6822 }],
}
const ENVELOPE = { status: 'ok', code: 'OK', user_message: 'OK', data: PAYLOAD }

test('el envelope de servicio se desenvuelve al payload del contrato', () => {
  assert.equal(unwrapContractPayload(ENVELOPE), PAYLOAD)
})

test('el payload crudo pasa tal cual (la otra forma real del backend)', () => {
  assert.equal(unwrapContractPayload(PAYLOAD), PAYLOAD)
})

test('lo que no es utilizable se reporta como null, no como éxito vacío', () => {
  for (const raw of [null, undefined, 42, 'texto', [], { cualquier: 'cosa' }]) {
    assert.equal(unwrapContractPayload(raw), null, JSON.stringify(raw))
  }
  assert.equal(unwrapContractPayload({ ok: false, code: 'DATE_NOT_ALLOWED' }), null)
  assert.equal(unwrapContractPayload({ status: 'error', code: 'UNAUTHORIZED' }), null)
})

test('runOperationsHome entrega a la vista el PAYLOAD, nunca el envelope', async () => {
  const res = await runOperationsHome({
    fetchDayControl: async () => ENVELOPE,
    fetchRadar: async () => ({ status: 'ok', code: 'OK', data: { ok: true, positions: [] } }),
  })

  assert.equal(res.status, RUN_STATUS.LIVE)
  assert.equal(res.dayControl.summary.sales_day_amount, 23121.0, 'la venta del día llega a la vista')
  assert.equal(res.dayControl.date, '2026-08-01', 'la fecha operativa llega a la vista')
  assert.equal(res.dayControl.status, undefined, 'no se filtró el envelope')
  assert.equal(res.radar.positions.length, 0)
  assert.equal(res.radarError, null)
})

test('una respuesta con forma inesperada YA NO pasa por buena (antes: LIVE en ceros)', async () => {
  const res = await runOperationsHome({
    fetchDayControl: async () => ({ cualquier: 'cosa' }),
    fetchRadar: async () => null,
  })

  assert.notEqual(res.status, RUN_STATUS.LIVE, 'no se declara LIVE con datos que la vista no puede leer')
  assert.equal(res.dayControl, null)
  assert.ok(res.error, 'el fallo se nombra en vez de pintar ceros')
})

test('el radar sigue siendo secundario: si falla, la pantalla no se cae', async () => {
  const res = await runOperationsHome({
    fetchDayControl: async () => ENVELOPE,
    fetchRadar: async () => { throw new Error('radar caído') },
  })

  assert.equal(res.status, RUN_STATUS.LIVE)
  assert.equal(res.radar, null)
  assert.match(res.radarError, /radar caído/)
})
