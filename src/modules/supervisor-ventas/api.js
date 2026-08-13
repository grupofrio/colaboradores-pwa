// ─── API Supervisor de Ventas ────────────────────────────────────────────────
// Capa de endpoints para el módulo Supervisor de Ventas V2.
//
// ESTADO ACTUAL (2026-04-09):
// Todos los endpoints se resuelven via directSupervisorVentas() en lib/api.js
// como queries JSON-RPC directas a Odoo (readModelSorted / createUpdate).
//
// CUANDO SEBASTIÁN SUBA gf_saleops/controllers/supervisor.py:
// Estas funciones NO necesitan cambiar — api() rutea automáticamente.
// Los controllers deben exponer las mismas rutas /pwa-supv/*.
//
// SCOPE:
// - company_id se extrae de la sesión automáticamente en lib/api.js
// - employee_id se pasa explícitamente donde aplica (forecast, kpi)
// ─────────────────────────────────────────────────────────────────────────────

import { api, todayLocal } from '../../lib/api.js'

// ── Dashboard / Equipo ───────────────────────────────────────────────────────

/** Lista de vendedores del equipo (filtra por company_id de sesión) */
export function getTeam() {
  return api('GET', '/pwa-supv/team')
}

/** Rutas del equipo para una fecha (default: hoy) */
export function getTeamRoutes(date) {
  const qs = date ? `?date=${date}` : ''
  return api('GET', `/pwa-supv/team-routes${qs}`)
}

// ── Día operativo · Day Control / Radar (backend #220) ───────────────────────
// La fecha operativa la resuelve el backend con la timezone de la sucursal; el
// argumento `date` es un override opcional. Retornan el payload del contrato
// (day_control/1 · radar/1) sin transformar. NO existe fallback local: si el
// endpoint no está desplegado, api() rechaza y la capa superior decide.

/** Control del día operativo (venta, salida, cierre, prioridades). */
export function getDayControl(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  return api('GET', `/pwa-supv/day-control${qs}`)
}

/** KPIs de la sucursal para un periodo (hoy|semana|mes).
 *  El backend resuelve el rango server-side; aqui solo viaja el NOMBRE del
 *  periodo. Devuelve el contrato tal cual, sin transformar. */
export function getSupervisorKpis(period) {
  return api('GET', `/pwa-supv/kpis?period=${encodeURIComponent(period || 'hoy')}`)
}

/** Integridad de ejecucion por vendedor (hoy|semana|mes): cuánto del trabajo
 *  terminado se puede VERIFICAR. Devuelve DOS porcentajes que se leen juntos
 *  (calidad de lo evaluable y cobertura de la evidencia) — ver el modelo puro.
 *  Read-only, escopado server-side a la sucursal del token; no expone identidad
 *  de cliente ni de prospecto, solo si la visita tenía una. */
export function getExecutionIntegrity(period) {
  return api('GET', `/pwa-supv/execution-integrity?period=${encodeURIComponent(period || 'semana')}`)
}

/** Productos vendidos del período (SKU/cantidad/importe + delta + cobertura de
 *  portafolio), read-only, escopado server-side a la sucursal. */
export function getProductsSold(period) {
  return api('GET', `/pwa-supv/products-sold?period=${encodeURIComponent(period || 'hoy')}`)
}

/** Matriz semanal de cumplimiento por subpolígono (portada de Mis rutas de
 *  mañana). Read-only, escopado server-side. `week` = 'YYYY-Www' opcional. */
export function getRoutesWeek(week) {
  const qs = week ? `?week=${encodeURIComponent(week)}` : ''
  return api('GET', `/pwa-supv/routes-week${qs}`)
}

/** Radar de posiciones read-only (no tiempo real; ver captured_at). */
export function getRadar(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  return api('GET', `/pwa-supv/radar${qs}`)
}

/** Recursos disponibles para "Planear mañana" (read-only): unidades y personas
 *  con las que armar las rutas del día, marcando lo ya asignado en esa fecha.
 *  Escopado server-side a sucursal/compañía; el cliente NO decide el alcance. */
export function getAvailableResources(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  return api('GET', `/pwa-supv/available-resources${qs}`)
}

/** Asignar/reasignar recursos de un plan del día (Planear mañana). WRITE seguro:
 *  fija/override chofer, vendedor y/o unidad. Solo se envían los campos presentes
 *  (ausente = no se toca). Devuelve el plan con la readiness recomputada. */
