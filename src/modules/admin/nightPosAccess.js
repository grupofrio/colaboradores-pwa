import { isValidAuthenticatedSession } from '../../lib/session.js'
import { isNightPosEmployee } from './identityGates.js'

// El gate por NOMBRE ("hector" + "tapia") se retiró: un nombre se colisiona y no
// distingue entre fichas de empleado. Ahora se compara `employee_id`, que emite
// el servidor al iniciar sesión. Ver `identityGates.js`.
export function hasNightPosIdentity(session = {}) {
  return isNightPosEmployee(session)
}

export function canAccessNightPos(session = {}) {
  return isValidAuthenticatedSession(session) && hasNightPosIdentity(session)
}

// Alias de compatibilidad — los nombres viejos siguen resolviendo mientras se
// actualizan los llamadores. No comparan nombres: delegan en el gate por id.
export const hasHectorTapiaIdentity = hasNightPosIdentity
export const canAccessHectorNightPos = canAccessNightPos
