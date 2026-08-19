import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSalesOpsRequest, createSalesOpsProxyHandler, SalesOpsProxyError } from '../api/salesops.js'

const employeeToken = 'employee-mobile-token'
const serverToken = 'server-only-test-token'

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

test('SalesOps proxy injects the server token and forwards only identity headers', async () => {
  let forwarded = null
  const handler = createSalesOpsProxyHandler({
    salesOpsToken: serverToken,
    fetchFn: async (url, options) => {
      forwarded = { url, options }
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-private': serverToken,
        },
      })
    },
  })
  const res = responseRecorder()

  await handler({
    method: 'POST',
    query: {
      path: 'gf/salesops/warehouse/van_load/create_execute',
      trace: ['one', 'two'],
    },
    headers: {
      accept: 'application/json',
      authorization: 'Bearer browser-session',
      'x-gf-employee-token': employeeToken,
      'x-gf-token': 'client-controlled-token',
      'api-key': 'client-api-key',
      cookie: 'session=browser-cookie',
    },
    body: { jsonrpc: '2.0', params: { data: { lines: [] } } },
  }, res)

  assert.equal(
    forwarded.url,
    'https://grupofrio-gf.odoo.com/gf/salesops/warehouse/van_load/create_execute?trace=one&trace=two',
  )
  assert.deepEqual(forwarded.options.headers, {
    Accept: 'application/json',
    Authorization: 'Bearer browser-session',
    'Content-Type': 'application/json',
    'X-GF-Employee-Token': employeeToken,
    'X-GF-Token': serverToken,
  })
  assert.equal(forwarded.options.body, JSON.stringify({ jsonrpc: '2.0', params: { data: { lines: [] } } }))
  assert.equal(res.statusCode, 201)
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.equal(res.headers['x-private'], undefined)
  assert.doesNotMatch(String(res.body), new RegExp(serverToken))
})

test('SalesOps proxy fails closed when upstream reflects the server token', async () => {
  for (const upstream of [
    new Response(JSON.stringify({ detail: serverToken }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    new Response(JSON.stringify({ detail: serverToken }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'x-private': serverToken },
    }),
  ]) {
    const handler = createSalesOpsProxyHandler({
      salesOpsToken: serverToken,
      fetchFn: async () => upstream,
    })
    const res = responseRecorder()

    await handler({
      method: 'POST',
      query: { path: ['gf', 'salesops', 'warehouse', 'van_load'] },
      headers: { 'x-gf-employee-token': employeeToken },
      body: {},
    }, res)

    assert.equal(res.statusCode, 502)
    assert.equal(res.headers['cache-control'], 'no-store')
    assert.doesNotMatch(String(res.body), new RegExp(serverToken))
  }
})

test('SalesOps request builder rejects missing credentials, unsafe paths, and unsupported methods', () => {
  const valid = {
    path: ['gf', 'salesops', 'warehouse', 'van_load'],
    method: 'POST',
    employeeToken,
    salesOpsToken: serverToken,
  }

  for (const input of [
    { ...valid, employeeToken: '' },
    { ...valid, salesOpsToken: '' },
    { ...valid, path: ['pwa-admin', 'requisitions'] },
    { ...valid, path: ['gf', 'salesops', '..', 'van_load'] },
    { ...valid, path: ['gf', 'salesops'] },
    { ...valid, method: 'TRACE' },
  ]) {
    assert.throws(
      () => buildSalesOpsRequest(input),
      (error) => error instanceof SalesOpsProxyError,
    )
  }
})
