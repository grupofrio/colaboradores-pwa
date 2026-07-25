// ─── KOLD OS · M7 — Etiquetas, colores y escaleras (presentación honesta) ────
// Espeja los vocabularios del backend; ninguna etiqueta afirma utilidad, margen
// real ni rentabilidad completa.

export const M7_VERDICT_ORDER = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M7_VERDICT_LABELS = Object.freeze({
  incumplimiento: 'Incumplimiento', riesgo: 'Riesgo', anomalia: 'Anomalía',
  cumple: 'Cumple', no_evaluable: 'No evaluable',
})
export const M7_VERDICT_COLORS = Object.freeze({
  incumplimiento: '#ef4444', riesgo: '#f59e0b', anomalia: '#a78bfa',
  cumple: '#10b981', no_evaluable: 'rgba(255,255,255,0.45)',
})
export const M7_VERDICT_HELP = Object.freeze({
  incumplimiento: 'Regla con umbral aprobado por dirección que NO se cumple. En v1 no existe ninguno.',
  riesgo: 'Señal que exige atención; sin umbral aprobado no es incumplimiento.',
  anomalia: 'Patrón atípico observado en la medición.',
  cumple: 'La condición medida no ocurre.',
  no_evaluable: 'No hay evidencia suficiente para concluir; se declara con su razón.',
})

export const M7_CLASSIFICATION_LABELS = Object.freeze({
  definitive: 'Definitivo', caveated: 'Con salvedad', exploratory: 'Exploratorio',
  not_evaluable: 'No evaluable', invalid: 'Inválido',
})
export const M7_SEVERITY_LABELS = Object.freeze({
  critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
  informational: 'Informativa',
})
export const M7_LIFECYCLE_LABELS = Object.freeze({
  new: 'Nuevo', persistent: 'Persistente', recurrent: 'Reincidente',
})

// La escalera económica: SÓLO L1 activo con el fixture actual. Sin barra de
// progreso porcentual (sugeriría "% de rentabilidad", que sería falso).
export const M7_LEVEL_LADDER = Object.freeze([
  { id: 'L0_not_evaluable', label: 'L0 · No evaluable',
    desc: 'No existe fuente suficiente ni para ingreso.' },
  { id: 'L1_observable_revenue', label: 'L1 · Ingreso observable',
    desc: 'Ingreso o venta neta verificable POR MONEDA. Nivel actual.' },
  { id: 'L2_observable_gross_margin', label: 'L2 · Margen bruto observable',
    desc: 'Exige COGS histórico comparable. standard_price actual NO lo habilita.' },
  { id: 'L3_observable_contribution', label: 'L3 · Contribución observable',
    desc: 'Margen bruto − costos variables asignables.' },
  { id: 'L4_partial_operating', label: 'L4 · Resultado operativo parcial',
    desc: 'Con costos directos adicionales observables.' },
  { id: 'L5_operating_profit', label: 'L5 · Utilidad operativa',
    desc: 'Sólo con todos los gastos operativos cubiertos.' },
  { id: 'L6_net_profit', label: 'L6 · Utilidad neta',
    desc: 'Sólo con gastos financieros, impuestos y demás partidas.' },
])

// Etiquetas legibles de compatibilidades del DAG (Codex §8).
export const M7_COMPATIBILITY_LABELS = Object.freeze({
  historical_cost_currency_compatible: 'Moneda del costo compatible con la venta',
  historical_cost_uom_compatible: 'UOM del costo comparable a la venta',
  historical_cost_date_basis_compatible: 'Fecha de costo compatible con la venta',
  cost_revenue_granularity_compatible: 'Misma granularidad de costo y venta',
  historical_cost_same_company: 'Costo y venta de la misma compañía',
  currency_normalization_full_coverage: 'Cobertura FX completa (todas las monedas)',
})

export const M7_CAPABILITY_LABELS = Object.freeze({
  gross_margin_observable: 'Margen bruto observable',
  contribution_margin_observable: 'Margen de contribución observable',
  operating_profit_observable: 'Utilidad operativa observable',
  net_profit_observable: 'Utilidad neta observable',
  currency_normalization_supported: 'Normalización de moneda',
  consolidated_profitability_supported: 'Rentabilidad consolidada',
  revenue_observable: 'Ingreso observable',
  historical_cogs_observable: 'COGS histórico observable',
  historical_sales_cost_match_supported: 'Match de costo histórico',
  variable_costs_observable: 'Costos variables observables',
  comprehensive_operating_expenses_observable: 'Gastos operativos integrales',
  historical_fx_available: 'Tasas FX históricas aplicables',
  current_standard_cost_presence: 'Presencia de costo estándar actual',
})

export const M7_INCIDENCES_NOTE = 'Sumatoria de incidencias por regla; una misma '
  + 'entidad puede aparecer en varias reglas. No representa registros únicos, '
  + 'pesos ni pérdida económica.'

export const M7_EVIDENCE_SOURCE_LABELS = Object.freeze({
  xml_rpc_read_only: 'Medición read-only (XML-RPC) — evidencia NO formal',
  odoo_shell_read_only: 'Corrida odoo-shell read-only (formal)',
})

export function categoryLabel(cat) {
  const map = {
    revenue: 'Ingresos', discounts: 'Descuentos', cost: 'Costo',
    margin: 'Margen y resultado', logistics: 'Logística',
    customer_channel: 'Cliente y canal', branch: 'Sucursal',
    financial: 'Cartera / financiero', handoff: 'Handoffs', system: 'Sistema',
  }
  return map[cat] || cat
}
