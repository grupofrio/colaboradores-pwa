import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  isIsolatedStagingOdooOrigin,
  isProductionOdooOrigin,
  mustIsolateFromProduction,
  resolveOdooOrigin,
  StagingOriginError,
} from '../api/_odooOrigin.js'
import { buildOdooPwaRequest, PwaProxyError } from '../api/_odooPwaProxy.js'
import { createEmployeeSignInProxyHandler } from '../api/employee-sign-in.js'
import { createOdooOriginProxyHandler } from '../api/odoo-origin.js'
import { shouldShowStagingBanner } from '../src/lib/stagingRuntime.js'

const stagingHost = 'https://grupofrio-gf-staging10082026-example.dev.odoo.com'
const stableStagingHost = 'https://odoo-staging.grupofrio.mx'

test('production Odoo hosts are recognized and rejected for staging isolation', () => {
  assert.equal(isProductionOdooOrigin('https://grupofrio-gf.odoo.com'), true)
  assert.equal(isProductionOdooOrigin('https://grupofrio.odoo.com'), true)
  assert.equal(isIsolatedStagingOdooOrigin(stagingHost), true)
  assert.equal(isIsolatedStagingOdooOrigin('https://grupofrio-gf.odoo.com'), false)
})

test('stable staging domain is accepted without allowing arbitrary domains', () => {
  assert.equal(isIsolatedStagingOdooOrigin(stableStagingHost), true)
  assert.equal(
    resolveOdooOrigin({ VERCEL_ENV: 'preview', ODOO_ORIGIN: stableStagingHost }),
    stableStagingHost,
  )
  assert.equal(isIsolatedStagingOdooOrigin('https://odoo-staging.example.com'), false)
})

test('preview and staging runtimes fail closed without an isolated staging origin', () => {
  assert.equal(mustIsolateFromProduction({ VERCEL_ENV: 'preview' }), true)
  assert.equal(mustIsolateFromProduction({ GF_PWA_RUNTIME: 'staging' }), true)
  assert.equal(mustIsolateFromProduction({ VERCEL_PROJECT_NAME: 'staging-colaboradores-pwa' }), true)
  assert.equal(mustIsolateFromProduction({ VERCEL_ENV: 'production' }), false)
  assert.throws(
    () => resolveOdooOrigin({ VERCEL_ENV: 'preview' }),
    (error) => error instanceof StagingOriginError && error.status === 503,
  )
  assert.throws(
    () => resolveOdooOrigin({
      VERCEL_ENV: 'preview',
      ODOO_ORIGIN: 'https://grupofrio-gf.odoo.com',
    }),
    StagingOriginError,
  )
  assert.equal(
    resolveOdooOrigin({ VERCEL_ENV: 'preview', ODOO_ORIGIN: stagingHost }),
    stagingHost,
  )
  assert.equal(resolveOdooOrigin({}), 'https://grupofrio-gf.odoo.com')
})

test('resolveOdooOrigin strips trailing /odoo from copied Odoo.sh URLs', () => {
  assert.equal(
    resolveOdooOrigin({
      VERCEL_ENV: 'preview',
      ODOO_ORIGIN: 'https://grupofrio-gf-staging280826-37133857.dev.odoo.com/odoo',
    }),
    'https://grupofrio-gf-staging280826-37133857.dev.odoo.com',
  )
})

test('PWA proxy and login refuse production when preview isolation is required', () => {
  assert.throws(
    () => buildOdooPwaRequest({
      path: ['pwa-admin', 'capabilities'],
      method: 'GET',
      employeeToken: 'token',
      serviceApiKey: 'key',
      env: { VERCEL_ENV: 'preview' },
    }),
    (error) => error instanceof PwaProxyError && error.status === 503,
  )
})

test('login proxy returns 503 instead of calling production on preview', async () => {
  let called = false
  const handler = createEmployeeSignInProxyHandler({
    env: { VERCEL_ENV: 'preview', ODOO_ORIGIN: 'https://grupofrio-gf.odoo.com' },
    fetchFn: async () => {
      called = true
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body; return this },
  }
  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { jsonrpc: '2.0', params: { barcode: '0000', pin: '0000' } },
  }, res)
  assert.equal(called, false)
  assert.equal(res.statusCode, 503)
  assert.match(String(res.body), /staging|producción|produccion/i)
})

test('generic get_records_sorted route is forwarded by the staging Odoo proxy', async () => {
  const calls = []
  const handler = createOdooOriginProxyHandler({
    env: {
      VERCEL_ENV: 'preview',
      ODOO_ORIGIN: 'https://grupofrio-gf-staging280826-37133857.dev.odoo.com',
    },
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ result: { response: [{ id: 89, code: 'CIGU' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body; return this },
  }
  await handler({
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: 'Bearer session-token',
      'x-gf-employee-token': 'employee-token',
      'api-key': 'browser-api-key',
    },
    query: { path: 'get_records_sorted' },
    body: { jsonrpc: '2.0', method: 'call', params: { model: 'stock.warehouse' }, id: 1 },
  }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://grupofrio-gf-staging280826-37133857.dev.odoo.com/get_records_sorted')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer session-token')
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-token')
  assert.equal(calls[0].options.headers['Api-Key'], 'browser-api-key')
})

test('vercel catch-alls no longer rewrite to production Odoo', () => {
  const vercel = readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8')
  assert.doesNotMatch(vercel, /grupofrio-gf\.odoo\.com/)
  assert.doesNotMatch(vercel, /grupofrio\.odoo\.com/)
  assert.match(vercel, /\/api\/odoo-origin/)
  assert.match(vercel, /\/api\/n8n-guard/)
})

test('STAGING banner is reserved for staging/preview runtimes', () => {
  assert.equal(shouldShowStagingBanner('staging'), true)
  assert.equal(shouldShowStagingBanner('preview'), true)
  assert.equal(shouldShowStagingBanner(''), false)
  assert.equal(shouldShowStagingBanner('production'), false)
  const app = readFileSync(fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8')
  assert.match(app, /StagingEnvironmentBanner/)
})
