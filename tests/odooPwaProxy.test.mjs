import assert from 'node:assert/strict'
import test from 'node:test'

import { buildOdooPwaRequest, PwaProxyError } from '../api/_odooPwaProxy.js'
import { createOdooPwaProxyHandler } from '../api/odoo/[...path].js'

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

test('server handler injects the environment key without returning it to the browser', async () => {
  let forwarded = null
  const handler = createOdooPwaProxyHandler({
    serviceApiKey: serviceApiKey,
    fetchFn: async (url, options) => {
      forwarded = { url, options }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-private': serviceApiKey },
      })
    },
  })
  const res = responseRecorder()

  await handler({
    method: 'GET',
    query: { path: ['pwa-admin', 'requisitions'], limit: '10' },
    headers: { 'x-gf-employee-token': employeeToken },
  }, res)

  assert.equal(forwarded.url, 'https://grupofrio-gf.odoo.com/pwa-admin/requisitions?limit=10')
  assert.equal(forwarded.options.headers['Api-Key'], serviceApiKey)
  assert.equal(forwarded.options.headers['X-GF-Employee-Token'], employeeToken)
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'application/json')
  assert.equal(res.headers['x-private'], undefined)
  assert.doesNotMatch(String(res.body), new RegExp(serviceApiKey))
})

test('server handler rejects missing token and missing service key', async () => {
  const noTokenHandler = createOdooPwaProxyHandler({ serviceApiKey, fetchFn: async () => null })
  const noTokenResponse = responseRecorder()
  await noTokenHandler({ method: 'GET', query: { path: ['pwa-admin', 'requisitions'] }, headers: {} }, noTokenResponse)
  assert.equal(noTokenResponse.statusCode, 401)

  const noKeyHandler = createOdooPwaProxyHandler({ serviceApiKey: '', fetchFn: async () => null })
  const noKeyResponse = responseRecorder()
  await noKeyHandler({
    method: 'GET',
    query: { path: ['pwa-admin', 'requisitions'] },
    headers: { 'x-gf-employee-token': employeeToken },
  }, noKeyResponse)
  assert.equal(noKeyResponse.statusCode, 503)
})
