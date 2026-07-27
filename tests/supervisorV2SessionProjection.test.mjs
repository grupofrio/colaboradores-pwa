import test from 'node:test'
import assert from 'node:assert/strict'

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

test('login projection: a second OFF login overwrites a prior ON session', () => {
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
