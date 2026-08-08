// ─── Supervisor V2 · Integridad de ejecución (modelo PURO) ───────────────────
// Traduce el contrato de /pwa-supv/execution-integrity a lo que se pinta. Sin
// window, sin fetch, sin React ⇒ testeable con `node --test`.
//
// REGLA CENTRAL (viene del backend y aquí NO se rompe): los dos porcentajes se
// leen SIEMPRE en pareja.
//   · pct_verificadas   → qué tan bien sale lo que SÍ se puede juzgar
//   · pct_con_evidencia → cuánto del trabajo dejó rastro para poder juzgarlo
// Publicar el primero solo premiaría a quien deja de generar evidencia: un 100%
// sobre 3 de 40 visitas no dice que la ruta esté bien, dice que no sabemos. Por
// eso `sin_evidencia` es un tono propio y la vista nunca lo pinta en verde.
//
// null ≠ 0: sin base no hay porcentaje. Se muestra "—", jamás "0%".

// El veredicto lo emite el SERVIDOR (`tone`/`tone_word`). Aquí solo se traduce a
// color. Recalcular el semáforo en el cliente abriría dos verdades distintas.
export const TONE_KEY = {
  ok: 'ok',
  watch: 'watch',
  bad: 'bad',
  sin_evidencia: 'blind',
  none: 'none',
}

export const REASON_LABEL = {
  sin_identidad: 'sin cliente ni prospecto',
  sin_checkin: 'sin check-in',
  sin_duracion: 'sin duración medida',
}

/** Desenvuelve la respuesta (el shim puede entregar el payload directo o dentro
 *  de `.data`). Devuelve null si no trae la forma esperada. */
export function unwrapIntegrity(res) {
  if (!res || typeof res !== 'object') return null
  const d = Array.isArray(res.sellers) ? res : (res.data || null)
  if (!d || typeof d !== 'object') return null
  if (typeof d.available !== 'boolean') return null
  return d
}

/** ¿El backend puede responder esta pregunta? Cuando dice que no, se declara el
 *  motivo en vez de pintar una vista vacía que se leería como "todo bien". */
export function unavailableReason(payload) {
  if (!payload) return 'RESPUESTA_SIN_INTEGRIDAD'
  if (payload.available === false) return String(payload.reason || 'no_disponible')
  return null
}

export function integrityRows(payload) {
  const rows = payload && Array.isArray(payload.sellers) ? payload.sellers : []
  // El ORDEN lo fija el servidor (primero la ceguera, luego lo peor verificado).
  // Reordenar aquí por "más banderas" castigaría a quien sí genera evidencia.
  return rows
}

/** Porcentaje legible. `null`/ausente ⇒ "—" (no hay base, no es cero). */
export function pctLabel(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n}%`
}

export function toneKey(row) {
  return TONE_KEY[row && row.tone] || 'none'
}

export function toneWord(row) {
  // La palabra viene del servidor; el color solo nunca basta (AA + daltonismo).
  return (row && row.tone_word) || 'Sin visitas'
}

/** Frase que ancla el porcentaje a su base real. Sin esto, "100%" flota. */
export function evidenceCaption(row) {
  const visitas = Number(row && row.visitas) || 0
  const evaluables = Number(row && row.evaluables) || 0
  if (!visitas) return 'Sin visitas terminadas en el periodo.'
  return `${evaluables} de ${visitas} visitas terminadas dejaron rastro suficiente para juzgarlas.`
}

/** Aviso explícito cuando la base es tan chica que el veredicto no representa la
 *  ruta. Es el antídoto contra aplaudir un 100% de casi nada. */
export function blindWarning(row) {
  if (toneKey(row) !== 'blind') return null
  return 'Menos de la mitad del trabajo dejó rastro: lo que sabemos no representa la ruta.'
}

/** Motivos de "no verificable" con conteo, ordenados de mayor a menor y sin los
 *  que están en cero. Es lo accionable: dice QUÉ pedirle al vendedor. */
export function blindReasons(row) {
  const raw = (row && row.motivos_no_verificable) || {}
  const out = []
  for (const key of Object.keys(REASON_LABEL)) {
    const n = Number(raw[key]) || 0
    if (n > 0) out.push({ key, label: REASON_LABEL[key], count: n })
  }
  out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  return out
}

/** Texto de los umbrales tal como los declara el servidor. No se hardcodean
 *  aquí: si dirección los mueve, la pantalla debe seguirlos sola. */
export function thresholdsCaption(payload) {
  const t = (payload && payload.thresholds) || {}
  const dist = Number(t.max_checkin_distance_m)
  const dur = Number(t.min_visit_duration_min)
  if (!Number.isFinite(dist) || !Number.isFinite(dur)) return null
  return `Verificada = tiene cliente o prospecto, check-in a ${dist} m o menos y al menos ${dur} minuto de visita.`
}

export function periodCaption(payload) {
  const p = (payload && payload.period) || {}
  if (!p.date_from || !p.date_to) return null
  if (p.date_from === p.date_to) return `Día ${p.date_from}`
  return `Del ${p.date_from} al ${p.date_to}`
}
