import { api } from '../../../lib/api.js'
import { isOperationalDate } from './operationalDate.js'

export const SUPERVISOR_DAY_CONTROL_PATH =
  '/gf/salesops/supervisor/v2/day-control'

export function buildDayControlRequest(date) {
  if (date === undefined) return { data: {} }
  if (!isOperationalDate(date)) throw new TypeError('Fecha operativa inválida')
  return { data: { date } }
}

export function requestSupervisorDayControl(date) {
  return api('POST', SUPERVISOR_DAY_CONTROL_PATH, buildDayControlRequest(date))
}
