import test from 'node:test'
import assert from 'node:assert/strict'

import { DAY_CONTROL_FIXTURE } from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import {
  classifyDayControlEnvelope,
  isDayControlPayload,
  loadDayControlState,
  stateCopy,
} from '../src/modules/supervisor-ventas/dayControl/state.js'

const envelopeError = (code, extra = {}) => classifyDayControlEnvelope({
  status: 'error',
  code,
  ...extra,
})

const SAFE_ERROR_COPY = {
  kind: 'error',
  title: 'No pudimos cargar la operación',
  detail: 'Intenta nuevamente.',
  retryable: true,
}

const INVALID_CONTRACT_COPY = {
  kind: 'invalid_contract',
  title: 'La información llegó en un formato no compatible',
  detail: 'Intenta nuevamente.',
  retryable: true,
}

const REQUIRED_PAYLOAD_FIELDS = [
  'ok',
  'contract',
  'date',
  'summary',
  'capabilities',
  'routes',
  'priorities',
]

function revokedProxy(target) {
  const revocable = Proxy.revocable(target, {})
  revocable.revoke()
  return revocable.proxy
}

test('acepta el contrato mínimo válido', () => {
  assert.equal(isDayControlPayload(DAY_CONTROL_FIXTURE), true)
  assert.equal(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: DAY_CONTROL_FIXTURE,
  }).kind, 'valid')
})

test('payload válido sin rutas es empty, no error ni ceros inventados', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes = []
  payload.summary.routes_total = 0

  assert.deepEqual(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }), {
    kind: 'empty',
    payload,
  })
})

test('solo FEATURE_DISABLED activa disabled', () => {
  assert.equal(envelopeError('FEATURE_DISABLED').kind, 'disabled')

  for (const [code, kind] of [
    ['UNAUTHORIZED', 'unauthorized'],
    ['FORBIDDEN', 'forbidden'],
    ['NO_BRANCH_SCOPE', 'no_scope'],
    ['MULTI_BRANCH', 'ambiguous_scope'],
    ['DATE_NOT_ALLOWED', 'date_unavailable'],
    ['SERVER_MISCONFIG', 'error'],
    ['VALIDATION_ERROR', 'invalid_contract'],
  ]) {
    assert.equal(envelopeError(code).kind, kind)
  }
})

test('summary debe ser objeto no-array', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.summary = []

  assert.equal(isDayControlPayload(payload), false)
  assert.equal(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }).kind, 'invalid_contract')
})

test('capabilities debe ser objeto no-array', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.capabilities = []

  assert.equal(isDayControlPayload(payload), false)
  assert.equal(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }).kind, 'invalid_contract')
})

test('códigos no-string coercibles jamás activan disabled', () => {
  for (const code of [
    ['FEATURE_DISABLED'],
    { toString() { return 'FEATURE_DISABLED' } },
    new String('FEATURE_DISABLED'),
  ]) {
    assert.deepEqual(envelopeError(code), SAFE_ERROR_COPY)
  }
})

test('claves heredadas de Object.prototype producen error seguro', () => {
  for (const code of ['toString', 'constructor', '__proto__']) {
    const result = envelopeError(code)

    assert.deepEqual(result, SAFE_ERROR_COPY)
    assert.equal(typeof result.kind, 'string')
    assert.deepEqual(Object.keys(result).sort(), [
      'detail',
      'kind',
      'retryable',
      'title',
    ])
  }
})

test('solo el string exacto FEATURE_DISABLED produce disabled', () => {
  assert.equal(envelopeError('FEATURE_DISABLED').kind, 'disabled')

  for (const code of [
    'feature_disabled',
    ' FEATURE_DISABLED',
    'FEATURE_DISABLED ',
    ['FEATURE_DISABLED'],
  ]) {
    assert.deepEqual(envelopeError(code), SAFE_ERROR_COPY)
  }
})

test('status no-string no entra al flujo de error ni activa disabled', () => {
  assert.deepEqual(classifyDayControlEnvelope({
    status: ['error'],
    code: 'FEATURE_DISABLED',
  }), INVALID_CONTRACT_COPY)
})

test('status y code heredados no activan disabled', () => {
  const envelope = Object.create({
    status: 'error',
    code: 'FEATURE_DISABLED',
  })

  assert.deepEqual(
    classifyDayControlEnvelope(envelope),
    INVALID_CONTRACT_COPY,
  )
})

