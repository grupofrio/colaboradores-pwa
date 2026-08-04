// ─── Color de una parada en el mapa: por RESULTADO, no por visita ────────────
// Antes los dos mapas coloreaban por "¿le hizo check-in?": ámbar si estaba
// planeada, verde si había check-in. O sea que una parada donde el vendedor
// llegó y NO vendió se pintaba igual de verde que una venta. Para un supervisor
// que mira el mapa para saber dónde se está perdiendo la venta, eso es lo
// contrario de informar.
//
// Vive aquí, y no en cada mapa, porque el radar y el detalle de unidad tienen
// que pintar lo MISMO: dos paletas para el mismo hecho serían dos verdades.

export const RESULT_SOLD = 'sold'
export const RESULT_NO_SALE = 'no_sale'
export const RESULT_PENDING = 'pending'

// Valores crudos de `gf.route.stop.result_status`. Conviven dos familias en el
// payload (la del contrato y la de algunas rutas), igual que en la lista de
// paradas; se cubren las dos.
const SOLD_VALUES = new Set(['con_venta', 'delivered_full', 'delivered_partial'])
const NO_SALE_VALUES = new Set(['no_sale', 'no_venta'])

/**
 * Clasifica una parada. Un estado DESCONOCIDO cae en "pendiente", nunca en
 * "vendió": afirmar una venta que el backend no afirmó es la mentira cara.
 */
export function classifyStopResult(stop) {
  const raw = typeof stop?.result_status === 'string' ? stop.result_status.trim() : ''
  if (SOLD_VALUES.has(raw)) return RESULT_SOLD
  if (NO_SALE_VALUES.has(raw)) return RESULT_NO_SALE
  return RESULT_PENDING
}

// Contraste AA sobre el mapa claro: el relleno es sólido y el borde más oscuro,
// para que el punto se distinga también sobre calles y manzanas claras.
//
// EL COLOR NO PUEDE SER LO ÚNICO. Medido: el verde y el rojo que cumplen AA
// contra un mapa claro quedan en 1.10:1 ENTRE SÍ — en escala de grises son el
// mismo punto, y quien no distingue rojo de verde (≈8% de los hombres) no
// podría leer el mapa. La leyenda no lo resuelve, porque los puntos del mapa no
// llevan texto encima.
//
// Por eso cada resultado trae también FORMA: distinto radio y distinto trazo.
// "Vendió" es un disco lleno, "no venta" es un aro grueso punteado y
// "pendiente" es un punto pequeño. Se distinguen sin depender del color.
export const RESULT_STYLES = Object.freeze({
  [RESULT_SOLD]: {
    fill: '#166534', stroke: '#0b3a1d', label: 'Vendió',
    radius: 7, weight: 2, dashArray: null, fillOpacity: 0.95,
  },
  [RESULT_NO_SALE]: {
    fill: '#b91c1c', stroke: '#6d1010', label: 'No venta',
    radius: 9, weight: 3, dashArray: '4 3', fillOpacity: 0.35,
  },
  [RESULT_PENDING]: {
    fill: '#5B7285', stroke: '#33434f', label: 'Pendiente',
    radius: 5, weight: 1.5, dashArray: null, fillOpacity: 0.8,
  },
})

/** Opciones de trazo de Leaflet para una parada, forma incluida. */
export function pathOptionsForStop(stop) {
  const s = styleForStop(stop)
  return {
    color: s.stroke, fillColor: s.fill, fillOpacity: s.fillOpacity,
    weight: s.weight, dashArray: s.dashArray || undefined,
  }
}

// La posición PLANEADA se conserva como referencia tenue: sin ella no se puede
// ver el desvío entre dónde debía estar el cliente y dónde se hizo el check-in.
export const PLANNED_STYLE = Object.freeze({
  fill: 'rgba(0,119,187,0.12)',
  stroke: 'rgba(0,119,187,0.45)',
  label: 'Posición planeada',
  radius: 6, weight: 1.5, dashArray: '3 3', fillOpacity: 1,
})

export function styleForStop(stop) {
  return RESULT_STYLES[classifyStopResult(stop)]
}

/**
 * Leyenda del mapa. Va con PALABRA, no solo color: se lee bajo el sol y hay
 * quien no distingue rojo de verde.
 */
export const RESULT_LEGEND = Object.freeze([
  { key: RESULT_SOLD, ...RESULT_STYLES[RESULT_SOLD] },
  { key: RESULT_NO_SALE, ...RESULT_STYLES[RESULT_NO_SALE] },
  { key: RESULT_PENDING, ...RESULT_STYLES[RESULT_PENDING] },
  { key: 'planned', ...PLANNED_STYLE },
])

/** Kind del punto de mapa que consume el radar (`stop_sold`, …). */
export function stopKind(stop) {
  return `stop_${classifyStopResult(stop)}`
}

export const STOP_KINDS = Object.freeze([
  'stop_sold', 'stop_no_sale', 'stop_pending', 'stop_planned',
])

// ─── Zona (polígono) de la ruta ──────────────────────────────────────────────
// El backend entrega GeoJSON, que usa [lon, lat]. Leaflet usa [lat, lng]. NO
// voltearlo dejaría el polígono de Guerrero en medio del océano Índico.

function ring(coords) {
  return coords
    .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map((c) => [c[1], c[0]])
}

/**
 * Convierte la geometría del contrato a lo que espera `<Polygon positions>`.
 * Devuelve `null` cuando no hay zona utilizable: si el plan no tiene polígono
 * NO se dibuja nada. Un cuadro inventado se leería como que la unidad se salió
 * de su zona, que es justo lo que el supervisor mira aquí.
 */
export function zoneToLeafletPositions(zone) {
  const geom = zone?.geometry
  const coords = geom?.coordinates
  if (!Array.isArray(coords) || coords.length === 0) return null

  let rings = []
  if (geom.type === 'Polygon') {
    rings = coords.map(ring)
  } else if (geom.type === 'MultiPolygon') {
    rings = coords.flatMap((poly) => (Array.isArray(poly) ? poly.map(ring) : []))
  } else {
    return null
  }
  // Un anillo de menos de 3 puntos no encierra área: no es una zona.
  rings = rings.filter((r) => r.length >= 3)
  return rings.length ? rings : null
}

/** Color del borde de la zona. Sin color propio, el azul de marca. */
export function zoneColor(zone) {
  const raw = typeof zone?.color === 'string' ? zone.color.trim() : ''
  return /^#[0-9A-Fa-f]{3,8}$/.test(raw) ? raw : '#0077BB'
}

/** Texto de la zona para la leyenda: "Iguala SUR B (subpolígono)". */
export function zoneLabel(zone) {
  if (!zone?.name) return ''
  const nivel = zone.level === 'subpolygon' ? 'subpolígono' : 'polígono'
  return `${zone.name} (${nivel})`
}
