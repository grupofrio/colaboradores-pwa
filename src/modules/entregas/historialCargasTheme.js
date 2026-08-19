import { TOKENS as DARK_TOKENS } from '../../tokens.js'
import { BRAND_TOKENS } from '../../theme/brandTokens.js'

export function getHistorialCargasTheme(isAdmin) {
  return isAdmin ? BRAND_TOKENS : DARK_TOKENS
}