export function assignRoutePlanResources(planId, resources = {}) {
  const payload = { plan_id: Number(planId || 0) }
  if (resources.vehicle_id != null) payload.vehicle_id = Number(resources.vehicle_id)
  if (resources.driver_employee_id != null) payload.driver_employee_id = Number(resources.driver_employee_id)
  if (resources.salesperson_employee_id != null) payload.salesperson_employee_id = Number(resources.salesperson_employee_id)
  return api('POST', '/pwa-supv/route-plan-assign-resources', payload)
}

/** Supervisor V2: paradas de una ruta vía DTO read-only guardado (#223), sin
 *  ORM/sudo en el cliente. Devuelve el envelope {status,data:{stops,...}}. */
export function getRouteStopsV2(planId) {
  return api('GET', `/pwa-supv/route-stops-v2?plan_id=${Number(planId || 0)}`)
}

/** Readiness AUTORITATIVA de un plan (recursos + cobertura + estado), LECTURA PURA
 *  (B1). Devuelve el envelope {status,data:{readiness,...}}. Reemplaza el uso del
 *  write assign-resources como lectura; conoce señales que sólo el servidor tiene
 *  (p.ej. sobrecapacidad). */
export function getRoutePlanReadiness(planId) {
  return api('GET', `/pwa-supv/route-plan-readiness?route_plan_id=${Number(planId || 0)}`)
}

// ── Pronóstico ───────────────────────────────────────────────────────────────

/** Productos disponibles para forecast */
export function getForecastProducts() {
  return api('GET', '/pwa-supv/forecast-products')
}

/**
 * Crear forecast.
 * @param {Object} data
 * @param {string} data.date_target - YYYY-MM-DD
 * @param {Array} data.lines - [{product_id, channel, qty}]
 * @param {number} [data.sucursal] - analytic_account_id (sucursal)
 * @param {number} [data.route_id] - Ruta maestra gf.route para forecast por ruta.
 * @param {number} [data.route_plan_id] - Plan diario gf.route.plan asociado.
 * @param {number} [data.employee_id] - Si se especifica, forecast es per-vendor.
 *   Si se omite, es forecast global de sucursal.
 *   NOTA: Requiere que gf.saleops.forecast tenga campo employee_id
 *   (propuesto en spec § 3.1, pendiente de confirmación con Sebastián)
 */
export function createForecast(data) {
  return api('POST', '/pwa-supv/forecast-create', data)
}

/** Rutas maestras asignadas al CEDIS de la sesión para planeación diaria */
export function getRouteTemplatesForPlanning(dateTarget) {
  const qs = dateTarget ? `?date_target=${encodeURIComponent(dateTarget)}` : ''
  return api('GET', `/pwa-supv/route-templates${qs}`)
}

/** Crear o reutilizar el plan diario de una ruta para la fecha objetivo */
export function ensureDailyRoutePlan(routeId, dateTarget, criteria = {}) {
  return api('POST', '/pwa-supv/route-plan-ensure', {
    route_id: Number(routeId || 0),
    date_target: dateTarget,
    ...criteria,
  })
}

/** Poligonos disponibles para planeacion diaria */
export function getPlanningPolygons() {
  return api('GET', '/pwa-supv/polygons')
}

/** Subpoligonos de un poligono padre */
export function getPlanningSubpolygons(polygonId) {
  const qs = polygonId ? `?polygon_id=${encodeURIComponent(polygonId)}` : ''
  return api('GET', `/pwa-supv/subpolygons${qs}`)
}

/** Segmentos operativos de la sucursal (read-only, escopado server-side por el
 *  token). Filtro opcional por poligono/subpoligono (referencia del segmento). */
export function getPlanningSegments(polygonId, subpolygonId) {
  const parts = []
  if (polygonId) parts.push(`polygon_id=${encodeURIComponent(polygonId)}`)
  if (subpolygonId) parts.push(`subpolygon_id=${encodeURIComponent(subpolygonId)}`)
  return api('GET', `/pwa-supv/segments${parts.length ? `?${parts.join('&')}` : ''}`)
}

/** Canales comerciales disponibles para filtrar clientes */
export function getPlanningChannels() {
  return api('GET', '/pwa-supv/customer-channels')
}

/** Ventanas horarias disponibles para filtrar clientes */
export function getPlanningTimeWindows() {
  return api('GET', '/pwa-supv/time-windows')
}

/** Planes diarios activos/editables para agregar clientes manualmente */
export function getActiveRoutePlans(dateTarget) {
  const qs = dateTarget ? `?date_target=${encodeURIComponent(dateTarget)}` : ''
  return api('GET', `/pwa-supv/active-route-plans${qs}`)
}

