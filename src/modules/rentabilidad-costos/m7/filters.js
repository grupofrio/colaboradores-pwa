// ─── KOLD OS · M7 — Contrato de filtros del frontend ─────────────────────────
// Espejo EXACTO de la allowlist del backend. Los filtros NO soportados NO se
// ofrecen (ofrecer uno que el hallazgo no porta devuelve 0 SIEMPRE) y se muestran
// como "no disponible" con su razón.

import {
  M7_CLASSIFICATIONS, M7_VERDICTS, M7_SEVERITIES, M7_LIFECYCLE_STATES,
} from './contract.js'
import {
  M7_VERDICT_LABELS, M7_CLASSIFICATION_LABELS, M7_SEVERITY_LABELS,
  M7_LIFECYCLE_LABELS,
} from './m7Meta.js'

export const M7_PAGE_SIZE = 25

export const M7_DEFAULT_FILTERS = Object.freeze({
  verdict: '', classification: '', severity: '', lifecycle_status: '',
  category: '', rule_code: '', search: '', date_from: '', date_to: '',
  page: 1, page_size: M7_PAGE_SIZE,
})

// Ejes filtrables (validación de VALOR contra el enum, igual que el backend).
export const M7_FILTER_AXES = Object.freeze([
  { key: 'verdict', label: 'Veredicto', options: M7_VERDICTS, labels: M7_VERDICT_LABELS,
    help: 'Qué se concluye de la regla.' },
  { key: 'classification', label: 'Clasificación', options: M7_CLASSIFICATIONS,
    labels: M7_CLASSIFICATION_LABELS, help: 'Qué tan sólida es la evidencia. NO es el veredicto.' },
  { key: 'severity', label: 'Severidad', options: M7_SEVERITIES, labels: M7_SEVERITY_LABELS,
    help: 'Qué tan grave sería si es real.' },
  { key: 'lifecycle_status', label: 'Ciclo de vida', options: M7_LIFECYCLE_STATES,
    labels: M7_LIFECYCLE_LABELS, help: 'Cómo evoluciona entre corridas del MISMO scope.' },
])

// Espejo de core.UNSUPPORTED_FILTERS: NO se ofrecen, con razón visible.
export const M7_UNSUPPORTED_FILTERS = Object.freeze([
  { key: 'company_id', reason: 'hallazgos agregados: no portan compañía individual' },
  { key: 'branch_id', reason: 'sin dimensión de sucursal en v1' },
  { key: 'currency_id', reason: 'los importes viajan POR MONEDA en metrics, no en findings' },
  { key: 'channel_id', reason: 'sin dimensión de canal en findings v1' },
  { key: 'product_id', reason: 'sin dimensión de producto en findings v1' },
  { key: 'product_category_id', reason: 'sin dimensión de categoría en findings v1' },
  { key: 'route_id', reason: 'sin dimensión de ruta en findings v1' },
  { key: 'vehicle_id', reason: 'sin dimensión de vehículo en findings v1' },
  { key: 'allocation_policy_id', reason: "v1 no tiene políticas: siempre 'none'" },
  { key: 'granularity', reason: 'v1 emite una sola granularidad (aggregate)' },
  { key: 'coverage_status', reason: 'no existe ese eje como campo filtrable en v1' },
  { key: 'profitability_level', reason: 'el nivel es del RUN (capabilities), no del hallazgo' },
  { key: 'partner_id', reason: 'identidad de cliente = PII; jamás viaja' },
])

/** Construye los params para el backend a partir del estado de filtros. */
export function buildFindingsParams(filters) {
  const out = {}
  for (const key of ['verdict', 'classification', 'severity', 'lifecycle_status',
    'category', 'rule_code', 'search', 'date_from', 'date_to']) {
    const v = filters?.[key]
    if (v !== undefined && v !== null && v !== '') out[key] = v
  }
  out.page = Math.max(1, Number(filters?.page) || 1)
  out.page_size = Math.min(100, Math.max(1, Number(filters?.page_size) || M7_PAGE_SIZE))
  return out
}

export function activeFilterCount(filters) {
  return ['verdict', 'classification', 'severity', 'lifecycle_status', 'category',
    'rule_code', 'search', 'date_from', 'date_to']
    .filter((k) => filters?.[k] !== undefined && filters?.[k] !== null && filters?.[k] !== '')
    .length
}
