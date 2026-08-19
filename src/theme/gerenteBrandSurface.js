// Pure helpers for Gerente V2 presentation surfaces that reuse Admin / Brief
// components without adopting the dark Admin shell.

import { isGerenteSucursalPilotSession } from '../modules/admin/gerentePilotCaps.js'
import { isBrandLightSession } from './useBrandPalette.js'

/**
 * Brand-light container for Gerente (and supervisor ventas) shared screens.
 * Fail-closed: only pure gerente_sucursal pilot or brand-light roles.
 */
export function isGerenteBrandSurface(session) {
  return isBrandLightSession(session) || isGerenteSucursalPilotSession(session)
}
