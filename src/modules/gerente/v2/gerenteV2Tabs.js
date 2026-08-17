// ─── Gerente V2 · definición de las 6 pestañas (sin JSX) ─────────────────────
// En .js (no .jsx) para que el shell Y los tests la importen sin un loader de
// JSX. `route` es la ruta canónica de cada pestaña de "Mi Sucursal".
// Fase 3 añade "Controles" como 7ª pestaña. El rail hace scroll horizontal
// cuando no caben las 7 (por eso NO hay barra inferior propia: la lección del
// #147). Controles va antes de "Más" para que la detección de malos manejos
// quede a la vista, no escondida.
export const GERENTE_V2_TABS = Object.freeze([
  { key: 'hoy', label: 'Hoy', route: '/gerente', glyph: '◉' },
  { key: 'equipo', label: 'Equipo', route: '/gerente/equipo', glyph: '⚇' },
  { key: 'admin', label: 'Admin', route: '/gerente/admin', glyph: '▤' },
  { key: 'produccion', label: 'Producción', route: '/gerente/produccion', glyph: '⚙' },
  { key: 'inventario', label: 'Inventario', route: '/gerente/inventario', glyph: '▦' },
  { key: 'controles', label: 'Controles', route: '/gerente/controles', glyph: '⚐' },
  { key: 'mas', label: 'Más', route: '/gerente/mas', glyph: '⋯' },
])
