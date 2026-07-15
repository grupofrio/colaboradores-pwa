// ─── KOLD OS · M3 — Metadata de presentación (labels/orden/colores) ──────────
// El catálogo CANÓNICO de reglas vive en el backend (gf_kold_os_m3/lib/
// kold_os_m3_core.py, PR GrupoVeniu/GrupoFrio#202); aquí solo presentación.

export const M3_CATEGORY_LABELS = Object.freeze({
  asignacion_arranque: 'Asignación y arranque',
  ejecucion_paradas: 'Ejecución de paradas',
  resultado_comercial: 'Resultado comercial',
  carga_inventario: 'Carga e inventario',
  incidentes: 'Incidentes',
  cierre: 'Cierre',
  offline_sync: 'Offline y sincronización',
  plan_vs_real: 'Plan vs real',
})

export const M3_CATEGORY_ORDER = Object.freeze([
  'asignacion_arranque', 'ejecucion_paradas', 'resultado_comercial',
  'carga_inventario', 'incidentes', 'cierre', 'offline_sync', 'plan_vs_real',
])

export const M3_STATUS_LABELS = Object.freeze({
  GREEN: 'Cumple', AMBER: 'Riesgo', RED: 'Incumplimiento', NOT_EVALUABLE: 'No evaluable',
})

export const M3_LIFECYCLE_LABELS = Object.freeze({
  new: 'Nuevo', persistent: 'Persistente', corrected: 'Corregido', recurrent: 'Reincidente',
})

export const M3_SEVERITY_LABELS = Object.freeze({ high: 'Alta', medium: 'Media' })

// Badges de granularidad: el detalle declara su nivel real, jamás finge.
export const M3_GRANULARITY_LABELS = Object.freeze({
  aggregate: 'AGREGADO', branch: 'SUCURSAL', route: 'RUTA', stop: 'PARADA', record: 'REGISTRO',
})

export function categoryLabel(key) {
  return M3_CATEGORY_LABELS[key] || key
}

// ── Veredictos (Codex Track C/U): lo que la UI PUEDE afirmar ─────────────────
// Un dato rojo NO es un incumplimiento si la regla es exploratoria.
export const M3_VERDICT_LABELS = Object.freeze({
  incumplimiento: 'INCUMPLIMIENTO',
  riesgo: 'RIESGO',
  anomalia: 'ANOMALÍA',
  cumple: 'CUMPLE',
  no_evaluable: 'NO EVALUABLE',
})

export const M3_VERDICT_COLORS = Object.freeze({
  incumplimiento: '#ef4444',
  riesgo: '#f59e0b',
  anomalia: '#a78bfa',
  cumple: '#22c55e',
  no_evaluable: 'rgba(255,255,255,0.45)',
})

export const M3_VERDICT_HELP = Object.freeze({
  incumplimiento: 'Regla definitive con umbral aprobado: la evidencia prueba el incumplimiento.',
  riesgo: 'Señal con supuesto declarado (caveated) o métrica en ámbar: requiere validación.',
  anomalia: 'Señal EXPLORATORIA: el dato llama la atención pero el modelo aún no prueba una conclusión de negocio (umbral no aprobado y/o supuesto no verificado).',
  cumple: 'La regla se satisface con la evidencia disponible.',
  no_evaluable: 'El contrato de datos no permite evaluar esta regla; no se afirma nada.',
})

export const M3_CLASSIFICATION_LABELS = Object.freeze({
  definitive: 'Definitiva', caveated: 'Con supuestos', exploratory: 'Exploratoria',
  not_evaluable: 'No evaluable', invalid: 'Inválida',
})

export const M3_VERDICT_ORDER = Object.freeze(['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])

// ── Honestidad de la evidencia (Codex ronda 2 §1) ───────────────────────────
// Se lee del `run`, no del modo de entrega: el lector debe poder distinguir
// "números reales" de "corrida formal" sin conocer el pipeline.
export const M3_EVIDENCE_SOURCE_LABELS = Object.freeze({
  odoo_shell_production_run: 'corrida odoo-shell en producción',
  xml_rpc_read_only_measurements: 'mediciones XML-RPC read-only contra producción',
})

export const M3_EVIDENCE_CLASSIFICATION_LABELS = Object.freeze({
  formal_production_run: 'Corrida formal de producción',
  pre_deployment_semantic_validation: 'Validación semántica previa al despliegue',
})

export const M3_SHELL_BLOCKER_LABELS = Object.freeze({
  ssh_key_not_registered: 'llave SSH no registrada en Odoo.sh',
  module_not_deployed: 'módulo sin desplegar',
  production_shell_unavailable: 'shell de producción no disponible',
})
