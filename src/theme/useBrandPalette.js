// ─── useBrandPalette / isBrandLightSession ───────────────────────────────────
// Decide si una sesión ve la identidad CLARA (institucional Grupo Frío) o el
// tema oscuro de siempre. Un solo lugar para esa pregunta, para que no se
// disperse en cada pantalla.
//
// Regla: SOLO `supervisor_ventas` (rol efectivo: principal o adicional). Todos
// los demás roles siguen exactamente igual que hoy.
//
// Módulo PURO en su parte decisoria (isBrandLightSession) para poder testearse
// sin React.
import { hasEffectiveRole } from '../lib/effectiveRoles.js'
import { BRAND_LIGHT, BRAND_LIGHT_ROLE } from './brandLight.js'

/** ¿esta sesión ve la identidad clara? Fail-closed: cualquier duda ⇒ oscuro. */
export function isBrandLightSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false
  return hasEffectiveRole(session, BRAND_LIGHT_ROLE)
}

/**
 * Paleta que debe usar una pantalla compartida.
 * @param {object} session
 * @param {object} darkColors  paleta oscura (normalmente TOKENS.colors)
 * @returns {{light: boolean, c: object}}
 */
export function resolvePalette(session, darkColors) {
  const light = isBrandLightSession(session)
  return { light, c: light ? BRAND_LIGHT : darkColors }
}
