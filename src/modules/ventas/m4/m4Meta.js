// ─── KOLD OS · M4 — metadatos de presentación (sin lógica) ───────────────────
// Orden y labels de los 9 bloques comerciales + veredictos del contrato
// epistémico. La UI muestra VEREDICTOS, no solo colores.

export const M4_CATEGORY_ORDER = Object.freeze([
  'maestro_clientes', 'clasificacion_canal', 'leads_oportunidades',
  'pedidos_ventas', 'precio_descuento', 'recurrencia', 'portafolio',
  'perdida_recompra', 'senal_m4_m2',
])

export const M4_CATEGORY_LABELS = Object.freeze({
  maestro_clientes: 'Maestro de clientes',
  clasificacion_canal: 'Clasificación y canal',
  leads_oportunidades: 'Leads y oportunidades',
  pedidos_ventas: 'Pedidos y ventas',
  precio_descuento: 'Precio y descuento',
  recurrencia: 'Recurrencia',
  portafolio: 'Portafolio y penetración',
  perdida_recompra: 'Pérdida y recompra',
  senal_m4_m2: 'Señal M4 → M2',
})

export function categoryLabel(key) {
  return M4_CATEGORY_LABELS[key] || key
}

export const M4_STATUS_LABELS = Object.freeze({
  RED: 'Rojo', AMBER: 'Ámbar', GREEN: 'Verde', NOT_EVALUABLE: 'No evaluable',
})

export const M4_SEVERITY_LABELS = Object.freeze({
  high: 'Alta', medium: 'Media', low: 'Baja',
})

export const M4_GRANULARITY_LABELS = Object.freeze({
  aggregate: 'AGREGADO', company: 'COMPAÑÍA', branch: 'SUCURSAL',
  channel: 'CANAL', customer_segment: 'SEGMENTO', customer: 'CLIENTE',
  order: 'PEDIDO', line: 'LÍNEA', product: 'PRODUCTO',
})

export const M4_LIFECYCLE_LABELS = Object.freeze({
  new: 'Nuevo', persistent: 'Persistente', recurrent: 'Reincidente', corrected: 'Corregido',
})

// ── Contrato epistémico: veredictos (la lectura autoritativa) ────────────────
export const M4_VERDICT_ORDER = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])

export const M4_VERDICT_LABELS = Object.freeze({
  incumplimiento: 'INCUMPLIMIENTO', riesgo: 'RIESGO', anomalia: 'ANOMALÍA',
  cumple: 'CUMPLE', no_evaluable: 'NO EVALUABLE',
})

export const M4_VERDICT_COLORS = Object.freeze({
  incumplimiento: '#f87171', riesgo: '#fbbf24', anomalia: '#7dd3fc',
  cumple: '#4ade80', no_evaluable: '#94a3b8',
})

export const M4_VERDICT_HELP = Object.freeze({
  incumplimiento: 'Umbral APROBADO + supuesto verificado por modelo/constraint: la evidencia lo prueba.',
  riesgo: 'Supuesto de negocio declarado pero NO verificado: probable, no probado.',
  anomalia: 'Señal exploratoria (umbral no aprobado o supuesto dudoso): dice dónde mirar, NO prueba una conclusión.',
  cumple: 'La regla evaluó en verde dentro de su universo.',
  no_evaluable: 'El contrato v1 no permite concluir (dato/join/política ausente).',
})

export const M4_CLASSIFICATION_LABELS = Object.freeze({
  definitive: 'Definitiva', caveated: 'Con supuestos', exploratory: 'Exploratoria',
  not_evaluable: 'No evaluable', invalid: 'Inválida',
})

// ── Honestidad de la evidencia (se lee del RUN, no del modo de entrega) ──────
export const M4_EVIDENCE_SOURCE_LABELS = Object.freeze({
  odoo_shell_production_run: 'corrida odoo-shell en producción',
  xml_rpc_read_only_measurements: 'mediciones XML-RPC read-only contra producción',
})

export const M4_EVIDENCE_CLASSIFICATION_LABELS = Object.freeze({
  formal_production_run: 'Corrida formal de producción',
  pre_deployment_semantic_validation: 'Validación semántica previa al despliegue',
})

export const M4_SHELL_BLOCKER_LABELS = Object.freeze({
  ssh_key_not_registered: 'llave SSH no registrada en Odoo.sh',
  module_not_deployed: 'módulo sin desplegar',
  production_shell_unavailable: 'shell de producción no disponible',
})
