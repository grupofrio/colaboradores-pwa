// ─── Supervisor V2 · proyección de mapa (PURA, sin React) ─────────────────────
// Bounding-box + proyección equirectangular lat/long → viewBox. Sin dependencias.
// Validación estricta de coordenadas ANTES de proyectar (Codex P12): finito, en
// rango geográfico, sin NaN/Infinity; bounding box degenerado, unidad única y
// anti-meridiano manejados. Separado de PositionMap.jsx para testabilidad.
export const PAD = 0.12 // margen relativo alrededor del bounding box
const MIN_SPAN = 0.0015 // ~150 m; evita división por cero y zoom infinito

export function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v) }

/** Coordenada geográfica válida: número finito EN RANGO. Rechaza NaN/Infinity y
 *  valores fuera de [-90,90] / [-180,180]. (0,0) es técnicamente válido pero es
 *  "isla nula" — el llamador decide su política; aquí solo validamos rango. */
export function isValidLat(v) { return isFiniteNum(v) && v >= -90 && v <= 90 }
export function isValidLng(v) { return isFiniteNum(v) && v >= -180 && v <= 180 }
export function isValidLatLng(p) { return !!p && isValidLat(p.lat) && isValidLng(p.lng) }

/** Filtra a puntos geográficamente válidos (para no proyectar basura). */
export function validPoints(points) {
  return (points || []).filter(isValidLatLng)
}

export function computeBounds(points) {
  const valid = validPoints(points)
  if (valid.length === 0) return null
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const p of valid) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng)
  }
  // Anti-meridiano: si el span longitudinal es enorme (>180) es casi seguro un
  // cruce de la línea de fecha (p.ej. +179 y −179). Sin re-proyección compleja
  // en V1: se marca degenerado para que la UI prefiera la LISTA (no dibujar un
  // mapa engañoso que estire el mundo). Se declara, no se inventa cartografía.
  const rawLngSpan = maxLng - minLng
  const antimeridian = rawLngSpan > 180
  // Punto único o coincidentes ⇒ span mínimo (bbox no degenerado).
  const latSpan = Math.max(maxLat - minLat, MIN_SPAN)
  const lngSpan = Math.max(rawLngSpan, MIN_SPAN)
  return {
    minLat: minLat - latSpan * PAD, maxLat: maxLat + latSpan * PAD,
    minLng: minLng - lngSpan * PAD, maxLng: maxLng + lngSpan * PAD,
    antimeridian,
    count: valid.length,
  }
}

export function project(lat, lng, bounds, w, h) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * w
  const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * h // norte arriba
  return { x, y }
}
