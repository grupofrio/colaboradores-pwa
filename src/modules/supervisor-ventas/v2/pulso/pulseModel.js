export const PULSE_HORIZONS = Object.freeze([
  { key: 'ahora', label: 'Ahora' },
  { key: 'ayer', label: 'Ayer' },
])

export const ATTENTION_TYPES = Object.freeze([
  'route_not_departed',
  'route_zero_visits',
  'close_cash_composed',
  'open_routes_over_7d',
  'load_pending_acceptance',
  'gps_stale',
  'coverage_gap',
  'conversion_watch',
])

const ATTENTION_TYPE_SET = new Set(ATTENTION_TYPES)
const SEVERITY_RANK = Object.freeze({ critical: 0, warning: 1, info: 2 })

export const CONVERSION_LABELS = Object.freeze({
  good: 'En orden',
  watch: 'Vigilar',
  attention: 'Atención',
  critical: 'Crítico',
  unknown: 'Sin dato',
})

function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function formatCashCopy(cash) {
  if (!cash || cash.available !== true || cash.pending !== true) return null

  if (cash.currency_status === 'known_single') {
    const amount = finite(cash.amount)
    const currency = String(cash.currency || '').trim()
    if (amount === null || !currency) return 'Caja pendiente · moneda por confirmar'
    const formatted = new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
    }).format(amount)
    return `Caja pendiente · ${formatted} ${currency}`
  }

  if (cash.currency_status === 'known_multiple') {
    const count = Math.max(Array.isArray(cash.breakdown) ? cash.breakdown.length : 0, 2)
    return `Caja pendiente en ${count} monedas`
  }

  if (cash.currency_status === 'unknown') {
    return 'Caja pendiente · moneda por confirmar'
  }

  return 'Caja pendiente'
}

export function isAttentionItem(item) {
  return !!item && ATTENTION_TYPE_SET.has(item.type)
}

export function sortAttention(items = []) {
  return items
    .filter(isAttentionItem)
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const a = left.item
      const b = right.item
      const severity = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
      if (severity) return severity
      const occurred = String(a.occurred_at || '').localeCompare(String(b.occurred_at || ''))
      if (occurred) return occurred
      const entity = (finite(a.entity_id) ?? 0) - (finite(b.entity_id) ?? 0)
      if (entity) return entity
      const type = String(a.type || '').localeCompare(String(b.type || ''))
      return type || left.index - right.index
    })
    .map(({ item }) => item)
}

export function sliceAttention(items = [], max = 5) {
  const limit = Math.max(0, Number.isFinite(Number(max)) ? Number(max) : 5)
  return sortAttention(items).slice(0, limit)
}

export function conversionState(value) {
  const pct = finite(value)
  if (pct === null) return { pct: null, tone: 'unknown', label: CONVERSION_LABELS.unknown }
  if (pct >= 80) return { pct, tone: 'good', label: CONVERSION_LABELS.good }
  if (pct >= 50) return { pct, tone: 'watch', label: CONVERSION_LABELS.watch }
  if (pct >= 40) return { pct, tone: 'attention', label: CONVERSION_LABELS.attention }
  return { pct, tone: 'critical', label: CONVERSION_LABELS.critical }
}

export function diagnosis(coverageValue, conversionValue) {
  const coverage = finite(coverageValue)
  const conversion = finite(conversionValue)
  if (coverage === null || conversion === null) return { kind: 'none', summary: null }

  const coverageBad = coverage < 80
  const conversionBad = conversion < 50
  if (coverageBad && conversionBad) {
    return { kind: 'both', summary: 'Hay desviaciones en cobertura y conversión.' }
  }
  if (coverageBad) {
    return { kind: 'execution', summary: 'La principal desviación está en ejecución (cobertura).' }
  }
  if (conversionBad) {
    return { kind: 'conversion', summary: 'La principal desviación está en conversión.' }
  }
  return { kind: 'none', summary: null }
}

export function isPulseFocusCta(cta) {
  return cta?.kind === 'pulse_focus'
    && cta.horizon === 'ayer'
    && typeof cta.block === 'string'
    && cta.block.length > 0
}

export function pulseFocusTarget(cta) {
  if (!isPulseFocusCta(cta)) return null
  return {
    horizon: 'ayer',
    block: cta.block,
    entityId: cta.entity_id ?? null,
  }
}

export function pulseRouteRowId(entityId) {
  return entityId == null ? null : `pulse-route-${String(entityId)}`
}

export function focusPulseRoute(root, entityId) {
  const id = pulseRouteRowId(entityId)
  if (!id || !root?.querySelector) return false
  const row = root.querySelector(`[data-pulse-row-id="${id}"]`)
  if (!row) return false
  row.classList?.add('pulse-route-row--focused')
  row.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  return true
}

export function metricValue(metric, ...keys) {
  for (const key of keys) {
    const value = metric?.[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}
