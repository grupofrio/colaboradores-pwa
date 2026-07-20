// ─── Supervisor V2 · normalizador ÚNICO de respuestas Odoo (Codex §4) ─────────
// Contrato interno único para TODAS las respuestas V2. Reconoce las DOS formas
// reales que produce odooJson:
//   · Envelope de servicio (secure-writes / DTO reads): {status:'ok'|'error'|
//     'busy', code, user_message, data, meta} (services/response.ok/err).
//   · Payload crudo (day-control / radar): {ok:true|false, contract, ...}.
// Devuelve SIEMPRE {phase, data, code, message, partial, source, dataAsOf}.
// Prohibido fuera de aquí: comprobar res.ok / raw.status / result.result sueltos.
export const PHASE = Object.freeze({
  OK: 'ok', EMPTY: 'empty', PARTIAL: 'partial',
  DATE_NOT_ALLOWED: 'date_not_allowed', UNAUTHORIZED: 'unauthorized',
  FEATURE_DISABLED: 'feature_disabled', NOT_FOUND: 'not_found',
  CONFLICT: 'conflict', VALIDATION: 'validation', CAPABILITY_UNAVAILABLE: 'capability_unavailable',
  NETWORK: 'network', MALFORMED: 'malformed', ERROR: 'error',
})

// Mapea un code de negocio (envelope o payload) a una fase del contrato.
function phaseForCode(code) {
  const c = String(code || '').toUpperCase()
  if (c === 'DATE_NOT_ALLOWED') return PHASE.DATE_NOT_ALLOWED
  if (c === 'UNAUTHORIZED' || c === 'FORBIDDEN') return PHASE.UNAUTHORIZED
  if (c === 'FEATURE_DISABLED') return PHASE.FEATURE_DISABLED
  if (c === 'CAPABILITY_UNAVAILABLE' || c === 'NOT_IMPLEMENTED') return PHASE.CAPABILITY_UNAVAILABLE
  if (c === 'NOT_FOUND') return PHASE.NOT_FOUND
  if (c === 'CONFLICT' || c === 'LOCKED') return PHASE.CONFLICT
  if (c === 'VALIDATION_ERROR' || c === 'CONFIRM_REQUIRED') return PHASE.VALIDATION
  return PHASE.ERROR
}

function phaseForError(e) {
  const code = String(e?.code || e?.status || '').toUpperCase()
  const msg = String(e?.message || e || '')
  if (code === 'DATE_NOT_ALLOWED' || /DATE_NOT_ALLOWED/i.test(msg)) return PHASE.DATE_NOT_ALLOWED
  if (['401', '403', 'FORBIDDEN', 'UNAUTHORIZED'].includes(code)) return PHASE.UNAUTHORIZED
  if (code === '404' || code === 'NOT_FOUND') return PHASE.NOT_FOUND
  if (code === '409' || code === 'CONFLICT' || code === 'LOCKED') return PHASE.CONFLICT
  if (code === '422' || code === 'VALIDATION_ERROR') return PHASE.VALIDATION
  if (code === 'TYPEERROR' || /network|failed to fetch|networkerror/i.test(msg)) return PHASE.NETWORK
  return PHASE.ERROR
}

function extractDataAsOf(d) {
  if (!d || typeof d !== 'object') return null
  return d.data_as_of || d.generated_at || (d.data && (d.data.data_as_of || d.data.generated_at)) || null
}

/**
 * @param {*} raw  payload de odooJson (o null si hubo throw)
 * @param {*} error error capturado (o null)
 * @returns {{phase, data, code, message, partial, source, dataAsOf}}
 */
export function normalizeSupervisorV2Response(raw, error = null) {
  if (error) {
    return { phase: phaseForError(error), data: null, code: String(error.code || error.status || 'ERROR'), message: String(error.message || error), partial: false, source: 'live', dataAsOf: null }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // Forma A: envelope de servicio ({status, code, user_message, data}).
    if (typeof raw.status === 'string') {
      if (raw.status === 'ok') {
        return { phase: PHASE.OK, data: raw.data ?? {}, code: raw.code || 'OK', message: raw.user_message || '', partial: false, source: 'live', dataAsOf: extractDataAsOf(raw.data) }
      }
      // status error/busy
      return { phase: phaseForCode(raw.code), data: raw.data ?? null, code: raw.code || 'ERROR', message: raw.user_message || '', partial: false, source: 'live', dataAsOf: null }
    }
    // Forma B: payload crudo ({ok:true|false, contract,...}).
    if (raw.ok === true) {
      return { phase: PHASE.OK, data: raw, code: 'OK', message: '', partial: false, source: 'live', dataAsOf: extractDataAsOf(raw) }
    }
    if (raw.ok === false) {
      return { phase: phaseForCode(raw.code || raw.error), data: raw, code: raw.code || raw.error || 'ERROR', message: raw.message || raw.user_message || '', partial: false, source: 'live', dataAsOf: null }
    }
  }
  // Ni envelope ni payload reconocible ⇒ malformado (NO éxito, NO vacío).
  return { phase: PHASE.MALFORMED, data: null, code: 'MALFORMED', message: 'Respuesta con forma inesperada.', partial: false, source: 'live', dataAsOf: null }
}
