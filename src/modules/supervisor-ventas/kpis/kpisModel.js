// ─── KPIs del supervisor: del contrato a lo que se pinta ─────────────────────
// Toda la lógica de presentación vive aquí, sin JSX, para poder probarla.
//
// LA REGLA QUE MANDA: el backend distingue `null` (no se pudo saber) de `0` (se
// supo y es cero). La pantalla que se reemplaza hacía justo lo contrario —
// inventaba 82%, 14 visitas y "31 clientes nuevos" cuando no había dashboard.
// Aquí un dato ausente se dice, no se rellena.

export const PERIODS = Object.freeze([
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
])

const TONE_GOOD = 'good'
const TONE_WATCH = 'watch'
const TONE_BAD = 'bad'
const TONE_UNKNOWN = 'unknown'

export const NO_DATA = 'Sin dato'

function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Porcentaje legible. `null` NO se convierte en "0%". */
export function fmtPct(value) {
  return isNum(value) ? `${Math.round(value * 10) / 10}%` : NO_DATA
}

export const COLLECTION_INLINE_LABEL_MIN_PCT = 18

/** Decide si cada porcentaje de cobranza cabe dentro de su segmento. */
export function collectionPercentageLabels(cashPct) {
  if (!isNum(cashPct) || cashPct < 0 || cashPct > 100) return null

  const creditPct = Math.round((100 - cashPct) * 10) / 10
  const labelFor = (kind, pct) => (pct >= COLLECTION_INLINE_LABEL_MIN_PCT
    ? { inside: `${pct}%`, outside: '' }
    : { inside: '', outside: `${kind} ${pct}%` })

  return {
    cash: labelFor('Contado', cashPct),
    credit: labelFor('Crédito', creditPct),
  }
}

/** Entero legible con separadores. */
export function fmtInt(value) {
  return isNum(value) ? Math.round(value).toLocaleString('es-MX') : NO_DATA
}

/** Dinero. Sin moneda única el backend manda `currency: null` y NO se inventa
 *  un símbolo: sumar monedas distintas es exactamente lo que el contrato evita. */
export function fmtMoney(value, currency) {
  if (!isNum(value)) return NO_DATA
  const n = Math.round(value).toLocaleString('es-MX')
  if (!currency) return n
  return currency === 'MXN' ? `$${n}` : `${n} ${currency}`
}

export function toneForPct(pct, { good = 80, watch = 50 } = {}) {
  if (!isNum(pct)) return TONE_UNKNOWN
  if (pct >= good) return TONE_GOOD
  if (pct >= watch) return TONE_WATCH
  return TONE_BAD
}

export function toneForCount(count, { watchAt = 1, badAt = null } = {}) {
  if (!isNum(count)) return TONE_UNKNOWN
  if (badAt != null && count >= badAt) return TONE_BAD
  if (count >= watchAt) return TONE_WATCH
  return TONE_GOOD
}

/**
 * Traduce el contrato a la lista de tarjetas que pinta el panel.
 *
 * Devuelve SIEMPRE las siete, en orden, aunque falten datos: una tarjeta que
 * desaparece deja al supervisor sin saber si el indicador está bien o si el
 * sistema no pudo leerlo. Lo que cambia es que diga "Sin dato".
 */
/** Etiqueta del período que devolvió el backend (no la que pidió el cliente). */
export function periodLabel(payload) {
  const p = payload?.period || {}
  if (p.label) return p.label
  const found = PERIODS.find((x) => x.key === p.key)
  return found ? found.label : ''
}

/** Rango real del período, para que se vea qué se está sumando. */
export function periodRangeText(payload) {
  const p = payload?.period || {}
  if (!p.date_from || !p.date_to) return ''
  if (p.date_from === p.date_to) return p.date_from
  return `${p.date_from} al ${p.date_to}`
}

// ═════════════════════════════════════════════════════════════════════════════
// v2 — EMBUDO (mockup kpis_final_c_v2.html). El protagonista: tres círculos
// proporcionales Agendados → Visitados → Compraron, con las caídas (cobertura,
// conversión) como pill de semáforo EN PALABRA. Toda la geometría se decide
// aquí (sin JSX) para poder probarla.
// ═════════════════════════════════════════════════════════════════════════════

// Semáforo del embudo, con palabra + ícono (nunca color solo).
export const FUNNEL_TONE_LABEL = Object.freeze({
  good: 'Bien', watch: 'Atención', bad: 'Crítico', unknown: 'Sin dato',
})
export const FUNNEL_TONE_ICON = Object.freeze({
  good: '✓', watch: '!', bad: '✕', unknown: '—',
})

// Diámetro ∝ √(valor/agendados), con mínimo legible. El área (no el diámetro)
// representa la proporción — por eso la raíz. El círculo de agendados es el 100%.
export const FUNNEL_MAX_D = 132
export const FUNNEL_MIN_D = 44

export function funnelDiameter(value, agendados) {
  if (!isNum(value) || !isNum(agendados) || agendados <= 0 || value < 0) return FUNNEL_MIN_D
  const ratio = Math.min(1, value / agendados)
  const d = FUNNEL_MAX_D * Math.sqrt(ratio)
  return Math.max(FUNNEL_MIN_D, Math.round(d))
}

