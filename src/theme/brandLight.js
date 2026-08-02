// ─── Paleta institucional "claro Grupo Frío" ─────────────────────────────────
// Fuente de verdad: grupofrio/clientes-tradicional-kolders (docs/rebranding-pr2.md
// + src/app/globals.css), verificada contra grupofrio.mx. Se copia tal cual para
// que las dos PWAs se vean como el mismo producto.
//
// ALCANCE: SOLO la superficie de `supervisor_ventas`. El tema oscuro global de
// `src/tokens.js` NO se toca — el resto de los roles (producción, almacén,
// entregas, admin, torres) conserva su aspecto. Ver useBrandPalette().

export const BRAND_LIGHT = Object.freeze({
  // Institucionales
  primary: '#0077BB',
  ice: '#00B8D4',
  headerFrom: '#005A8D',
  headerTo: '#00B8D4',

  // Superficie
  bg: '#F0F9FF',
  surface: '#FFFFFF',
  surfaceSoft: '#F7FCFF',
  border: '#DBEFF9',

  // Texto
  text: '#0F2A3D',
  textMuted: '#5B7285',
  textLow: '#5B7285',
  onPrimary: '#FFFFFF',

  // Semáforo (se conserva el significado del tema oscuro, en versión clara)
  success: '#0F9D58',
  warning: '#B26A00',
  error: '#C5303B',
})

export const BRAND_HEADER_GRADIENT =
  `linear-gradient(135deg, ${BRAND_LIGHT.headerFrom} 0%, ${BRAND_LIGHT.headerTo} 100%)`

// Assets oficiales (Odoo res.company 34, los mismos de grupofrio.mx).
// Copiados desde el repo de clientes; NO se redibujan ni se recolorean.
export const BRAND_LOGO = '/brand/grupo-frio-logo.png'
export const BRAND_LOGO_MARK = '/brand/grupo-frio-logo-mark.png'

/** El rol al que se le aplica la identidad clara. Uno solo, a propósito. */
export const BRAND_LIGHT_ROLE = 'supervisor_ventas'
