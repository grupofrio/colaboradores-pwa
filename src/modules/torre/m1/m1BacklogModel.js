// ─── M1-D Backlog — modelo puro (sin React) ──────────────────────────────────
// Toda la lógica testeable de la pantalla ScreenM1Backlog vive aquí:
// construcción de query (contrato gf_tower_m1 v18.0.1.1.0, kold-os 57175d4),
// normalización tolerante del payload (claves desconocidas NO rompen),
// clasificación de errores a estados de UI, paginación con meta.total y
// visibilidad por rol. La UI solo presenta; jamás re-clasifica ni recalcula.

export const DEFAULT_LIMIT = 50

export const STATE_BUCKETS = [
  { value: 'open', label: 'Abiertas' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed_cash_pending', label: 'Cerradas c/cash' },
]

export const AGE_BUCKETS = [
  { value: '', label: 'Cualquier antigüedad' },
  { value: 'day', label: 'Hoy' },
  { value: 'recent', label: '1–7 días' },
  { value: 'historical', label: '>7 días' },
]

export const SORTS = [
  { value: 'age_days', label: 'Edad (mayor primero)' },
  { value: 'cash_pending_amount', label: 'Venta cash pend. (mayor primero)' },
  { value: 'scheduled_date', label: 'Fecha (reciente primero)' },
  { value: 'branch_name', label: 'Sucursal (A–Z)' },
]

export const DEFAULT_FILTERS = Object.freeze({
  state_bucket: 'open',
  bucket: '',
  date_from: '',
  date_to: '',
  sort: 'age_days',
  branch_id: '',        // solo admin; '' = todas
  close_candidate: false,
})

// ── Query (contrato) ─────────────────────────────────────────────────────────
// Solo params del contrato; jamás strings vacíos; jamás employee_id/company_id/
// domain; close_candidate SOLO como "1" cuando está activo (sin filtro inverso);
// branch_id SOLO para admin (el server lo ignoraría para supervisor, pero la UI
// ni siquiera lo manda).
export function buildBacklogQuery(filters, offset, role) {
  const f = { ...DEFAULT_FILTERS, ...(filters || {}) }
  const query = {
    state_bucket: f.state_bucket || 'open',
    limit: String(DEFAULT_LIMIT),
    offset: String(Math.max(0, Number(offset) || 0)),
  }
  if (f.bucket) query.bucket = f.bucket
  if (f.date_from) query.date_from = f.date_from
  if (f.date_to) query.date_to = f.date_to
  if (f.sort && f.sort !== 'age_days') query.sort = f.sort
  if (role === 'admin_plataforma' && f.branch_id) query.branch_id = String(f.branch_id)
  if (f.close_candidate === true) query.close_candidate = '1'
  return query
}

export function toQueryString(query) {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') usp.set(key, value)
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

// ── Normalización tolerante (compatibilidad aditiva) ────────────────────────
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

export function normalizeKpis(kpis, role) {
  const k = kpis && typeof kpis === 'object' ? kpis : {}
  const cards = [
    { key: 'open_routes', label: 'Rutas abiertas', value: num(k.open_routes), kind: 'int' },
    { key: 'cash_pending_amount', label: 'Venta cash pendiente de recepción', value: num(k.cash_pending_amount), kind: 'money' },
    { key: 'open_routes_over_7d', label: 'Abiertas >7 días', value: num(k.open_routes_over_7d), kind: 'int' },
    { key: 'close_candidates', label: 'Candidatas a cierre (en abiertas)', value: num(k.close_candidates), kind: 'int' },
    { key: 'draft_routes', label: 'Rutas draft', value: num(k.draft_routes), kind: 'int' },
    { key: 'cash_closed_pending_amount', label: 'Cash pendiente en cerradas', value: num(k.cash_closed_pending_amount), kind: 'money' },
  ]
  if (role === 'admin_plataforma') {
    cards.push({
      key: 'unresolved_branch_rows',
      label: 'Filas sin sucursal confiable (diagnóstico)',
      value: num(k.unresolved_branch_rows),
      kind: 'int',
    })
  }
  return cards
}

export function normalizeRow(row) {
  const r = row && typeof row === 'object' ? row : {}
  return {
    plan_id: num(r.plan_id),
    route_name: typeof r.route_name === 'string' ? r.route_name : '',
    branch_name: typeof r.branch_name === 'string' ? r.branch_name : '',
    branch_resolution_source: typeof r.branch_resolution_source === 'string' ? r.branch_resolution_source : '',
    state: typeof r.state === 'string' ? r.state : '',
    scheduled_date: typeof r.scheduled_date === 'string' ? r.scheduled_date : '',
    age_days: num(r.age_days) ?? 0,
    stops_total: num(r.stops_total) ?? 0,
    stops_done: num(r.stops_done) ?? 0,
    all_stops_done: r.all_stops_done === true,
    cash_pending_flag: r.cash_pending_flag === true,
    cash_pending_amount: num(r.cash_pending_amount) ?? 0,
    cash_closed_pending_flag: r.cash_closed_pending_flag === true,
    cash_closed_pending_amount: num(r.cash_closed_pending_amount) ?? 0,
    close_candidate_flag: r.close_candidate_flag === true,
    risk_level: ['low', 'medium', 'high'].includes(r.risk_level) ? r.risk_level : 'low',
    recommended_action: typeof r.recommended_action === 'string' ? r.recommended_action : '',
    last_activity_at: typeof r.last_activity_at === 'string' ? r.last_activity_at : '',
  }
}

export function normalizePayload(payload, role) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const meta = p.meta && typeof p.meta === 'object' ? p.meta : {}
  const rows = Array.isArray(p.rows) ? p.rows.map(normalizeRow) : []
  return {
    dataAsOf: typeof p.data_as_of === 'string' ? p.data_as_of : '',
    role: typeof p.role === 'string' ? p.role : role || '',
    kpis: normalizeKpis(p.kpis, role),
    rows,
    total: num(meta.total) ?? rows.length,
    limit: num(meta.limit) ?? DEFAULT_LIMIT,
    offset: num(meta.offset) ?? 0,
    rejectedParams: Array.isArray(meta.rejected_params) ? meta.rejected_params : [],
    status: rows.length === 0 ? 'empty' : 'success',
  }
}

// ── Selector de sucursal (F-5) ───────────────────────────────────────────────
// EXCLUSIVAMENTE desde payload.available_branches y SOLO para admin. Para
// supervisor devuelve [] aunque la clave apareciera por accidente.
export function visibleBranchOptions(role, payload) {
  if (role !== 'admin_plataforma') return []
  const list = payload && Array.isArray(payload.available_branches)
    ? payload.available_branches : []
  return list
    .filter((b) => b && Number.isFinite(Number(b.id)))
    .map((b) => ({ id: Number(b.id), display_name: typeof b.display_name === 'string' ? b.display_name : String(b.id) }))
}

export function showBranchSelector(role) {
  return role === 'admin_plataforma'
}

// ── Errores → estados de UI ──────────────────────────────────────────────────
// Códigos del contrato: 503 feature_disabled · 403 no_branch_scope/forbidden ·
// 401 missing_token/invalid_session/no_session · 400 invalid_branch · 500.
export function classifyError(err) {
  const status = Number(err?.status) || 0
  const code = String(err?.code || '')
  if (status === 503 || code === 'feature_disabled') {
    return { state: 'feature_disabled', retryable: true }
  }
  if (status === 403 && (code === 'no_branch_scope')) {
    return { state: 'no_branch_scope', retryable: false, reason: err?.reason || '' }
  }
  if (status === 403) return { state: 'forbidden', retryable: false }
  if (status === 401 || code === 'no_session') {
    // el flujo central gf:session-expired ya redirige; la UI solo lo refleja
    return { state: 'session_expired', retryable: false }
  }
  if (code === 'timeout') return { state: 'error', retryable: true, code }
  if (status === 400) return { state: 'error', retryable: false, code: code || 'bad_request' }
  return { state: 'error', retryable: true, code: code || (status ? String(status) : 'network') }
}

// Timeout manual (el cliente del repo no tiene timeout central): carrera simple
// que produce un error clasificable como retryable. Sin reintentos automáticos.
export function withTimeout(promise, ms = 30000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('timeout')
      e.code = 'timeout'
      e.status = 0
      reject(e)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// ── Paginación (meta.total filtrado) ─────────────────────────────────────────
export function pagination(offset, rowsCount, total, limit = DEFAULT_LIMIT) {
  const safeOffset = Math.max(0, Number(offset) || 0)
  const safeTotal = Math.max(0, Number(total) || 0)
  return {
    from: safeTotal === 0 ? 0 : safeOffset + 1,
    to: safeOffset + rowsCount,
    total: safeTotal,
    canPrev: safeOffset > 0,
    canNext: safeOffset + rowsCount < safeTotal,
    prevOffset: Math.max(0, safeOffset - limit),
    nextOffset: safeOffset + limit,
  }
}

// Cambiar cualquier filtro reinicia offset a 0 (regla del contrato de UI).
export function applyFilterChange(filters, key, value) {
  return { filters: { ...filters, [key]: value }, offset: 0 }
}

export function clearFilters() {
  return { filters: { ...DEFAULT_FILTERS }, offset: 0 }
}

// ── Formatos es-MX (presentación pura) ───────────────────────────────────────
const moneyFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
})

export function fmtMoney(value) {
  const n = num(value)
  return n === null ? '—' : moneyFmt.format(n)
}

export function fmtInt(value) {
  const n = num(value)
  return n === null ? '—' : String(n)
}

export function fmtKpiValue(card) {
  if (!card || card.value === null || card.value === undefined) return '—'
  return card.kind === 'money' ? fmtMoney(card.value) : fmtInt(card.value)
}

export const STATE_LABELS = {
  published: 'Publicada',
  in_progress: 'En progreso',
  draft: 'Borrador',
  closed: 'Cerrada',
}

export const RISK_LABELS = {
  low: { label: 'Bajo', icon: '●', color: '#22c55e' },
  medium: { label: 'Medio', icon: '●', color: '#f59e0b' },
  high: { label: 'Alto', icon: '●', color: '#ef4444' },
}