/** Buscar clientes para agregarlos manualmente a un plan */
export function searchPlanningCustomers(query) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  return api('GET', `/pwa-supv/customers/search${qs}`)
}

/** Clientes del CEDIS del supervisor para consulta/edicion */
export function getSupervisorCustomers(query) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  return api('GET', `/pwa-supv/customers${qs}`)
}

/** Actualizar datos editables de un cliente del scope del supervisor */
export function updateSupervisorCustomer(customerId, values) {
  return api('POST', '/pwa-supv/customers/update', {
    customer_id: Number(customerId || 0),
    values: values && typeof values === 'object' ? values : {},
  })
}

/** Agregar un cliente como parada manual a un plan activo */
export function addCustomerToRoutePlan(routePlanId, customerId, notes = '') {
  return api('POST', '/pwa-supv/route-plan-add-customer', {
    route_plan_id: Number(routePlanId || 0),
    customer_id: Number(customerId || 0),
    notes: String(notes || '').trim(),
  })
}

/** Previsualizar clientes candidatos para un plan de ruta */
export function previewRoutePlanCustomers(criteria = {}) {
  return api('POST', '/pwa-supv/route-plan-preview-customers', criteria)
}

/** Clientes por recuperar / inactivos de la sucursal del token (V2, read-only,
 *  escopado server-side). Reemplaza al listado viejo que era de COMPAÑÍA. El
 *  cliente NO manda company_id: el alcance sale del token. */
export function getBranchRecovery({ kind = 'recovery', limit, offset } = {}) {
  const p = new URLSearchParams()
  p.set('kind', kind === 'inactive' ? 'inactive' : 'recovery')
  if (limit) p.set('limit', String(limit))
  if (offset) p.set('offset', String(offset))
  return api('GET', `/pwa-supv/customers-recovery?${p.toString()}`)
}

/** Guardar borrador de plan de ruta */
export function saveRoutePlanDraft(payload = {}) {
  return api('POST', '/pwa-supv/route-plan-save-draft', payload)
}

/** Remover cliente o parada de un plan de ruta */
export function removeCustomerFromRoutePlan(routePlanId, customerOrStopId) {
  const target = customerOrStopId && typeof customerOrStopId === 'object'
    ? customerOrStopId
    : { customer_id: customerOrStopId }
  return api('POST', '/pwa-supv/route-plan-remove-customer', {
    route_plan_id: Number(routePlanId || 0),
    customer_id: Number(target.customer_id || target.id || 0),
    stop_id: Number(target.stop_id || 0),
  })
}

/** Optimizar el plan (secuencia) antes de publicar — B5. Devuelve plan_revision +
 *  métricas (distance_km/duration_min/stops_count) + optimizer_run_id. */
export function optimizeRoutePlan(routePlanId) {
  return api('POST', '/pwa-supv/route-plan-optimize', {
    route_plan_id: Number(routePlanId || 0),
  })
}

/** Revisar el plan antes de publicar (B5+). Corre la revisión server-side
 *  (action_review_optimized_route) y devuelve el veredicto: readiness_state
 *  (ready/warning/blocked) + blockers[]/warnings[]/missing_geo_count/overcapacity
 *  + plan_revision (la revisión POST-review que publish exigirá). NO publica. */
export function reviewRoutePlan(routePlanId) {
  return api('POST', '/pwa-supv/route-plan-review', {
    route_plan_id: Number(routePlanId || 0),
  })
}

/** Genera el snapshot de demanda desde las paradas VIGENTES del plan. Es un
 *  write explícito, token/scoped server-side: no optimiza ni publica. Tras éxito
 *  la UI debe volver a optimizar porque se actualiza la demanda congelada. */
export function generateRoutePlanDemandSnapshot(routePlanId) {
  return api('POST', '/pwa-supv/route-plan-generate-snapshot', {
    route_plan_id: Number(routePlanId || 0),
  })
}

/** Publicar plan de ruta. `planRevision` (opcional): la revisión con la que se
 *  optimizó/revisó; el backend la exige cuando el flag de publicación optimizada
 *  está ON (B5.2). `confirmWarnings`: cuando la revisión dejó AVISOS (readiness
 *  'warning'), confirma explícitamente que se publica con ellos. Sin flag, el
 *  backend actual publica igual (retrocompatible). */
export function publishRoutePlan(routePlanId, planRevision, confirmWarnings = false) {
  return api('POST', '/pwa-supv/route-plan-publish', {
    route_plan_id: Number(routePlanId || 0),
    ...(planRevision ? { plan_revision: String(planRevision) } : {}),
    ...(confirmWarnings ? { confirm_readiness_warnings: true } : {}),
  })
}