test('getters hostiles del envelope no se invocan ni lanzan', () => {
  const statusAccessor = Object.defineProperty({}, 'status', {
    get() { throw new Error('status getter invocado') },
  })
  const codeAccessor = Object.defineProperties({}, {
    status: { value: 'error' },
    code: { get() { throw new Error('code getter invocado') } },
  })
  const dataAccessor = Object.defineProperties({}, {
    status: { value: 'ok' },
    code: { value: 'OK' },
    data: { get() { throw new Error('data getter invocado') } },
  })

  assert.deepEqual(
    classifyDayControlEnvelope(statusAccessor),
    INVALID_CONTRACT_COPY,
  )
  assert.deepEqual(classifyDayControlEnvelope(codeAccessor), SAFE_ERROR_COPY)
  assert.deepEqual(
    classifyDayControlEnvelope(dataAccessor),
    INVALID_CONTRACT_COPY,
  )
})

test('payload totalmente heredado nunca se clasifica valid ni empty', () => {
  for (const payload of [
    Object.create(DAY_CONTROL_FIXTURE),
    Object.create({ ...DAY_CONTROL_FIXTURE, routes: [] }),
  ]) {
    assert.equal(isDayControlPayload(payload), false)
    assert.deepEqual(classifyDayControlEnvelope({
      status: 'ok',
      code: 'OK',
      data: payload,
    }), INVALID_CONTRACT_COPY)
  }
})

test('campos raíz accessor o heredados invalidan el payload sin invocar getters', () => {
  for (const field of REQUIRED_PAYLOAD_FIELDS) {
    const accessorPayload = structuredClone(DAY_CONTROL_FIXTURE)
    Object.defineProperty(accessorPayload, field, {
      get() { throw new Error(`${field} getter invocado`) },
    })

    assert.equal(
      isDayControlPayload(accessorPayload),
      false,
      `${field} accessor`,
    )
    assert.deepEqual(classifyDayControlEnvelope({
      status: 'ok',
      code: 'OK',
      data: accessorPayload,
    }), INVALID_CONTRACT_COPY, `${field} accessor`)

    const inheritedPayload = structuredClone(DAY_CONTROL_FIXTURE)
    const inheritedValue = inheritedPayload[field]
    delete inheritedPayload[field]
    Object.setPrototypeOf(inheritedPayload, { [field]: inheritedValue })

    assert.equal(
      isDayControlPayload(inheritedPayload),
      false,
      `${field} heredado`,
    )
    assert.deepEqual(classifyDayControlEnvelope({
      status: 'ok',
      code: 'OK',
      data: inheritedPayload,
    }), INVALID_CONTRACT_COPY, `${field} heredado`)
  }
})

test('Proxy revocado como envelope falla cerrado sin lanzar', () => {
  assert.deepEqual(
    classifyDayControlEnvelope(revokedProxy({})),
    INVALID_CONTRACT_COPY,
  )
})

test('summary revocado invalida payload y envelope sin lanzar', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.summary = revokedProxy({})

  assert.equal(isDayControlPayload(payload), false)
  assert.deepEqual(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }), INVALID_CONTRACT_COPY)
})

test('routes revocado invalida payload y envelope sin lanzar', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes = revokedProxy([])

  assert.equal(isDayControlPayload(payload), false)
  assert.deepEqual(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }), INVALID_CONTRACT_COPY)
})

test('routes cuyo get de length lanza no se clasifica valid ni empty', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes = new Proxy([{}], {
    get(target, key, receiver) {
      if (key === 'length') throw new Error('length getter invocado')
      return Reflect.get(target, key, receiver)
    },
  })

  assert.equal(isDayControlPayload(payload), false)
  assert.deepEqual(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }), INVALID_CONTRACT_COPY)
})

test('routes no puede mentir que length es cero para producir empty', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes = new Proxy([{}], {
    get(target, key, receiver) {
      if (key === 'length') return 0
      return Reflect.get(target, key, receiver)
    },
  })

  assert.equal(isDayControlPayload(payload), false)
  assert.deepEqual(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }), INVALID_CONTRACT_COPY)
})

