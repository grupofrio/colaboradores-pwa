import { isValidAuthenticatedSession } from '../../lib/session.js'
import { getSession } from '../../lib/api.js'

export function parseAllowedEmployeeIds(raw = '') {
  return [...new Set(String(raw).split(',')
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0))]
}

export function readVentasIgualaAccess(session, allowedEmployeeIds = []) {
  if (!isValidAuthenticatedSession(session)) return { level: 'none', reason: 'invalid_session' }
  const configuredIds = Array.isArray(allowedEmployeeIds) ? allowedEmployeeIds : []
  return configuredIds.includes(Number(session.employee_id))
    ? { level: 'iguala_sales', reason: 'configured_employee' }
    : { level: 'none', reason: 'not_authorized' }
}

const configuredEmployeeIds = parseAllowedEmployeeIds(
  import.meta.env?.VITE_IGUALA_SALES_EMPLOYEE_IDS ?? globalThis.process?.env?.VITE_IGUALA_SALES_EMPLOYEE_IDS,
)

export function readConfiguredVentasIgualaAccessForSession(session) {
  return readVentasIgualaAccess(session, configuredEmployeeIds)
}

export function readConfiguredVentasIgualaAccess() {
  return readConfiguredVentasIgualaAccessForSession(getSession())
}
