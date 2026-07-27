import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { createServer } from 'vite'
import { DAY_POS_FLOW } from '../src/modules/admin/posFlow.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const sharedScreenUrl = new URL('../src/modules/admin/ScreenRestrictedPosSales.jsx', import.meta.url)
const dayScreenUrl = new URL('../src/modules/admin/ScreenDayPosSales.jsx', import.meta.url)
const sharedScreenPath = fileURLToPath(sharedScreenUrl)
const dayScreenPath = fileURLToPath(dayScreenUrl)

const RESTRICTED_FLOW = Object.freeze({
  posRoute: '/pos-restringido',
  ticketBasePath: '/pos-restringido/ticket',
})

const POS_SESSION = Object.freeze({
  session_token: 'day-session',
  api_key: 'api-key',
  gf_employee_token: 'day-employee-token',
  employee_id: 801,
  role: 'pos_diurno',
  company_id: 34,
  warehouse_id: 89,
  sucursal: 'Iguala',
  name: 'Operador POS día',
})

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window
const originalDocument = globalThis.document

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

function setDaySession() {
  globalThis.localStorage.setItem('gf_session', JSON.stringify(POS_SESSION))
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
  assert.ok(existsSync(sharedScreenPath), 'falta ScreenRestrictedPosSales.jsx')
  assert.ok(existsSync(dayScreenPath), 'falta ScreenDayPosSales.jsx')
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const sharedModule = await vite.ssrLoadModule('/src/modules/admin/ScreenRestrictedPosSales.jsx')
      const dayModule = await vite.ssrLoadModule('/src/modules/admin/ScreenDayPosSales.jsx')
      const posModule = await vite.ssrLoadModule('/src/modules/admin/ScreenPOS.jsx')
      const appModule = await vite.ssrLoadModule('/src/App.jsx')
      return {
        SharedScreen: sharedModule.default,
        DayScreen: dayModule.default,
        PosScreen: posModule.default,
        SessionContext: appModule.SessionContext,
        formatRestrictedPosSaleTime: sharedModule.formatRestrictedPosSaleTime,
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
  globalThis.document = originalDocument
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderedText(renderer) {
  function collect(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return []
    if (typeof node === 'string' || typeof node === 'number') return [String(node)]
    if (Array.isArray(node)) return node.flatMap(collect)
    return collect(node.children)
  }

  return collect(renderer.toJSON()).join(' ').replace(/\s+/g, ' ').trim()
}

function renderedInstanceText(instance) {
  function collect(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return []
    if (typeof node === 'string' || typeof node === 'number') return [String(node)]
    if (Array.isArray(node)) return node.flatMap(collect)
    return collect(node.children)
  }

  return collect(instance).join(' ').replace(/\s+/g, ' ').trim()
}

function hasAncestorClass(instance, className) {
  let current = instance.parent
  while (current) {
    const classes = String(current.props?.className || '').split(/\s+/)
    if (classes.includes(className)) return true
    current = current.parent
  }
  return false
}

function assertMinimumTouchTarget(renderer, control, label) {
  const inlineMinimum = Number(control.props.style?.minHeight || 0)
  if (inlineMinimum >= 44) return

  assert.equal(
    hasAncestorClass(control, 'restricted-pos-sales-main'),
    true,
    `${label} debe estar dentro del alcance táctil de ventas restringidas`,
  )
  const renderedStyles = renderer.root
    .findAllByType('style')
    .map(renderedInstanceText)
    .join('\n')
  assert.match(
    renderedStyles,
    /\.restricted-pos-sales-main button\s*\{\s*min-height:\s*44px;/,
    `${label} debe heredar un mínimo táctil de 44px`,
  )
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function LocationProbe() {
  const location = useLocation()
  return React.createElement('output', { 'data-location': location.pathname }, location.pathname)
}

function screenTree(Screen, props, initialEntry) {
  return React.createElement(
    MemoryRouter,
    {
      initialEntries: [initialEntry],
      future: { v7_startTransition: true, v7_relativeSplatPath: true },
    },
    React.createElement(Screen, props),
    React.createElement(LocationProbe),
  )
}

async function createSharedScreen({
  loadSales,
  flow = RESTRICTED_FLOW,
  screenName = 'POS restringido',
} = {}) {
  const { SharedScreen } = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(screenTree(
      SharedScreen,
      { flow, loadSales, screenName },
      '/pos-restringido/ventas',
    ))
    await flush()
  })
  return renderer
}

test('shared screen shows loading, then an empty state, without date or range controls', async () => {
  const request = deferred()
  const calls = []
  const renderer = await createSharedScreen({
    loadSales: (...args) => {
      calls.push(args)
      return request.promise
    },
  })

  assert.deepEqual(calls, [[]])
  assert.match(renderedText(renderer), /Cargando ventas de hoy/)
  assert.equal(renderer.root.findAllByType('input').length, 0)
  assert.equal(renderer.root.findAllByType('select').length, 0)

  await act(async () => {
    request.resolve({ ok: true, data: { items: [] } })
    await flush()
  })

  assert.match(renderedText(renderer), /No hay ventas registradas hoy/)
  assert.equal(calls.length, 1, 'sin polling ni recargas automáticas')
  act(() => renderer.unmount())
})

test('shared screen hides failure-envelope details and retries only on request', async () => {
  let attempts = 0
  const loadSales = async () => {
    attempts += 1
    if (attempts === 1) {
      return {
        ok: false,
        data: { error: { message: 'SENSITIVE_NOT_OWNER' } },
      }
    }
    return {
      ok: true,
      data: { items: [{ order_id: 7102, name: 'VENTA RECUPERADA', state: 'sale' }] },
    }
  }
  const renderer = await createSharedScreen({ loadSales })

  assert.match(renderedText(renderer), /No se pudieron cargar las ventas de hoy/)
  assert.doesNotMatch(renderedText(renderer), /SENSITIVE_NOT_OWNER/)
  assert.equal(attempts, 1)

  const retry = renderer.root.findAllByType('button').find((button) => (
    button.children.join('') === 'Reintentar'
  ))
  assert.ok(retry)
  assertMinimumTouchTarget(renderer, retry, 'Reintentar')
  await act(async () => {
    retry.props.onClick()
    await flush()
  })

  assert.match(renderedText(renderer), /VENTA RECUPERADA/)
  assert.doesNotMatch(renderedText(renderer), /No se pudieron cargar/)
  assert.equal(attempts, 2)
  act(() => renderer.unmount())
})

test('shared screen treats thrown and nested failure envelopes as safe retryable errors', async () => {
  const failures = [
    () => Promise.reject(new Error('cancel_block_code=not_owner')),
    () => Promise.resolve({ success: false, message: 'SENSITIVE_SUCCESS' }),
    () => Promise.resolve({ status: 'ERROR', user_message: 'SENSITIVE_STATUS' }),
    () => Promise.resolve({ data: { error: { message: 'SENSITIVE_NESTED' } } }),
  ]

  for (const loadSales of failures) {
    const renderer = await createSharedScreen({ loadSales })
    const text = renderedText(renderer)
    assert.match(text, /No se pudieron cargar las ventas de hoy/)
    assert.doesNotMatch(text, /SENSITIVE_|not_owner|cancel_block_code/)
    assert.ok(renderer.root.findAllByType('button').some((button) => (
      button.children.join('') === 'Reintentar'
    )))
    act(() => renderer.unmount())
  }
})

test('day history treats a thrown 403 as a safe permission state without retry', async () => {
  let attempts = 0
  const permissionError = new Error('SENSITIVE_REVOKED_DAY_HISTORY')
  permissionError.status = 403
  const renderer = await createSharedScreen({
    flow: DAY_POS_FLOW,
    screenName: 'POS día',
    loadSales: async () => {
      attempts += 1
      throw permissionError
    },
  })

  const text = renderedText(renderer)
  assert.match(text, /Tu perfil ya no tiene acceso al POS día/)
  assert.doesNotMatch(text, /SENSITIVE_REVOKED_DAY_HISTORY|Revisa tu conexión/)
  assert.equal(renderer.root.findAllByType('button').some((button) => (
    button.children.join('') === 'Reintentar'
  )), false)
  assert.equal(attempts, 1)
  act(() => renderer.unmount())
})

test('shared screen suppresses stale request results when the loader changes', async () => {
  const first = deferred()
  const second = deferred()
  const { SharedScreen } = await loadRuntime()
  const firstLoader = () => first.promise
  const secondLoader = () => second.promise
  const element = (loadSales) => screenTree(
    SharedScreen,
    { flow: RESTRICTED_FLOW, loadSales, screenName: 'POS restringido' },
    '/pos-restringido/ventas',
  )

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(element(firstLoader))
    await flush()
  })
  await act(async () => {
    renderer.update(element(secondLoader))
    await flush()
  })
  await act(async () => {
    second.resolve({ data: { items: [{ order_id: 7202, name: 'RESPUESTA NUEVA' }] } })
    await flush()
  })
  await act(async () => {
    first.resolve({ data: { items: [{ order_id: 7201, name: 'RESPUESTA VIEJA' }] } })
    await flush()
  })

  assert.match(renderedText(renderer), /RESPUESTA NUEVA/)
  assert.doesNotMatch(renderedText(renderer), /RESPUESTA VIEJA/)
  act(() => renderer.unmount())
})

