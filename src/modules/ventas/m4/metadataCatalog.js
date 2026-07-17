// Metadata cerrada de M4 v1. Es un espejo literal de
// gf_kold_os_m4.lib.kold_os_m4_core (PR backend #205): capabilities(),
// REQUIRED_QUERY_IDS y commercial_kpis(). Los valores medidos siguen viniendo
// del backend; las etiquetas/fuentes que llegan a UI/export se reconstruyen
// desde este catálogo para que texto arbitrario nunca se vuelva evidencia.

export const M4_RUN_ENVIRONMENTS = Object.freeze(['dev', 'staging', 'production'])

export const M4_REQUIRED_QUERY_IDS = Object.freeze([
  'module_status',
  'schema_catalog',
  'scope_validation',
  'customer_master_metrics',
  'customer_dup_metrics',
  'order_metrics',
  'order_state_metrics',
  'order_line_metrics',
  'crm_metrics',
  'recurrence_metrics',
])

export const M4_OPTIONAL_QUERY_IDS = Object.freeze([])

export const M4_CAPABILITY_FEATURES = Object.freeze({
  history: true,
  findings_pagination: true,
  aggregate: true,
  company_dimension: false,
  branch_dimension: false,
  channel_dimension: false,
  customer_dimension: false,
  order_dimension: false,
  product_dimension: false,
  entity_detail: false,
  confirmed_orders: true,
  delivered_orders: false,
  invoiced_orders: false,
  paid_orders: false,
  pos_sales: false,
  returns: false,
  margin: false,
  historical_order_channel: false,
  pricelist_evaluation: false,
  campaign_execution: false,
})

export const M4_CANONICAL_CAPABILITIES = Object.freeze({
  required_query_ids: M4_REQUIRED_QUERY_IDS,
  optional_query_ids: M4_OPTIONAL_QUERY_IDS,
  granularities: Object.freeze(['aggregate']),
  features: M4_CAPABILITY_FEATURES,
  stale_days: 7,
  findings_max_page_size: 100,
  classifications: Object.freeze([
    'definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid',
  ]),
  verdicts: Object.freeze([
    'incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable',
  ]),
})

export const M4_MODULE_NAMES = Object.freeze([
  'gf_kold_os_m4', 'sale', 'crm', 'gf_logistics_ops', 'os_customer_zones',
])
export const M4_MODULE_STATES = Object.freeze([
  'installed', 'uninstalled', 'to install', 'to upgrade', 'to remove',
])
export const M4_ORDER_STATES = Object.freeze(['draft', 'sent', 'sale', 'cancel'])

export const M4_SCHEMA_CATALOG = Object.freeze({
  res_partner: Object.freeze([
    'id', 'company_id', 'customer_rank', 'active', 'channel_id', 'partner_latitude',
    'country_id', 'vat', 'phone', 'create_date', 'commercial_partner_id',
  ]),
  sale_order: Object.freeze([
    'id', 'company_id', 'state', 'date_order', 'user_id', 'partner_id',
    'x_analytic_account_id',
  ]),
  sale_order_line: Object.freeze([
    'order_id', 'product_id', 'product_uom_qty', 'price_unit', 'discount', 'display_type',
  ]),
  crm_lead: Object.freeze(['id', 'company_id', 'user_id', 'stage_id', 'team_id']),
})

const CUSTOMER_UNIVERSE = (
  'Raices comerciales (commercial_partner_id = id) con al menos un pedido '
  + 'confirmado historico en las companias del scope. El maestro NO es scopeable '
  + 'por compania porque los partners con company_id vacio son compartidos entre '
  + 'companias; el universo se DERIVA de los pedidos del scope.'
)

// Compatibilidad de lectura con el backend v1 publicado: acepta su explicación
// histórica solo con una cifra decimal en la posición medida. Esa cifra jamás
// se conserva; getM4KpiMetadata() devuelve siempre la plantilla estructural.
const LEGACY_CUSTOMER_UNIVERSE_RE = (
  /^Raices comerciales \(commercial_partner_id = id\) con al menos un pedido confirmado historico en las companias del scope\. El maestro NO es scopeable por compania \(\d+ partners con company_id vacio son compartidos entre companias\), por eso el universo se DERIVA de los pedidos del scope\.$/
)

