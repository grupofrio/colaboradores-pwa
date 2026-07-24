// ─── KOLD OS · M6 — Filtros (SERVER-SIDE, jamás en el cliente) ───────────────
//
// ORDEN OBLIGATORIO (bug 3 de M3, que filtraba después de paginar):
//   usuario elige filtros → request al backend → el backend filtra → cuenta →
//   pagina → el frontend REPRESENTA.
//
// Este archivo NO contiene una función que filtre `items`: filtrar aquí haría
// que el total mienta y que los filtros "pierdan" resultados de páginas
// siguientes. Sólo construye los params que viajan y decide qué filtro se
// MUESTRA (según capabilities y lo que los hallazgos realmente portan).

import {
  M6_CATEGORY_ORDER, M6_VERDICT_ORDER, M6_CLASSIFICATION_ORDER,
  M6_SEVERITY_ORDER, M6_LIFECYCLE_ORDER,
} from './m6Meta.js'
import { KOLD_OS_M6_FINDINGS_PARAMS } from '../../../lib/koldOsM6Route.js'

export const M6_PAGE_SIZE = 25

export const M6_DEFAULT_FILTERS = Object.freeze({
  category: '', rule_code: '', classification: '', verdict: '', severity: '',
  lifecycle_status: '', responsible_area: '', entity_type: '', search: '',
  date_from: '', date_to: '',
})

// Los CUATRO EJES se ofrecen por SEPARADO. Colapsarlos (p.ej. un único selector
// "estado") fue el bug D de M3/M4/M5.
export const M6_FILTER_AXES = Object.freeze([
  { key: 'verdict', label: 'Veredicto', options: M6_VERDICT_ORDER,
    help: 'Qué se concluye de la regla.' },
  { key: 'classification', label: 'Clasificación', options: M6_CLASSIFICATION_ORDER,
    help: 'Qué tan sólida es la evidencia. NO es el veredicto.' },
  { key: 'severity', label: 'Severidad', options: M6_SEVERITY_ORDER,
    help: 'Qué tan grave sería si es real.' },
  { key: 'lifecycle_status', label: 'Ciclo de vida', options: M6_LIFECYCLE_ORDER,
    help: 'Cómo evoluciona entre corridas del MISMO scope.' },
  { key: 'category', label: 'Bloque', options: M6_CATEGORY_ORDER,
    help: 'Área funcional del hallazgo.' },
])

/**
 * Filtros que NO se muestran y POR QUÉ. v1 es AGREGADO: los hallazgos no portan
 * company/branch/currency/journal/aging, así que ofrecerlos devolvería 0
 * siempre — una mentira silenciosa. La razón se muestra en la UI.
 */
export const M6_HIDDEN_FILTERS = Object.freeze([
  { key: 'company_id', reason: 'capability company_dimension=false — v1 es agregado' },
  { key: 'branch_id', reason: 'capability branch_dimension=false — v1 es agregado' },
  { key: 'currency_id', reason: 'capability currency_dimension=false — el hallazgo no porta moneda' },
  { key: 'journal_id', reason: 'capability journal_dimension=false' },
  { key: 'aging_bucket', reason: 'el aging vive en el snapshot, no en el hallazgo' },
  { key: 'partner_id', reason: 'identidad de cliente = PII; jamás viaja' },
])

/**
 * Decide si un filtro se muestra: sólo si el backend lo acepta (allowlist) Y la
 * capability lo permite. No se muestra un filtro que el backend rechazaría.
 */
export function isFilterAvailable(key, capabilities) {
  if (!KOLD_OS_M6_FINDINGS_PARAMS.includes(key)) return false
  const features = capabilities?.features
  if (!features) return true
  if (key === 'company_id') return features.company_dimension === true
  if (key === 'branch_id') return features.branch_dimension === true
  if (key === 'currency_id') return features.currency_dimension === true
  if (key === 'journal_id') return features.journal_dimension === true
  return true
}

/** Construye los params que VIAJAN al backend. Descarta vacíos y desconocidos. */
export function buildFindingsParams(filters, { page = 1, pageSize = M6_PAGE_SIZE } = {}) {
  const out = { page, page_size: pageSize }
  for (const key of KOLD_OS_M6_FINDINGS_PARAMS) {
    if (key === 'page' || key === 'page_size') continue
    const value = filters?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      out[key] = String(value).trim()
    }
  }
  return out
}

/** ¿Hay algún filtro activo? (para el badge de "filtros aplicados"). */
export function activeFilterCount(filters) {
  return Object.entries(filters || {}).filter(([k, v]) =>
    k !== 'page' && k !== 'page_size' && v !== undefined && v !== null && String(v).trim() !== '').length
}
