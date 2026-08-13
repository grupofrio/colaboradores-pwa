import test from 'node:test'
import assert from 'node:assert/strict'

import { api } from '../src/lib/api.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

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
    async json() {
      return payload
    },
  }
}

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    employee_id: 730,
    company_id: 35,
    ...session,
  }))
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

test('harvest with mermada bars uses canonical backend harvest endpoint atomically', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/api/ice/slot/harvest') {
      return createJsonResponse(200, {
        ok: true,
        message: 'Cosecha registrada. Pendiente de recepcion PT.',
        data: {
          slot_id: 33,
          packing_entry_id: 91,
          qty_units: 6,
          scrap: {
            scrap_id: 77,
            move_id: 501,
            move_state: 'done',
            reason_id: 2,
            qty_bars: 2,
            location_id: 1085,
            location_dest_id: 1173,
          },
        },
      })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('POST', '/pwa-prod/harvest-with-pt-reception', {
    slot_id: 33,
    shift_id: 55,
    temperature: -10.5,
    slot: { id: 33, name: 'A1', product_id: 900, product_name: 'MP Barra Grande' },
    tank: { id: 9, display_name: 'Tanque 3 Iguala', line_id: 1, bars_per_basket: 8, kg_per_bar: 50 },
    line_type: 'barra',
    product_id: 900,
    source_product_id: 900,
    qty_reported: 6,
    scrap_bars: 2,
  })

  const harvestCall = calls.find((call) => call.url === '/odoo-api/api/ice/slot/harvest')
  assert.ok(harvestCall)
  assert.equal(harvestCall.payload.slot_id, 33)
  assert.equal(harvestCall.payload.shift_id, 55)
  assert.equal(harvestCall.payload.temperatura, -10.5)
  assert.equal(harvestCall.payload.operator_id, 730)
  assert.equal(harvestCall.payload.product_id, 900)
  assert.equal(harvestCall.payload.source_product_id, 900)
  assert.equal(harvestCall.payload.scrap_bars, 2)
  assert.equal(harvestCall.payload.scrap_reason_id, undefined)
  assert.equal(harvestCall.payload.line_id, 1)
  assert.equal(harvestCall.payload.machine_id, 9)
  assert.equal(harvestCall.payload.scrap_source_location_id, 1085)
  assert.equal(harvestCall.payload.scrap_dest_location_id, 1173)

  const directScrapCalls = calls.filter((call) => call.payload?.params?.model === 'gf.production.scrap')
  assert.equal(directScrapCalls.length, 0)
  const directMoveCalls = calls.filter((call) => call.payload?.params?.model === 'stock.move')
  assert.equal(directMoveCalls.length, 0)
  const legacyHarvestCalls = calls.filter((call) => call.payload?.params?.model === 'x_ice.brine.slot')
  assert.equal(legacyHarvestCalls.length, 0)
  const packCalls = calls.filter((call) => call.url === '/odoo-api/api/production/pack')
  assert.equal(packCalls.length, 0)

  assert.equal(result.ok, true)
  assert.equal(result.scrap.ok, true)
  assert.equal(result.scrap.data.scrap_id, 77)
  assert.equal(result.scrap_inventory_move.ok, true)
  assert.equal(result.scrap_inventory_move.data.move_id, 501)
  assert.equal(result.pt_reception.ok, true)
  assert.equal(result.pt_reception.data.packing_entry_id, 91)
})

test('harvest with pt reception sends plain harvest to canonical backend endpoint', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/api/ice/slot/harvest') {
      return createJsonResponse(200, {
        ok: true,
        data: {
          slot_id: 33,
          packing_entry_id: 91,
          qty_units: 8,
        },
      })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('POST', '/pwa-prod/harvest-with-pt-reception', {
    slot_id: 33,
    shift_id: 55,
    temperature: -10.5,
    slot: { id: 33, name: 'A1', product_id: 900, product_name: 'MP Barra Grande' },
    tank: { id: 9, display_name: 'Tanque 3 Iguala', line_id: 1, bars_per_basket: 8, kg_per_bar: 50 },
    line_type: 'barra',
    product_id: 900,
    source_product_id: 900,
    qty_reported: 8,
  })

  const harvestCall = calls.find((call) => call.url === '/odoo-api/api/ice/slot/harvest')
  assert.ok(harvestCall)
  assert.equal(harvestCall.payload.slot_id, 33)
  assert.equal(harvestCall.payload.temperatura, -10.5)
  assert.equal(harvestCall.payload.product_id, 900)
  assert.equal(harvestCall.payload.source_product_id, 900)
  assert.equal(harvestCall.payload.scrap_bars, 0)
  assert.equal(calls.some((call) => call.payload?.params?.model === 'x_ice.brine.slot'), false)
  assert.equal(result.ok, true)
  assert.equal(result.pt_reception.data.packing_entry_id, 91)
})

test('harvest with pt reception does not call legacy slot harvest when canonical endpoint rejects', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/api/ice/slot/harvest') {
      return createJsonResponse(200, { ok: false, message: 'No se pudo crear entrada PT' })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('POST', '/pwa-prod/harvest-with-pt-reception', {
    slot_id: 33,
    shift_id: 55,
    temperature: -10.5,
    slot: { id: 33, name: 'A1', product_id: 724, product_name: 'BARRA DE HIELO GRANDE (75KG)' },
    tank: { id: 9, display_name: 'Tanque 3 Iguala', line_id: 1, bars_per_basket: 8, kg_per_bar: 75 },
    line_type: 'barra',
    product_id: 724,
    source_product_id: 763,
    qty_reported: 8,
  })

  const canonicalHarvestCall = calls.find((call) => call.url === '/odoo-api/api/ice/slot/harvest')
  const legacyHarvestCallIndex = calls.findIndex((call) => {
    const params = call.payload?.params || {}
    return params.model === 'x_ice.brine.slot' && params.method === 'function'
  })

  assert.ok(canonicalHarvestCall)
  assert.equal(legacyHarvestCallIndex, -1)
  assert.equal(result.ok, false)
  assert.equal(result.harvested, false)
  assert.equal(result.harvest.ok, false)
  assert.equal(result.pt_reception.ok, false)
  assert.match(result.error, /No se pudo crear entrada PT/)
})
