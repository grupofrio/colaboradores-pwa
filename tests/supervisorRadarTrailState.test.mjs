import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRadarTrailError,
  applyRadarTrailResponse,
  createRadarTrailRequest,
  selectRadarTrail,
} from '../src/modules/supervisor-ventas/v2/radar/radarTrailState.js'

const PLAN_A = 31
const PLAN_B = 32
const DAY_A = '2026-08-03'
const DAY_B = '2026-08-04'

const responseWith = (data) => ({ result: { ok: true, data } })

test('normalizes a valid GPS trail and appends a distinct current endpoint', () => {
  const request = createRadarTrailRequest(PLAN_A, DAY_A)
  const state = applyRadarTrailResponse(request, request.key, responseWith({
    trail: [
      { lat: 18.34, lng: -99.53 },
      { lat: 18.35, lng: -99.54 },
    ],
    current: { lat: 18.36, lng: -99.55 },
  }))

  assert.equal(state.status, 'ready')
  assert.deepEqual(selectRadarTrail(state, PLAN_A, DAY_A), [
    { lat: 18.34, lng: -99.53 },
    { lat: 18.35, lng: -99.54 },
    { lat: 18.36, lng: -99.55 },
  ])
})

test('does not create GPS geometry from null-island or invalid coordinates', () => {
  const request = createRadarTrailRequest(PLAN_A, DAY_A)
  const state = applyRadarTrailResponse(request, request.key, responseWith({
    trail: [
      { lat: 0, lng: 0 },
      { lat: '18.35', lng: -99.54 },
      { lat: 91, lng: -99.55 },
    ],
    current: { lat: 0, lng: 0 },
  }))

  assert.deepEqual(selectRadarTrail(state, PLAN_A, DAY_A), [])
})

test('does not expose absent or one-point trails as radar geometry', () => {
  const request = createRadarTrailRequest(PLAN_A, DAY_A)

  for (const payload of [
    {},
    { current: { lat: 18.36, lng: -99.55 } },
    { trail: [{ lat: 18.34, lng: -99.53 }], current: { lat: 18.36, lng: -99.55 } },
  ]) {
    const state = applyRadarTrailResponse(request, request.key, responseWith(payload))
    assert.deepEqual(selectRadarTrail(state, PLAN_A, DAY_A), [])
  }
})

test('does not duplicate the current point when it is already the final trail point', () => {
  const request = createRadarTrailRequest(PLAN_A, DAY_A)
  const state = applyRadarTrailResponse(request, request.key, responseWith({
    trail: [
      { lat: 18.34, lng: -99.53 },
      { lat: 18.35, lng: -99.54 },
    ],
    current: { lat: 18.35, lng: -99.54 },
  }))

  assert.deepEqual(selectRadarTrail(state, PLAN_A, DAY_A), [
    { lat: 18.34, lng: -99.53 },
    { lat: 18.35, lng: -99.54 },
  ])
})

test('keeps unavailable, failed, and rejected tracking requests free of geometry', () => {
  const request = createRadarTrailRequest(PLAN_A, DAY_A)
  const validTrail = {
    trail: [{ lat: 18.34, lng: -99.53 }, { lat: 18.35, lng: -99.54 }],
  }

  for (const response of [
    { result: { ok: false, data: { code: 'FEATURE_DISABLED' } } },
    { result: { ok: false, status: 'FORBIDDEN', payload: {} } },
    { result: { ok: false, payload: { status: 'DATE_NOT_ALLOWED' } } },
    { result: { ok: false, error: { code: 'SERVER_ERROR' }, data: validTrail } },
  ]) {
    const state = applyRadarTrailResponse(request, request.key, response)
    assert.deepEqual(selectRadarTrail(state, PLAN_A, DAY_A), [])
  }

  const failed = applyRadarTrailError(request, request.key)
  assert.equal(failed.status, 'error')
  assert.deepEqual(selectRadarTrail(failed, PLAN_A, DAY_A), [])
})

test('resets synchronously for plan or operational-date changes and rejects late results', () => {
  const requestA = createRadarTrailRequest(PLAN_A, DAY_A)
  const loadedA = applyRadarTrailResponse(requestA, requestA.key, responseWith({
    trail: [{ lat: 18.34, lng: -99.53 }, { lat: 18.35, lng: -99.54 }],
  }))
  assert.equal(selectRadarTrail(loadedA, PLAN_A, DAY_A).length, 2)

  const requestB = createRadarTrailRequest(PLAN_B, DAY_A)
  assert.deepEqual(requestB, {
    key: `${PLAN_B}:${DAY_A}`,
    planId: PLAN_B,
    operationalDate: DAY_A,
    status: 'loading',
    trail: [],
  })
  assert.deepEqual(selectRadarTrail(requestB, PLAN_B, DAY_A), [])
  assert.strictEqual(applyRadarTrailResponse(requestB, requestA.key, responseWith({
    trail: [{ lat: 19.34, lng: -100.53 }, { lat: 19.35, lng: -100.54 }],
  })), requestB)

  const requestNextDay = createRadarTrailRequest(PLAN_B, DAY_B)
  assert.deepEqual(selectRadarTrail(requestNextDay, PLAN_B, DAY_B), [])
  assert.strictEqual(applyRadarTrailError(requestNextDay, requestB.key), requestNextDay)
  assert.deepEqual(selectRadarTrail(loadedA, PLAN_B, DAY_A), [])
})
