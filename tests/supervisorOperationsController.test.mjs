import test from 'node:test'
import assert from 'node:assert/strict'

import { DAY_CONTROL_FIXTURE } from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import {
  loadSupervisorOperationDays,
} from '../src/modules/supervisor-ventas/dayControl/controller.js'

function fixtureFor(date) {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.date = date
  return payload
}

const okEnvelope = (payload) => ({
  status: 'ok',
  code: 'OK',
  data: payload,
})

test('solicita Ayer solo después de publicar la fecha operativa de Hoy', async () => {
  const dates = []
  const publishedToday = []
  const publishedYesterdayLoading = []
  const requester = async (date) => {
    dates.push(date)
    return okEnvelope(fixtureFor(date || '2026-07-24'))
  }

  const result = await loadSupervisorOperationDays({
    requester,
    onToday: (state) => publishedToday.push(state.kind),
    onYesterdayLoading: (state) => publishedYesterdayLoading.push(state),
  })

  assert.deepEqual(dates, [undefined, '2026-07-23'])
  assert.deepEqual(publishedToday, ['valid'])
  assert.deepEqual(publishedYesterdayLoading, [
    { kind: 'loading', date: '2026-07-23' },
  ])
  assert.equal(result.today.kind, 'valid')
  assert.equal(result.yesterday.kind, 'valid')
  assert.equal(result.yesterday.payload.date, '2026-07-23')
})

test('FEATURE_DISABLED no solicita Ayer', async () => {
  const dates = []
  const result = await loadSupervisorOperationDays({
    requester: async (date) => {
      dates.push(date)
      return { status: 'error', code: 'FEATURE_DISABLED' }
    },
  })

  assert.deepEqual(dates, [undefined])
  assert.equal(result.today.kind, 'disabled')
  assert.equal(result.yesterday.kind, 'idle')
})

test('un error de Hoy no solicita Ayer', async () => {
  const dates = []
  const result = await loadSupervisorOperationDays({
    requester: async (date) => {
      dates.push(date)
      throw new Error('network detail must stay private')
    },
  })

  assert.deepEqual(dates, [undefined])
  assert.equal(result.today.kind, 'error')
  assert.equal(result.yesterday.kind, 'idle')
})

test('un error de Ayer conserva el estado válido de Hoy', async () => {
  const result = await loadSupervisorOperationDays({
    requester: async (date) => {
      if (date === undefined) return okEnvelope(fixtureFor('2026-07-24'))
      throw new Error('yesterday unavailable')
    },
  })

  assert.equal(result.today.kind, 'valid')
  assert.equal(result.today.payload.date, '2026-07-24')
  assert.equal(result.yesterday.kind, 'error')
})

test('un Hoy vacío aún deriva Ayer desde la fecha del servidor', async () => {
  const dates = []
  const requester = async (date) => {
    dates.push(date)
    const payload = fixtureFor(date || '2026-07-24')
    if (date === undefined) {
      payload.routes = []
      payload.summary.routes_total = 0
    }
    return okEnvelope(payload)
  }

  const result = await loadSupervisorOperationDays({ requester })

  assert.deepEqual(dates, [undefined, '2026-07-23'])
  assert.equal(result.today.kind, 'empty')
  assert.equal(result.yesterday.kind, 'valid')
})

test('cada recarga independiente vuelve a comenzar por Hoy', async () => {
  const dates = []
  const requester = async (date) => {
    dates.push(date)
    return okEnvelope(fixtureFor(date || '2026-07-24'))
  }

  await loadSupervisorOperationDays({ requester })
  await loadSupervisorOperationDays({ requester })

  assert.deepEqual(dates, [
    undefined,
    '2026-07-23',
    undefined,
    '2026-07-23',
  ])
})

test('el límite civil inferior conserva Hoy y degrada solo Ayer', async () => {
  const dates = []
  const result = await loadSupervisorOperationDays({
    requester: async (date) => {
      dates.push(date)
      return okEnvelope(fixtureFor('0001-01-01'))
    },
  })

  assert.deepEqual(dates, [undefined])
  assert.equal(result.today.kind, 'valid')
  assert.equal(result.today.payload.date, '0001-01-01')
  assert.equal(result.yesterday.kind, 'date_unavailable')
})
