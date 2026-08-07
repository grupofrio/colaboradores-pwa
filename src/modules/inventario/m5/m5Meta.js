// ─── KOLD OS · M5 — metadatos de presentación (sin lógica) ───────────────────
// Orden y labels de los 10 bloques del flujo de producto + veredictos del contrato
// epistémico. La UI muestra VEREDICTOS, no solo colores.

export const M5_CATEGORY_ORDER = Object.freeze([
  'catalogo_pesos', 'carga', 'stock_unidad', 'salidas', 'refill',
  'devoluciones', 'mermas_diferencias', 'kilogramos', 'consignacion', 'handoffs',
])

export const M5_CATEGORY_LABELS = Object.freeze({
  catalogo_pesos: 'Catálogo y pesos',
  carga: 'Carga',
  stock_unidad: 'Stock de unidad',
  salidas: 'Salidas de producto',
  refill: 'Refill',
  devoluciones: 'Devoluciones y sobrantes',
  mermas_diferencias: 'Mermas y diferencias',
  kilogramos: 'Kilogramos',
  consignacion: 'Consignación',
  handoffs: 'Handoffs M3/M6/M7',
})

export function categoryLabel(key) {
  return M5_CATEGORY_LABELS[key] || key
}

export const M5_STATUS_LABELS = Object.freeze({
  RED: 'Rojo', AMBER: 'Ámbar', GREEN: 'Verde', NOT_EVALUABLE: 'No evaluable',
})

export const M5_SEVERITY_LABELS = Object.freeze({
  high: 'Alta', medium: 'Media', low: 'Baja',
})

// M5 v1 emite UNA sola granularidad: el backend declara
// `capabilities.granularities == ['aggregate']`. Las demás etiquetas venían de
// M4 (canal/segmento/cliente/pedido) y de M3 (vehículo/almacén): rotular algo
// que el backend nunca emite es prometer una dimensión que no existe.
export const M5_GRANULARITY_LABELS = Object.freeze({
  aggregate: 'AGREGADO',
})

export const M5_LIFECYCLE_LABELS = Object.freeze({
  new: 'Nuevo', persistent: 'Persistente', recurrent: 'Reincidente', corrected: 'Corregido',
})

// ── Contrato epistémico: veredictos (la lectura autoritativa) ────────────────
export const M5_VERDICT_ORDER = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])

export const M5_VERDICT_LABELS = Object.freeze({
  incumplimiento: 'INCUMPLIMIENTO', riesgo: 'RIESGO', anomalia: 'ANOMALÍA',
  cumple: 'CUMPLE', no_evaluable: 'NO EVALUABLE',
})

export const M5_VERDICT_COLORS = Object.freeze({
  incumplimiento: '#f87171', riesgo: '#fbbf24', anomalia: '#7dd3fc',
  cumple: '#4ade80', no_evaluable: '#94a3b8',
})

export const M5_VERDICT_HELP = Object.freeze({
  incumplimiento: 'Umbral APROBADO + supuesto verificado por modelo/constraint: la evidencia lo prueba.',
  riesgo: 'Supuesto de negocio declarado pero NO verificado: probable, no probado.',
  anomalia: 'Señal exploratoria (umbral no aprobado o supuesto dudoso): dice dónde mirar, NO prueba una conclusión.',
  cumple: 'La regla evaluó en verde dentro de su universo.',
  no_evaluable: 'El contrato v1 no permite concluir (dato/join/política ausente).',
})

export const M5_CLASSIFICATION_LABELS = Object.freeze({
  definitive: 'Definitiva', caveated: 'Con supuestos', exploratory: 'Exploratoria',
  not_evaluable: 'No evaluable', invalid: 'Inválida',
})

// ── Honestidad de la evidencia (se lee del RUN, no del modo de entrega) ──────
export const M5_EVIDENCE_SOURCE_LABELS = Object.freeze({
  odoo_shell_production_run: 'corrida odoo-shell en producción',
  xml_rpc_read_only_measurements: 'mediciones XML-RPC read-only contra producción',
})

export const M5_EVIDENCE_CLASSIFICATION_LABELS = Object.freeze({
  formal_production_run: 'Corrida formal de producción',
  pre_deployment_semantic_validation: 'Validación semántica previa al despliegue',
})

export const M5_SHELL_BLOCKER_LABELS = Object.freeze({
  ssh_key_not_registered: 'llave SSH no registrada en Odoo.sh',
  module_not_deployed: 'módulo sin desplegar',
  production_shell_unavailable: 'shell de producción no disponible',
})
