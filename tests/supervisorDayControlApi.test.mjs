import test from 'node:test'
import assert from 'node:assert/strict'

import {
  requestSupervisorDayControl,
  SUPERVISOR_DAY_CONTROL_PATH,
} from '../src/modules/supervisor-ventas/dayControl/api.js'
import { api } from '../src/lib/api.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

const FORBIDDEN = new Set([
  'employee_id',
  'company_id',
  'branch_id',
  'analytic_account_id',
  'warehouse_id',
  'tz',
  'timezone',
])

function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      store = {}
    },
  }
}

function createJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload)
    },
  }
}

function setSession() {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    gf_employee_token: 'employee-token-test',
    employee_id: 717,
    company_id: 34,
    branch_id: 12,
    warehouse_id: 89,
    x_analytic_account_id: [901, 'CEDIS Iguala'],
    tz: 'America/Mexico_City',
    timezone: 'America/Mexico_City',
  }))
}

function assertNoForbiddenKeys(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    assert.equal(FORBIDDEN.has(key), false, `la petición no debe incluir ${key}`)
    assertNoForbiddenKeys(child)
  }
}

function captureCalls(calls) {
  globalThis.fetch = async (url, options = {}) => {
    const payload = JSON.parse(options.body)
    calls.push({
      url,
      method: options.method,
      headers: options.headers,
      params: payload.params,
    })
    return createJsonResponse(200, {
      result: {
        status: 'ok',
      },
    })
  }
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
  setSession()
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

test('Hoy usa Odoo directo y omite fecha, identidad, scope y timezone', async () => {
  const calls = []
  captureCalls(calls)

  const response = await requestSupervisorDayControl()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `/odoo-api${SUPERVISOR_DAY_CONTROL_PATH}`)
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].params, { data: {} })
  assert.equal(calls[0].headers['X-GF-Employee-Token'], 'employee-token-test')
  assertNoForbiddenKeys(calls[0].params)
  assert.equal(response.status, 'ok')
})

test('Ayer envía solo la fecha civil validada', async () => {
  const calls = []
  captureCalls(calls)

  await requestSupervisorDayControl('2026-07-23')

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, {
    data: {
      date: '2026-07-23',
    },
  })
  assertNoForbiddenKeys(calls[0].params)
})

test('una fecha inválida no toca la red', async () => {
  const calls = []
  captureCalls(calls)

  await assert.rejects(
    async () => requestSupervisorDayControl('2026-02-29'),
    /fecha operativa/i,
  )
  assert.equal(calls.length, 0)
})

test('Day Control rechaza métodos distintos de POST sin caer a n8n', async () => {
  const calls = []
  captureCalls(calls)

  await assert.rejects(
    api('GET', `${SUPERVISOR_DAY_CONTROL_PATH}?unexpected=1`),
    (error) => error?.status === 405 && error?.code === 'method_not_allowed',
  )
  assert.equal(calls.length, 0)
})
