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

/**
 * Flatten the SaleOps pulse envelope so views can read either top-level or
 * `blocks.*` without inventing a second contract shape.
 */
export function presentPulsePayload(raw = {}) {
  const blocks = raw?.blocks && typeof raw.blocks === 'object' ? raw.blocks : {}
  const resultado = blocks.resultado || raw.resultado || raw.result || {}
  const sales = resultado.sales || {}
  const collection = resultado.collection || {}
  const money = presentMoney(resultado.money, sales, collection, resultado)
  return {
    ...raw,
    partial: raw.partial === true,
    attention: raw.attention || raw.attention_items || [],
    attention_total: raw.attention_total ?? (raw.attention || []).length,
    funnel: blocks.funnel || raw.funnel || {},
    diagnosis: blocks.diagnosis || raw.diagnosis || null,
    quality: blocks.quality || raw.quality || raw.quality_metric || null,
    recovery: blocks.recovery || raw.recovery || null,
    estado_compacto: blocks.estado_compacto || raw.estado_compacto || raw.estado || null,
    cash: blocks.cash || raw.cash || null,
    yesterday_route_breakdown:
      blocks.yesterday_route_breakdown
      || raw.yesterday_route_breakdown
      || raw.routes
      || [],
    resultado: {
      money,
      sales_amount: money.consolidated ? money.sales_total : null,
      orders: money.consolidated ? money.orders : null,
      avg_ticket: money.consolidated ? money.avg_ticket : null,
      cash: money.consolidated ? money.cash : null,
      credit: money.consolidated ? money.credit : null,
      currency: money.consolidated ? money.currency : null,
      credit_label: collection.credit_label || 'Crédito otorgado',
    },
  }
}

/**
 * Compact operational state for Ahora.
 * When estado_compacto.available === false, never render defensive zeros
 * as if they were a real measurement (UNAVAILABLE != ZERO).
 */
export function compactState(data) {
  const value = data?.estado_compacto || data?.estado || data?.state || data?.compact_state
  if (!value || typeof value !== 'object') return null

  if (value.available === false) {
    return {
      title: value.title || 'Estado del día',
      summary: value.summary || 'Estado operativo no disponible.',
      value: null,
      available: false,
    }
  }

  const routes = value.routes_total
  const departed = value.departed
  const notDeparted = value.not_departed
  if (routes == null && departed == null && notDeparted == null && !value.title) return null
  return {
    title: value.title || value.label || 'Estado del día',
    summary: value.summary || (
      routes != null
        ? `${departed ?? '—'} salieron · ${notDeparted ?? '—'} sin salida · ${routes} rutas`
        : null
    ),
    value: value.value ?? value.count ?? null,
    available: value.available !== false,
  }
}

/**
 * Currency-safe money projection for Ayer.
 * Never exposes a cross-currency consolidated total to the UI.
 */
export function presentMoney(money, sales = {}, collection = {}, resultado = {}) {
  if (money && typeof money === 'object' && !Array.isArray(money)) {
    const status = money.currency_status || 'not_applicable'
    const consolidated = money.consolidated === true && status === 'known_single'
    return {
      available: money.available !== false,
      consolidated,
      currency_status: status,
      currency: consolidated ? (money.currency || null) : null,
      sales_total: consolidated ? finite(money.sales_total) : null,
      cash: consolidated ? finite(money.cash) : null,
      credit: consolidated ? finite(money.credit) : null,
      orders: consolidated ? finite(money.orders) : null,
      avg_ticket: consolidated ? finite(money.avg_ticket) : null,
      breakdown: Array.isArray(money.breakdown) ? money.breakdown : [],
    }
  }

  // Legacy fallback: only show totals when a single currency is known.
  const currency = String(
    sales.currency || collection.currency || resultado.currency || '',
  ).trim() || null
  if (!currency) {
    return {
      available: true,
      consolidated: false,
      currency_status: 'unknown',
      currency: null,
      sales_total: null,
      cash: null,
      credit: null,
      orders: null,
      avg_ticket: null,
      breakdown: [],
    }
  }
  return {
    available: true,
    consolidated: true,
    currency_status: 'known_single',
    currency,
    sales_total: finite(sales.total ?? resultado.sales_amount),
    cash: finite(collection.cash ?? resultado.cash),
    credit: finite(collection.credit ?? resultado.credit_granted ?? resultado.credito_otorgado),
    orders: finite(sales.orders ?? resultado.orders),
    avg_ticket: finite(sales.avg_ticket ?? resultado.avg_ticket),
    breakdown: [],
  }
}

/** Clear Pulso dark-launch projection after server FEATURE_DISABLED. */
export function clearPulseSessionProjection(session = {}) {
  return {
    capabilities: {
      ...(session.capabilities && typeof session.capabilities === 'object'
        ? session.capabilities
        : {}),
      supervisorPulse: false,
    },
    branch: {
      ...(session.branch && typeof session.branch === 'object' ? session.branch : {}),
      supervisor_pulse_enabled: false,
    },
  }
}


