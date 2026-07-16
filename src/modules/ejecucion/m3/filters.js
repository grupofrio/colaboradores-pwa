// ─── KOLD OS · M3 — Filtros locales del detalle (puros) ──────────────────────
// MISMA semántica de parámetros que GET /pwa-kold-os/m3/findings (backend
// gf_kold_os_m3). En producción el filtrado/paginado es SERVER-SIDE; este
// módulo se usa para el modo demo (fixture) y como referencia del contrato.

export const M3_DEFAULT_FILTERS = Object.freeze({
  category: '',
  rule_code: '',
  severity: '',
  verdict: '',
  classification: '',
  lifecycle_status: '',
  responsible_area: '',
  granularity: '',
  entity_type: '',
  branch_id: '',
  search: '',
  date_from: '',
  date_to: '',
})

export const M3_PAGE_SIZE = 10

const matchesDate = (value, from, to) => {
  if (!from && !to) return true
  const t = Date.parse(value || '')
  if (!Number.isFinite(t)) return false
  if (from) {
    const f = Date.parse(`${from}T00:00:00Z`)
    if (Number.isFinite(f) && t < f) return false
  }
  if (to) {
    const u = Date.parse(`${to}T23:59:59Z`)
    if (Number.isFinite(u) && t > u) return false
  }
  return true
}

/** Aplica los filtros del contrato sobre items de findings (fail-safe). */
export function applyFindingFilters(findings = [], filters = M3_DEFAULT_FILTERS) {
  const f = { ...M3_DEFAULT_FILTERS, ...(filters || {}) }
  const search = String(f.search || '').trim().toLowerCase()
  const branchId = f.branch_id === '' || f.branch_id === null || f.branch_id === undefined
    ? null
    : Number(f.branch_id)
  return (Array.isArray(findings) ? findings : []).filter((finding) => {
    if (!finding) return false
    for (const key of [
      'category', 'rule_code', 'severity', 'verdict', 'classification',
      'lifecycle_status', 'responsible_area', 'granularity', 'entity_type',
    ]) {
      if (f[key] && finding[key] !== f[key]) return false
    }
    if (branchId !== null && finding.branch_id !== branchId) return false
    if (!matchesDate(finding.last_seen_at, f.date_from, f.date_to)) return false
    if (search) {
      const haystack = [
        finding.rule_code, finding.title, finding.description,
        finding.entity_reference, finding.responsible_area, finding.entity_type,
        finding.branch_code,
      ].join(' ').toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

/** Paginación defensiva (espejo del backend: clamps + total). */
export function paginate(items = [], page = 1, pageSize = M3_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : []
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : M3_PAGE_SIZE
  const pages = Math.max(Math.ceil(list.length / size), 1)
  const current = Math.min(Math.max(Number.isInteger(page) ? page : 1, 1), pages)
  const start = (current - 1) * size
  return {
    items: list.slice(start, start + size),
    page: current,
    pages,
    total: list.length,
    page_size: size,
  }
}
