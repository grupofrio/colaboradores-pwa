import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'

import { useRadarTrail } from '../src/modules/supervisor-ventas/v2/radar/useRadarTrail.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const DAY_A = '2026-08-03'
const DAY_B = '2026-08-04'

function responseWith(data) {
  return { result: { ok: true, data } }
}

function createControlledLoader() {
  const requests = []
  const loadTrack = (planId, operationalDate) => {
    let resolve
    let reject
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    requests.push({ planId, operationalDate, resolve, reject, promise })
    return promise
  }
  return { loadTrack, requests }
}

function Harness({ planId, operationalDate, loadTrack, onState }) {
  onState(useRadarTrail(planId, operationalDate, { loadTrack }))
  return null
}

test('loads only the current request and clears the selected trail before a replacement resolves', async () => {
  const { loadTrack, requests } = createControlledLoader()
  const states = []
  const onState = (state) => states.push({ trail: state.trail, trailStatus: state.trailStatus })
  let renderer

  try {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Harness, {
        planId: 31,
        operationalDate: DAY_A,
        loadTrack,
        onState,
      }))
    })
    assert.deepEqual(requests.map(({ planId, operationalDate }) => ({ planId, operationalDate })), [{ planId: 31, operationalDate: DAY_A }])
    assert.deepEqual(states.at(-1), { trail: [], trailStatus: 'loading' })

    await act(async () => {
      renderer.update(React.createElement(Harness, {
        planId: 32,
        operationalDate: DAY_B,
        loadTrack,
        onState,
      }))
    })
    assert.deepEqual(requests.map(({ planId, operationalDate }) => ({ planId, operationalDate })), [
      { planId: 31, operationalDate: DAY_A },
      { planId: 32, operationalDate: DAY_B },
    ])
    assert.deepEqual(states.at(-1), { trail: [], trailStatus: 'loading' })

    await act(async () => {
      requests[0].resolve(responseWith({
        trail: [{ lat: 18.34, lng: -99.53 }, { lat: 18.35, lng: -99.54 }],
      }))
      await requests[0].promise
    })
    assert.deepEqual(states.at(-1), { trail: [], trailStatus: 'loading' })

    await act(async () => {
      requests[1].resolve(responseWith({
        trail: [{ lat: 19.34, lng: -100.53 }, { lat: 19.35, lng: -100.54 }],
      }))
      await requests[1].promise
    })
    assert.deepEqual(states.at(-1), {
      trail: [{ lat: 19.34, lng: -100.53 }, { lat: 19.35, lng: -100.54 }],
      trailStatus: 'ready',
    })
  } finally {
    await act(async () => { renderer?.unmount() })
  }
})

test('does not load when the plan or operational date is invalid', async () => {
  const { loadTrack, requests } = createControlledLoader()
  const states = []
  let renderer

  try {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Harness, {
        planId: null,
        operationalDate: DAY_A,
        loadTrack,
        onState: (state) => states.push({ trail: state.trail, trailStatus: state.trailStatus }),
      }))
    })
    assert.deepEqual(requests, [])
    assert.deepEqual(states.at(-1), { trail: [], trailStatus: 'idle' })

    await act(async () => {
      renderer.update(React.createElement(Harness, {
        planId: 31,
        operationalDate: 'not-a-date',
        loadTrack,
        onState: (state) => states.push({ trail: state.trail, trailStatus: state.trailStatus }),
      }))
    })
    assert.deepEqual(requests, [])
    assert.deepEqual(states.at(-1), { trail: [], trailStatus: 'idle' })
  } finally {
    await act(async () => { renderer?.unmount() })
  }
})
