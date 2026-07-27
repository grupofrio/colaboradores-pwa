import { isValidAuthenticatedSession } from '../../lib/session.js'

const DEFAULT_ATTENDANCE_MANAGER_IDS = '717'

/** Parse the public, UI-only allowlist without accepting numeric coercions. */
export function parseAttendanceManagerIds(raw = '') {
  if (typeof raw !== 'string') return []

  const ids = []
  const seen = new Set()
  for (const value of raw.split(',')) {
    const candidate = value.trim()
    if (!/^[1-9]\d*$/.test(candidate)) continue

    const employeeId = Number(candidate)
    if (!Number.isSafeInteger(employeeId) || seen.has(employeeId)) continue
    seen.add(employeeId)
    ids.push(employeeId)
  }
  return ids
}

/**
 * Local UX gate only. Odoo authenticates and authorizes every attendance call.
 * The injected raw string keeps this helper deterministic in Node tests.
 */
export function readAttendanceAccess(
  session,
  raw = import.meta.env?.VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS ?? DEFAULT_ATTENDANCE_MANAGER_IDS,
) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }

  return parseAttendanceManagerIds(raw).includes(Number(session.employee_id))
    ? { level: 'manager', reason: 'employee_allowlist' }
    : { level: 'none', reason: 'employee_not_allowed' }
}