test('shared screen ignores a request that settles after unmount', async () => {
  const request = deferred()
  const renderer = await createSharedScreen({ loadSales: () => request.promise })
  act(() => renderer.unmount())

  await act(async () => {
    request.resolve({ data: { items: [{ order_id: 7301, name: 'TARDÍA' }] } })
    await flush()
  })

  assert.equal(renderer.toJSON(), null)
})

test('shared screen preserves backend order and renders Mexico time, statuses, and injected ticket paths', async () => {
  const renderer = await createSharedScreen({
    screenName: 'POS especial',
    loadSales: async () => ({
      data: {
        items: [
          {
            order_id: 7402,
            name: 'MÁS RECIENTE',
            partner_name: 'Cliente Iguala',
            date_order: '2026-07-25 03:10:00',
            amount_total: 1234.5,
            state: 'sale',
          },
          { order_id: 7401, name: 'ANTERIOR', partner_name: 'Público', state: 'done' },
          { order_id: 7400, name: 'CANCELADA', partner_name: 'Público', state: 'cancel' },
          { order_id: 7399, name: 'DESCONOCIDA', partner_name: 'Público', state: 'draft' },
          { order_id: 'unsafe', name: 'NO DEBE RENDERIZARSE' },
        ],
      },
    }),
  })

  const text = renderedText(renderer)
  assert.ok(text.indexOf('MÁS RECIENTE') < text.indexOf('ANTERIOR'))
  assert.match(text, /POS ESPECIAL/)
  assert.match(text, /21:10/)
  assert.match(text, /Cliente Iguala/)
  assert.match(text, /\$1,234\.50/)
  for (const label of ['Activa', 'Cerrada', 'Cancelada', 'Desconocida']) {
    assert.match(text, new RegExp(label))
  }
  assert.doesNotMatch(text, /NO DEBE RENDERIZARSE/)

  const saleRows = renderer.root.findAll((node) => node.props['data-sale-order-id'])
  assert.deepEqual(saleRows.map((node) => node.props['data-sale-order-id']), [7402, 7401, 7400, 7399])
  for (const saleRow of saleRows) {
    assertMinimumTouchTarget(renderer, saleRow, `ticket ${saleRow.props['data-sale-order-id']}`)
  }
  await act(async () => {
    saleRows[0].props.onClick()
    await flush()
  })
  assert.equal(renderer.root.findByType('output').props['data-location'], '/pos-restringido/ticket/7402')

  const back = renderer.root.findByProps({ 'aria-label': 'Volver al POS especial' })
  assert.equal(back.props.style.width, 44)
  assert.equal(back.props.style.height, 44)
  await act(async () => {
    back.props.onClick()
    await flush()
  })
  assert.equal(renderer.root.findByType('output').props['data-location'], '/pos-restringido')
  act(() => renderer.unmount())
})

