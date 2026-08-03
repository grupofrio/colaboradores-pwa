import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildUnitTrackBounds,
  isValidCoordinate,
  normalizeUnitTrack,
  unitTrackAvailability,
} from '../src/modules/supervisor-ventas/unitTrackState.js'

test('isValidCoordinate excludes zero, non-numeric, non-finite, and out-of-range coordinates', () => {
  assert.equal(isValidCoordinate(19.4326, -99.1332), true)
  assert.equal(isValidCoordinate(0, 0), false)
  assert.equal(isValidCoordinate('19.4326', -99.1332), false)
  assert.equal(isValidCoordinate(Infinity, -99.1332), false)
  assert.equal(isValidCoordinate(90.001, -99.1332), false)
  assert.equal(isValidCoordinate(19.4326, -180.001), false)
})

test('normalizeUnitTrack keeps valid current, trail, and planned stop coordinates only', () => {
  const track = normalizeUnitTrack({
    current: { lat: 19.4326, lng: -99.1332, captured_at: '2026-08-03T10:00:00Z' },
    trail: [
      { lat: 19.4, lng: -99.1, recorded_at: '2026-08-03T09:00:00Z' },
      { lat: 0, lng: 0 },
      { lat: 91, lng: -99.2 },
    ],
    stops: [
      { sequence: 1, name: 'Cliente Norte', done: false, planned_lat: 19.45, planned_lng: -99.15 },
      { sequence: 2, name: 'Sin ubicación', planned_lat: 0, planned_lng: 0 },
    ],
  })

  assert.deepEqual(track.current, {
    lat: 19.4326,
    lng: -99.1332,
    captured_at: '2026-08-03T10:00:00Z',
  })
  assert.deepEqual(track.trail, [{ lat: 19.4, lng: -99.1, recorded_at: '2026-08-03T09:00:00Z' }])
  assert.deepEqual(track.stops, [{
    sequence: 1,
    name: 'Cliente Norte',
    done: false,
    result_status: undefined,
    arrived_at: undefined,
    planned_lat: 19.45,
    planned_lng: -99.15,
    checkin_lat: undefined,
    checkin_lng: undefined,
  }])
  assert.deepEqual(buildUnitTrackBounds(track), [
    [19.4326, -99.1332],
    [19.4, -99.1],
    [19.45, -99.15],
  ])
})

test('normalizeUnitTrack returns an empty track for an empty payload', () => {
  assert.deepEqual(normalizeUnitTrack(), {
    current: null,
    trail: [],
    trail_available: false,
    stops: [],
  })
})

test('normalizeUnitTrack retains a current point when there is no trail', () => {
  const track = normalizeUnitTrack({ current: { lat: 20, lng: -100 } })

  assert.deepEqual(track.current, { lat: 20, lng: -100 })
  assert.deepEqual(track.trail, [])
  assert.deepEqual(buildUnitTrackBounds(track), [[20, -100]])
})

test('normalizeUnitTrack suppresses trail points when trail_available is false', () => {
  const track = normalizeUnitTrack({
    current: { lat: 20, lng: -100 },
    trail_available: false,
    trail: [{ lat: 20.1, lng: -100.1 }],
  })

  assert.equal(track.trail_available, false)
  assert.deepEqual(track.trail, [])
  assert.deepEqual(buildUnitTrackBounds(track), [[20, -100]])
})

test('normalizeUnitTrack retains both planned and check-in locations for a visited stop', () => {
  const track = normalizeUnitTrack({
    stops: [{
      sequence: 3,
      name: 'Cliente Centro',
      done: true,
      result_status: 'visited',
      arrived_at: '2026-08-03T11:30:00Z',
      planned_lat: 19.41,
      planned_lng: -99.14,
      checkin_lat: 19.412,
      checkin_lng: -99.142,
    }],
  })

  assert.deepEqual(track.stops, [{
    sequence: 3,
    name: 'Cliente Centro',
    done: true,
    result_status: 'visited',
    arrived_at: '2026-08-03T11:30:00Z',
    planned_lat: 19.41,
    planned_lng: -99.14,
    checkin_lat: 19.412,
    checkin_lng: -99.142,
  }])
  assert.deepEqual(buildUnitTrackBounds(track), [[19.41, -99.14], [19.412, -99.142]])
})

test('normalizeUnitTrack retains a check-in-only stop and its check-in bound', () => {
  const track = normalizeUnitTrack({
    stops: [{
      sequence: 4,
      name: 'Cliente Poniente',
      done: true,
      checkin_lat: 19.43,
      checkin_lng: -99.13,
    }],
  })

  assert.deepEqual(track.stops, [{
    sequence: 4,
    name: 'Cliente Poniente',
    done: true,
    result_status: undefined,
    arrived_at: undefined,
    planned_lat: undefined,
    planned_lng: undefined,
    checkin_lat: 19.43,
    checkin_lng: -99.13,
  }])
  assert.deepEqual(buildUnitTrackBounds(track), [[19.43, -99.13]])
})

test('unitTrackAvailability rejects redacted JSON-RPC unavailable envelopes without producing map geometry', () => {
  for (const [response, expected] of [
    [{ jsonrpc: '2.0', id: null, result: { ok: false, data: { code: 'FEATURE_DISABLED' } } }, 'disabled'],
    [{ jsonrpc: '2.0', id: null, result: { ok: false, status: 'FORBIDDEN', payload: {} } }, 'forbidden'],
    [{ jsonrpc: '2.0', id: null, result: { ok: false, payload: { status: 'DATE_NOT_ALLOWED' } } }, 'date_not_allowed'],
  ]) {
    assert.equal(unitTrackAvailability(response), expected)
    assert.deepEqual(buildUnitTrackBounds(normalizeUnitTrack(response.result.data ?? response.result.payload)), [])
  }
})

test('unitTrackAvailability unwraps JSON-RPC result payloads', () => {
  assert.equal(unitTrackAvailability({ result: { ok: true, data: { current: { lat: 19.4, lng: -99.1 } } } }), 'ready')
  assert.equal(unitTrackAvailability({ result: { ok: true, data: {} } }), 'empty')
  const errorResponse = { result: { ok: false, error: { code: 'SERVER_ERROR' } } }
  assert.equal(unitTrackAvailability(errorResponse), 'error')
  assert.deepEqual(buildUnitTrackBounds(normalizeUnitTrack(errorResponse.result.data)), [])
})

test('unitTrackAvailability treats a top-level JSON-RPC error as an error', () => {
  assert.equal(unitTrackAvailability({ jsonrpc: '2.0', error: { code: 'SERVER_ERROR' } }), 'error')
})
