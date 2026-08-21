import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionScope } from '../../../../lib/sessionStore.js'
import { requestSupervisorPulse } from './pulseApi.js'

export const PULSE_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
  FEATURE_DISABLED: 'feature_disabled',
  AUTH_ERROR: 'auth_error',
  NETWORK_ERROR: 'network_error',
})

function errorCode(value) {
  return String(value?.code || value?.status || value || '').toUpperCase()
}

function statusForError(error) {
  const code = errorCode(error)
  if (['401', '403', 'UNAUTHORIZED', 'FORBIDDEN', 'NO_SESSION'].includes(code)) {
    return PULSE_STATUS.AUTH_ERROR
  }
  if (code === 'FEATURE_DISABLED') return PULSE_STATUS.FEATURE_DISABLED
  if (
    code === '0'
    || code === 'NETWORK'
    || /NETWORK|FAILED TO FETCH|NETWORKERROR/i.test(String(error?.message || ''))
  ) {
    return PULSE_STATUS.NETWORK_ERROR
  }
  return PULSE_STATUS.UNAVAILABLE
}

export function normalizePulseResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: PULSE_STATUS.UNAVAILABLE, data: null, error: 'Respuesta de Pulso no disponible.' }
  }

  if (raw.status === 'ok') {
    const data = raw.data && typeof raw.data === 'object' ? raw.data : {}
    const partial = raw.partial === true || data.partial === true || data.status === 'partial'
    return { status: partial ? PULSE_STATUS.PARTIAL : PULSE_STATUS.READY, data, error: null }
  }

  if (raw.ok === true) {
    const data = raw.data && typeof raw.data === 'object' ? raw.data : raw
    const partial = raw.partial === true || data.partial === true || data.status === 'partial'
    return { status: partial ? PULSE_STATUS.PARTIAL : PULSE_STATUS.READY, data, error: null }
  }

  const status = statusForError({ code: raw.code || raw.error, status: raw.http_status })
  return {
    status,
    data: raw.data && typeof raw.data === 'object' ? raw.data : null,
    error: raw.user_message || raw.message || 'Pulso no está disponible.',
  }
}

export function usePulse(horizon, {
  enabled = true,
  loadPulse = requestSupervisorPulse,
} = {}) {
  const scope = useSessionScope()
  const requestSequence = useRef(0)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(() => (
    enabled
      ? { status: PULSE_STATUS.LOADING, data: null, error: null }
      : { status: PULSE_STATUS.FEATURE_DISABLED, data: null, error: null }
  ))

  useEffect(() => {
    const requestId = (requestSequence.current += 1)
    let cancelled = false

    if (!enabled) {
      setState({ status: PULSE_STATUS.FEATURE_DISABLED, data: null, error: null })
      return () => { cancelled = true }
    }

    setState({ status: PULSE_STATUS.LOADING, data: null, error: null })
    Promise.resolve()
      .then(() => loadPulse(horizon))
      .then((raw) => {
        if (!cancelled && requestSequence.current === requestId) {
          setState(normalizePulseResponse(raw))
        }
      })
      .catch((error) => {
        if (!cancelled && requestSequence.current === requestId) {
          setState({
            status: statusForError(error),
            data: null,
            error: error?.message || 'Pulso no está disponible.',
          })
        }
      })

    return () => { cancelled = true }
  }, [attempt, enabled, horizon, loadPulse, scope.scopeKey])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  return { ...state, reload }
}