const WINDOW = Symbol('window')
const KPI_METADATA = {
  commercial_customers_in_scope: {
    universe: CUSTOMER_UNIVERSE,
    source_model: 'res.partner', source_fields: ['commercial_partner_id', 'customer_rank'],
    caveat: 'Universo derivado de pedidos: NO incluye clientes sin historial de compra.',
  },
  customers_currently_without_channel: {
    universe: CUSTOMER_UNIVERSE,
    source_model: 'res.partner', source_fields: ['channel_id'],
    caveat: 'Canal ACTUAL del cliente (A4), NO el canal historico del pedido.',
  },
  customers_without_geolocation: {
    universe: CUSTOMER_UNIVERSE,
    source_model: 'res.partner', source_fields: ['partner_latitude'],
    caveat: 'Mide geocodificacion del maestro, no conducta comercial.',
  },
  archived_customers_with_order_history: {
    universe: CUSTOMER_UNIVERSE,
    source_model: 'res.partner', source_fields: ['active', 'customer_rank'],
    caveat: 'Archivar puede ser depuracion legitima; no hay motivo estructurado.',
  },
  customer_vat_duplicate_groups: {
    universe: CUSTOMER_UNIVERSE,
    source_model: 'res.partner', source_fields: ['vat'],
    caveat: 'Conteo sanitizado de grupos con VAT repetido; el valor jamas se expone.',
  },
  confirmed_orders: {
    universe: ['sale.order state=\'sale\', company_id en scope, date_order en ', WINDOW],
    source_model: 'sale.order', source_fields: ['state', 'date_order', 'company_id'],
    caveat: 'Pedido CONFIRMADO. NO implica entregado/facturado/cobrado/pagado (M5/M6).',
  },
  cancelled_orders: {
    universe: ['sale.order state=\'cancel\', date_order en ', WINDOW],
    source_model: 'sale.order', source_fields: ['state', 'date_order'],
    caveat: 'Observacion cruda: sin politica de cancelacion aprobada.',
  },
  confirmed_orders_without_sale_order_user_id: {
    universe: ['Pedidos confirmados del scope en ', WINDOW],
    source_model: 'sale.order', source_fields: ['user_id'],
    caveat: 'Mide SOLO sale.order.user_id (A3). NO evalua res.partner.user_id, crm.team, vendedor de ruta, POS ni integraciones: NO es ownership comercial total.',
  },
  confirmed_orders_whose_customer_currently_has_no_channel: {
    universe: ['Pedidos confirmados del scope en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['partner_id.channel_id'],
    caveat: 'Canal ACTUAL del cliente al momento de la auditoria (A4), NO snapshot del pedido.',
  },
  confirmed_orders_to_non_commercial_partner: {
    universe: ['Pedidos confirmados del scope en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['partner_id.customer_rank'],
    caveat: 'El modelo permite vender a un partner con customer_rank<=0.',
  },
  confirmed_orders_without_analytic_account: {
    universe: ['Pedidos confirmados del scope en ', WINDOW],
    source_model: 'sale.order', source_fields: ['x_analytic_account_id'], caveat: null,
  },
  confirmed_order_lines: {
    universe: ['Lineas de PRODUCTO (display_type vacio) de pedidos confirmados en ', WINDOW],
    source_model: 'sale.order.line', source_fields: ['display_type'],
    caveat: 'Excluye secciones y notas (display_type no vacio).',
  },
  confirmed_order_lines_with_nonpositive_qty: {
    universe: ['Lineas de PRODUCTO de pedidos confirmados en ', WINDOW],
    source_model: 'sale.order.line', source_fields: ['product_uom_qty'],
    caveat: 'Inspeccion A6: qty=0 exacta, sin entregar ni facturar; Odoo no lo prohibe => residuo de captura (RIESGO), NO incumplimiento.',
  },
  confirmed_order_lines_with_discount: {
    universe: ['Lineas de PRODUCTO de pedidos confirmados en ', WINDOW],
    source_model: 'sale.order.line', source_fields: ['discount'],
    caveat: 'Sin politica de descuento aprobada: observacion, no incumplimiento.',
  },
  active_leads_in_scope: {
    universe: 'crm.lead de las companias del scope',
    source_model: 'crm.lead', source_fields: ['company_id'],
    caveat: 'Sin ventana temporal: es el pipeline vigente, no un flujo del periodo.',
  },
  customers_with_confirmed_orders: {
    universe: ['Raices del universo con >=1 pedido confirmado en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['commercial_partner_id', 'date_order'],
    caveat: null,
  },
  recurrent_customers: {
    universe: ['Raices con >=2 pedidos confirmados en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['commercial_partner_id'],
    caveat: 'Umbral >=2 para \'recurrente\' NO ratificado por direccion comercial.',
  },
  customers_without_orders_in_window: {
    universe: ['Universo (raices con historial) sin pedido confirmado en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['commercial_partner_id', 'date_order'],
    caveat: '\'Dormido\' NO tiene definicion de ventana aprobada (exploratorio).',
  },
  customers_lost_prior_window: {
    universe: ['Raices con pedido en la ventana previa de igual longitud pero no en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['commercial_partner_id', 'date_order'],
    caveat: '\'Perdido\' NO tiene definicion aprobada (exploratorio).',
  },
  new_customers_first_order_in_window: {
    universe: ['Raices cuyo primer pedido del historial cae en ', WINDOW],
    source_model: 'sale.order -> res.partner', source_fields: ['commercial_partner_id', 'date_order'],
    caveat: null,
  },
  new_customers_without_second_order: {
    universe: ['Raices con primer pedido en ', WINDOW, ' y exactamente 1 pedido'],
    source_model: 'sale.order -> res.partner', source_fields: ['commercial_partner_id'],
    caveat: 'Objetivo de 2a compra NO aprobado (exploratorio).',
  },
}

const SUMMARY_KPI_METADATA = Object.freeze({
  universe: 'Catalogo de reglas M4 evaluadas en esta corrida',
  source_model: 'gf.kold.os.m4.finding (derivado del catalogo)',
  source_fields: Object.freeze(['verdict', 'classification']),
  caveat: null,
})

for (const key of [
  'definitive_incident_count', 'warning_count', 'exploratory_signal_count',
  'compliant_rule_count', 'not_evaluable_rule_count',
]) KPI_METADATA[key] = SUMMARY_KPI_METADATA
Object.freeze(KPI_METADATA)

const renderUniverse = (template, scope) => {
  if (typeof template === 'string') return template
  const window = `[${scope.window_start}, ${scope.window_end_exclusive})`
  return template.map((part) => (part === WINDOW ? window : part)).join('')
}

export const M4_KPI_NAMES = Object.freeze(Object.keys(KPI_METADATA))

export function getM4KpiMetadata(name, scope) {
  const metadata = KPI_METADATA[name]
  if (!metadata || !scope) return null
  return {
    universe: renderUniverse(metadata.universe, scope),
    source_model: metadata.source_model,
    source_fields: [...metadata.source_fields],
    caveat: metadata.caveat,
  }
}

export function matchesM4KpiMetadata(name, field, value, scope) {
  const metadata = getM4KpiMetadata(name, scope)
  if (!metadata || !Object.hasOwn(metadata, field)) return false
  if (field === 'universe' && metadata.universe === CUSTOMER_UNIVERSE) {
    return value === metadata.universe
      || (typeof value === 'string' && LEGACY_CUSTOMER_UNIVERSE_RE.test(value))
  }
  if (field === 'source_fields') {
    return Array.isArray(value) && value.length === metadata.source_fields.length
      && value.every((item, index) => item === metadata.source_fields[index])
  }
  return value === metadata[field]
}
