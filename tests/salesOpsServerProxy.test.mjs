import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSalesOpsRequest,
  createSalesOpsProxyHandler,
  readSalesOpsToken,
  salesOpsTokenProbe,
  SalesOpsProxyError,
} from '../api/salesops.js'

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

test('readSalesOpsToken uses live env lookup and ignores blank or padded keys', () => {
  assert.equal(readSalesOpsToken({}), '')
  assert.equal(readSalesOpsToken({ GF_SALESOPS_TOKEN: `  ${serverToken}  ` }), serverToken)
  assert.equal(readSalesOpsToken({ 'GF_SALESOPS_TOKEN ': serverToken }), serverToken)
  assert.equal(readSalesOpsToken({ GF_SALEOPS_TOKEN: serverToken }), serverToken)
  assert.equal(readSalesOpsToken({ GF_SALESOPS_TOKE_DIAG: serverToken }), '')
  assert.equal(readSalesOpsToken({ GF_SALEOPS_TOKE_DIAG: serverToken }), '')
  assert.equal(salesOpsTokenProbe({}), 'undef')
  assert.equal(salesOpsTokenProbe({ GF_SALESOPS_TOKEN: '' }), 'empty')
  assert.equal(salesOpsTokenProbe({ GF_SALESOPS_TOKEN: serverToken }), 'set')
  assert.equal(salesOpsTokenProbe({ GF_SALEOPS_TOKEN: serverToken }), 'typo')
})

test('SalesOps proxy accepts the misspelled GF_SALEOPS_TOKEN env name', async () => {
  let forwarded = null
  const handler = createSalesOpsProxyHandler({
    env: { GF_SALEOPS_TOKEN: serverToken },
    fetchFn: async (url, options) => {
      forwarded = { url, options }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const res = responseRecorder()
  await handler({
    method: 'POST',
    query: { path: 'gf/salesops/warehouse/van_load/create_execute' },
    headers: { 'x-gf-employee-token': employeeToken },
    body: {},
  }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(forwarded.options.headers['X-GF-Token'], serverToken)
  assert.equal(res.headers['x-gf-salesops-probe'], undefined)
})

test('SalesOps proxy reads GF_SALESOPS_TOKEN from env at request time and ignores client X-GF-Token', async () => {
  let forwarded = null
  const handler = createSalesOpsProxyHandler({
    env: { GF_SALESOPS_TOKEN: serverToken },
    fetchFn: async (url, options) => {
      forwarded = { url, options }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const res = responseRecorder()

  await handler({
    method: 'POST',
    query: { path: 'gf/salesops/warehouse/van_load/create_execute' },
    headers: {
      'x-gf-employee-token': employeeToken,
      'x-gf-token': 'client-controlled-token',
    },
    body: { jsonrpc: '2.0', params: {} },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(forwarded.options.headers['X-GF-Token'], serverToken)
  assert.equal(forwarded.options.headers['X-GF-Employee-Token'], employeeToken)
})

test('SalesOps proxy returns 503 when GF_SALESOPS_TOKEN is missing from env', async () => {
  const handler = createSalesOpsProxyHandler({
    env: {},
    fetchFn: async () => {
      throw new Error('upstream should not be called')
    },
  })
  const res = responseRecorder()

  await handler({
    method: 'POST',
    query: { path: 'gf/salesops/warehouse/van_load/create_execute' },
    headers: { 'x-gf-employee-token': employeeToken },
    body: {},
  }, res)

  assert.equal(res.statusCode, 503)
  assert.match(String(res.body), /Servicio temporalmente no disponible/)
})

test('SalesOps proxy exposes configured=0/1 only on staging runtime', async () => {
  const missing = createSalesOpsProxyHandler({
    env: { GF_PWA_RUNTIME: 'staging' },
    fetchFn: async () => {
      throw new Error('upstream should not be called')
    },
  })
  const missingRes = responseRecorder()
  await missing({
    method: 'POST',
    query: { path: 'gf/salesops/warehouse/van_load/create_execute' },
    headers: { 'x-gf-employee-token': employeeToken },
    body: {},
  }, missingRes)
  assert.equal(missingRes.statusCode, 503)
  assert.equal(missingRes.headers['x-gf-salesops-configured'], '0')
  assert.equal(missingRes.headers['x-gf-salesops-probe'], 'undef')
  assert.equal(missingRes.headers['x-gf-pwa-key-probe'], 'undef')

  const present = createSalesOpsProxyHandler({
    env: {
      GF_PWA_RUNTIME: 'staging',
      GF_SALESOPS_TOKEN: serverToken,
      ODOO_ORIGIN: 'https://grupofrio-gf-staging280826-37133857.dev.odoo.com',
      GF_ALLOWED_ODOO_ORIGIN: 'https://grupofrio-gf-staging280826-37133857.dev.odoo.com',
    },
    fetchFn: async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  })
  const presentRes = responseRecorder()
  await present({
    method: 'POST',
    query: { path: 'gf/salesops/warehouse/van_load/create_execute' },
    headers: { 'x-gf-employee-token': employeeToken },
    body: {},
  }, presentRes)
  assert.equal(presentRes.statusCode, 200)
  assert.equal(presentRes.headers['x-gf-salesops-configured'], '1')
  assert.equal(presentRes.headers['x-gf-salesops-probe'], 'set')

  const productionLike = createSalesOpsProxyHandler({
    env: { GF_SALESOPS_TOKEN: serverToken },
    fetchFn: async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  })
  const productionRes = responseRecorder()
  await productionLike({
    method: 'POST',
    query: { path: 'gf/salesops/warehouse/van_load/create_execute' },
    headers: { 'x-gf-employee-token': employeeToken },
    body: {},
  }, productionRes)
  assert.equal(productionRes.headers['x-gf-salesops-configured'], undefined)
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
