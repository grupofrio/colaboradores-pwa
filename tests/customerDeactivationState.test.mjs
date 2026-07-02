import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ANGELICA_DECISIONS,
  DEFAULT_DEACTIVATION_JOB_CONFIG,
  SUGEY_VERIFICATION_RESULTS,
  buildAngelicaDecisionPayload,
  buildSugeyVerificationPayload,
  canAccessAngelicaDeactivation,
  canAccessSugeyDeactivation,
  getSessionJobIds,
  normalizeDeactivationRequest,
  validateAngelicaDecisionForm,
  validateSugeyVerificationForm,
} from '../src/modules/supervisor-ventas/customerDeactivationState.js'

test('default deactivation job config uses the configured job keys', () => {
  assert.deepEqual(DEFAULT_DEACTIVATION_JOB_CONFIG, {
    sugeyJobIds: ['supervisor_ventas'],
    angelicaJobIds: ['gerente_sucursal'],
  })
})

test('permission helpers use primary and additional job keys', () => {
  assert.equal(canAccessSugeyDeactivation({ role: 'supervisor_ventas' }), true)
  assert.equal(canAccessAngelicaDeactivation({ role: 'gerente_sucursal' }), true)
  assert.equal(canAccessSugeyDeactivation({ role: 'jefe_ruta', additional_job_keys: ['supervisor_ventas'] }), true)
  assert.equal(canAccessAngelicaDeactivation({ role: 'auxiliar_admin', additional_job_keys: ['gerente_sucursal'] }), true)
  assert.equal(canAccessSugeyDeactivation({ role: 'gerente_sucursal' }), false)
})

test('permission helpers also tolerate Odoo-style job_id values', () => {
  const config = { sugeyJobIds: [11], angelicaJobIds: [22] }

  assert.equal(canAccessSugeyDeactivation({ job_id: [11, 'Supervisor Ventas'] }, config), true)
  assert.equal(canAccessAngelicaDeactivation({ job_id: [22, 'Gerente Sucursal'] }, config), true)
  assert.equal(canAccessSugeyDeactivation({ job_id: [1, 'Other'], additional_job_ids: [11] }, config), true)
  assert.equal(canAccessAngelicaDeactivation({ job_id: [1, 'Other'], additional_job_ids: [[22, 'Gerente']] }, config), true)
  assert.equal(canAccessSugeyDeactivation({ job_id: [22, 'Gerente Sucursal'] }, config), false)
})

test('getSessionJobIds normalizes supported session role sources', () => {
  assert.deepEqual(
    getSessionJobIds({
      role: ' supervisor_ventas ',
      job_key: 'supervisor_ventas',
      job_id: [33, 'Supervisor Ventas'],
      additional_job_keys: [' gerente_sucursal ', ''],
      additional_roles: ['auxiliar_admin'],
      additional_job_ids: [[44, 'Otro'], 55],
    }),
    ['supervisor_ventas', '33', 'Supervisor Ventas', 'gerente_sucursal', 'auxiliar_admin', '44', 'Otro', '55'],
  )
})

test('normalizes deactivation request response shape', () => {
  assert.deepEqual(normalizeDeactivationRequest({
    id: '123',
    state: 'pending_sugey',
    partner_id: [456, 'Abarrotes Centro'],
    route_name: 'Ruta Norte',
    driver_name: 'Chofer',
    reason: 'not_exists',
    request_comment: 'Cerrado',
    request_contact_person: 'Vecino',
    request_photo_url: '/web/content/1',
    age_hours: '6',
  }), {
    id: 123,
    name: '',
    state: 'pending_sugey',
    partner_id: 456,
    partner_name: 'Abarrotes Centro',
    route_name: 'Ruta Norte',
    driver_name: 'Chofer',
    reason: 'not_exists',
    reason_label: '',
    request_comment: 'Cerrado',
    request_contact_person: 'Vecino',
    request_latitude: null,
    request_longitude: null,
    request_photo_url: '/web/content/1',
    requested_at: '',
    sugey_result: '',
    sugey_comment: '',
    sugey_photo_url: '',
    sugey_latitude: null,
    sugey_longitude: null,
    sugey_verified_at: '',
    angelica_decision: '',
    angelica_comment: '',
    angelica_decided_at: '',
    age_hours: 6,
    timeline: [],
  })
})

test('validates Sugey verification before submit', () => {
  assert.equal(validateSugeyVerificationForm({
    result: '',
    comment: 'ok',
    photoBase64: 'abc',
    latitude: 19,
    longitude: -99,
  }), 'Selecciona el resultado de verificacion.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: '',
    photoBase64: 'abc',
    latitude: 19,
    longitude: -99,
  }), 'El comentario es obligatorio.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: 'ok',
    photoBase64: '',
    latitude: 19,
    longitude: -99,
  }), 'La foto es obligatoria.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: 'ok',
    photoBase64: 'abc',
    latitude: null,
    longitude: -99,
  }), 'GPS obligatorio para verificar la solicitud.')

  assert.equal(validateSugeyVerificationForm({
    result: 'confirmed_not_exists',
    comment: 'ok',
    photoBase64: 'abc',
    latitude: 19,
    longitude: -99,
  }), '')
})

test('validates Angelica decision before submit', () => {
  assert.equal(validateAngelicaDecisionForm({ decision: '', comment: 'ok' }), 'Selecciona una decision.')
  assert.equal(validateAngelicaDecisionForm({ decision: 'reject', comment: '' }), 'El comentario es obligatorio para esta decision.')
  assert.equal(validateAngelicaDecisionForm({ decision: 'request_second_verification', comment: '' }), 'El comentario es obligatorio para esta decision.')
  assert.equal(validateAngelicaDecisionForm({ decision: 'keep_active', comment: '' }), 'El comentario es obligatorio para esta decision.')
  assert.equal(validateAngelicaDecisionForm({ decision: 'commercial_recovery', comment: '' }), 'El comentario es obligatorio para esta decision.')
  assert.equal(validateAngelicaDecisionForm({ decision: 'approve', comment: '' }), '')
})

test('builds Sugey and Angelica payloads', () => {
  assert.deepEqual(buildSugeyVerificationPayload({
    result: 'confirmed_not_exists',
    comment: '  confirmado ',
    photoBase64: 'data:image/jpeg;base64,abc',
    latitude: 19,
    longitude: -99,
    accuracy: 15,
    verifiedAt: '2026-07-01T12:00:00-06:00',
  }), {
    result: 'confirmed_not_exists',
    comment: 'confirmado',
    photo_base64: 'abc',
    photo_mime: 'image/jpeg',
    latitude: 19,
    longitude: -99,
    accuracy: 15,
    verified_at: '2026-07-01T12:00:00-06:00',
  })

  assert.deepEqual(buildAngelicaDecisionPayload({
    decision: 'approve',
    comment: '  ok ',
    decidedAt: '2026-07-01T14:00:00-06:00',
  }), {
    decision: 'approve',
    comment: 'ok',
    decided_at: '2026-07-01T14:00:00-06:00',
  })
})

test('constants expose expected business options', () => {
  assert.equal(SUGEY_VERIFICATION_RESULTS.confirmed_not_exists.label, 'Confirmado no existe')
  assert.equal(ANGELICA_DECISIONS.request_second_verification.label, 'Pedir segunda verificacion')
})
