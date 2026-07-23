// ─── Supervisor V2 · normalizador ÚNICO de WRITES (Codex §7) ──────────────────
// Los adaptadores de escritura NO pueden ignorar el envelope del backend ni
// devolver éxito optimista. Reconoce las mismas dos formas que las lecturas
// ({status:'ok'|'error'|'busy', code, user_message, data} y {ok:true|false,...})
// MÁS los errores de red/JSON-RPC (throw) y las respuestas malformadas. Devuelve
// SIEMPRE {ok, phase, code, data, message, retryable}.
//
// Regla dura (§7): status:'error' / status:'busy' / malformed / code de error
// desconocido NUNCA ⇒ ok:true. La UI no muestra toast de éxito salvo phase===
// 'success'. `retryable` marca los estados donde reintentar tiene sentido
// (red / locked / conflict) — la UI debe recargar antes de reintentar en conflict.
export const WRITE_PHASE = Object.freeze({
  SUCCESS: 'success', UNAUTHORIZED: 'unauthorized', FORBIDDEN: 'forbidden',
  DATE_NOT_ALLOWED: 'date_not_allowed', FEATURE_DISABLED: 'feature_disabled',
  VALIDATION: 'validation', CONFLICT: 'conflict', LOCKED: 'locked',
  NOT_FOUND: 'not_found', CAPABILITY_UNAVAILABLE: 'capability_unavailable',
  NETWORK: 'network', INVALID: 'invalid',
})

const RETRYABLE = new Set([WRITE_PHASE.NETWORK, WRITE_PHASE.LOCKED, WRITE_PHASE.CONFLICT])

// code de negocio (envelope) → fase de write. A diferencia de las lecturas, aquí
// FORBIDDEN≠UNAUTHORIZED y LOCKED≠CONFLICT (semántica distinta para el usuario).
function phaseForCode(code) {
  switch (String(code || '').toUpperCase()) {
    case 'DATE_NOT_ALLOWED': return WRITE_PHASE.DATE_NOT_ALLOWED
    case 'UNAUTHORIZED': return WRITE_PHASE.UNAUTHORIZED
    case 'FORBIDDEN': return WRITE_PHASE.FORBIDDEN
    case 'FEATURE_DISABLED': return WRITE_PHASE.FEATURE_DISABLED
    case 'CONFLICT': return WRITE_PHASE.CONFLICT
    case 'LOCKED': return WRITE_PHASE.LOCKED
    case 'NOT_FOUND': return WRITE_PHASE.NOT_FOUND
    case 'CAPABILITY_UNAVAILABLE':
    case 'NOT_IMPLEMENTED': return WRITE_PHASE.CAPABILITY_UNAVAILABLE
    case 'VALIDATION_ERROR':
    case 'CONFIRM_REQUIRED': return WRITE_PHASE.VALIDATION
    default: return WRITE_PHASE.INVALID // code de error DESCONOCIDO ⇒ NO éxito
  }
}

function phaseForError(e) {
  const code = String(e?.code || e?.status || '').toUpperCase()
  const msg = String(e?.message || e || '')
  if (code === '401' || code === 'UNAUTHORIZED') return WRITE_PHASE.UNAUTHORIZED
  if (code === '403' || code === 'FORBIDDEN') return WRITE_PHASE.FORBIDDEN
  if (code === '404' || code === 'NOT_FOUND') return WRITE_PHASE.NOT_FOUND
  if (code === '409' || code === 'CONFLICT') return WRITE_PHASE.CONFLICT
  if (code === 'LOCKED') return WRITE_PHASE.LOCKED
  if (code === '422' || code === 'VALIDATION_ERROR') return WRITE_PHASE.VALIDATION
  if (code === 'DATE_NOT_ALLOWED') return WRITE_PHASE.DATE_NOT_ALLOWED
  if (code === 'TYPEERROR' || /network|failed to fetch|networkerror/i.test(msg)) return WRITE_PHASE.NETWORK
  return WRITE_PHASE.INVALID
}

function build(phase, { code, data = null, message = '' } = {}) {
  return {
    ok: phase === WRITE_PHASE.SUCCESS,
    phase,
    code: code || String(phase).toUpperCase(),
    data,
    message,
    retryable: RETRYABLE.has(phase),
  }
}

/**
 * @param {*} raw   payload devuelto por odooJson (o null si hubo throw)
 * @param {*} error error capturado (o null)
 * @returns {{ok:boolean, phase:string, code:string, data:*, message:string, retryable:boolean}}
 */
export function normalizeWriteResponse(raw, error = null) {
  if (error) {
    return build(phaseForError(error), { code: String(error.code || error.status || 'ERROR'), message: String(error.message || error) })
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (typeof raw.status === 'string') {
      if (raw.status === 'ok') {
        return build(WRITE_PHASE.SUCCESS, { code: raw.code || 'OK', data: raw.data ?? {}, message: raw.user_message || '' })
      }
      if (raw.status === 'busy') {
        return build(WRITE_PHASE.LOCKED, { code: raw.code || 'LOCKED', data: raw.data ?? null, message: raw.user_message || '' })
      }
      // status === 'error' (u otro no-ok): la fase sale del code de negocio.
      return build(phaseForCode(raw.code), { code: raw.code || 'ERROR', data: raw.data ?? null, message: raw.user_message || '' })
    }
    if (raw.ok === true) {
      return build(WRITE_PHASE.SUCCESS, { code: raw.code || 'OK', data: raw, message: raw.message || '' })
    }
    if (raw.ok === false) {
      return build(phaseForCode(raw.code || raw.error), { code: raw.code || raw.error || 'ERROR', data: raw, message: raw.message || raw.user_message || '' })
    }
  }
  // Ni envelope ni payload reconocible ⇒ INVALID (NUNCA éxito, NUNCA vacío).
  return build(WRITE_PHASE.INVALID, { code: 'MALFORMED', message: 'Respuesta de escritura con forma inesperada.' })
}
