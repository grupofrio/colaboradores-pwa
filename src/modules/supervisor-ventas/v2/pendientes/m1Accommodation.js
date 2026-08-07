// ─── Acomodo del backlog M1 para la superficie "Pendientes" ──────────────────
// PURO: sin React, sin fetch. Recibe lo que YA normalizó
// `src/modules/torre/m1/m1BacklogModel.js` (normalizePayload) y lo ordena de lo
// accionable a lo informativo. No re-clasifica buckets ni recalcula nada que el
// backend ya emitió: `close_candidate_flag`, `recommended_action`, `risk_level`
// y `age_days` vienen del servidor y aquí solo se agrupan y cuentan.
//
// DE DÓNDE SALE CADA NÚMERO (importa para no mentir en la UI):
//   · Los CONTEOS de las tarjetas de arriba salen de `kpis`, que el backend
//     calcula con search_count sobre TODO el scope.
//   · La DISTRIBUCIÓN DE RIESGO se cuenta sobre las filas realmente cargadas:
//     el contrato no expone conteos de riesgo y el endpoint topa en 200 filas
//     (MAX_LIMIT). Por eso el acomodo devuelve `rowsCounted` y `total`, y la
//     vista está obligada a decir sobre cuántas está hablando.

// Antigüedad para el rezago: cortes declarados, no inventados por la UI.
export const REZAGO_MIN_DAYS = 30

const AGE_BANDS = [
  { key: '30_60', label: '30–60 días', min: 30, max: 60 },
  { key: '61_90', label: '61–90 días', min: 61, max: 90 },
  { key: '90_mas', label: 'más de 90 días', min: 91, max: Infinity },
]

function num(value) {
  return Number.isFinite(value) ? value : 0
}

/** Suma de caja pendiente de un conjunto de filas. */
export function sumCash(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, r) => acc + num(r?.cash_pending_amount), 0)
}

/**
 * Agrupa por la acción que YA recomendó el backend. No se traduce ni se
 * reinterpreta: si mañana el backend cambia el texto, aquí aparece tal cual.
 * Orden: por conteo desc y, a igualdad, alfabético (determinista).
 */
export function groupByRecommendedAction(rows) {
  const map = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const action = (row?.recommended_action || '').trim()
    if (!action) continue
    const prev = map.get(action) || { action, count: 0, cash: 0, planIds: [] }
    prev.count += 1
    prev.cash += num(row?.cash_pending_amount)
    if (prev.planIds.length < 50) prev.planIds.push(row?.plan_id ?? null)
    map.set(action, prev)
  }
  return [...map.values()].sort((a, b) => (b.count - a.count) || a.action.localeCompare(b.action))
}

/** Conteo por nivel de riesgo SOBRE LAS FILAS DADAS (ver nota de arriba). */
export function countByRisk(rows) {
  const out = { high: 0, medium: 0, low: 0 }
  for (const row of Array.isArray(rows) ? rows : []) {
    const level = row?.risk_level
    if (level === 'high' || level === 'medium' || level === 'low') out[level] += 1
  }
  return out
}

/** Distribución del rezago por bandas de antigüedad. */
export function distributeByAge(rows) {
  return AGE_BANDS.map((band) => {
    const inBand = (Array.isArray(rows) ? rows : []).filter(
      (r) => num(r?.age_days) >= band.min && num(r?.age_days) <= band.max,
    )
    return { key: band.key, label: band.label, count: inBand.length, cash: sumCash(inBand) }
  })
}

/**
 * Acomodo completo.
 * @param {object} main       payload normalizado (state_bucket=open)
 * @param {Array}  candidates filas normalizadas de close_candidate=1
 * @returns objeto listo para pintar; la vista NO calcula nada más.
 */
export function buildM1Accommodation(main, candidates) {
  const rows = Array.isArray(main?.rows) ? main.rows : []
  const kpiByKey = new Map((main?.kpis || []).map((c) => [c.key, c.value]))
  const kpi = (key) => (kpiByKey.has(key) ? kpiByKey.get(key) : null)

  const candidateRows = Array.isArray(candidates) ? candidates : []
  const rezagoRows = rows.filter((r) => num(r?.age_days) >= REZAGO_MIN_DAYS)

  return {
    // 1 · veredicto — conteos autoritativos del backend (search_count)
    verdict: {
      closeCandidates: kpi('close_candidates'),
      openRoutes: kpi('open_routes'),
      cashPending: kpi('cash_pending_amount'),
      cashClosedPending: kpi('cash_closed_pending_amount'),
      draftRoutes: kpi('draft_routes'),
      dataAsOf: main?.dataAsOf || '',
    },
    // 2 · listas para cerrar — filas exactas de una consulta propia
    candidates: candidateRows,
    // 3 · requieren gestión — agrupado por la acción del backend
    actionGroups: groupByRecommendedAction(rows),
    // 4 · riesgo — sobre las filas cargadas, y la vista debe decirlo
    risk: {
      counts: countByRisk(rows),
      rowsCounted: rows.length,
      total: num(main?.total),
      partial: rows.length < num(main?.total),
    },
    // 5 · rezago histórico — separado, plegado, "no es de hoy"
    rezago: {
      count: rezagoRows.length,
      cash: sumCash(rezagoRows),
      bands: distributeByAge(rezagoRows),
      minDays: REZAGO_MIN_DAYS,
    },
  }
}
