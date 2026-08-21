import { TOKENS as DARK_TOKENS } from '../../tokens.js'
import { BRAND_TOKENS } from '../../theme/brandTokens.js'

export function getHistorialCargasTheme({ isAdmin = false, isLightSurface = false } = {}) {
  return (isAdmin || isLightSurface) ? BRAND_TOKENS : DARK_TOKENS
}
