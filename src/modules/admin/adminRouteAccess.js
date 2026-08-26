// ─── Autorización por SUBRUTA de /admin ─────────────────────────────────────
// `/admin` estaba gateado UNA sola vez, en el elemento padre, con
// `moduleId="admin_sucursal"` — cuyos roles son auxiliar_admin, gerente_sucursal
// y direccion_general. Todas las subrutas colgaban de ahí, así que el filtro por
// rol de "Aprobar gastos", "Liquidaciones" y "Materia prima" existía SOLO en el
// menú: un auxiliar_admin que escribiera la URL a mano entraba igual.
//
// CLEAN-02: la política NO se duplica. Sale de `NAV_ITEMS` (misma fuente que
// AdminShell / AdminGerenteTab) y aplica el mismo clamp de piloto Gerente RO
// (`access` WRITE + capabilities) que el menú. Deep-link ≡ menú.
//
// Esto sigue siendo autorización de CLIENTE: no reemplaza la validación del
// backend, la complementa.
import { NAV_ITEMS } from './adminNavItems.js'
import {
  ADMIN_NAV_ACCESS,
  isGerentePilotReadOnly,
} from './gerentePilotCaps.js'
import { isCashShiftNavigationVisible, isTraspasoMpNavigationVisible } from '../../lib/navModel.js'

/** Ruta absoluta → roles autorizados, derivado de NAV_ITEMS. */
export const ADMIN_ROUTE_ROLES = Object.freeze(
  NAV_ITEMS.reduce((acc, item) => {
    acc[item.route] = Object.freeze([...item.roles])
    return acc
  }, {}),
)

/**
 * Rutas montadas bajo /admin que NO aparecen en NAV_ITEMS (detalle / flujos
 * internos). Declaradas explícitamente: fail-closed si falta política.
 */
const EXTRA_ROUTE_POLICY = Object.freeze({
  '/admin/ticket': Object.freeze({
    roles: Object.freeze(['auxiliar_admin', 'gerente_sucursal', 'direccion_general']),
    access: ADMIN_NAV_ACCESS.MIXED,
  }),
  '/admin/bolsas/validar': Object.freeze({
    roles: Object.freeze(['gerente_sucursal', 'direccion_general']),
    access: ADMIN_NAV_ACCESS.WRITE,
  }),
  '/admin/materiales/validar': Object.freeze({
    roles: Object.freeze(['gerente_sucursal', 'direccion_general']),
    access: ADMIN_NAV_ACCESS.WRITE,
  }),
  '/admin/materiales/resolver-rechazo': Object.freeze({
    roles: Object.freeze(['gerente_sucursal', 'direccion_general']),
    access: ADMIN_NAV_ACCESS.WRITE,
  }),
})

/** @deprecated prefer policyForRoute — kept for tests that assert role maps. */
export const EXTRA_ROUTE_ROLES = Object.freeze(
  Object.fromEntries(
    Object.entries(EXTRA_ROUTE_POLICY).map(([route, policy]) => [route, policy.roles]),
  ),
)

function policyForRoute(route) {
  const nav = NAV_ITEMS.find((item) => item.route === route)
  if (nav) {
    return {
      roles: nav.roles,
      access: nav.access || ADMIN_NAV_ACCESS.READ,
      navId: nav.id,
    }
  }
  const extra = EXTRA_ROUTE_POLICY[route]
  if (extra) {
    return {
      roles: extra.roles,
      access: extra.access,
      navId: null,
    }
  }
  return null
}

/**
 * ¿La sesión puede abrir esta subruta de /admin?
 * Fail-closed: sin roles, sin política, WRITE bajo piloto RO, o capability
 * denegada (p.ej. cortes de caja) → false.
 *
 * @param {string} route  ruta absoluta, p.ej. '/admin/liquidaciones'
 * @param {string[]} effectiveRoles  job keys efectivas de la sesión
 * @param {{ session?: object, capabilities?: object }} [ctx]
 */
export function adminRouteAllows(route, effectiveRoles = [], ctx = {}) {
  const policy = policyForRoute(String(route || ''))
  if (!policy) return false
  if (!Array.isArray(effectiveRoles) || effectiveRoles.length === 0) return false
  if (!effectiveRoles.some((role) => policy.roles.includes(role))) return false

  const session = ctx.session || null
  const capabilities = ctx.capabilities || {}

  // Paridad con AdminShell.navItemsForRoles: cierre solo si cash-shift visible.
  if (policy.navId === 'cierre' && !isCashShiftNavigationVisible(capabilities)) {
    return false
  }

  if (policy.navId === 'traspaso-mp' && !isTraspasoMpNavigationVisible(capabilities)) {
    return false
  }

  // Paridad con filterAdminNavForGerentePilot: WRITE oculto bajo piloto RO.
  if (session && isGerentePilotReadOnly(session, capabilities)) {
    if (policy.access === ADMIN_NAV_ACCESS.WRITE) return false
  }

  return true
}

/** Export for tests — inspect policy (roles + access) for a route. */
export function adminRoutePolicy(route) {
  return policyForRoute(String(route || ''))
}
