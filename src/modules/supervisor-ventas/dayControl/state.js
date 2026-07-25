import { requestSupervisorDayControl } from './api.js'
import { isOperationalDate } from './operationalDate.js'

const MISSING = Symbol('missing')
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

function isRecord(value) {
  try {
    return Boolean(
      value && typeof value === 'object' && !Array.isArray(value),
    )
  } catch {
    return false
  }
}

function readOwnData(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor && hasOwn(descriptor, 'value')
      ? descriptor.value
      : MISSING
  } catch {
    return MISSING
  }
}

function safeArrayLength(value) {
  try {
    if (!Array.isArray(value)) return MISSING
    const descriptorLength = readOwnData(value, 'length')
    if (!Number.isInteger(descriptorLength) || descriptorLength < 0) {
      return MISSING
    }
    const observedLength = value.length
    return observedLength === descriptorLength ? observedLength : MISSING
  } catch {
    return MISSING
  }
}

const ERROR_KIND = Object.freeze({
  FEATURE_DISABLED: 'disabled',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NO_BRANCH_SCOPE: 'no_scope',
  MULTI_BRANCH: 'ambiguous_scope',
  DATE_NOT_ALLOWED: 'date_unavailable',
  SERVER_MISCONFIG: 'error',
  VALIDATION_ERROR: 'invalid_contract',
})

const STATE_COPY = Object.freeze({
  idle: {
    title: '',
    detail: '',
    retryable: false,
  },
  loading: {
    title: 'Cargando la operación',
    detail: 'Estamos consultando la información del día.',
    retryable: false,
  },
  disabled: {
    title: 'Control diario todavía no habilitado',
    detail: '',
    retryable: false,
  },
  unauthorized: {
    title: 'Tu sesión necesita renovarse',
    detail: 'Vuelve a iniciar sesión para continuar.',
    retryable: false,
  },
  forbidden: {
    title: 'No tienes permiso para ver esta operación',
    detail: 'Solicita acceso al responsable de tu sucursal.',
    retryable: false,
  },
  no_scope: {
    title: 'No hay una sucursal operativa asignada',
    detail: 'Revisa la asignación de tu usuario.',
    retryable: false,
  },
  ambiguous_scope: {
    title: 'Tu usuario tiene más de una sucursal operativa',
    detail: 'Se necesita una única sucursal para continuar.',
    retryable: false,
  },
  date_unavailable: {
    title: 'La fecha no está disponible',
    detail: 'Selecciona otro día o intenta nuevamente.',
    retryable: true,
  },
  invalid_contract: {
    title: 'La información llegó en un formato no compatible',
    detail: 'Intenta nuevamente.',
    retryable: true,
  },
  error: {
    title: 'No pudimos cargar la operación',
    detail: 'Intenta nuevamente.',
    retryable: true,
  },
})

export function stateCopy(kind) {
  const safeKind = typeof kind === 'string' && hasOwn(STATE_COPY, kind)
    ? kind
    : 'error'
  const copy = STATE_COPY[safeKind]
  return {
    kind: safeKind,
    title: copy.title,
    detail: copy.detail,
    retryable: copy.retryable,
  }
}

function readDayControlPayload(value) {
  if (!isRecord(value)) return null

  const ok = readOwnData(value, 'ok')
  const contract = readOwnData(value, 'contract')
  const date = readOwnData(value, 'date')
  const summary = readOwnData(value, 'summary')
  const capabilities = readOwnData(value, 'capabilities')
  const routes = readOwnData(value, 'routes')
  const priorities = readOwnData(value, 'priorities')
  const routesLength = safeArrayLength(routes)
  const prioritiesLength = safeArrayLength(priorities)

  if (ok !== true
      || contract !== 'gf.salesops.supervisor.day_control/1'
      || !isOperationalDate(date)
      || !isRecord(summary)
      || !isRecord(capabilities)
      || routesLength === MISSING
      || prioritiesLength === MISSING) {
    return null
  }
  return {
    payload: value,
    routesLength,
  }
}

export function isDayControlPayload(value) {
  try {
    return readDayControlPayload(value) !== null
  } catch {
    return false
  }
}

export function classifyDayControlEnvelope(envelope) {
  try {
    if (!isRecord(envelope)) return stateCopy('invalid_contract')

    const status = readOwnData(envelope, 'status')
    if (typeof status !== 'string') return stateCopy('invalid_contract')

    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus === 'error') {
      const code = readOwnData(envelope, 'code')
      const kind = typeof code === 'string' && hasOwn(ERROR_KIND, code)
        ? ERROR_KIND[code]
        : 'error'
      return stateCopy(kind)
    }

    if (normalizedStatus !== 'ok') return stateCopy('invalid_contract')

    const code = readOwnData(envelope, 'code')
    const payload = readOwnData(envelope, 'data')
    const payloadData = readDayControlPayload(payload)
    if (code !== 'OK' || !payloadData) {
      return stateCopy('invalid_contract')
    }
    return {
      kind: payloadData.routesLength === 0 ? 'empty' : 'valid',
      payload: payloadData.payload,
    }
  } catch {
    return stateCopy('invalid_contract')
  }
}

export async function loadDayControlState(
  date,
  requester = requestSupervisorDayControl,
) {
  try {
    return classifyDayControlEnvelope(await requester(date))
  } catch {
    return stateCopy('error')
  }
}
