// compressorStatus.js — presentacion del estado de compresor y aceite.
//
// Modulo puro: devuelve TONOS semanticos, no colores. El mapeo a TOKENS vive
// en el JSX, para que estas reglas se puedan probar sin cargar el tema.
//
// Reglas de honestidad:
//   - `unknown` NO es `off`. Si nadie registro nada, se dice "Sin registro".
//   - las alertas de aceite las decide el backend (`oil.alert`); aqui solo se
//     mapea a un tono y se muestra `oil.message` tal cual.

const STATE_LABELS = {
  on: { label: 'Encendido', tone: 'on' },
  off: { label: 'Apagado', tone: 'off' },
  unknown: { label: 'Sin registro', tone: 'unknown' },
}

export function stateLabel(state) {
  return STATE_LABELS[state] || STATE_LABELS.unknown
}

const OIL_ALERT_TONES = {
  nivel_bajo: 'error',
  sin_lectura: 'warning',
  lectura_vencida: 'warning',
}

/** @returns {{tone:'error'|'warning'}|null} */
export function oilAlertTone(alert) {
  if (!alert) return null
  return { tone: OIL_ALERT_TONES[alert] || 'warning' }
}

/**
 * "hace 3 h", "hace 12 min", "ayer 22:40".
 * Odoo entrega datetimes naive en UTC ("YYYY-MM-DD HH:MM:SS").
 */
export function formatRelative(value) {
  const date = parseOdooDatetime(value)
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return formatClock(date)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return `ayer ${formatClock(date)}`
  if (days < 7) return `hace ${days} dias`
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

export function parseOdooDatetime(value) {
  if (!value) return null
  const raw = String(value)
  // Naive de Odoo => UTC explicito. Con offset propio, se respeta.
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
    ? raw.replace(' ', 'T')
    : `${raw.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatClock(date) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
