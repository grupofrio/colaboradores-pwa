import assert from 'node:assert/strict'
import test from 'node:test'

import { createEmployeeSignInProxyHandler } from '../api/employee-sign-in.js'

const secretMarker = 'server-only-login-token'

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

function loginRequest(body = { jsonrpc: '2.0', params: { barcode: '7777', pin: '7777' } }) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer must-not-forward',
      cookie: 'must-not-forward',
      'x-gf-token': 'must-not-forward',
    },
    body,
  }
}

test('login relay redacts SalesOps fields from JSON-RPC success without forwarding client headers', async () => {
  let forwarded = null
  const handler = createEmployeeSignInProxyHandler({
    fetchFn: async (url, options) => {
      forwarded = { url, options }
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          employee_id: 730,
          gf_salesops_token: secretMarker,
          salesops_api_token: secretMarker,
          x_gf_token: secretMarker,
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const res = responseRecorder()

  await handler(loginRequest(), res)

  assert.equal(forwarded.url, 'https://grupofrio-gf.odoo.com/api/employee-sign-in')
  assert.deepEqual(forwarded.options.headers, {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  })
  assert.equal(forwarded.options.body, JSON.stringify(loginRequest().body))
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'application/json')
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(res.body), { jsonrpc: '2.0', result: { employee_id: 730 } })
  assert.doesNotMatch(res.body, new RegExp(secretMarker))
})

test('login relay redacts a direct non-2xx JSON response while preserving its status', async () => {
  const handler = createEmployeeSignInProxyHandler({
    fetchFn: async () => new Response(JSON.stringify({
      error: 'invalid_pin',
      gf_salesops_token: secretMarker,
      salesops_api_token: secretMarker,
      x_gf_token: secretMarker,
    }), { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' } }),
  })
  const res = responseRecorder()

  await handler(loginRequest(), res)

  assert.equal(res.statusCode, 401)
  assert.equal(res.headers['content-type'], 'application/json')
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_pin' })
  assert.doesNotMatch(res.body, new RegExp(secretMarker))
})

test('login relay rejects unsupported and malformed client input without contacting Odoo', async () => {
  let calls = 0
  const handler = createEmployeeSignInProxyHandler({ fetchFn: async () => { calls += 1 } })

  for (const req of [
    { ...loginRequest(), method: 'GET' },
    { ...loginRequest(), headers: { 'content-type': 'text/plain' } },
    { ...loginRequest('{not-json'), body: '{not-json' },
  ]) {
    const res = responseRecorder()
    await handler(req, res)
    assert.ok([400, 405, 415].includes(res.statusCode))
    assert.equal(res.headers['content-type'], 'application/json')
    assert.equal(res.headers['cache-control'], 'no-store')
  }
  assert.equal(calls, 0)
})

test('login relay fails closed when Odoo returns invalid or non-JSON content', async () => {
  for (const upstream of [
    new Response(`not-json ${secretMarker}`, { status: 200, headers: { 'content-type': 'text/plain' } }),
    new Response(`{bad-json ${secretMarker}`, { status: 200, headers: { 'content-type': 'application/json' } }),
  ]) {
    const handler = createEmployeeSignInProxyHandler({ fetchFn: async () => upstream })
    const res = responseRecorder()

    await handler(loginRequest(), res)

    assert.equal(res.statusCode, 502)
    assert.equal(res.headers['content-type'], 'application/json')
    assert.equal(res.headers['cache-control'], 'no-store')
    assert.doesNotMatch(res.body, new RegExp(secretMarker))
  }
})
