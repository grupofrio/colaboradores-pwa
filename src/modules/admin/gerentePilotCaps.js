// Pure helpers: Gerente Iguala pilot keeps Admin read-only while
// `gf_salesops.gerente_writes.enabled` is OFF.

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
 * When gerente_writes is OFF, pure gerente_sucursal must not see write invitations
 * (Aprobar / Registrar / Validar) as if they were active. Backend remains authority.
 */
export function isGerentePilotReadOnly(session, capabilities = {}) {
  if (!isGerenteSucursalPilotSession(session)) return false
  return capabilities?.gerenteWritesEnabled !== true
}

export function filterAdminNavForGerentePilot(items, session, capabilities = {}) {
  const list = Array.isArray(items) ? items : []
  if (!isGerentePilotReadOnly(session, capabilities)) return list
  return list
    .filter((item) => item && item.access !== ADMIN_NAV_ACCESS.WRITE)
    .map((item) => {
      if (item.access !== ADMIN_NAV_ACCESS.MIXED) return item
      return {
        ...item,
        status: 'pending_backend',
        lockedReason: 'Solo lectura en el piloto Gerente (escrituras desactivadas).',
      }
    })
}

export function isGerenteSucursalPilotSession(session) {
  const role = String(session?.role || '').trim()
  if (role !== 'gerente_sucursal') return false
  const extras = Array.isArray(session?.additional_job_keys) ? session.additional_job_keys : []
  // Dual-role auxiliar keeps legacy Admin write UX; pure gerente stays read-only.
  return !extras.map((k) => String(k || '').trim()).includes('auxiliar_admin')
}

/** Fail-closed write clamp for the Iguala Gerente pilot. */
export function clampGerentePilotWriteCapabilities(session, caps = {}) {
  if (!caps || typeof caps !== 'object') return caps
  if (!isGerenteSucursalPilotSession(session)) return caps
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
