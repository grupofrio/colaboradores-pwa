// Odoo devuelve datetimes naive en UTC ("2026-08-20 13:18:09", sin 'Z' ni
// offset). Si se pasan directo a `new Date(...)`, el navegador los interpreta
// en su propia zona local y la hora mostrada queda desfasada (el bug que
// reportaron en Energia: una foto "subida a la 1:18" cuando en planta aun no
// eran esa hora). Se fuerza UTC (`+ 'Z'`) y se formatea en la zona de planta;
// todas las plantas activas (Iguala, CDMX, GDL) comparten America/Mexico_City.
export function parseOdooUtc(raw) {
  if (!raw) return null
  const d = new Date(String(raw).replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatOdooDateTime(raw, options = {}) {
  const d = parseOdooUtc(raw)
  if (!d) return raw ? String(raw) : ''
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
    ...options,
  })
}

export function formatOdooTime(raw, options = {}) {
  const d = parseOdooUtc(raw)
  if (!d) return raw ? String(raw) : ''
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
    ...options,
  })
}
