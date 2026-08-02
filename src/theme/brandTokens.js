// ─── BRAND_TOKENS — el tema CLARO con la MISMA forma que TOKENS ──────────────
// Espejo exacto de `src/tokens.js` (colors · radius · shadow · glass · motion ·
// state · freshness) con la paleta institucional Grupo Frío verificada contra
// grupofrio.mx. Misma forma ⇒ una pantalla cambia de tema cambiando de DÓNDE
// importa sus tokens, sin reescribir un solo estilo.
//
// POR QUÉ NO UN HOOK: las pantallas declaran `const C = TOKENS.colors` a nivel
// de MÓDULO y sus helpers (Card/Chip/Title) cierran sobre esa constante. Un hook
// no puede ejecutarse ahí. Y no hace falta: la superficie V2 y dayControl solo
// se montan bajo rutas `moduleId="supervisor_ventas"` (App.jsx), así que ningún
// otro rol puede renderizar estos archivos.
//
// Esa exclusividad es un INVARIANTE, no una suposición: `tests/brandTokensScope
// .test.mjs` falla si un archivo que importa BRAND_TOKENS se monta fuera de una
// ruta de supervisión. Si algún día una de estas vistas se comparte con otro
// rol, el test truena antes que el usuario vea texto claro sobre claro.
//
// El tema oscuro global (`src/tokens.js`) NO se toca: el resto de los roles
// sigue exactamente igual.
//
// Mapa oscuro → claro (autorizado por Yamil, PR2 del rebranding):
//   bg0/bg1/bg2                → página #F0F9FF · tarjetas #FFFFFF · acentos #E0F3FC/#C9EBF8
//   superficies glass          → blanco con borde #DBEFF9 y sombra suave
//   bordes                     → #DBEFF9 · borderBlue → rgba(0,119,187,0.18)
//   blue/blue2/blue3           → #0077BB / #00B8D4 / #005A8D
//   text/textSoft/muted/low    → #0F2A3D / #0F2A3D / #5B7285 / #5B7285
//   semáforo                   → misma SEMÁNTICA, tonos legibles sobre claro

export const BRAND_TOKENS = {
  colors: {
    // Fondos
    bg0: '#F0F9FF',
    bg1: '#F0F9FF',
    bg2: '#E0F3FC',
    // Superficies (antes "glass"): tarjeta blanca sólida
    surface:       '#FFFFFF',
    surfaceSoft:   '#F7FCFF',
    surfaceStrong: '#E0F3FC',
    // Fondo de la navegación global
    navBg:     'rgba(255,255,255,0.96)',
    // Bordes
    border:     '#DBEFF9',
    borderBlue: 'rgba(0,119,187,0.18)',
    // Azules corporativos
    blue:     '#0077BB',
    blue2:    '#00B8D4',
    blue3:    '#005A8D',
    blueGlow: 'rgba(0,119,187,0.12)',
    // Texto (contraste AA sobre #FFFFFF y #F0F9FF)
    text:      '#0F2A3D',
    textSoft:  '#0F2A3D',
    textMuted: '#5B7285',
    textLow:   '#5B7285',
    // Semáforo — misma semántica, tonos legibles sobre claro.
    // OJO: el mapa autorizado proponía #16a34a / #d97706 / #dc2626, pero como
    // TEXTO sobre blanco dan 3.30:1, 3.94:1 y 4.83:1 — los dos primeros no
    // llegan al AA que el mismo encargo exige. Se bajan un escalón de luminancia
    // conservando el matiz. El test de contraste lo verifica y truena si alguien
    // los vuelve a aclarar. Como RELLENO de gráfico (puntos del mapa) sí se usan
    // los tonos originales: ahí el mínimo es 3:1 y llevan contorno oscuro.
    success:     '#166534',
    successSoft: 'rgba(22,101,52,0.10)',
    warning:     '#b45309',
    warningSoft: 'rgba(180,83,9,0.10)',
    error:       '#b91c1c',
    errorSoft:   'rgba(185,28,28,0.10)',
  },

  // Geometría y movimiento son idénticos al tema oscuro: el rebranding es de
  // color, no de forma. Se replican para que BRAND_TOKENS sea intercambiable.
  radius: {
    sm:   14,
    md:   18,
    lg:   22,
    xl:   24,
    pill: 999,
  },

  shadow: {
    soft:  '0 1px 2px rgba(15,42,61,0.06)',
    md:    '0 2px 8px rgba(15,42,61,0.08)',
    lg:    '0 8px 24px rgba(15,42,61,0.10)',
    blue:  '0 0 0 1px rgba(0,119,187,0.10)',
    inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
  },

  glass: {
    panel:     '#FFFFFF',
    panelSoft: '#F7FCFF',
    hero:      'linear-gradient(135deg, #005A8D 0%, #00B8D4 100%)',
  },

  motion: {
    fast:   '180ms ease',
    normal: '280ms ease',
    spring: '380ms cubic-bezier(0.34,1.56,0.64,1)',
  },

  // Canal semántico de ESTADOS: se conserva glyph y palabra (la distinción NO
  // es solo color); cambian fg/bg/border para ser legibles sobre claro.
  state: {
    info:          { fg: '#5B7285', bg: 'transparent',            border: 'transparent',            glyph: '·', word: 'Información' },
    signal:        { fg: '#0077BB', bg: 'rgba(0,119,187,0.08)',   border: 'rgba(0,119,187,0.30)',   glyph: '◈', word: 'Señal', dashed: true },
    risk:          { fg: '#b45309', bg: 'rgba(217,119,6,0.10)',   border: 'rgba(217,119,6,0.34)',   glyph: '⚠', word: 'Riesgo' },
    incumplimiento:{ fg: '#b91c1c', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.36)',   glyph: '⛔', word: 'Incumplimiento' },
    no_evaluable:  { fg: '#5B7285', bg: 'rgba(15,42,61,0.03)',    border: 'rgba(15,42,61,0.14)',    glyph: '▢', word: 'No evaluable' },
  },

  // Canal de FRESCURA: reloj/neutro, nunca el rojo de riesgo de negocio.
  freshness: {
    neutral: { fg: '#005A8D', bg: 'rgba(0,119,187,0.07)',  border: 'rgba(0,119,187,0.20)', glyph: '🕑' },
    stale:   { fg: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.28)', glyph: '🕑' },
  },
}

export default BRAND_TOKENS
