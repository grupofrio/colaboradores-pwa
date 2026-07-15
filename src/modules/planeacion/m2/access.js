// ─── KOLD OS · M2 — Contrato de acceso (fail-closed) ─────────────────────────
// Quién ve la superficie M2 "Planeación" (v1):
//   · x_job_key `direccion_general`          → acceso GLOBAL (dirección autorizada)
//   · tower_status `admin_plataforma`        → acceso GLOBAL (admin de plataforma,
//     rol AUTORITATIVO servido por Odoo en session.employee.tower_status)
//   · todo lo demás                          → SIN ACCESO (fail-closed)
//
// DELIBERADO: NO se copian las reglas de Tower M1 (supervisor_ventas con
// tower_status NO entra a M2 — Tower autoriza su propio módulo, no éste).
// "Responsables de planeación / operativos autorizados" NO tienen fuente
// autoritativa de rol hoy ⇒ quedan owner_status=unassigned y se documenta en
// docs/m2/M2_PERMISSIONS.md (agregarlos = decisión S/N, no inferencia).
//
// El scope por compañía/sucursal existe en el contrato (`scopeFindingsForAccess`)
// pero v1 solo emite nivel global: el contrato de datos es agregado (sin
// dimensión sucursal), así que un nivel "branch" sería teatro. Se activará con
// la extensión v1.1 del contrato del auditor.

import { isValidAuthenticatedSession } from '../../../lib/session.js'
import { getEffectiveJobKeys } from '../../../lib/roleContext.js'
import { readAuthoritativeTowerStatus } from '../../torre/e1/loadTowerStatus.js'

export const M2_ALLOWED_JOB_KEYS = Object.freeze(['direccion_general'])
export const M2_ALLOWED_TOWER_STATUS = Object.freeze(['admin_plataforma'])

/** Decide el nivel de acceso M2 para una sesión. Fail-closed. */
export function readM2Access(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }
  const jobKeys = getEffectiveJobKeys(session)
  if (M2_ALLOWED_JOB_KEYS.some((key) => jobKeys.includes(key))) {
    return { level: 'global', reason: 'job_key_direccion_general' }
  }
  const towerStatus = readAuthoritativeTowerStatus(session)
  if (towerStatus && M2_ALLOWED_TOWER_STATUS.includes(towerStatus)) {
    return { level: 'global', reason: 'tower_admin_plataforma' }
  }
  return { level: 'none', reason: 'not_authorized' }
}

/**
 * Aplica el scope del acceso sobre hallazgos. v1: global ve todo el agregado;
 * cualquier otro nivel ⇒ NADA (cero fuga cross-company).
 */
export function scopeFindingsForAccess(findings = [], access = null) {
  if (!access || access.level !== 'global') return []
  return Array.isArray(findings) ? findings : []
}
