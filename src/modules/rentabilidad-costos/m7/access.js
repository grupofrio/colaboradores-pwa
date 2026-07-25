// ─── KOLD OS · M7 — Contrato de acceso (fail-closed) ─────────────────────────
// Quién ve la superficie M7 "Rentabilidad y costos" (v1):
//   · x_job_key `direccion_general`  → acceso GLOBAL
//   · todo lo demás                  → SIN ACCESO (fail-closed)
//
// Espeja EXACTAMENTE el backend #211: `_access_for` compara sólo contra
// `ALLOWED_JOB_KEYS = ("direccion_general",)`. NO hay otra constante de acceso en
// el backend (a diferencia del `ALLOWED_TOWER_STATUS` fantasma que M6 eliminó).
//
// NO se habilitan por nombre textual: admin_plataforma, gerente_sucursal,
// operaciones, finanzas, contador, comercial. No existe job key autoritativa
// para ellos; inventarla abriría el dato económico más sensible a un rol que
// quizá no significa lo que su nombre sugiere. Si el frontend fuera más
// permisivo que el backend, la tarjeta se vería y el endpoint respondería 403
// (el bug de M1). Fail-closed = alinearse con la autoridad, no con el rol que
// "debería" poder. Habilitar otro rol es UNA línea en el backend + UNA aquí, con
// su S/N — no una inferencia que el frontend pueda hacer solo.

import { isValidAuthenticatedSession } from '../../../lib/session.js'
import { getEffectiveJobKeys } from '../../../lib/roleContext.js'

export const M7_ALLOWED_JOB_KEYS = Object.freeze(['direccion_general'])

/** Decide el nivel de acceso M7 para una sesión. Fail-closed. */
export function readM7Access(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }
  const jobKeys = getEffectiveJobKeys(session)
  if (M7_ALLOWED_JOB_KEYS.some((key) => jobKeys.includes(key))) {
    return { level: 'global', reason: 'job_key_direccion_general' }
  }
  return { level: 'none', reason: 'not_authorized' }
}
