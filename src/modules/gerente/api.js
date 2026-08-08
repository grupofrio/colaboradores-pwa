// ─── API Gerente de Sucursal ─────────────────────────────────────────────────
// Los cuatro endpoints viven ahora en Odoo (`/gf/salesops/gerente/v2/*`,
// GrupoVeniu/GrupoFrio#270) y derivan compañía y sucursal del token del empleado.
// Antes se resolvían con consultas ORM `sudo` armadas en el navegador y
// filtradas por el `company_id` de la sesión del cliente.
//
// Estas funciones devuelven SIEMPRE `{ ok, ... , error }`: nunca lanzan por un
// rechazo del backend, para que la pantalla pueda distinguir "no habilitado"
// de "falló" y de "no hay datos". `null` sigue significando "sin dato".
import { api } from '../../lib/api'

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

function normalizeList(res, key = 'items') {
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), [key]: [] }
  }
  const items = Array.isArray(res?.[key]) ? res[key] : (Array.isArray(res) ? res : [])
  return { ok: true, [key]: items }
}

/** Alertas del día de la sucursal del token. */
export async function getAlerts() {
  return normalizeList(await api('GET', '/pwa-gerente/alerts'))
}

/** Forecasts confirmados (bloqueados, listos para unlock) de la sucursal. */
export async function getLockedForecasts() {
  return normalizeList(await api('GET', '/pwa-gerente/forecasts-locked'))
}

/** Desbloquear forecast. El backend valida que sea de TU sucursal. */
export async function unlockForecast(forecastId) {
  const res = await api('POST', '/pwa-gerente/forecast-unlock', { forecast_id: forecastId })
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message) }
  }
  return { ok: true, data: res?.data || {} }
}

/** KPI summary de la sucursal. `has_data:false` ⇒ no hay snapshot (no es cero). */
export async function getKpiSummary() {
  const res = await api('GET', '/pwa-gerente/kpi-summary')
  if (res && res.success === false) {
    return { ok: false, code: res.code, error: gerenteErrorMessage(res.code, res.message), kpi: null }
  }
  const { success, ...kpi } = res || {}
  return { ok: true, kpi }
}
