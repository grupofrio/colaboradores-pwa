import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('SPA fallback does not intercept internal API routes', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const fallback = config.rewrites.find((rewrite) => rewrite.destination === '/index.html')

  assert.ok(fallback)
  assert.match(fallback.source, /api/)
})

test('PWA admin paths rewrite to a flat serverless function', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const proxy = config.rewrites.find((rewrite) => rewrite.source === '/odoo-api/pwa-admin/:proxyPath*')

  assert.deepEqual(proxy, {
    source: '/odoo-api/pwa-admin/:proxyPath*',
    destination: '/api/pwa-admin?path=:proxyPath',
  })
})