test('Proxy Array transparente conserva payload valid', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes = new Proxy(payload.routes, {})

  assert.equal(isDayControlPayload(payload), true)
  assert.equal(classifyDayControlEnvelope({
    status: 'ok',
    code: 'OK',
    data: payload,
  }).kind, 'valid')
})

test('contrato roto siempre es invalid_contract y nunca partial', () => {
  for (const mutation of [
    (payload) => { payload.contract = 'otra-version' },
    (payload) => { payload.date = '2026-02-29' },
    (payload) => { payload.routes = null },
    (payload) => { payload.priorities = {} },
    (payload) => { payload.summary = null },
    (payload) => { payload.capabilities = null },
  ]) {
    const payload = structuredClone(DAY_CONTROL_FIXTURE)
    mutation(payload)
    const result = classifyDayControlEnvelope({
      status: 'ok',
      code: 'OK',
      data: payload,
    })

    assert.equal(result.kind, 'invalid_contract')
    assert.notEqual(result.kind, 'partial')
    assert.equal('payload' in result, false)
  }
})

test('stateCopy conserva únicamente copy curado y retryable del plan', () => {
  const expected = {
    idle: ['', '', false],
    loading: [
      'Cargando la operación',
      'Estamos consultando la información del día.',
      false,
    ],
    disabled: ['Control diario todavía no habilitado', '', false],
    unauthorized: [
      'Tu sesión necesita renovarse',
      'Vuelve a iniciar sesión para continuar.',
      false,
    ],
    forbidden: [
      'No tienes permiso para ver esta operación',
      'Solicita acceso al responsable de tu sucursal.',
      false,
    ],
    no_scope: [
      'No hay una sucursal operativa asignada',
      'Revisa la asignación de tu usuario.',
      false,
    ],
    ambiguous_scope: [
      'Tu usuario tiene más de una sucursal operativa',
      'Se necesita una única sucursal para continuar.',
      false,
    ],
    date_unavailable: [
      'La fecha no está disponible',
      'Selecciona otro día o intenta nuevamente.',
      true,
    ],
    invalid_contract: [
      'La información llegó en un formato no compatible',
      'Intenta nuevamente.',
      true,
    ],
    error: [
      'No pudimos cargar la operación',
      'Intenta nuevamente.',
      true,
    ],
  }

  for (const [kind, [title, detail, retryable]] of Object.entries(expected)) {
    assert.deepEqual(stateCopy(kind), { kind, title, detail, retryable })
    assert.deepEqual(Object.keys(stateCopy(kind)).sort(), [
      'detail',
      'kind',
      'retryable',
      'title',
    ])
  }
})

test('errores y códigos desconocidos usan copy seguro sin filtrar el envelope', () => {
  const result = envelopeError('BACKEND_SECRET_FAILURE', {
    message: 'token secreto Unexpected token <html>',
    body: { token: 'token secreto' },
    error: new Error('detalle técnico'),
  })

  assert.deepEqual(result, {
    kind: 'error',
    title: 'No pudimos cargar la operación',
    detail: 'Intenta nuevamente.',
    retryable: true,
  })
  assert.equal(JSON.stringify(result).includes('token secreto'), false)
  assert.equal(JSON.stringify(result).includes('detalle técnico'), false)
})

test('envelopes desconocidos o mal formados fallan cerrados', () => {
  for (const envelope of [
    null,
    {},
    { status: 'pending', code: 'OK', data: DAY_CONTROL_FIXTURE },
    { status: 'ok', code: 'UNKNOWN', data: DAY_CONTROL_FIXTURE },
    { status: 'ok', code: 'OK', data: null },
  ]) {
    assert.deepEqual(classifyDayControlEnvelope(envelope), {
      kind: 'invalid_contract',
      title: 'La información llegó en un formato no compatible',
      detail: 'Intenta nuevamente.',
      retryable: true,
    })
  }
})

test('loadDayControlState convierte excepciones en error seguro', async () => {
  const result = await loadDayControlState(undefined, async () => {
    throw new Error('token secreto Unexpected token <html>')
  })

  assert.deepEqual(result, {
    kind: 'error',
    title: 'No pudimos cargar la operación',
    detail: 'Intenta nuevamente.',
    retryable: true,
  })
  assert.ok(!JSON.stringify(result).includes('token secreto'))
})
