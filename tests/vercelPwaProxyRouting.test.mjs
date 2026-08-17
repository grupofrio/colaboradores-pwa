import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('SPA fallback does not intercept internal API routes', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const fallback = config.rewrites.find((rewrite) => rewrite.destination === '/index.html')

  assert.ok(fallback)
  assert.match(fallback.source, /api/)
})
