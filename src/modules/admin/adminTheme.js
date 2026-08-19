// El hack de `filter: invert(1) hue-rotate(180deg)` (para simular tema claro
// sobre TOKENS oscuro) se retiró: ahora las pantallas de Admin Sucursal ya
// pintan con BRAND_TOKENS (paleta clara real, ver AdminShell.jsx). Aplicar el
// filtro encima invertía colores ya claros — esa doble inversión era la causa
// del bug de texto ilegible reportado en Admin Sucursal.
export const ADMIN_THEME_SCOPE_STYLE = Object.freeze({
  minHeight: '100dvh',
  background: '#F0F9FF',
})

export function getAdminThemeScopeStyle(overrides = {}) {
  return {
    ...ADMIN_THEME_SCOPE_STYLE,
    ...overrides,
  }
}
