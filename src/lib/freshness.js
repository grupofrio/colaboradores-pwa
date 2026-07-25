// ─── Frescura del dato — lógica PURA y testeable (Etapa 0A) ──────────────────
// En 0A la UI es DESCRIPTIVA y NEUTRAL: solo edad ("Datos medidos hace N horas").
// El estado evaluativo (vigente/atrasado) requiere una cadencia APROBADA y trazable
// (ver docs/redesign/FRESHNESS_POLICY_PROPOSAL.md); sin ella, level = 'neutral'.
// Jamás se reutiliza el rojo de riesgo de negocio para frescura.

/** Convierte un ISO a epoch ms; null si no es parseable. */
export function parseAsOfMs(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/** Edad legible desde ms. Devuelve {text, minutes} o null si entradas inválidas. */
export function describeAge(asOfMs, nowMs) {
  if (!Number.isFinite(asOfMs) || !Number.isFinite(nowMs)) return null
  const diff = nowMs - asOfMs
  if (diff < 60000) return { text: 'medidos hace instantes', minutes: Math.max(0, Math.floor(diff / 60000)) }
  const min = Math.floor(diff / 60000)
  if (min < 60) return { text: `medidos hace ${min} min`, minutes: min }
  const h = Math.floor(min / 60)
  if (h < 48) return { text: `medidos hace ${h} h`, minutes: min }
  const d = Math.floor(h / 24)
  return { text: `medidos hace ${d} días`, minutes: min }
}

/**
 * Vista de frescura para la UI. En 0A solo produce `neutral` (descriptivo).
 * @param {object} args {dataAsOf, cadence, staleAfterHours, nowMs}
 * @returns {{level:'neutral'|'stale'|'unknown', label, minutes|null, evaluative:boolean}}
 */
export function freshnessView({ dataAsOf, staleAfterHours = null, nowMs } = {}) {
  const asOf = parseAsOfMs(dataAsOf)
  const now = Number.isFinite(nowMs) ? nowMs : Date.now()
  if (asOf === null) return { level: 'unknown', label: 'corte no informado', minutes: null, evaluative: false }
  const age = describeAge(asOf, now)
  const label = `Datos ${age.text}`
  // Estado evaluativo SOLO si hay una política (staleAfterHours) aprobada. En 0A
  // ningún módulo la trae ⇒ siempre 'neutral' (descriptivo).
  if (Number.isFinite(staleAfterHours) && staleAfterHours > 0) {
    const stale = age.minutes > staleAfterHours * 60
    return { level: stale ? 'stale' : 'neutral', label, minutes: age.minutes, evaluative: true }
  }
  return { level: 'neutral', label, minutes: age.minutes, evaluative: false }
}
