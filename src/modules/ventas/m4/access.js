// ─── KOLD OS · M4 — Contrato de acceso (fail-closed) ─────────────────────────
// Quién ve la superficie M4 "Ventas y clientes" (v1):
//   · x_job_key `direccion_general`   → acceso GLOBAL (dirección autorizada)
//   · tower_status `admin_plataforma` → acceso GLOBAL
//   · todo lo demás                   → SIN ACCESO (fail-closed)
//
// Alineado con el backend CONGELADO (gf_kold_os_m4._access_for @ 978994c4):
// acepta job key `direccion_general` O tower_status `admin_plataforma`
// (la PROYECCIÓN server-side de direccion_general vía
// resolve_employee_pwa_tower_status) — misma verdad, cero divergencia.
// PROVISIONAL: si la auditoría de Codex cambia el contrato de permisos del
// backend, esta allowlist se ajusta en el MISMO PR (una línea aquí + tests).
//
// DELIBERADO (Fase 10): gerente_sucursal / supervisor_ventas / vendedor /
// chofer / jefe_ruta NO tienen acceso v1 — no existe fuente autoritativa de rol
// comercial por sucursal hoy; autorizarlos “por nombre” sería inventar
// autoridad. Cada adición futura = decisión S/N + una línea en AMBAS
// allowlists (frontend y backend), no inferencia.
//
// El scope por compañía/canal existe en el contrato (`scopeFindingsForAccess`)
// pero v1 solo emite nivel global: el contrato de datos es agregado.

import { isValidAuthenticatedSession } from '../../../lib/session.js'
import { getEffectiveJobKeys } from '../../../lib/roleContext.js'
import { readAuthoritativeTowerStatus } from '../../torre/e1/loadTowerStatus.js'

export const M4_ALLOWED_JOB_KEYS = Object.freeze(['direccion_general'])
export const M4_ALLOWED_TOWER_STATUS = Object.freeze(['admin_plataforma'])

/** Decide el nivel de acceso M4 para una sesión. Fail-closed. */
export function readM4Access(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }
  const jobKeys = getEffectiveJobKeys(session)
  if (M4_ALLOWED_JOB_KEYS.some((key) => jobKeys.includes(key))) {
    return { level: 'global', reason: 'job_key_direccion_general' }
  }
  const towerStatus = readAuthoritativeTowerStatus(session)
  if (towerStatus && M4_ALLOWED_TOWER_STATUS.includes(towerStatus)) {
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
