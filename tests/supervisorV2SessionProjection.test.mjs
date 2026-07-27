import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildSupervisorV2SessionProjection } from '../src/modules/supervisor-ventas/v2/sessionProjection.js'

test('login projection: exact true/true is preserved', () => {
  assert.deepEqual(buildSupervisorV2SessionProjection({
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: true },
  }), {
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: true },
  })
})

test('login projection: malformed values fail closed', () => {
  for (const raw of [
    null, {},
    { capabilities: { supervisorV2: 1 }, branch: { supervisor_v2_enabled: 'true' } },
    { capabilities: [], branch: [] },
  ]) {
    const projected = buildSupervisorV2SessionProjection(raw)
    assert.equal(projected.capabilities.supervisorV2, false)
    assert.equal(projected.branch.supervisor_v2_enabled, false)
  }
})

test('login projection: inherited top-level containers fail closed', () => {
  const result = Object.create({
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: true },
  })

  assert.deepEqual(buildSupervisorV2SessionProjection(result), {
    capabilities: { supervisorV2: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('login projection: inherited flags fail closed', () => {
  assert.deepEqual(buildSupervisorV2SessionProjection({
    capabilities: Object.create({ supervisorV2: true }),
    branch: Object.create({ supervisor_v2_enabled: true }),
  }), {
    capabilities: { supervisorV2: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('login projection: arrays with true expando flags fail closed', () => {
  const capabilities = []
  capabilities.supervisorV2 = true
  const branch = []
  branch.supervisor_v2_enabled = true

  assert.deepEqual(buildSupervisorV2SessionProjection({ capabilities, branch }), {
    capabilities: { supervisorV2: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('login projection: null-prototype records preserve own true flags', () => {
  const result = Object.create(null)
  result.capabilities = Object.create(null)
  result.capabilities.supervisorV2 = true
  result.branch = Object.create(null)
  result.branch.supervisor_v2_enabled = true

  assert.deepEqual(buildSupervisorV2SessionProjection(result), {
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: true },
  })
})

test('login projection: partial shapes preserve only the exact boolean present', () => {
  assert.deepEqual(buildSupervisorV2SessionProjection({
    capabilities: { supervisorV2: true },
  }), {
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: false },
  })
  assert.deepEqual(buildSupervisorV2SessionProjection({
    branch: { supervisor_v2_enabled: true },
  }), {
    capabilities: { supervisorV2: false },
    branch: { supervisor_v2_enabled: true },
  })
})

test('login projection: each call returns fresh nested objects', () => {
  const input = {
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: true },
  }
  const first = buildSupervisorV2SessionProjection(input)
  const second = buildSupervisorV2SessionProjection(input)

  assert.notStrictEqual(first.capabilities, second.capabilities)
  assert.notStrictEqual(first.branch, second.branch)
})

test('login projection: projection does not mutate input', () => {
  const input = {
    capabilities: { supervisorV2: true, untouched: 'capabilities' },
    branch: { supervisor_v2_enabled: true, untouched: 'branch' },
    untouched: 'result',
  }
  const before = structuredClone(input)

  buildSupervisorV2SessionProjection(input)

  assert.deepEqual(input, before)
})

test('login projection: merging an OFF projection overwrites a prior ON projection', () => {
  const on = buildSupervisorV2SessionProjection({
    capabilities: { supervisorV2: true },
    branch: { supervisor_v2_enabled: true },
  })
  const off = buildSupervisorV2SessionProjection({})
  const rebuiltSession = { ...on, ...off }
  assert.deepEqual(rebuiltSession, {
    capabilities: { supervisorV2: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('ScreenLogin imports and merges the pure projection into fallbackPayload', () => {
  const src = readFileSync(fileURLToPath(
    new URL('../src/screens/ScreenLogin.jsx', import.meta.url),
  ), 'utf8')
  assert.match(src, /buildSupervisorV2SessionProjection/)
  assert.match(src, /\.\.\.buildSupervisorV2SessionProjection\(result\)/)
})
