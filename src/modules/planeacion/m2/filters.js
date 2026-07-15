// ─── KOLD OS · M2 — Filtros y paginación del drill-down (puros) ──────────────

export const M2_DEFAULT_FILTERS = Object.freeze({
  category: 'all',
  severity: 'all',
  status: 'all',
  lifecycle: 'all',
  entity_type: 'all',
  responsible_area: 'all',
  search: '',
  date_from: '',
  date_to: '',
})

export const M2_PAGE_SIZE = 10

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

/** Aplica los filtros del drill-down sobre hallazgos (fail-safe: lista vacía). */
export function applyFindingFilters(findings = [], filters = M2_DEFAULT_FILTERS) {
  const f = { ...M2_DEFAULT_FILTERS, ...(filters || {}) }
  const search = String(f.search || '').trim().toLowerCase()
  return (Array.isArray(findings) ? findings : []).filter((finding) => {
    if (!finding) return false
    if (f.category !== 'all' && finding.category !== f.category) return false
    if (f.severity !== 'all' && finding.severity !== f.severity) return false
    if (f.status !== 'all' && finding.status !== f.status) return false
    if (f.lifecycle !== 'all' && finding.lifecycle_status !== f.lifecycle) return false
    if (f.entity_type !== 'all' && finding.entity_type !== f.entity_type) return false
    if (f.responsible_area !== 'all' && finding.responsible_area !== f.responsible_area) return false
    if (!matchesDate(finding.last_seen_at, f.date_from, f.date_to)) return false
    if (search) {
      const haystack = [
        finding.rule_code, finding.title, finding.description,
        finding.entity_reference, finding.responsible_area, finding.entity_type,
      ].join(' ').toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

/** Paginación defensiva: page se ajusta al rango válido. */
export function paginate(items = [], page = 1, pageSize = M2_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : []
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : M2_PAGE_SIZE
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