test('shared formatter interprets zone-less Odoo datetimes as UTC for Mexico City', async () => {
  const { formatRestrictedPosSaleTime } = await loadRuntime()

  assert.equal(formatRestrictedPosSaleTime('2026-07-25 03:10:00'), '21:10')
  assert.equal(formatRestrictedPosSaleTime('invalid'), 'Hora no disponible')
  assert.equal(formatRestrictedPosSaleTime(null), 'Hora no disponible')
})

test('day wrapper injects the day loader and flow without client date filters', async () => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {}, addEventListener() {} }
  setDaySession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse({
      ok: true,
      data: {
        items: [{ order_id: 7501, name: 'DÍA 7501', state: 'sale' }],
      },
    })
  }

  const { DayScreen } = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(screenTree(DayScreen, {}, '/pos-diurno/ventas'))
    await flush()
  })

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/today-sales?pos_scope=day',
  ])
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'day-employee-token')
  assert.match(renderedText(renderer), /POS DÍA/)
  assert.equal(renderer.root.findAllByType('input').length, 0)

  const row = renderer.root.findByProps({ 'data-sale-order-id': 7501 })
  await act(async () => {
    row.props.onClick()
    await flush()
  })
  assert.equal(renderer.root.findByType('output').props['data-location'], '/pos-diurno/ticket/7501')

  const back = renderer.root.findByProps({ 'aria-label': 'Volver al POS día' })
  await act(async () => {
    back.props.onClick()
    await flush()
  })
  assert.equal(renderer.root.findByType('output').props['data-location'], '/pos-diurno')
  act(() => renderer.unmount())
})

