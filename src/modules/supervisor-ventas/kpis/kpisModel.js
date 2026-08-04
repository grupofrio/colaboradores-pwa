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

// Los KPIs 5/6/7 son saldo actual: no se mueven con el selector. Se etiquetan
// para que nadie los lea como "del mes".
export const TODAY_BADGE = 'al día de hoy'

const TONE_GOOD = 'good'
const TONE_WATCH = 'watch'
const TONE_BAD = 'bad'
const TONE_UNKNOWN = 'unknown'

// Semáforo CON PALABRA, no solo color: se lee bajo el sol y hay quien no
// distingue rojo de verde.
export const TONE_LABELS = Object.freeze({
  [TONE_GOOD]: 'En orden',
  [TONE_WATCH]: 'Atención',
  [TONE_BAD]: 'Crítico',
  [TONE_UNKNOWN]: 'Sin dato',
})

export const NO_DATA = 'Sin dato'

function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Porcentaje legible. `null` NO se convierte en "0%". */
export function fmtPct(value) {
  return isNum(value) ? `${Math.round(value * 10) / 10}%` : NO_DATA
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
export function buildKpiCards(payload) {
  const k = payload?.kpis || {}
  const cov = k.visit_coverage || {}
  const conv = k.conversion || {}
  const sales = k.sales || {}
  const coll = k.collection || {}
  const cash = k.cash_pending || {}
  const inact = k.inactive_customers || {}
  const routes = k.open_routes || {}

  const cur = sales.currency || coll.currency || null

  return [
    {
      key: 'visit_coverage',
      title: 'Cobertura de visitas',
      value: fmtPct(cov.pct),
      tone: toneForPct(cov.pct),
      detail: (isNum(cov.visited) && isNum(cov.scheduled))
        ? `${fmtInt(cov.visited)} de ${fmtInt(cov.scheduled)} agendados`
        : 'Sin rutas agendadas en el período',
      progress: isNum(cov.pct) ? cov.pct : null,
      scope: cov.scope || 'period',
    },
    {
      key: 'conversion',
      title: 'Conversión',
      value: fmtPct(conv.pct),
      tone: toneForPct(conv.pct, { good: 70, watch: 50 }),
      // "Compraron" son PARADAS, no pedidos: un cliente que hizo dos pedidos
      // sigue siendo un cliente que compró.
      detail: (isNum(conv.bought) && isNum(conv.visited))
        ? `${fmtInt(conv.bought)} compraron de ${fmtInt(conv.visited)} visitados`
        : 'Sin visitas registradas en el período',
      progress: isNum(conv.pct) ? conv.pct : null,
      scope: conv.scope || 'period',
    },
    {
      key: 'sales',
      title: 'Venta del período',
      value: fmtMoney(sales.total, cur),
      tone: TONE_UNKNOWN,
      detail: isNum(sales.orders)
        ? `${fmtInt(sales.orders)} pedidos · ticket ${fmtMoney(sales.avg_ticket, cur)}`
        : 'Sin pedidos en el período',
      scope: sales.scope || 'period',
      neutral: true,
    },
    {
      key: 'collection',
      title: 'Contado vs crédito',
      value: fmtMoney(coll.cash, cur),
      tone: toneForPct(coll.cash_pct, { good: 80, watch: 60 }),
      // NO se le llama "cobranza" a secas: `cash` es efectivo cobrado EN LA
      // RUTA y `credit` es crédito OTORGADO. No es recuperación de cartera.
      detail: isNum(coll.credit)
        ? `cobrado en ruta · ${fmtMoney(coll.credit, cur)} de crédito otorgado`
        : 'Sin venta registrada en el período',
      progress: isNum(coll.cash_pct) ? coll.cash_pct : null,
      scope: coll.scope || 'period',
    },
    {
      key: 'cash_pending',
      title: 'Caja pendiente',
      value: fmtMoney(cash.amount, cash.currency || cur),
      tone: toneForCount(cash.amount, { watchAt: 1 }),
      detail: cash.available === false
        ? 'La fuente de caja no está disponible'
        : 'Saldo de rutas abiertas',
      scope: cash.scope || 'today',
    },
    {
      key: 'inactive_customers',
      title: 'Dejaron de comprar',
      value: fmtInt(inact.count),
      tone: toneForCount(inact.count, { watchAt: 1, badAt: 50 }),
      detail: inact.available === false
        ? 'La fuente de clientes no está disponible'
        : 'Clientes sin comprar, sin cadena',
      scope: inact.scope || 'today',
    },
    {
      key: 'open_routes',
      title: 'Rutas abiertas +7 días',
      value: fmtInt(routes.over_7d),
      tone: toneForCount(routes.over_7d, { watchAt: 1, badAt: 5 }),
      detail: isNum(routes.no_visits_today)
        ? `${fmtInt(routes.no_visits_today)} ruta(s) de hoy sin visita registrada`
        : 'Sin dato de rutas de hoy',
      scope: routes.scope || 'today',
    },
  ]
}

/** ¿Esta tarjeta lleva la etiqueta "al día de hoy"? */
export function isSnapshot(card) {
  return card?.scope === 'today'
}

/**
 * ¿El panel tiene ALGO que mostrar?
 *
 * "Vacío" no es "el backend falló": es que respondió y no hay operación. Se
 * distinguen porque la pantalla de error invita a reintentar y la de vacío no.
 */
export function isEmptyPanel(payload) {
  const cards = buildKpiCards(payload)
  return cards.every((c) => c.value === NO_DATA)
}

/** Advertencias del contrato que el panel debe mostrar, no esconder. */
export function panelNotices(payload) {
  const notes = payload?.data_notes || {}
  const caps = payload?.capabilities || {}
  const out = []
  if (notes.inactive_accuracy) {
    out.push({
      key: 'inactive_accuracy',
      // El backend ya lo declara; el panel lo repite en corto para que no haya
      // que abrir el contrato para enterarse.
      text: 'El conteo de clientes que dejaron de comprar puede venir alto: depende de un ajuste de KoldScore que todavía no termina de propagar.',
    })
  }
  if (caps.routes_available === false) {
    out.push({ key: 'routes', text: 'No se pudieron leer las rutas de la sucursal.' })
  }
  return out
}

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