/**
 * Forecasts recientes.
 * @param {Object} [opts]
 * @param {number} [opts.employee_id] - Filtrar por vendedor específico.
 */
export function getForecasts(opts) {
  const qs = opts?.employee_id ? `?employee_id=${opts.employee_id}` : ''
  return api('GET', `/pwa-supv/forecasts${qs}`)
}

/** Confirmar un forecast (draft → confirmed) */
export function confirmForecast(forecastId) {
  return api('POST', '/pwa-supv/forecast-confirm', { forecast_id: forecastId })
}

/** Cancelar/reset un forecast (confirmed → draft) */
export function cancelForecast(forecastId) {
  return api('POST', '/pwa-supv/forecast-cancel', { forecast_id: forecastId })
}

/** Eliminar un forecast en borrador (solo draft) */
export function deleteForecast(forecastId) {
  return api('POST', '/pwa-supv/forecast-delete', { forecast_id: forecastId })
}

/** Líneas de un forecast (productos, canal, qty) — LEGACY (ORM). Ya NO se usa en
 *  el flujo de edición del supervisor (reemplazado por getForecastDto, §10). */
export function getForecastLines(forecastId) {
  return api('GET', `/pwa-supv/forecast-lines?forecast_id=${forecastId}`)
}

/**
 * DTO GET SEGURO del forecast (Codex §7/§10): carga forecast + write_date +
 * líneas completas + capabilities vía el endpoint token-only con scope canónico.
 * Devuelve { ok, forecast_id, write_date, operational_date, state, capabilities,
 * lines[], contract_version } o { ok:false, code, message }.
 */
export function getForecastDto(forecastId) {
  return api('POST', '/pwa-supv/forecast-get', { forecast_id: forecastId })
}

/**
 * Reemplazar las líneas de un forecast borrador (Codex §7/§9). El caller DEBE
 * pasar `expectedWriteDate` (el write_date que leyó del backend) y confirmar el
 * reemplazo total; vaciar exige confirmación adicional. Devuelve el resultado del
 * adaptador ({ok, phase, code, message, reload}) — el caller NO puede asumir éxito.
 * @param {number} forecastId
 * @param {Array} lines
 * @param {{expectedWriteDate:string, confirmReplaceAll?:boolean, confirmEmptyReplace?:boolean}} opts
 */
export function updateForecastLines(forecastId, lines, opts = {}) {
  return api('POST', '/pwa-supv/forecast-update-lines', {
    forecast_id: forecastId,
    lines,
    expected_write_date: opts.expectedWriteDate,
    confirm_replace_all: opts.confirmReplaceAll === true,
    confirm_empty_replace: opts.confirmEmptyReplace === true,
  })
}

// ── Metas mensuales ──────────────────────────────────────────────────────────

/** Metas de todos los vendedores del equipo (mes actual) */
export function getTeamTargets() {
  return api('GET', '/pwa-supv/team-targets')
}

// ── KPI Snapshots ────────────────────────────────────────────────────────────

/**
 * KPIs diarios de la sucursal.
 * @param {number} sucursalId - analytic_account_id
 * NOTA: Hoy filtra por sucursal (branch-level). Cuando el controller
 * de Sebastián tenga scope_key + employee_id, se podrá filtrar
 * por vendedor individual.
 */
export function getKpiSnapshots(sucursalId) {
  return api('GET', `/pwa-supv/kpi-snapshots?sucursal_id=${sucursalId}`)
}

// ── Detalle de Ruta ─────────────────────────────────────────────────────────

/** Paradas de una ruta (detalle de visitas) */
export function getRouteStops(routePlanId) {
  return api('GET', `/pwa-supv/route-stops?route_plan_id=${routePlanId}`)
}

/** Seguimiento de unidades para un plan diario de ruta */
export function getUnitTrack(planId, date) {
  const query = new URLSearchParams()
  const normalizedPlanId = Number(planId)
  query.set('plan_id', String(Number.isFinite(normalizedPlanId) ? normalizedPlanId : 0))
  if (date) query.set('date', date)
  return api('GET', `/pwa-supv/unit-track?${query}`)
}

// ── Score Semanal ───────────────────────────────────────────────────────────

/** Rutas de la semana (lunes a domingo) para score grid */
export function getWeekRoutes() {
  return api('GET', '/pwa-supv/week-routes')
}

