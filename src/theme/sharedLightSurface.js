import { isGerenteBrandSurface } from './gerenteBrandSurface.js'

const SHARED_LIGHT_SURFACE_ROLES = Object.freeze([
  'operador_rolito',
  'operador_barra',
  'auxiliar_produccion',
  'supervisor_produccion',
  'almacenista_pt',
  'almacenista_entregas',
  'jefe_ruta',
  'auxiliar_ruta',
  'favy_cedis',
])

/**
 * Shared Home/Nav light surface selector.
 * Keeps supervisor/gerente brand-light behavior and extends only the shared
 * surfaces that already opt into BRAND_TOKENS explicitly by primary role.
 */
export function isSharedLightSurfaceSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false
  if (isGerenteBrandSurface(session)) return true
  return SHARED_LIGHT_SURFACE_ROLES.includes(String(session?.role || '').trim())
}

export { SHARED_LIGHT_SURFACE_ROLES }
