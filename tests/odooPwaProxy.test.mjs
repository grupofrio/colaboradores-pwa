import assert from 'node:assert/strict'
import test from 'node:test'

import { buildOdooPwaRequest, PwaProxyError } from '../api/_odooPwaProxy.js'

const serviceApiKey = 'server-only-test-key'
const employeeToken = 'employee-mobile-token'

test('buildOdooPwaRequest sends server API key and employee token only to pwa-admin', () => {
  const request = buildOdooPwaRequest({
    path: ['pwa-admin', 'requisitions'],
    method: 'GET',
    query: 'limit=10&offset=0',
    employeeToken,
    serviceApiKey,
  })

  assert.equal(
    request.url,
    'https://grupofrio-gf.odoo.com/pwa-admin/requisitions?limit=10&offset=0',
  )
  assert.deepEqual(request.headers, {
    Accept: 'application/json',
    'Api-Key': serviceApiKey,
    'X-GF-Employee-Token': employeeToken,
  })
})

test('buildOdooPwaRequest rejects non-administrative paths', () => {
  assert.throws(
    () => buildOdooPwaRequest({
      path: ['web', 'database', 'manager'],
      method: 'GET',
      employeeToken,
      serviceApiKey,
    }),
    (error) => error instanceof PwaProxyError && error.status === 404,
  )
})

test('buildOdooPwaRequest rejects missing employee token and service key', () => {
  assert.throws(
    () => buildOdooPwaRequest({
      path: ['pwa-admin', 'requisitions'],
      method: 'GET',
      serviceApiKey,
    }),
    (error) => error instanceof PwaProxyError && error.status === 401,
  )

  assert.throws(
    () => buildOdooPwaRequest({
      path: ['pwa-admin', 'requisitions'],
      method: 'GET',
      employeeToken,
    }),
    (error) => error instanceof PwaProxyError && error.status === 503,
  )
})
