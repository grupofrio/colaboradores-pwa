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

test('SalesOps and login routes reach protected functions before generic Odoo rewrites', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const rewrites = config.rewrites
  const salesOpsIndex = rewrites.findIndex((rewrite) => rewrite.source === '/odoo-api/gf/salesops/:proxyPath*')
  const loginIndex = rewrites.findIndex((rewrite) => rewrite.source === '/api-odoo/employee-sign-in')
  const genericOdooIndex = rewrites.findIndex((rewrite) => rewrite.source === '/odoo-api/:path*')
  const genericApiOdooIndex = rewrites.findIndex((rewrite) => rewrite.source === '/api-odoo/:path*')

  assert.deepEqual(rewrites[salesOpsIndex], {
    source: '/odoo-api/gf/salesops/:proxyPath*',
    destination: '/api/salesops?path=gf/salesops/:proxyPath',
  })
  assert.deepEqual(rewrites[loginIndex], {
    source: '/api-odoo/employee-sign-in',
    destination: '/api/employee-sign-in',
  })
  assert.ok(salesOpsIndex >= 0 && salesOpsIndex < genericOdooIndex)
  assert.ok(loginIndex >= 0 && loginIndex < genericApiOdooIndex)
  assert.equal(rewrites[genericOdooIndex].destination, '/api/odoo-origin?path=:path')
  assert.equal(rewrites[genericApiOdooIndex].destination, '/api/odoo-origin?path=api/:path')
  assert.ok(!JSON.stringify(config.rewrites).includes('grupofrio-gf.odoo.com'))
})
