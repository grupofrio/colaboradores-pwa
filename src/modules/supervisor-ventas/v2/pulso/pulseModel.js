export const PULSE_HORIZONS = Object.freeze([
  { key: 'ahora', label: 'Ahora' },
  { key: 'ayer', label: 'Ayer' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
])

export const PULSE_HORIZON_KEYS = Object.freeze(PULSE_HORIZONS.map((item) => item.key))

export const ATTENTION_TYPES = Object.freeze([
  'route_not_departed',
  'route_zero_visits',
  'close_cash_composed',
  'open_routes_over_7d',
  'load_pending_acceptance',
  'gps_stale',
  'coverage_gap',
  'conversion_watch',
  'first_visit_late',
  'km_deviation_high',
  'km_deviation_low',
  'customer_purchase_drop',
  'weekly_customer_missing',
  'execution_pattern',
  'capacity_over',
  'recurrent_issue',
  'persistent_issue',
])

export const PULSE_FOCUS_HORIZONS = Object.freeze(['ahora', 'ayer', 'semana', 'mes'])

export const TONE_LABELS = Object.freeze({
  good: 'En orden',
  watch: 'Vigilar',
  attention: 'Atención',
  critical: 'Crítico',
  unknown: 'Sin dato',
})

const ATTENTION_TYPE_SET = new Set(ATTENTION_TYPES)
const PULSE_FOCUS_HORIZON_SET = new Set(PULSE_FOCUS_HORIZONS)
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

function blockObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
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

export function displayValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (Number.isFinite(number)) {
    return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(number)}${suffix}`
  }
  return String(value)
}

export function moneyValue(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return '—'
  if (!currency) return '—'
  const number = Number(amount)
  if (!Number.isFinite(number)) return '—'
  const formatted = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(number)
  return `${formatted} ${currency}`
}

export function toneLabel(tone) {
  return TONE_LABELS[tone] || TONE_LABELS.unknown
}

export function matrixCellLabel(cell) {
  if (!cell || cell.available === false) return 'Sin dato'
  if (cell.label) return String(cell.label)
  const pct = finite(cell.pct ?? cell.value)
  if (pct === null) return 'Sin dato'
  if (cell.unit === 'count' || cell.kind === 'count') return displayValue(pct)
  return displayValue(pct, '%')
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
    && PULSE_FOCUS_HORIZON_SET.has(cta.horizon)
    && typeof cta.block === 'string'
    && cta.block.length > 0
}

export function pulseFocusTarget(cta) {
  if (!isPulseFocusCta(cta)) return null
  return {
    horizon: cta.horizon,
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

export function focusPulseBlock(root, block) {
  if (!block || !root?.querySelector) return false
  const target = root.querySelector(`[data-pulse-block="${block}"]`)
  if (!target) return false
  target.classList?.add('pulse-block--focused')
  target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  return true
}

export function metricValue(metric, ...keys) {
  for (const key of keys) {
    const value = metric?.[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

function presentMovementCards(raw) {
  if (Array.isArray(raw?.cards)) {
    return raw.cards.map((card) => ({
      key: card.key || card.id || card.label,
      label: card.label || card.title || 'Movimiento',
      count: card.available === false ? null : finite(card.count ?? card.total ?? card.value),
      tone: card.tone || 'unknown',
      tone_label: card.tone_label || toneLabel(card.tone),
      summary: card.summary || null,
      available: card.available !== false,
      cta: card.cta || null,
    }))
  }

  const canonicalSlots = [
    ['recovered', 'Recuperados'],
    ['prospects_converted', 'Prospectos convertidos'],
    ['prospects_activated', 'Prospectos activados'],
    ['pending_to_buy', 'Pendientes de compra'],
    ['opportunities', 'Oportunidades'],
    ['opportunities_converted', 'Oportunidades convertidas'],
  ]
  const cards = []
  for (const [key, label] of canonicalSlots) {
    const card = raw?.[key]
    if (!card || typeof card !== 'object') continue
    if (card.available === false) {
      cards.push({
        key,
        label,
        count: null,
        tone: 'unknown',
        tone_label: 'No disponible',
        summary: card.reason || `${label} no disponible.`,
        available: false,
        cta: card.cta || null,
      })
      continue
    }
    const count = finite(card.count ?? card.open ?? card.total ?? card.value)
    cards.push({
      key,
      label,
      count,
      tone: card.tone || (count != null && count > 0 ? 'watch' : 'good'),
      tone_label: card.tone_label || toneLabel(card.tone),
      summary: card.summary || null,
      available: true,
      cta: card.cta || null,
    })
  }
  if (cards.length) return cards

  // Legacy pre-canonical keys (tests/fixtures antiguos).
  for (const key of ['recovered', 'missing', 'drops', 'opportunities']) {
    const card = raw?.[key]
    if (!card || typeof card !== 'object') continue
    cards.push({
      key,
      label: card.label || key,
      count: card.available === false ? null : finite(card.count ?? card.total ?? card.value),
      tone: card.tone || 'unknown',
      tone_label: card.tone_label || toneLabel(card.tone),
      summary: card.summary || null,
      available: card.available !== false,
      cta: card.cta || null,
    })
  }
  return cards
}

export function presentCustomerMovement(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Movimiento de clientes',
      summary: value.summary || 'Movimiento de clientes no disponible.',
      cards: [],
    }
  }
  return {
    available: true,
    title: value.title || 'Movimiento de clientes',
    summary: value.summary || null,
    cards: presentMovementCards(value),
  }
}

export function presentWeekMatrix(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Cobertura semanal',
      summary: value.summary || 'Matriz semanal no disponible.',
      days: [],
      rows: [],
    }
  }
  const days = Array.isArray(value.days) ? value.days : (Array.isArray(value.columns) ? value.columns : [])
  const rows = Array.isArray(value.rows)
    ? value.rows.map((row) => ({
      label: row.operational_plan_name || row.label || row.name || row.route_name || 'Indicador',
      cells: Array.isArray(row.cells)
        ? row.cells.map((cell) => ({
          available: cell?.available !== false && cell?.state !== 'unavailable',
          tone: cell?.tone || (cell?.state === 'complete' ? 'good' : cell?.state === 'incomplete' ? 'attention' : 'unknown'),
          tone_label: cell?.tone_label || toneLabel(cell?.tone),
          label: cell?.label || matrixCellLabel(cell),
          value: cell?.available === false ? null : finite(cell?.pct ?? cell?.value ?? cell?.visited),
        }))
        : [],
    }))
    : []
  return {
    available: true,
    title: value.title || 'Cobertura semanal',
    summary: value.summary || null,
    days,
    rows,
  }
}

export function presentSameTranche(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Tendencia de sucursal (mismo tramo)',
      summary: value.summary || 'Comparativo no disponible.',
      money: presentMoney(value.money),
    }
  }
  const money = presentMoney(
    value.money,
    value.sales || {},
    value.collection || {},
    value,
  )
  return {
    available: true,
    title: value.title || 'Tendencia de sucursal (mismo tramo)',
    summary: value.summary || null,
    current_label: value.current_label || value.current?.label || 'Periodo actual',
    previous_label: value.previous_label || value.previous?.label || 'Periodo anterior',
    delta_pct: finite(value.delta_pct ?? value.change_pct),
    money,
    current: value.current || {},
    previous: value.previous || {},
  }
}

export function presentExecution(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Ejecución',
      summary: value.summary || 'Ejecución no disponible.',
      punctuality: null,
      km: null,
      quality: null,
    }
  }

  const mapMetric = (metric, fallbackLabel) => {
    const item = blockObject(metric)
    if (!item) return null
    if (item.available === false) {
      return {
        available: false,
        label: item.label || fallbackLabel,
        summary: item.summary || `${fallbackLabel} no disponible.`,
        value: null,
      }
    }
    return {
      available: true,
      label: item.label || fallbackLabel,
      summary: item.summary || null,
      value: finite(item.pct ?? item.value ?? item.count),
      tone: item.tone || 'unknown',
      tone_label: item.tone_label || toneLabel(item.tone),
      unit: item.unit || (item.count != null ? 'count' : 'pct'),
    }
  }

  return {
    available: true,
    title: value.title || 'Ejecución',
    summary: value.summary || null,
    punctuality: mapMetric(value.punctuality, 'Puntualidad'),
    km: mapMetric(value.km ?? value.km_deviation, 'Kilometraje'),
    quality: mapMetric(value.quality, 'Calidad'),
  }
}

export function presentMonthTargets(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Venta vs objetivos',
      summary: value.summary || 'Objetivos no disponibles.',
      sales: null,
      frozen_demand: null,
      direct_target: null,
      pace: null,
    }
  }

  const mapTarget = (target, fallbackLabel) => {
    const item = blockObject(target)
    if (!item) return null
    if (item.available === false) {
      return {
        available: false,
        label: item.label || fallbackLabel,
        summary: item.summary || `${fallbackLabel} no disponible.`,
        amount: null,
        currency: null,
      }
    }
    return {
      available: true,
      label: item.label || fallbackLabel,
      summary: item.summary || null,
      amount: finite(item.amount ?? item.target ?? item.value ?? item.actual),
      currency: item.currency || value.currency || null,
    }
  }

  const pace = blockObject(value.pace)
  return {
    available: true,
    title: value.title || 'Venta vs objetivos',
    summary: value.summary || null,
    sales: mapTarget(value.sales ?? value.actual, 'Venta'),
    frozen_demand: mapTarget(value.frozen_demand ?? value.demanda_congelada, 'Demanda congelada'),
    direct_target: mapTarget(value.direct_target ?? value.meta_directa, 'Meta directa'),
    pace: !pace
      ? null
      : pace.available === false
        ? {
          available: false,
          label: pace.label || 'Ritmo',
          summary: pace.summary || 'Ritmo no disponible.',
          pct: null,
          tone: 'unknown',
          tone_label: TONE_LABELS.unknown,
        }
        : {
          available: true,
          label: pace.label || 'Ritmo',
          summary: pace.summary || null,
          pct: finite(pace.pct ?? pace.value),
          tone: pace.tone || 'unknown',
          tone_label: pace.tone_label || toneLabel(pace.tone),
        },
  }
}

export function presentTrend(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Tendencia',
      summary: value.summary || 'Tendencia no disponible.',
      direction: null,
    }
  }
  return {
    available: true,
    title: value.title || 'Tendencia',
    summary: value.summary || null,
    direction: value.direction || value.trend || null,
    points: Array.isArray(value.points) ? value.points : [],
  }
}

export function presentProducts(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Productos',
      summary: value.summary || 'Productos no disponibles.',
      items: [],
    }
  }
  const items = Array.isArray(value.items) ? value.items : (Array.isArray(value.products) ? value.products : [])
  return {
    available: true,
    title: value.title || 'Productos',
    summary: value.summary || null,
    items: items.map((item) => ({
      name: item.name || item.product_name || 'Producto',
      change_pct: item.available === false ? null : finite(item.change_pct ?? item.delta_pct),
      tone: item.tone || 'unknown',
      tone_label: item.tone_label || toneLabel(item.tone),
      available: item.available !== false,
    })),
  }
}

export function presentRecurrentExecution(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Ejecución recurrente',
      summary: value.summary || 'Ejecución recurrente no disponible.',
      items: [],
    }
  }
  const items = Array.isArray(value.items) ? value.items : []
  return {
    available: true,
    title: value.title || 'Ejecución recurrente',
    summary: value.summary || null,
    items: items.map((item) => ({
      type: item.type || item.key || 'issue',
      label: item.label || item.title || 'Incidencia',
      count: item.available === false ? null : finite(item.count ?? item.value),
      tone: item.tone || 'unknown',
      tone_label: item.tone_label || toneLabel(item.tone),
      available: item.available !== false,
    })),
  }
}

export function presentPurchaseDrops(raw) {
  const value = blockObject(raw)
  if (!value) return null
  if (value.available === false) {
    return {
      available: false,
      title: value.title || 'Caídas de compra',
      summary: value.summary || 'Listado no disponible.',
      items: [],
    }
  }
  const items = Array.isArray(value.items) ? value.items : (Array.isArray(value.customers) ? value.customers : [])
  return {
    available: true,
    title: value.title || 'Caídas de compra',
    summary: value.summary || null,
    count: value.count ?? items.length,
    items: items.map((item) => ({
      id: item.id ?? item.partner_id ?? item.customer_id ?? item.entity_id,
      name: item.name || item.customer_name || item.entity_name || 'Cliente',
      drop_pct: item.available === false
        ? null
        : finite(item.drop_pct ?? item.delta_pct ?? item.change_pct),
      current_purchase_date: item.current_purchase_date || null,
      previous_purchase_date: item.previous_purchase_date || null,
      current_amount: finite(item.current_amount),
      previous_amount: finite(item.previous_amount),
      currency: item.currency || null,
      severity: item.severity || null,
      summary: item.summary || null,
      available: item.available !== false,
    })),
  }
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
    customer_movement: presentCustomerMovement(blocks.customer_movement || raw.customer_movement),
    week_matrix: presentWeekMatrix(blocks.week_matrix || raw.week_matrix),
    same_tranche: presentSameTranche(blocks.same_tranche || blocks.resultado || raw.same_tranche),
    execution: presentExecution(blocks.execution || raw.execution),
    targets: presentMonthTargets(blocks.targets || raw.targets),
    trend: presentTrend(blocks.trend || raw.trend),
    products: presentProducts(blocks.products || raw.products),
    recurrent_execution: presentRecurrentExecution(blocks.recurrent_execution || raw.recurrent_execution),
    purchase_drops: presentPurchaseDrops(
      blocks.customer_purchase_drop
      || blocks.purchase_drops
      || raw.customer_purchase_drop
      || raw.purchase_drops
      || blocks.drops
    ),
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
