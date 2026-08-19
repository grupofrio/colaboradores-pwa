// millingAPI.js — Control de conversión en transformación (molido).
//
// Contra controladores REALES de Odoo (gf_milling_control). Identidad por
// `X-GF-Employee-Token`; sin ORM ni `sudo` desde el navegador.
//
//   POST /api/production/milling/evaluate        (lectura, antes de guardar)
//   POST /api/production/milling/record-counts   (deja la evidencia del recuento)
//   POST /api/production/milling/daily-summary   (visibilidad del día)

import { api } from '../../lib/api'

function unwrap(envelope, fallbackError) {
  if (envelope?.ok) return envelope.data || {}
  const error = new Error(envelope?.message || fallbackError || 'Error del servidor')
  error.code = envelope?.data?.code || null
  throw error
}

/**
 * Pregunta al servidor si esta captura se aleja del esperado. NO guarda nada.
 *
 * El umbral y el esperado los decide Odoo: esta capa no compara ni calcula.
 * @returns {Promise<{expected_output_qty_units:number, variance_pct:number,
 *   threshold_pct:number, requires_recount:boolean, direction:string}>}
 */
export async function evaluateMillingVariance({ recipeCode, inputQtyUnits, outputQtyUnits }) {
  const res = await api('POST', '/api/production/milling/evaluate', {
    recipe_code: recipeCode,
    input_qty_units: Number(inputQtyUnits),
    output_qty_units: Number(outputQtyUnits),
  })
  return unwrap(res, 'No se pudo verificar la conversión')
}

/**
 * Guarda los DOS conteos de una transformación ya creada.
 *
 * El par (primer conteo, recuento) es la evidencia: un recuento que confirma
 * el número informa tanto como uno que lo corrige.
 */
export async function recordMillingCounts({ orderId, firstCount, recount }) {
  const res = await api('POST', '/api/production/milling/record-counts', {
    order_id: orderId,
    first_output_qty_units: Number(firstCount),
    recount_output_qty_units: recount === null || recount === undefined
      ? undefined
      : Number(recount),
  })
  return unwrap(res, 'No se pudieron registrar los conteos')
}

/** Conversión del día por planta: real vs esperado, en bolsas. */
export async function getMillingDailySummary({ warehouseId, date } = {}) {
  const res = await api('POST', '/api/production/milling/daily-summary', {
    warehouse_id: warehouseId || undefined,
    date: date || undefined,
  })
  return unwrap(res, 'No se pudo leer la conversión del día')
}
