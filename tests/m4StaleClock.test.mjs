import test from 'node:test'
import assert from 'node:assert/strict'

import * as staleClock from '../src/modules/ventas/m4/staleClock.js'
import { evidenceJson, executiveSummaryText, exportFilename } from '../src/modules/ventas/m4/exporters.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const { getM4PayloadAgeDays, isM4PayloadStale, startM4StaleMonitor } = staleClock

const DAY = 86_400_000
const payloadAt = (finishedAt, stale = false) => ({ stale, run: { finished_at: finishedAt } })

test('stale local prevalece aunque backend stale=false', () => {
  const finished = Date.parse('2026-07-01T00:00:00Z')
  const payload = payloadAt(new Date(finished).toISOString(), false)
  assert.equal(isM4PayloadStale(payload, finished + 8 * DAY), true)
  assert.equal(isM4PayloadStale(payload, finished + 6 * DAY), false)
  assert.equal(isM4PayloadStale(payloadAt(new Date(finished).toISOString(), true), finished), true)
})

test('edad visible conserva el máximo entre backend y reloj local', () => {
  const finished = Date.parse('2026-07-01T00:00:00Z')
  const payload = { ...payloadAt(new Date(finished).toISOString(), true), age_days: 9 }
  assert.equal(getM4PayloadAgeDays(payload, finished + DAY), 9)
})

test('monitor cruza el umbral mientras está montado sin refetch', () => {
  const finished = Date.parse('2026-07-01T00:00:00Z')
  let nowMs = finished + 7 * DAY
  let scheduled = null
  let cancelled = null
  const states = []
  const stop = startM4StaleMonitor(payloadAt(new Date(finished).toISOString(), false), {
    now: () => nowMs,
    onChange: (state) => states.push(state),
    schedule: (callback, intervalMs) => {
      scheduled = { callback, intervalMs }
      return 17
    },
    cancel: (timerId) => { cancelled = timerId },
  })

  assert.equal(states.at(-1).stale, false)
  assert.ok(scheduled.intervalMs > 0 && scheduled.intervalMs <= 60_000)

  nowMs = finished + 7 * DAY + 1
  scheduled.callback()
  assert.equal(states.at(-1).stale, true)
  assert.equal(states.at(-1).nowMs, nowMs)

  stop()
  assert.equal(cancelled, 17)
})

test('al cruzar STALE montado, payload JSON, resumen y filename exportan el mismo estado', () => {
  assert.equal(typeof staleClock.buildM4EffectivePayload, 'function')
  const payload = JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE))
  const finished = Date.parse(payload.run.finished_at)
  let nowMs = finished + 7 * DAY
  let tick
  let effective = staleClock.buildM4EffectivePayload(payload, { stale: false, ageDays: 7 })
  startM4StaleMonitor(payload, {
    now: () => nowMs,
    onChange: (state) => { effective = staleClock.buildM4EffectivePayload(payload, state) },
    schedule: (callback) => { tick = callback; return 1 },
    cancel: () => {},
  })
  assert.equal(effective.stale, false)

  nowMs = finished + 7 * DAY + 1
  tick()
  assert.equal(effective.stale, true)
  assert.equal(effective.run.technical_state, 'STALE')
  const json = JSON.parse(evidenceJson(effective))
  assert.equal(json.export_meta.stale, true)
  assert.equal(json.envelope.stale, true)
  assert.ok(json.envelope.age_days >= 8, 'la edad exportada no puede redondear debajo del umbral STALE')
  assert.match(executiveSummaryText(effective), /CORRIDA STALE/)
  assert.match(exportFilename('m4', 'csv', { stale: effective.stale }), /_STALE\.csv$/)
})
