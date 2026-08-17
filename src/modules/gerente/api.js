// ─── API Gerente de Sucursal ─────────────────────────────────────────────────
import { api } from '../../lib/api'

/** Alertas del día (gf.ops.event_log filtrado por sucursal) */
export function getAlerts() {
  return api('GET', '/pwa-gerente/alerts')
}

/** Forecasts confirmados (bloqueados, listos para unlock) */
export function getLockedForecasts() {
  return api('GET', '/pwa-gerente/forecasts-locked')
}

/** Desbloquear forecast (set state=draft) */
export function unlockForecast(forecastId) {
  return api('POST', '/pwa-gerente/forecast-unlock', { forecast_id: forecastId })
}

/** KPI summary de la sucursal */
export function getKpiSummary() {
  return api('GET', '/pwa-gerente/kpi-summary')
}

// ── Gerente V2 · "Mi Sucursal" (shell de pestañas, detrás del flag gerente_v2)
// Estas funciones devuelven SIEMPRE `{ ok, ... , error }`: nunca lanzan por un
// rechazo del backend, para que la pantalla pueda distinguir "no habilitado"
// de "falló" y de "no hay datos". `null` sigue significando "sin dato". Son
// funciones NUEVAS (no reemplazan getAlerts/getKpiSummary/etc. de arriba, que
// siguen alimentando el hub legacy con su forma de respuesta actual).

/** Traduce el código del backend a algo que la gerente pueda leer. */
export function gerenteErrorMessage(code, fallback) {
  switch (code) {
    case 'FEATURE_DISABLED':
      return 'Esta vista aún no está habilitada para tu sucursal.'
    case 'UNAUTHORIZED':
      return 'Tu sesión no tiene credencial de empleado. Vuelve a iniciar sesión.'
    case 'FORBIDDEN':
      return 'Tu puesto no tiene acceso a esta vista.'
    case 'NO_BRANCH_SCOPE':
      return 'Tu usuario no está asignado a una sucursal activa.'
    case 'MULTI_BRANCH':
      return 'Tu usuario aparece en más de una sucursal activa: avisa a sistemas.'
    default:
      return fallback || 'No se pudo cargar la información.'
  }
}

/** Tablero "Hoy" de la sucursal: venta mostrador, gastos, caja, asistencias. */
export async function getGerenteToday() {
  const res = await api('GET', '/pwa-gerente/today')
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), data: null }
  }
  return { ok: true, data: res?.data || null, scope: res?.scope || null }
}

/** Existencias por almacén de la sucursal (solo los almacenes propios). */
export async function getGerenteInventory(warehouseId) {
  const res = await api('GET', '/pwa-gerente/inventory', warehouseId ? { warehouse_id: warehouseId } : undefined)
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), warehouses: [] }
  }
  return { ok: true, warehouses: Array.isArray(res?.warehouses) ? res.warehouses : [], available: res?.available !== false }
}

/** Resumen del día de producción de la(s) planta(s) de la sucursal. */
export async function getGerenteProduction() {
  const res = await api('GET', '/pwa-gerente/production')
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), data: null }
  }
  return { ok: true, data: res?.data || null }
}

/** Pendientes (tareas + notas) SOLO LECTURA del equipo de la sucursal. */
export async function getGerentePendientes() {
  const res = await api('GET', '/pwa-gerente/pendientes')
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), data: null }
  }
  return { ok: true, data: res?.data || null }
}

// ── Panel de controles (detección read-only) ─────────────────────────────────

/** Todas las reglas de control del período. Cada regla:
 *  { key, available, count, total_amount, data_as_of, reason, threshold }.
 *  El scope lo impone el backend por token; `branchId` solo lo usa dirección
 *  para elegir sucursal (el gerente lo ignora). */
export async function getControls(period = 'today', branchId) {
  const qs = branchId ? `&branch_id=${branchId}` : ''
  const res = await api('GET', `/pwa-gerente/controls?period=${encodeURIComponent(period)}${qs}`)
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), rules: [] }
  }
  return { ok: true, rules: Array.isArray(res?.rules) ? res.rules : [], period: res?.period || period, scope: res?.scope || null }
}

/** Detalle (items) de UNA regla en el período. */
export async function getControlDetail(rule, period = 'today', branchId) {
  const qs = branchId ? `&branch_id=${branchId}` : ''
  const res = await api('GET', `/pwa-gerente/controls/detail?rule=${encodeURIComponent(rule)}&period=${encodeURIComponent(period)}${qs}`)
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), items: [] }
  }
  return { ok: true, items: Array.isArray(res?.items) ? res.items : [], rule, available: res?.available !== false, reason: res?.reason || null }
}
