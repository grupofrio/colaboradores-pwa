import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SAFE_AUTH_ERROR_MESSAGE,
  sanitizeAuthErrorMessage,
  sanitizeUpstreamAuthBody,
} from '../src/lib/sanitizeAuthErrors.js'
import { createOdooPwaProxyHandler } from '../api/odoo/[...path].js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('sanitizeAuthErrorMessage strips Odoo "The key … is not allowed" leaks', () => {
  const leaked = 'The key abcdefghijklmnopqrstuvwxyz0123456789ab is not allowed'
  const clean = sanitizeAuthErrorMessage(leaked)
  assert.equal(clean, SAFE_AUTH_ERROR_MESSAGE)
  assert.doesNotMatch(clean, /abcdefghijklmnopqrstuvwxyz/)
  assert.doesNotMatch(clean, /0123456789ab/)
})

test('sanitizeAuthErrorMessage remaps plain API key requerida without embedding secrets', () => {
  const clean = sanitizeAuthErrorMessage('API key requerida.')
  assert.match(clean, /autenticar el servicio/i)
  assert.doesNotMatch(clean, /api key requerida/i)
})

test('sanitizeUpstreamAuthBody rewrites HTML ValidationError pages', () => {
  const html = '<!doctype html><html><title>400</title><p>The key supersecretkeyvalue1234567890abcd is not allowed</p></html>'
  const out = sanitizeUpstreamAuthBody(Buffer.from(html), 'text/html')
  assert.equal(out.redacted, true)
  const text = Buffer.isBuffer(out.body) ? out.body.toString('utf8') : String(out.body)
  assert.doesNotMatch(text, /supersecretkeyvalue/)
  assert.match(text, /autenticación|autenticar/i)
})

test('sanitizeUpstreamAuthBody rewrites JSON messages that embed the key', () => {
  const payload = JSON.stringify({
    ok: false,
    message: 'The key leakedsecretkeyvalue000111222333444 is not allowed',
  })
  const out = sanitizeUpstreamAuthBody(Buffer.from(payload), 'application/json')
  assert.equal(out.redacted, true)
  const parsed = JSON.parse(Buffer.from(out.body).toString('utf8'))
  assert.doesNotMatch(parsed.message, /leakedsecret/)
})

test('proxy never forwards Odoo key-leak HTML to the browser', async () => {
  const serviceApiKey = 'server-only-test-key-abcdefghij'
  const employeeToken = 'employee-mobile-token'
  const upstreamHtml = `<!doctype html><p>The key ${serviceApiKey} is not allowed</p>`

  const handler = createOdooPwaProxyHandler({
    serviceApiKey,
    fetchFn: async () => ({
      status: 400,
      headers: { get: (n) => (String(n).toLowerCase() === 'content-type' ? 'text/html' : null) },
      arrayBuffer: async () => Buffer.from(upstreamHtml),
    }),
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
    method: 'GET',
    query: { path: ['pwa-admin', 'expense-catalog'] },
    headers: { 'x-gf-employee-token': employeeToken },
  }, res)

  assert.equal(res.statusCode, 400)
  const body = Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.body)
  assert.doesNotMatch(body, new RegExp(serviceApiKey))
  assert.match(body, /autenticación|autenticar/i)
})

test('expenses-pending-approval FE contract uses GET odooHttp (not odooJson POST)', () => {
  const api = readFileSync(join(root, 'src/lib/api.js'), 'utf8')
  const block = api.slice(
    api.indexOf("cleanPath === '/pwa-admin/expenses-pending-approval'"),
    api.indexOf("cleanPath === '/pwa-admin/expense-approve'"),
  )
  assert.match(block, /odooHttp\(\s*'GET'/)
  assert.doesNotMatch(block, /odooJson\(/)
})

test('buildBaseHeaders skips client Api-Key for pwa-admin paths', () => {
  const api = readFileSync(join(root, 'src/lib/api.js'), 'utf8')
  assert.match(api, /pwa-admin\/\* goes through the Vercel proxy/i)
  assert.match(api, /!clean\.startsWith\('\/pwa-admin\/'\)/)
})
