// ─── KOLD OS · M2 — Metadata de presentación (labels/orden/colores) ──────────
// El catálogo CANÓNICO de reglas vive en el backend (gf_kold_os_m2/lib/
// kold_os_m2_core.py); aquí solo hay presentación. Nada de lógica de negocio.

export const M2_CATEGORY_LABELS = Object.freeze({
  territorio: 'Territorio',
  solver: 'Solver',
  vehiculo_capacidad: 'Vehículo y capacidad',
  carga_handoff: 'Carga y handoff',
  snapshots_forecast: 'Snapshots y forecast',
  resultado_real: 'Resultado real',
})

export const M2_CATEGORY_ORDER = Object.freeze([
  'territorio', 'solver', 'vehiculo_capacidad', 'carga_handoff',
  'snapshots_forecast', 'resultado_real',
])

export const M2_STATUS_LABELS = Object.freeze({
  GREEN: 'Cumple', AMBER: 'Riesgo', RED: 'Incumplimiento', NOT_EVALUABLE: 'No evaluable',
})

export const M2_LIFECYCLE_LABELS = Object.freeze({
  new: 'Nuevo', persistent: 'Persistente', corrected: 'Corregido', recurrent: 'Reincidente',
})

export const M2_SEVERITY_LABELS = Object.freeze({ high: 'Alta', medium: 'Media' })

// Badges de granularidad (B5): el detalle declara su nivel real, jamás finge.
export const M2_GRANULARITY_LABELS = Object.freeze({
  aggregate: 'AGREGADO', branch: 'SUCURSAL', record: 'REGISTRO',
})

export function categoryLabel(key) {
  return M2_CATEGORY_LABELS[key] || key
}
