import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const screenUrl = new URL('../src/modules/admin/ScreenNightPosSales.jsx', import.meta.url)
const screenPath = fileURLToPath(screenUrl)
const sharedScreenUrl = new URL('../src/modules/admin/ScreenRestrictedPosSales.jsx', import.meta.url)
const posSource = readFileSync(new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url), 'utf8')
const flowSource = readFileSync(new URL('../src/modules/admin/posFlow.js', import.meta.url), 'utf8')

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window

let vite
let runtimePromise

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

function setNightSession() {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'night-session',
    api_key: 'api-key',
    gf_employee_token: 'night-employee-token',
    employee_id: 730,
    role: 'desarrollador_ventas',
    name: 'Héctor Tapia',
  }))
}

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload)
    },
  }
}

async function loadRuntime() {
  assert.ok(existsSync(screenPath), 'falta ScreenNightPosSales.jsx')
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const module = await vite.ssrLoadModule('/src/modules/admin/ScreenNightPosSales.jsx')
      return {
        Screen: module.default,
        formatNightPosSaleTime: module.formatNightPosSaleTime,
      }
    })()
  }
  return runtimePromise
}

after(async () => {
  await vite?.close()
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
})

function renderedText(renderer) {
  function collect(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return []
    if (typeof node === 'string' || typeof node === 'number') return [String(node)]
    if (Array.isArray(node)) return node.flatMap(collect)
    return collect(node.children)
  }

  return collect(renderer.toJSON()).join(' ').replace(/\s+/g, ' ').trim()
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function LocationProbe() {
  const location = useLocation()
  return React.createElement('output', { 'data-location': location.pathname }, location.pathname)
}

test('night wrapper injects the existing night loader and flow', async () => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {}, addEventListener() {} }
  setNightSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse({
      ok: true,
      data: {
        items: [{
          order_id: 9001,
          name: 'NOCHE 9001',
          partner_name: 'Venta Público Iguala Noche',
          date_order: '2026-07-25 03:10:00',
          amount_total: 98.75,
          state: 'sale',
        }],
      },
    })
  }

  const { Screen } = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: ['/pos-nocturno/ventas'],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(Screen),
        React.createElement(LocationProbe),
      ),
    )
    await flush()
  })

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/today-sales?night_pos=1',
  ])
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'night-employee-token')
  const text = renderedText(renderer)
  assert.match(text, /POS NOCTURNO/)
  assert.match(text, /NOCHE 9001/)
  assert.match(text, /Venta Público Iguala Noche/)
  assert.match(text, /21:10/)
  assert.match(text, /\$98\.75/)
  assert.match(text, /Activa/)
  assert.equal(renderer.root.findAllByType('input').length, 0)

  const row = renderer.root.findByProps({ 'data-sale-order-id': 9001 })
  assert.equal(row.type, 'button')
  await act(async () => {
    row.props.onClick()
    await flush()
  })
  assert.equal(renderer.root.findByType('output').props['data-location'], '/pos-nocturno/ticket/9001')

  const back = renderer.root.findByProps({ 'aria-label': 'Volver al POS nocturno' })
  await act(async () => {
    back.props.onClick()
    await flush()
  })
  assert.equal(renderer.root.findByType('output').props['data-location'], '/pos-nocturno')
  act(() => renderer.unmount())
})

test('night compatibility formatter remains deterministic', async () => {
  const { formatNightPosSaleTime } = await loadRuntime()

  assert.equal(formatNightPosSaleTime('2026-07-25 03:10:00'), '21:10')
  assert.equal(formatNightPosSaleTime('invalid'), 'Hora no disponible')
  assert.equal(formatNightPosSaleTime(null), 'Hora no disponible')
})

test('night wrapper is thin and the shared component owns presentation and filtering', () => {
  assert.ok(existsSync(screenPath), 'falta ScreenNightPosSales.jsx')
  assert.ok(existsSync(fileURLToPath(sharedScreenUrl)), 'falta ScreenRestrictedPosSales.jsx')
  const source = readFileSync(screenUrl, 'utf8')

  assert.match(source, /ScreenRestrictedPosSales/)
  assert.match(source, /NIGHT_POS_FLOW/)
  assert.match(source, /getNightTodaySales/)
  assert.doesNotMatch(source, /useEffect|useState|\.map\(|\.filter\(|buildPosTicketPath/)
  assert.doesNotMatch(source, /type=["']date["']|\bdate_from\b|\bdate_to\b/)
})

test('mobile and desktop POS still expose sales only through flow.salesRoute', () => {
  const actionMatches = posSource.match(/\{flow\.salesRoute && \(/g) || []

  assert.equal(actionMatches.length, 2, 'una acción en desktop y otra en mobile')
  assert.ok(posSource.indexOf('flow.salesRoute') < posSource.indexOf('<AdminPosForm flow={flow} />'))
  assert.match(posSource, /navigate\(flow\.salesRoute\)/)
  const adminFlow = flowSource.match(/export const ADMIN_POS_FLOW = Object\.freeze\(\{[\s\S]*?\n\}\)/)
  assert.ok(adminFlow)
  assert.doesNotMatch(adminFlow[0], /salesRoute/)
})
