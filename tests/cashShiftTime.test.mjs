import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

let timeHelpers = {}
try {
  timeHelpers = await import('../src/modules/admin/cashShiftTime.js')
} catch {
  // The first RED run proves the reusable timezone helper does not exist yet.
}

test('cash-shift duration is identical in UTC and Mexico browser environments', () => {
  assert.equal(typeof timeHelpers.durationFromWallTime, 'function')
  const moduleUrl = new URL('../src/modules/admin/cashShiftTime.js', import.meta.url).href
  const script = `
    import { durationFromWallTime } from ${JSON.stringify(moduleUrl)}
    process.stdout.write(durationFromWallTime(
      '2026-07-27 06:00:00',
      'America/Mexico_City',
      Date.parse('2026-07-27T14:30:00Z'),
    ))
  `
  const outputs = ['UTC', 'America/Mexico_City'].map((TZ) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env: { ...process.env, TZ },
    })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  })
  assert.deepEqual(outputs, ['2 h 30 min', '2 h 30 min'])
})

test('wall-time conversion honors daylight-saving offsets in the supplied timezone', () => {
  assert.equal(typeof timeHelpers.zonedWallTimeToUtcMs, 'function')
  assert.equal(
    timeHelpers.zonedWallTimeToUtcMs('2024-01-15 12:00:00', 'America/New_York'),
    Date.parse('2024-01-15T17:00:00Z'),
  )
  assert.equal(
    timeHelpers.zonedWallTimeToUtcMs('2024-07-15 12:00:00', 'America/New_York'),
    Date.parse('2024-07-15T16:00:00Z'),
  )
})
