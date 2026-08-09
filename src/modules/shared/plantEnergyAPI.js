// plantEnergyAPI.js — Fase 1 Produccion: energia por periodos, compresores y
// produccion esperada vs real.
//
// TODO en este archivo pega contra controladores REALES de Odoo
// (gf_plant_energy). NO hay ORM client-side ni `sudo` desde el navegador:
// la identidad va por `X-GF-Employee-Token` y la validacion es server-side.
//
//   POST /api/production/energy/periods/create   (solo supervisor_produccion)
//   POST /api/production/energy/summary
//   POST /api/production/compressor/status
//   POST /api/production/compressor/toggle
//   POST /api/production/compressor/oil
//   POST /api/production/expected-vs-real
//   POST /api/production/brine/reading
//
// Contrato de respuesta: {ok, message, data}. Este modulo devuelve `data` en
// exito y lanza Error con el mensaje del backend en fallo — el frontend NO
// reinterpreta ni recalcula nada.

import { api } from '../../lib/api'

function unwrap(envelope, fallbackError) {
  if (envelope?.ok) return envelope.data || {}
  const message = envelope?.message || fallbackError || 'Error del servidor'
  const error = new Error(message)
  error.code = envelope?.data?.code || null
  throw error
}

// ─── Energia ─────────────────────────────────────────────────────────────────

/** Consumo del turno por periodo + valorizado. Todo calculado en Odoo. */
export async function getEnergySummary(shiftId) {
  const res = await api('POST', '/api/production/energy/summary', { shift_id: shiftId })
  return unwrap(res, 'No se pudo leer el consumo de energia')
}

/**
 * Registra una lectura de 3 periodos.
 * Se envia el DISPLAY del medidor; el x1200 lo aplica el servidor.
 *
 * @param {{shift_id:number, reading_type:'start'|'end', kwh_base:number,
 *          kwh_intermedia:number, kwh_punta:number, photo_base64:string}} payload
 */
export async function createEnergyPeriodReading(payload) {
  const res = await api('POST', '/api/production/energy/periods/create', payload)
  return unwrap(res, 'No se pudo registrar la lectura')
}

// ─── Compresores ─────────────────────────────────────────────────────────────

/** Estado, horas del turno y aceite por compresor. Incluye `can_write`. */
export async function getCompressorStatus(shiftId) {
  const res = await api('POST', '/api/production/compressor/status', { shift_id: shiftId })
  return unwrap(res, 'No se pudo leer el estado de los compresores')
}

/** Enciende o apaga. El timestamp y el guard de doble-encendido son del backend. */
export async function toggleCompressor({ shiftId, machineId, action, notes }) {
  const res = await api('POST', '/api/production/compressor/toggle', {
    shift_id: shiftId,
    machine_id: machineId,
    action,
    notes: notes || undefined,
  })
  return unwrap(res, 'No se pudo registrar el evento del compresor')
}

/** Registra nivel de mirilla (`level`) o relleno (`refill`). Foto obligatoria. */
export async function registerCompressorOil({
  shiftId, machineId, logType, oilLevel, liters, photoBase64, note,
}) {
  const res = await api('POST', '/api/production/compressor/oil', {
    shift_id: shiftId,
    machine_id: machineId,
    log_type: logType,
    oil_level: oilLevel || undefined,
    liters: liters ?? undefined,
    photo_base64: photoBase64,
    note: note || undefined,
  })
  return unwrap(res, 'No se pudo registrar el aceite')
}

// ─── Esperado vs real ────────────────────────────────────────────────────────

/** Esperado vs real por linea + KPI de ciclos Rolito. `null` != 0. */
export async function getExpectedVsReal(shiftId) {
  const res = await api('POST', '/api/production/expected-vs-real', { shift_id: shiftId })
  return unwrap(res, 'No se pudo leer esperado vs real')
}

// ─── Salmuera (historico) ────────────────────────────────────────────────────

/** Guarda la lectura en el historico ADEMAS de actualizar el ultimo valor. */
export async function createBrineReadingWithHistory({
  shiftId, machineId, saltLevel, brineTemp,
}) {
  const res = await api('POST', '/api/production/brine/reading', {
    shift_id: shiftId,
    machine_id: machineId,
    salt_level: saltLevel,
    brine_temp: brineTemp,
  })
  return unwrap(res, 'No se pudo registrar la lectura de salmuera')
}