test('desktop and mobile POS render 44px Ventas de hoy actions that use the injected flow', async () => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  setDaySession()
  globalThis.fetch = () => new Promise(() => {})
  const { PosScreen, SessionContext } = await loadRuntime()

  for (const [width, viewport] of [[1280, 'desktop'], [390, 'mobile']]) {
    globalThis.window = {
      innerWidth: width,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
      location: { reload() {} },
    }

    let renderer
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          MemoryRouter,
          {
            initialEntries: [DAY_POS_FLOW.posRoute],
            future: { v7_startTransition: true, v7_relativeSplatPath: true },
          },
          React.createElement(
            SessionContext.Provider,
            {
              value: {
                session: POS_SESSION,
                updateSession() {},
              },
            },
            React.createElement(PosScreen, { flow: DAY_POS_FLOW }),
          ),
          React.createElement(LocationProbe),
        ),
      )
      await flush()
    })

    const salesActions = renderer.root.findAllByType('button').filter((button) => (
      /^Ventas de hoy(?:\s|$)/.test(renderedInstanceText(button))
    ))
    assert.equal(salesActions.length, 1, `${viewport}: una acción Ventas de hoy`)
    assert.ok(
      Number(salesActions[0].props.style?.minHeight || 0) >= 44,
      `${viewport}: la acción Ventas de hoy conserva 44px`,
    )

    await act(async () => {
      salesActions[0].props.onClick()
      await flush()
    })
    assert.equal(
      renderer.root.findByType('output').props['data-location'],
      DAY_POS_FLOW.salesRoute,
      `${viewport}: navega por flow.salesRoute`,
    )
    act(() => renderer.unmount())
  }
})

test('generic screen contains no night identity, date-range, or hardcoded ticket policy', () => {
  assert.ok(existsSync(sharedScreenPath), 'falta ScreenRestrictedPosSales.jsx')
  const sharedSource = readFileSync(sharedScreenUrl, 'utf8')
  const daySource = readFileSync(dayScreenUrl, 'utf8')

  assert.match(sharedSource, /buildPosTicketPath\(flow, sale\.order_id\)/)
  assert.match(sharedSource, /navigate\(flow\.posRoute\)/)
  assert.doesNotMatch(sharedSource, /NIGHT_POS_FLOW|getNightTodaySales|H[eé]ctor|employee/)
  assert.doesNotMatch(sharedSource, /type=["']date["']|\bdate_from\b|\bdate_to\b/)
  assert.match(daySource, /ScreenRestrictedPosSales/)
  assert.match(daySource, /DAY_POS_FLOW/)
  assert.match(daySource, /getDayTodaySales/)
  assert.doesNotMatch(daySource, /useEffect|useState|\.map\(|\.filter\(/)
})