/**
 * Los tres círculos + las dos caídas, listos para pintar. Cada círculo trae su
 * diámetro; cada caída su % , tono, palabra e ícono. `per_100` cierra el embudo.
 * Sin datos ⇒ value null (se pinta "sin dato"), no 0.
 */
export function buildFunnel(payload) {
  const f = payload?.funnel || {}
  const ag = f.agendados
  const circles = [
    { key: 'agendados', label: 'Agendados', value: ag, diameter: funnelDiameter(ag, ag) },
    { key: 'visitados', label: 'Visitados', value: f.visitados, diameter: funnelDiameter(f.visitados, ag) },
    { key: 'compraron', label: 'Compraron', value: f.compraron, diameter: funnelDiameter(f.compraron, ag) },
  ]
  const drops = [
    {
      key: 'coverage', label: 'Cobertura', from: 'agendados', to: 'visitados',
      pct: f.coverage_pct, tone: f.coverage_tone || 'unknown',
      toneWord: FUNNEL_TONE_LABEL[f.coverage_tone] || FUNNEL_TONE_LABEL.unknown,
      toneIcon: FUNNEL_TONE_ICON[f.coverage_tone] || FUNNEL_TONE_ICON.unknown,
    },
    {
      key: 'conversion', label: 'Conversión', from: 'visitados', to: 'compraron',
      pct: f.conversion_pct, tone: f.conversion_tone || 'unknown',
      toneWord: FUNNEL_TONE_LABEL[f.conversion_tone] || FUNNEL_TONE_LABEL.unknown,
      toneIcon: FUNNEL_TONE_ICON[f.conversion_tone] || FUNNEL_TONE_ICON.unknown,
    },
  ]
  const per100 = f.per_100_agendados
  const closing = isNum(per100)
    ? `De cada 100 agendados, ${per100} compraron`
    : 'Sin agendados en el período'
  return { circles, drops, closing, hasData: isNum(ag) }
}

// ── Deltas (flechas ▲/▼ del período anterior) ────────────────────────────────
// En "Hoy" el delta compara un día A LA MITAD contra un día completo: a media
// mañana grita ▼80% sin que pase nada. Para ese período NO se pinta el % como
// alarma: se etiqueta "parcial". Semana/Mes comparan período completo vs completo.
export function deltaView(delta, period) {
  if (period === 'hoy') {
    return { show: true, partial: true, arrow: '', tone: 'unknown', dir: 'none', text: 'parcial · el día va a la mitad' }
  }
  const d = delta || {}
  const dir = d.direction || 'none'
  if (dir === 'none' || !isNum(d.delta_pct)) {
    return { show: false, partial: false, arrow: '', text: 'sin comparativo', tone: 'unknown', dir }
  }
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '='
  const tone = dir === 'up' ? 'good' : dir === 'down' ? 'bad' : 'watch'
  return { show: true, partial: false, arrow, tone, dir, text: `${arrow} ${Math.abs(d.delta_pct)}% vs período anterior` }
}

// ── Gráfica de barras ETIQUETADA (compradores/día, calidad/día) ──────────────
// No sparkline pelón: cada barra con número arriba y etiqueta abajo, hoy
// resaltado. La altura se normaliza contra el máximo de la serie.
export function buildBars(series, { maxHeight = 96 } = {}) {
  const points = Array.isArray(series) ? series : []
  const values = points.map((p) => (isNum(p?.value) ? p.value : 0))
  const max = values.length ? Math.max(...values, 1) : 1
  return points.map((p) => {
    const v = isNum(p?.value) ? p.value : null
    return {
      label: p?.label ?? '',
      value: v,
      valueText: v == null ? NO_DATA : fmtInt(v),
      // Altura mínima 3px para que una barra de valor 0/bajo siga siendo visible.
      height: v == null ? 0 : Math.max(3, Math.round((v / max) * maxHeight)),
      isCurrent: Boolean(p?.is_current),
      missing: v == null,
    }
  })
}

export function hasSeries(series) {
  return Array.isArray(series) && series.some((p) => isNum(p?.value))
}

// ── Calidad de ejecución ─────────────────────────────────────────────────────
export function buildQuality(payload) {
  const q = payload?.quality || {}
  if (q.available === false) {
    return { available: false, aRevisar: NO_DATA, totalVisitas: NO_DATA, routes: [], sellers: [], definition: q.definition || '' }
  }
  const routes = Array.isArray(q.routes) ? q.routes : []
  // Chips de vendedores únicos (accionable: con quién revisar).
  const sellers = [...new Set(routes.map((r) => r.seller).filter(Boolean))]
  return {
    available: true,
    aRevisar: fmtInt(q.a_revisar),
    aRevisarNum: isNum(q.a_revisar) ? q.a_revisar : null,
    totalVisitas: fmtInt(q.total_visitas),
    routesCount: routes.length,
    routes,
    sellers,
    definition: q.definition || '',
  }
}

/** Advertencia del contrato sobre la proporción anómala de "a revisar". */
export function qualityHighRatioNote(payload) {
  return payload?.data_notes?.quality_high_ratio || null
}

export function prospectionComingSoon(payload) {
  const p = payload?.prospection || {}
  return p.status === 'coming_soon' || p.available === false
}
