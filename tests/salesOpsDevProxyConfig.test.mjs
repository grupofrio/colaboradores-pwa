import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

test('vite dev proxy replicates the SalesOps server-side token injection route', () => {
  assert.match(source, /const salesOpsOdooOrigin = 'https:\/\/grupofrio-gf\.odoo\.com'/)
  assert.match(source, /'\/odoo-api\/gf\/salesops':\s*\{/)
  assert.match(source, /target:\s*salesOpsOdooOrigin/)
  assert.match(source, /proxyReq\.setHeader\('X-GF-Token', env\.GF_SALESOPS_TOKEN\)/)
  assert.match(source, /rewrite:\s*\(path\)\s*=>\s*path\.replace\(\s*\/\^\\\/odoo-api\/\s*,\s*''\s*\)/)
})