// ── Ventas del día por vendedor (Sebastián audit 2026-04-10) ────────────────
// Backend: GET /api/pt/day-sales → sales_qty_by_employee_for_day()
// El endpoint vive en gf_saleops/controllers/pt.py pero es consumido aquí por
// supervisor-ventas para mostrar ventas del día por cada vendedor del equipo.
// Response shape: { ok, data: { date, warehouse_id, items: [{ employee_id, employee_name, qty_total, kg_total, products? }] } }

/**
 * @param {Object} [opts]
 * @param {number} [opts.warehouseId] - Warehouse PT origen (default sesión).
 * @param {string} [opts.date]        - YYYY-MM-DD (default: hoy).
 * @returns {Promise<{ date: string, warehouse_id: number, items: Array }>}
 */
export async function getDaySales(opts = {}) {
  const qs = new URLSearchParams()
  if (opts.warehouseId) qs.set('warehouse_id', String(opts.warehouseId))
  if (opts.date) qs.set('date', opts.date)
  const result = await api('GET', `/pwa-pt/day-sales${qs.toString() ? `?${qs}` : ''}`)
  const payload = result?.data || result || {}
  return {
    date: payload.date || opts.date || todayLocal(),
    warehouse_id: payload.warehouse_id || opts.warehouseId || 0,
    items: Array.isArray(payload.items) ? payload.items
         : Array.isArray(payload) ? payload
         : [],
  }
}

// ── F4-E.2: Route suggestions from weekly plan master ───────────────────────
// Backend endpoints (gf_route_compliance/controllers/pwa_route_suggestions.py):
//   GET  /pwa-supv/branch-configs
//   GET  /pwa-supv/route-suggestions
//   POST /pwa-supv/route-suggestions/confirm
//
// Permite a la supervisora ver las sugerencias del Plan Maestro Semanal
// (gf.route.weekly.plan.line) para una fecha y confirmar recursos
// (driver/vehicle/etc.) SIN generar gf.route.plan ni invocar F4-D.
// El flujo manual existente (ensureDailyRoutePlan) queda intacto y coexiste
// con esta opcion como toggle en ScreenPronostico.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * F4-E.2: lista branch_configs activos accesibles para la PWA.
 * Permite resolver branch_config_id sin hardcodearlo en el frontend.
 *
 * @returns {Promise<{ok: boolean, data: {branch_configs: Array, count: number}}>}
 */
export function getBranchConfigs() {
  return api('GET', '/pwa-supv/branch-configs')
}

/**
 * F4-E.2: lee sugerencias del weekly plan para una fecha + branch.
 *
 * Reglas backend:
 *   - Si se pasa weekly_plan_id, ese tiene prioridad.
 *   - Si no, se busca por (branch_config_id, date) en estados draft|published|in_progress.
 *   - Estados cancelled/closed bloqueados.
 *   - Si la fecha cae fuera del rango del plan, devuelve suggestions=[] + message warning.
 *
 * @param {Object} opts
 * @param {string} [opts.date]              YYYY-MM-DD (default backend: tomorrow)
 * @param {number} [opts.weeklyPlanId]      ID del weekly plan (prioritario)
 * @param {number} [opts.branchConfigId]    Requerido si no se pasa weeklyPlanId
 * @returns {Promise<Object>}
 */
export function getRouteSuggestions({ date, weeklyPlanId, branchConfigId } = {}) {
  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  if (weeklyPlanId) qs.set('weekly_plan_id', String(weeklyPlanId))
  if (branchConfigId) qs.set('branch_config_id', String(branchConfigId))
  const query = qs.toString()
  return api('GET', `/pwa-supv/route-suggestions${query ? `?${query}` : ''}`)
}

/**
 * F4-E.2: confirma recursos sobre una linea del weekly plan.
 *
 * El backend (gf_route_compliance) escribe SOLO en gf.route.weekly.plan.line
 * con whitelist estricto. NO crea gf.route.plan ni gf.route.stop.
 * Driver+vehicle deben resolver a 1 gf.route activa.
 *
 * Campos permitidos (extras devuelven invalid_payload):
 *   - weekly_plan_line_id (REQUIRED)
 *   - planned_driver_id (REQUIRED)
 *   - planned_vehicle_id (REQUIRED)
 *   - planned_salesperson_id (opcional)
 *   - planned_mobile_location_id (opcional)
 *   - planned_warehouse_dispatch_id (opcional)
 *   - planned_departure_time (opcional, float horas)
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export function confirmRouteSuggestion(payload) {
  return api('POST', '/pwa-supv/route-suggestions/confirm', payload || {})
}
