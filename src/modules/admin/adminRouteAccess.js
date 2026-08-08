// ─── Autorización por SUBRUTA de /admin ─────────────────────────────────────
// `/admin` estaba gateado UNA sola vez, en el elemento padre, con
// `moduleId="admin_sucursal"` — cuyos roles son auxiliar_admin, gerente_sucursal
// y direccion_general. Todas las subrutas colgaban de ahí, así que el filtro por
// rol de "Aprobar gastos", "Liquidaciones" y "Materia prima" existía SOLO en el
// menú: un auxiliar_admin que escribiera la URL a mano entraba igual.
//
// La lista de roles por ruta no se duplica: se deriva de `NAV_ITEMS`, que ya es
// la fuente que pinta el menú. Así el menú y la URL no pueden discrepar — que es
// exactamente como se abrió este hueco.
//
// Esto sigue siendo autorización de CLIENTE: no reemplaza la validación del
// backend, la complementa. Las rutas restringidas apuntan a endpoints que ya
// validan rol server-side; lo que se cierra aquí es que la pantalla se pinte.
import { NAV_ITEMS } from './adminNavItems.js'

/** Ruta absoluta → roles autorizados, derivado de NAV_ITEMS. */
export const ADMIN_ROUTE_ROLES = Object.freeze(
  NAV_ITEMS.reduce((acc, item) => {
    acc[item.route] = Object.freeze([...item.roles])
    return acc
  }, {}),
)

/**
 * Rutas montadas bajo /admin que NO aparecen en NAV_ITEMS (pantallas de detalle
 * o flujos internos). Se declaran explícitamente para que ninguna quede sin
 * política por olvido: el default de `adminRouteAllows` es fail-closed, así que
 * una ruta nueva sin entrada aquí se bloquea hasta que alguien decida sus roles.
 */
const EXTRA_ROUTE_ROLES = Object.freeze({
  '/admin/ticket': ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'],
  '/admin/bolsas/validar': ['gerente_sucursal', 'direccion_general'],
  '/admin/materiales/validar': ['gerente_sucursal', 'direccion_general'],
  '/admin/materiales/resolver-rechazo': ['gerente_sucursal', 'direccion_general'],
})

function rolesForRoute(route) {
  if (ADMIN_ROUTE_ROLES[route]) return ADMIN_ROUTE_ROLES[route]
  if (EXTRA_ROUTE_ROLES[route]) return EXTRA_ROUTE_ROLES[route]
  return null
}

/**
 * ¿Los roles efectivos de la sesión pueden abrir esta subruta de /admin?
 * Fail-closed: sin roles, o sin política declarada para la ruta, no entra.
 *
 * @param {string} route  ruta absoluta, p.ej. '/admin/liquidaciones'
 * @param {string[]} effectiveRoles  job keys efectivas de la sesión
 */
export function adminRouteAllows(route, effectiveRoles = []) {
  const allowed = rolesForRoute(String(route || ''))
  if (!allowed) return false
  if (!Array.isArray(effectiveRoles) || effectiveRoles.length === 0) return false
  return effectiveRoles.some((role) => allowed.includes(role))
}
