// ─── KOLD OS · M6 — Etiquetas y orden canónico de la UI ──────────────────────
// Los CUATRO EJES son independientes: cada uno tiene su vocabulario propio y
// ninguno se deriva de otro (bug D de M3/M4/M5: colapsarlos).

export const M6_CATEGORY_ORDER = Object.freeze([
  'facturacion', 'pagos', 'caja_ruta', 'cierre_caja', 'cierre_admin',
  'conciliacion', 'cartera_aging', 'handoffs', 'moneda',
])

export const M6_CATEGORY_LABELS = Object.freeze({
  facturacion: 'Facturación y cuentas por cobrar',
  pagos: 'Pagos',
  caja_ruta: 'Caja de ruta',
  cierre_caja: 'Cierre de caja',
  cierre_admin: 'Corte y cierre administrativo',
  conciliacion: 'Conciliación',
  cartera_aging: 'Cartera y aging',
  handoffs: 'Handoffs operativos',
  moneda: 'Moneda',
})

export function categoryLabel(category) {
  return M6_CATEGORY_LABELS[category] || category || '—'
}

// ── EJE 1 · VEREDICTO (qué se concluye) ─────────────────────────────────────
export const M6_VERDICT_ORDER = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M6_VERDICT_LABELS = Object.freeze({
  incumplimiento: 'INCUMPLIMIENTO', riesgo: 'RIESGO', anomalia: 'ANOMALÍA',
  cumple: 'CUMPLE', no_evaluable: 'NO EVALUABLE',
})
export const M6_VERDICT_COLORS = Object.freeze({
  incumplimiento: '#ef4444', riesgo: '#f59e0b', anomalia: '#a78bfa',
  cumple: '#22c55e', no_evaluable: 'rgba(255,255,255,0.45)',
})
export const M6_VERDICT_HELP = Object.freeze({
  incumplimiento: 'Umbral APROBADO por dirección + supuesto verificado. En v1 no hay ninguno.',
  riesgo: 'Supuesto declarado pero NO verificado: señala, no prueba.',
  anomalia: 'Señal exploratoria: dice dónde mirar, no qué concluir.',
  cumple: 'La condición medida no se cumple en esta evidencia.',
  no_evaluable: 'El contrato v1 no permite concluir (declarado, no accidental).',
})

// ── EJE 2 · CLASIFICACIÓN (qué tan sólida es la evidencia) ──────────────────
export const M6_CLASSIFICATION_ORDER = Object.freeze(
  ['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'])
export const M6_CLASSIFICATION_LABELS = Object.freeze({
  definitive: 'Definitiva', caveated: 'Con salvedad', exploratory: 'Exploratoria',
  not_evaluable: 'No evaluable', invalid: 'Inválida',
})

// ── EJE 3 · SEVERIDAD (qué tan grave si es real) ────────────────────────────
export const M6_SEVERITY_ORDER = Object.freeze(
  ['critical', 'high', 'medium', 'low', 'informational'])
export const M6_SEVERITY_LABELS = Object.freeze({
  critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
  informational: 'Informativa',
})

// ── EJE 4 · LIFECYCLE (cómo evoluciona entre corridas del MISMO scope) ──────
// Espejo de core.LIFECYCLE_STATES: los estados que el backend EMITE.
// `corrected` NO está: ofrecerlo daría un filtro que siempre devuelve 0, y un 0
// se lee como "no hubo ninguna corrección" — que es distinto de "M6 no puede
// saberlo". El backend lo rechaza en rejected_params. Ver M6_LIFECYCLE_UNAVAILABLE.
export const M6_LIFECYCLE_ORDER = Object.freeze(
  ['new', 'persistent', 'recurrent'])
export const M6_LIFECYCLE_LABELS = Object.freeze({
  new: 'Nuevo', persistent: 'Persistente', recurrent: 'Reincidente',
})

// Se muestra en la UI como capacidad NO disponible, con su razón: el usuario
// debe saber que "corregido" no es que no haya, es que no se mide.
export const M6_LIFECYCLE_UNAVAILABLE = Object.freeze([
  {
    key: 'corrected',
    label: 'Corregido',
    reason: 'M6 v1 no puede probar una corrección: un hallazgo ausente no trae '
      + 'sus cuatro ejes y la historia no registra qué reglas se evaluaron. '
      + 'Ausencia ≠ corrección. Backend: lifecycle_corrected_detection=false.',
  },
])

// M6 v1 emite UNA sola granularidad: capabilities.granularities == ['aggregate'].
export const M6_GRANULARITY_LABELS = Object.freeze({ aggregate: 'AGREGADO' })

export const M6_EVIDENCE_SOURCE_LABELS = Object.freeze({
  xml_rpc_read_only: 'XML-RPC read-only (NO formal)',
  odoo_shell_read_only: 'odoo-shell de producción (formal)',
})

export const M6_SHELL_BLOCKER_LABELS = Object.freeze({
  ssh_key_not_registered: 'llave SSH no registrada en Odoo.sh',
  module_not_deployed: 'módulo sin desplegar',
  production_shell_unavailable: 'shell de producción no disponible',
})
