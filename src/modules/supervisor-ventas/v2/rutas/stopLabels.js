// ─── Paradas: cómo se leen los estados crudos del backend ────────────────────
// La lista mostraba `no_sale`, `delivered_full`, `pendiente` — los valores tal
// como salen de Odoo. Se traducen SOLO para mostrar: los valores crudos no se
// tocan, ni se mandan de vuelta, ni se usan para decidir nada.
//
// Se cubren las dos familias que conviven en el payload: la del contrato de
// `gf.route.stop` (`delivered_full`, `no_sale`, `not_visited`…) y la que traen
// los fixtures/algunas rutas (`con_venta`, `no_venta`). Un valor desconocido NO
// se inventa: se muestra tal cual, para que se vea que falta traducirlo en vez
// de esconderlo detrás de un genérico.

export const STOP_RESULT_LABELS = Object.freeze({
  // Contrato de gf.route.stop
  delivered_full: 'venta realizada',
  delivered_partial: 'venta parcial',
  no_sale: 'no venta',
  no_stock: 'sin producto',
  rejected: 'rechazada',
  closed: 'cerrado',
  not_visited: 'no visitada',
  // Variantes que aparecen en el payload de rutas
  con_venta: 'venta realizada',
  no_venta: 'no venta',
})

/** Estado legible de una parada. `pending`/null ⇒ todavía no le tocan. */
export function stopResultLabel(stop) {
  const raw = typeof stop?.result_status === 'string' ? stop.result_status.trim() : ''
  if (!raw || raw === 'pending') return 'pendiente de visita'
  return STOP_RESULT_LABELS[raw] || raw
}

/** ¿La parada terminó SIN venta? Es cuando el motivo importa. */
export function isNoSale(stop) {
  const raw = typeof stop?.result_status === 'string' ? stop.result_status.trim() : ''
  return raw === 'no_sale' || raw === 'no_venta'
}

// El motivo puede venir como texto plano o como el par [id, nombre] de un
// many2one. Se acepta cualquiera de los dos y se descarta lo que no sea legible.
export function noSaleReason(stop) {
  const raw = stop?.not_visited_reason
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (Array.isArray(raw) && typeof raw[1] === 'string' && raw[1].trim()) return raw[1].trim()
  return ''
}

/**
 * Lo que se pinta en la columna de motivo.
 * Distingue las tres cosas que NO son lo mismo:
 *   · no aplica            → la parada no terminó en "no venta";
 *   · motivo real          → lo que capturó quien iba en la ruta;
 *   · sin motivo capturado → terminó en no venta y nadie escribió por qué.
 * Ese último caso es información: significa que falta captura en campo, no que
 * el dato no exista en el sistema.
 */
export function noSaleReasonDisplay(stop) {
  if (!isNoSale(stop)) return { show: false, text: '', missing: false }
  const reason = noSaleReason(stop)
  return reason
    ? { show: true, text: reason, missing: false }
    : { show: true, text: 'sin motivo capturado', missing: true }
}

/** ¿Ya la visitaron? Mismo criterio que traía la vista, sin cambiarlo. */
export function isVisited(stop) {
  return stop?.state === 'done' || stop?.has_checkin === true || !!stop?.actual_end_time
}
