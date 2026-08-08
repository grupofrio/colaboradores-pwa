// ─── Reglas puras de la captura de gastos ───────────────────────────────────
// Vive aparte del componente para poder probarse sin DOM. Todo lo de aquí es
// espejo de lo que el backend valida: el cliente NO es la autoridad, solo evita
// que la capturista descubra el rechazo hasta después de llenar el formulario.

/** Fecha local (no UTC) en formato YYYY-MM-DD, zona de negocio MX. */
export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** Fecha mínima capturable: hoy menos `backdateDays`. */
export function minCaptureDate(backdateDays, today = businessToday()) {
  const days = Number.isFinite(Number(backdateDays)) ? Math.max(Number(backdateDays), 0) : 3
  const [y, m, d] = today.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() - days)
  return base.toISOString().slice(0, 10)
}

/**
 * Valida la fecha del gasto contra la cota.
 * @returns {string} mensaje de error, o '' si es válida.
 */
export function validateExpenseDate(date, backdateDays, today = businessToday()) {
  if (!date) return 'Selecciona la fecha del gasto.'
  if (date > today) return 'La fecha del gasto no puede ser futura.'
  const min = minCaptureDate(backdateDays, today)
  if (date < min) {
    const days = Number(backdateDays)
    return `La fecha no puede ser mayor a ${days} días hacia atrás. Para un gasto más antiguo, pídelo a tu gerente.`
  }
  return ''
}

const DEPOSIT_WORDS = ['deposito', 'retiro']

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Guard SUAVE de depósitos/retiros.
 *
 * Medido en producción el 2026-08-07: "DEPOSITO WALMART" por $10,010 está
 * capturado como gasto. No bloquea a propósito — hasta que exista la pantalla
 * de Depósitos (Fase 0.4 de Sebas), bloquear dejaría a la capturista sin ningún
 * lugar donde registrarlo.
 *
 * Match por PALABRA, no por substring: "deposito" no debe dispararse dentro de
 * otra palabra ni "retiro" dentro de "retirointernacional".
 */
export function looksLikeDeposit(text) {
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean)
  return words.some((word) => DEPOSIT_WORDS.includes(word))
}

/** Texto del chip de dimensiones: «Iguala · CEDIS · CC-COM-IGU-VENTAS». */
export function dimensionChips(dimensions) {
  if (!dimensions) return []
  return [
    dimensions.plaza && { key: 'plaza', label: 'Plaza', value: dimensions.plaza.code || dimensions.plaza.name },
    dimensions.un && { key: 'un', label: 'Unidad', value: dimensions.un.name || dimensions.un.code },
    dimensions.cc && { key: 'cc', label: 'Centro de costo', value: dimensions.cc.name || dimensions.cc.code },
  ].filter(Boolean)
}
