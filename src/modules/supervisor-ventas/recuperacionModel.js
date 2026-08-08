// ─── Recuperación / inactivos — modelo PURO (sin React) ──────────────────────
// Traduce el contrato del endpoint V2 escopado a sucursal y arma la lista de
// planes de MAÑANA a los que se puede agregar un cliente. Sin window/fetch ⇒
// testeable con `node --test`.
//
// POR QUÉ V2: el listado viejo (/pwa-supv/customers/recovery, api_key +
// company_id del cliente) mostraba clientes de TODAS las plazas de la compañía
// (128/225 vs 14/15 reales de Iguala). El V2 escopa por sucursal server-side.

export const KIND_RECOVERY = 'recovery'
export const KIND_INACTIVE = 'inactive'

export const KIND_LABEL = {
  [KIND_RECOVERY]: 'Por recuperar',
  [KIND_INACTIVE]: 'Inactivos (+60 días)',
}

/** Desenvuelve la respuesta (el shim puede dar el payload directo o en `.data`).
 *  Devuelve null si no trae la forma esperada. */
export function unwrapRecovery(res) {
  if (!res || typeof res !== 'object') return null
  const d = Array.isArray(res.customers) ? res : (res.data || null)
  if (!d || typeof d !== 'object') return null
  if (typeof d.available !== 'boolean') return null
  return d
}

/** ¿El backend pudo responder? Si no, se declara el motivo en vez de pintar una
 *  lista vacía que se leería como "no hay nadie por recuperar". */
export function recoveryUnavailable(payload) {
  if (!payload) return 'RESPUESTA_SIN_RECUPERACION'
  if (payload.available === false) return String(payload.reason || 'no_disponible')
  return null
}

export function recoveryCustomers(payload) {
  return payload && Array.isArray(payload.customers) ? payload.customers : []
}

/** "hace N días" honesto: sin dato no se inventa. */
export function daysLabel(customer) {
  const n = Number(customer && customer.days_since_last_order)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n} días sin comprar`
}

// ── Planes de MAÑANA a los que se puede agregar ──────────────────────────────
// La fuente es routes-week: cada fila trae `tomorrow.plan_id` cuando el plan de
// mañana YA existe como gf.route.plan. Solo esos son destinos válidos para
// add_customer — un plan operativo sin materializar no tiene id que recibir al
// cliente. Se dice explícitamente cuando no hay ninguno, en vez de ofrecer un
// selector vacío.

const TYPE_SHORT = { SO: 'Solo', SP: 'Subpolígono', P: 'Polígono' }

/** Opciones de destino: [{ plan_id, label, tipo }] a partir de la respuesta de
 *  routes-week. Solo filas con plan de mañana materializado (plan_id). */
export function tomorrowPlanOptions(routesWeekRes) {
  const d = routesWeekRes && (Array.isArray(routesWeekRes.rows) ? routesWeekRes : routesWeekRes.data)
  const rows = d && Array.isArray(d.rows) ? d.rows : []
  const out = []
  const seen = new Set()
  for (const row of rows) {
    const planId = row && row.tomorrow && row.tomorrow.plan_id
    if (!planId || seen.has(planId)) continue
    seen.add(planId)
    out.push({
      plan_id: planId,
      tipo: row.tipo || null,
      label: row.name || `Plan ${planId}`,
    })
  }
  return out
}

export function planOptionSubtitle(option) {
  const t = option && option.tipo
  return t && TYPE_SHORT[t] ? TYPE_SHORT[t] : 'Plan de mañana'
}

/** Mensaje del resultado de agregar, honesto sobre lo que el server confirmó. */
export function addResultMessage(res, customerName) {
  const ok = res && (res.ok === true || (res.data && res.data.ok === true) || res.added === true)
  const name = customerName || 'El cliente'
  if (ok) return { tone: 'ok', text: `${name} quedó agregado al plan de mañana.` }
  const code = (res && (res.code || (res.data && res.data.code))) || 'no_confirmado'
  return { tone: 'error', text: `No se pudo agregar (${code}).` }
}
