// ─── KOLD OS · M6 — Contrato de acceso (fail-closed) ─────────────────────────
// Quién ve la superficie M6 "Caja y conciliación" (v1):
//   · x_job_key `direccion_general`  → acceso GLOBAL
//   · todo lo demás                  → SIN ACCESO (fail-closed)
//
// ⚠️ DIVERGENCIA DELIBERADA CON M2 — leer antes de "arreglarla":
// M2 acepta `direccion_general` Y `admin_plataforma` (su proyección server-side)
// porque SU BACKEND TAMBIÉN ACEPTA AMBAS. El backend de M6 **NO**: su
// `_access_for` sólo compara contra `ALLOWED_JOB_KEYS = ("direccion_general",)`;
// la constante `ALLOWED_TOWER_STATUS` existe pero NUNCA SE USA (verificado en el
// código del backend local).
//
// Si aquí aceptáramos `admin_plataforma`, el frontend sería MÁS PERMISIVO que el
// backend: la tarjeta se vería, el clic entraría y el endpoint respondería 403.
// Ése es exactamente el bug de M1 (tarjeta visible / clic bloqueado). Fail-closed
// significa alinearse con la autoridad, no con el rol que "debería" poder.
//
// Para habilitar `admin_plataforma`: es UNA línea en el backend (que `_access_for`
// consulte `ALLOWED_TOWER_STATUS`) + UNA aquí, con su S/N. No es una inferencia
// que el frontend pueda hacer solo.
//
// NO se habilitan por nombre textual: finanzas, dirección financiera, gerente
// administrativo, cobranza, caja, gerente_sucursal. No existe job key
// autoritativa para ellos; inventarla abriría el dato más sensible de la empresa
// a un rol que quizá no significa lo que su nombre sugiere (ver M6_PERMISSIONS.md).
//
// El scope por compañía/sucursal existe en el contrato del backend pero v1 sólo
// emite nivel global: los hallazgos son AGREGADOS (sin dimensión sucursal), así
// que un nivel "branch" sería teatro.

import { isValidAuthenticatedSession } from '../../../lib/session.js'
import { getEffectiveJobKeys } from '../../../lib/roleContext.js'

export const M6_ALLOWED_JOB_KEYS = Object.freeze(['direccion_general'])

/** Decide el nivel de acceso M6 para una sesión. Fail-closed. */
export function readM6Access(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }
  const jobKeys = getEffectiveJobKeys(session)
  if (M6_ALLOWED_JOB_KEYS.some((key) => jobKeys.includes(key))) {
    return { level: 'global', reason: 'job_key_direccion_general' }
  }
  return { level: 'none', reason: 'not_authorized' }
}
