import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('public manifest asset exists and is valid JSON', () => {
  const raw = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')
  const manifest = JSON.parse(raw)

  assert.equal(manifest.name, 'GF Colaboradores')
  assert.equal(manifest.short_name, 'GF Tropa')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.ok(Array.isArray(manifest.icons))
  assert.ok(manifest.icons.length >= 2)
})
