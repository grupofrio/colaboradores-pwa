import { api } from '../../../../lib/api.js'

export const SUPERVISOR_PULSE_PATH = '/gf/salesops/supervisor/v2/pulse'

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pulse-${crypto.randomUUID()}`
  }
  return `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const VALID_HORIZONS = new Set(['ahora', 'ayer', 'semana', 'mes'])

export function buildPulseRequest(horizon, requestId = createRequestId()) {
  if (!VALID_HORIZONS.has(horizon)) {
    throw new TypeError('Horizonte de pulso inválido')
  }
  return {
    meta: { request_id: requestId },
    data: { horizon },
  }
}

export function requestSupervisorPulse(horizon) {
  return api('POST', SUPERVISOR_PULSE_PATH, buildPulseRequest(horizon))
}
