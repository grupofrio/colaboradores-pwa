// ─── Supervisor V2 · proyección de mapa (PURA, sin React) ─────────────────────
// Bounding-box + proyección equirectangular lat/long → viewBox. Sin dependencias.
// Separado de PositionMap.jsx para testabilidad y para que el .jsx solo exporte
// el componente (regla react-refresh).
export const PAD = 0.12 // margen relativo alrededor del bounding box

export function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v) }

export function computeBounds(points) {
  const valid = (points || []).filter((p) => isFiniteNum(p.lat) && isFiniteNum(p.lng))
  if (valid.length === 0) return null
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const p of valid) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng)
  }
  const latSpan = Math.max(maxLat - minLat, 0.001)
  const lngSpan = Math.max(maxLng - minLng, 0.001)
  return {
    minLat: minLat - latSpan * PAD, maxLat: maxLat + latSpan * PAD,
    minLng: minLng - lngSpan * PAD, maxLng: maxLng + lngSpan * PAD,
  }
}

export function project(lat, lng, bounds, w, h) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * w
  const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * h // norte arriba
  return { x, y }
}
