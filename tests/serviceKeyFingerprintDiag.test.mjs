import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fingerprintServiceApiKey,
  ID14_REFERENCE_FINGERPRINT,
  matchesId14Reference,
} from '../api/_serviceKeyFingerprint.js'
import { createDebugPwaServiceKeyFingerprintHandler } from '../api/internal/debug-pwa-service-key-fingerprint.js'

test('fingerprintServiceApiKey returns safe metadata only', () => {
  const fp = fingerprintServiceApiKey('  server-only-test-key  ')
  assert.equal(fp.present, true)
  assert.equal(fp.len, 20)
  assert.match(fp.sha256_12, /^[a-f0-9]{12}$/)
  assert.notEqual(fp.sha256_12, 'server-only-test-key')
})

test('fingerprintServiceApiKey handles missing value', () => {
  assert.deepEqual(fingerprintServiceApiKey(undefined), {
    present: false,
    len: 0,
    sha256_12: null,
  })
})

test('matchesId14Reference compares against public reference only', () => {
  assert.equal(ID14_REFERENCE_FINGERPRINT.len, 64)
  assert.equal(ID14_REFERENCE_FINGERPRINT.sha256_12, '2cba99eea238')
  assert.equal(matchesId14Reference({ present: true, len: 64, sha256_12: '2cba99eea238' }), true)
  assert.equal(matchesId14Reference({ present: true, len: 40, sha256_12: 'c91b82a5c275' }), false)
})

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    send(body) {
      this.body = body
      return this
    },
  }
}

test('debug endpoint is hidden without gate env', async () => {
  const handler = createDebugPwaServiceKeyFingerprintHandler({
    env: { ODOO_PWA_SERVICE_API_KEY: 'server-only-test-key' },
  })
  const res = responseRecorder()
  await handler({ method: 'GET', headers: { 'x-pwa-service-key-diag-gate': 'secret' }, query: {} }, res)
  assert.equal(res.statusCode, 404)
})

test('debug endpoint returns runtime fingerprint with valid gate', async () => {
  const handler = createDebugPwaServiceKeyFingerprintHandler({
    env: {
      ODOO_PWA_SERVICE_API_KEY: 'server-only-test-key',
      PWA_SERVICE_KEY_DIAG_GATE: 'diag-gate-test',
    },
  })
  const res = responseRecorder()
  await handler({
    method: 'GET',
    headers: { 'x-pwa-service-key-diag-gate': 'diag-gate-test' },
    query: {},
  }, res)

  assert.equal(res.statusCode, 200)
  const payload = JSON.parse(res.body)
  assert.equal(payload.present, true)
  assert.equal(payload.len, 20)
  assert.match(payload.sha256_12, /^[a-f0-9]{12}$/)
  assert.equal(payload.matches_id14, false)
  assert.equal(JSON.stringify(payload).includes('server-only-test-key'), false)
})

test('debug endpoint odoo probe returns transport metadata only', async () => {
  const handler = createDebugPwaServiceKeyFingerprintHandler({
    env: {
      ODOO_PWA_SERVICE_API_KEY: 'server-only-test-key',
      PWA_SERVICE_KEY_DIAG_GATE: 'diag-gate-test',
    },
    fetchFn: async () => ({
      status: 200,
      json: async () => ({ ok: true, data: { gerenteWritesEnabled: false } }),
    }),
  })
  const res = responseRecorder()
  await handler({
    method: 'GET',
    headers: {
      'x-pwa-service-key-diag-gate': 'diag-gate-test',
      'x-gf-employee-token': 'employee-mobile-token',
    },
    query: { probe: 'odoo' },
  }, res)

  const payload = JSON.parse(res.body)
  assert.deepEqual(payload.odoo_direct, { HTTP: 200, ok: true, code: null })
  assert.equal(payload.pre_request.matches_id14, false)
  assert.equal(payload.pre_request.len, 20)
})
