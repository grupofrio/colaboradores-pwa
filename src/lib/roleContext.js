import { isValidAuthenticatedSession } from './session.js'
import { readAuthoritativeTowerStatus } from '../modules/torre/e1/loadTowerStatus.js'

const MODULE_ROLE_VARIANTS = {
  registro_produccion: ['operador_barra', 'operador_rolito', 'auxiliar_produccion'],
  admin_sucursal: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'],
}

export const ROLE_LABELS = {
  operador_barra: 'Operador barra',
  operador_rolito: 'Operador rolito',
  auxiliar_produccion: 'Auxiliar producción',
  supervisor_produccion: 'Supervisor producción',
  almacenista_pt: 'Almacenista PT',
  jefe_ruta: 'Jefe ruta',
  auxiliar_ruta: 'Auxiliar ruta',
  almacenista_entregas: 'Almacenista entregas',
  supervisor_ventas: 'Supervisor ventas',
  auxiliar_admin: 'Auxiliar admin',
  gerente_sucursal: 'Gerente sucursal',
  direccion_general: 'Dirección general',
  operador_torres: 'Operador torres',
}

export function normalizeJobKeys(values = []) {
  const keys = Array.isArray(values) ? values : [values]
  const seen = new Set()
  return keys
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export function normalizeSessionRoleContext(session = {}) {
  const primaryRole = String(session?.role || '').trim()
  const rawAdditionalRoles = Array.isArray(session?.additional_job_keys)
    ? session.additional_job_keys
    : session?.additional_roles
  const additional_job_keys = normalizeJobKeys(rawAdditionalRoles)
    .filter((role) => role !== primaryRole)

  const module_role_contexts = Object.fromEntries(
    Object.entries(session?.module_role_contexts || {})
      .map(([moduleId, role]) => [String(moduleId || '').trim(), String(role || '').trim()])
      .filter(([moduleId, role]) => moduleId && role)
  )

  const explicitPlaza = String(session?.plaza_id || '').trim()
  return {
    ...session,
    role: primaryRole,
    additional_job_keys,
    module_role_contexts,
    plaza_id: explicitPlaza ? explicitPlaza.toUpperCase() : null,
  }
}

export function getEffectiveJobKeys(session = {}) {
  const extra = Array.isArray(session?.additional_job_keys)
    ? session.additional_job_keys
    : session?.additional_roles
  return normalizeJobKeys([session?.role || '', ...(extra || [])])
}

export function getAuthorizationJobKeys(session = {}) {
  const keys = getEffectiveJobKeys(session)
  if (keys[0] === 'gerente_sucursal') return keys
  // Un gerente_sucursal adicional no concede autorización ni evade el clamp.
  return keys.filter((key) => key !== 'gerente_sucursal')
}

export function authorizationJobKeysFrom(roles = [], session = null) {
  if (session) return getAuthorizationJobKeys(session)
  const keys = normalizeJobKeys(roles)
  if (keys[0] === 'gerente_sucursal') return keys
  return keys.filter((key) => key !== 'gerente_sucursal')
}

export function getEffectiveRoles(session = {}) {
  return getEffectiveJobKeys(session)
}

export function hasEffectiveRole(session, role) {
  return getEffectiveJobKeys(session).includes(String(role || '').trim())
}

export function normalizeAdditionalRoles(input) {
  if (!Array.isArray(input)) return []
  return normalizeJobKeys(input)
}

export function getCompatibleModuleRoles(module, effectiveRoles = []) {
  const normalizedRoles = normalizeJobKeys(effectiveRoles)
  const moduleRoles = Array.isArray(module?.roles) ? module.roles : []
  const variantRoles = Array.isArray(module?.roleContextRoles) && module.roleContextRoles.length
    ? module.roleContextRoles
    : MODULE_ROLE_VARIANTS[module?.id] || []

  const visibleRoles = normalizedRoles.filter((role) => moduleRoles.includes('*') || moduleRoles.includes(role))
  if (!variantRoles.length) return visibleRoles
  return visibleRoles.filter((role) => variantRoles.includes(role))
}

export function resolveModuleContextRole(session = {}, module, requestedRole = '') {
  const compatibleRoles = getCompatibleModuleRoles(module, getEffectiveJobKeys(session))
  const explicitRole = String(requestedRole || '').trim()
  if (explicitRole && compatibleRoles.includes(explicitRole)) return explicitRole
  const storedRole = String(session?.module_role_contexts?.[module?.id] || '').trim()
  if (storedRole && compatibleRoles.includes(storedRole)) return storedRole
  if (compatibleRoles.length === 1) return compatibleRoles[0]
  return ''
}

export function getModuleEntryDecision(module, session = {}) {
  const compatibleRoles = getCompatibleModuleRoles(module, getEffectiveJobKeys(session))
  if (!compatibleRoles.length) {
    return { type: 'denied', compatibleRoles: [], selectedRole: '' }
  }

  const selectedRole = resolveModuleContextRole(session, module)
  if (selectedRole) {
    return { type: 'direct', compatibleRoles, selectedRole }
  }

  return { type: 'choose', compatibleRoles, selectedRole: '' }
}

// Decisión de entrada SESSION-AWARE para el clic del home. Alinea el gate de
// entrada con la MISMA autoridad que decide la visibilidad de la tarjeta
// (navModel.isModuleVisibleForSession), evitando la incoherencia de que un
// módulo se muestre por tower_status pero su clic se autorice por x_job_key:
//   · sesión inválida  => denied (fail-closed).
//   · módulo towerGated => autoridad = tower_status AUTORITATIVO
//     (readAuthoritativeTowerStatus, allowlist dura), NO x_job_key. Entra sii
//     resuelve a un valor canónico; navega directo a module.route sin
//     role-context. TowerRoute sigue siendo el guard final de la ruta.
//   · resto            => delega en getModuleEntryDecision (rol/x_job_key),
//     sin cambios de comportamiento.
export function getModuleEntryDecisionForSession(module, session = {}) {
  if (!isValidAuthenticatedSession(session)) {
    return { type: 'denied', compatibleRoles: [], selectedRole: '' }
  }
  if (module?.towerGated) {
    const towerStatus = readAuthoritativeTowerStatus(session)
    if (!towerStatus) {
      return { type: 'denied', compatibleRoles: [], selectedRole: '' }
    }
    return { type: 'direct', compatibleRoles: [towerStatus], selectedRole: '' }
  }
  return getModuleEntryDecision(module, session)
}

export function upsertModuleRoleContext(contexts = {}, moduleId, role) {
  const normalizedRole = String(role || '').trim()
  const nextContexts = { ...(contexts || {}) }
  if (!moduleId) return nextContexts
  if (!normalizedRole) {
    delete nextContexts[moduleId]
    return nextContexts
  }
  nextContexts[moduleId] = normalizedRole
  return nextContexts
}
