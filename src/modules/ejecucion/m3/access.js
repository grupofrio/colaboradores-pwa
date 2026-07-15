// ─── KOLD OS · M3 — Contrato de acceso (fail-closed) ─────────────────────────
// Quién ve la superficie M3 "Ejecución de rutas" (v1):
//   · x_job_key `direccion_general`   → acceso GLOBAL
//   · tower_status `admin_plataforma` → acceso GLOBAL
//   · todo lo demás                   → SIN ACCESO (fail-closed)
//
// Base factual (misma que M2, alineada con gf_kold_os_m3._access_for):
// server-side `admin_plataforma` ES la PROYECCIÓN de `direccion_general`
// (PWA_TOWER_ROLE_STATUS_MAP en os_customer_zones); el backend evalúa la
// fuente PRIMARIA y aquí se aceptan ambas proyecciones de esa misma verdad.
//
// DELIBERADO (Fase 10, ver docs/m3/M3_PERMISSIONS del backend):
//   · jefe_ruta / chofer / operadores: SIN acceso — ejecutan la operación; el
//     observatorio ejecutivo no es su superficie (evita auto-supervisión);
//   · supervisor_ventas: SIN acceso — NO hereda de Tower M1;
//   · gerente_sucursal: nivel BRANCH definido en el contrato pero NO emitido
//     v1 (decisión S/N pendiente; con 1 regla dimensional sería teatro);
//   · "supervisor_operaciones" NO existe como x_job_key hoy (verificado) —
//     alta = S/N + una línea en ambas allowlists.

import { isValidAuthenticatedSession } from '../../../lib/session.js'
import { getEffectiveJobKeys } from '../../../lib/roleContext.js'
import { readAuthoritativeTowerStatus } from '../../torre/e1/loadTowerStatus.js'

export const M3_ALLOWED_JOB_KEYS = Object.freeze(['direccion_general'])
export const M3_ALLOWED_TOWER_STATUS = Object.freeze(['admin_plataforma'])

/** Decide el nivel de acceso M3 para una sesión. Fail-closed. */
export function readM3Access(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }
  const jobKeys = getEffectiveJobKeys(session)
  if (M3_ALLOWED_JOB_KEYS.some((key) => jobKeys.includes(key))) {
    return { level: 'global', reason: 'job_key_direccion_general' }
  }
  const towerStatus = readAuthoritativeTowerStatus(session)
  if (towerStatus && M3_ALLOWED_TOWER_STATUS.includes(towerStatus)) {
    return { level: 'global', reason: 'tower_admin_plataforma' }
  }
  return { level: 'none', reason: 'not_authorized' }
}

/** v1: global ve todo; cualquier otro nivel ⇒ NADA (cero fuga cross-scope). */
export function scopeFindingsForAccess(findings = [], access = null) {
  if (!access || access.level !== 'global') return []
  return Array.isArray(findings) ? findings : []
}
