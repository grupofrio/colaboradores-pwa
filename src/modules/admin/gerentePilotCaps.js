// Pure helpers: Gerente Iguala pilot keeps Admin read-only while
// `gf_salesops.gerente_writes.enabled` is OFF.
import { getEffectiveJobKeys } from '../../lib/roleContext.js'

const CASH_SHIFT_CAPABILITY_KEYS = Object.freeze([
  'cashShiftRead',
  'cashShiftManage',
  'cashShiftAuthorize',
  'cashShiftPendingDetail',
  'cashShiftReopen',
  'cashShiftPrint',
])

const GERENTE_PILOT_WRITE_CAP_KEYS = Object.freeze([
  'cashClosingWrite',
  'saleCancel',
  'saleCreate',
  'expenseApproval',
  'requisitionApproval',
  'cashShiftManage',
  'cashShiftAuthorize',
  'cashShiftPendingDetail',
  'cashShiftReopen',
  'cashShiftPrint',
  'evidenceUpload',
])

/** Admin nav / launcher access mode for the Iguala Gerente pilot. */
export const ADMIN_NAV_ACCESS = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  MIXED: 'mixed',
})

/**
 * Order-independent gerente authority (matches backend is_gerente_write_clamped).
 * Hybrids that also carry auxiliar_admin stay clamped — role union does not escape.
 */
export function isGerenteWriteClampedSession(session) {
  const keys = getEffectiveJobKeys(session)
  return keys.includes('gerente_sucursal') || keys.includes('gerente_unidad')
}

/** When gerente_writes is OFF, gerente-bearing sessions must not see write invitations. */
export function isGerentePilotReadOnly(session, capabilities = {}) {
  if (!isGerenteWriteClampedSession(session)) return false
  return capabilities?.gerenteWritesEnabled !== true
}

const GERENTE_PILOT_READ_ONLY_COPY = 'Solo lectura en el piloto Gerente (escrituras desactivadas).'

export function filterAdminNavForGerentePilot(items, session, capabilities = {}) {
  const list = Array.isArray(items) ? items : []
  if (!isGerentePilotReadOnly(session, capabilities)) return list
  return list
    .filter((item) => item && item.access !== ADMIN_NAV_ACCESS.WRITE)
    .map((item) => {
      if (item.access !== ADMIN_NAV_ACCESS.MIXED) return item
      // MIXED stays navigable: read surfaces are useful during the pilot.
      return {
        ...item,
        readOnlyPilot: true,
        lockedReason: GERENTE_PILOT_READ_ONLY_COPY,
      }
    })
}

/** Effective capability view for Gerente pilot — fail-closed until boot completes. */
export function resolveGerentePilotCapabilities(session, capabilities = {}, capsReady = false) {
  if (!isGerenteWriteClampedSession(session)) return capabilities
  if (!capsReady || capabilities?.gerenteWritesEnabled !== true) {
    return clampGerentePilotWriteCapabilities(session, {
      ...capabilities,
      gerenteWritesEnabled: false,
    })
  }
  return capabilities
}

/** Pure gerente_sucursal identity (primary, no auxiliar). Kept for brand surfaces. */
export function isGerenteSucursalPilotSession(session) {
  const keys = getEffectiveJobKeys(session)
  if (keys[0] !== 'gerente_sucursal') return false
  return !keys.includes('auxiliar_admin')
}

/** Fail-closed write clamp for gerente-bearing sessions (incl. hybrids / unidad). */
export function clampGerentePilotWriteCapabilities(session, caps = {}) {
  if (!caps || typeof caps !== 'object') return caps
  if (!isGerenteWriteClampedSession(session)) return caps
  if (caps.gerenteWritesEnabled === true) return caps
  const next = { ...caps }
  for (const key of GERENTE_PILOT_WRITE_CAP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(next, key) && typeof next[key] === 'boolean') {
      next[key] = false
    }
  }
  for (const key of CASH_SHIFT_CAPABILITY_KEYS) {
    if (key === 'cashShiftRead') continue
    next[key] = false
  }
  next.gerenteWritesEnabled = false
  return next
}
