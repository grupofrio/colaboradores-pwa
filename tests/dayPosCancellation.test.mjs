import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { createServer } from 'vite'
import qz from 'qz-tray'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const DAY_SESSION = Object.freeze({
  employee_id: 801,
  session_token: 'day-session',
  gf_employee_token: 'day-employee-token',
  api_key: 'day-api-key',
  role: 'pos_diurno',
  name: 'Operador POS día',
  company_id: 34,
  warehouse_id: 89,
  warehouse_name: 'Iguala',
  sucursal: 'Iguala',
})

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const qzOriginals = {
  isActive: qz.websocket.isActive,
  getDefault: qz.printers.getDefault,
  create: qz.configs.create,
  print: qz.print,
}

let vite
let runtimePromise
const activeRenderers = new Set()

function localStorageMock() {
  const values = new Map()
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

function documentMock() {
  return {
    body: {
      appendChild() {},
      removeChild() {},
    },
    createElement() {
      return {
        setAttribute() {},
        style: {},
        contentWindow: {
          document: {
            readyState: 'loading',
            open() {},
            write() {},
            close() {},
          },
          addEventListener() {},
          focus() {},
          print() {},
        },
      }
    },
  }
}

function response(status, payload) {
  const text = JSON.stringify(payload)
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return text },
    async json() { return payload },
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function order(state = 'sale') {
  return {
    id: 9001,
    name: 'DIA-9001',
    state,
    can_cancel: state === 'sale',
    cancel_block_code: state === 'sale' ? null : 'already_cancelled',
    date_order: '2026-07-26 18:15:00',
    partner_name: 'VENTA PUBLICO IGUALA',
    payment_method: 'cash',
    lines: [{ qty: 2, price_unit: 42, product_name: 'Hielo Prueba' }],
  }
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

function renderedText(renderer) {
  return renderedInstanceText(renderer.toJSON())
}

function findButton(renderer, label) {
  return renderer.root.findAllByType('button').find((button) => (
    renderedInstanceText(button) === label
  ))
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const [screenModule, appModule, flowModule] = await Promise.all([
        vite.ssrLoadModule('/src/modules/admin/ScreenTicket.jsx'),
        vite.ssrLoadModule('/src/App.jsx'),
        vite.ssrLoadModule('/src/modules/admin/posFlow.js'),
      ])
      return {
        ScreenTicket: screenModule.default,
        SessionContext: appModule.SessionContext,
        DAY_POS_FLOW: flowModule.DAY_POS_FLOW,
      }
    })()
  }
  return runtimePromise
}

function NavigationCapture({ onNavigate }) {
  const navigate = useNavigate()
  React.useEffect(() => onNavigate(navigate), [navigate, onNavigate])
  return null
}

async function mountTicketHarness(initialOrderId = 9001) {
  const runtime = await loadRuntime()
  let navigate
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [`/pos-diurno/ticket/${initialOrderId}`],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(React.Fragment, null,
          React.createElement(NavigationCapture, {
            onNavigate: (navigateFn) => { navigate = navigateFn },
          }),
          React.createElement(
            runtime.SessionContext.Provider,
            { value: { session: DAY_SESSION } },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, {
                path: '/pos-diurno/ticket/:orderId',
                element: React.createElement(runtime.ScreenTicket, { flow: runtime.DAY_POS_FLOW }),
              }),
            ),
          ),
        ),
      ),
    )
    await flush()
  })
  activeRenderers.add(renderer)
  return {
    renderer,
    navigateTo(orderId) { navigate(`/pos-diurno/ticket/${orderId}`) },
  }
}

async function mountTicket() {
  return (await mountTicketHarness()).renderer
}

beforeEach(() => {
  globalThis.localStorage = localStorageMock()
  globalThis.localStorage.setItem('gf_session', JSON.stringify(DAY_SESSION))
  globalThis.window = {
    innerWidth: 390,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    location: { origin: 'http://localhost' },
  }
  globalThis.document = documentMock()
})

afterEach(async () => {
  for (const renderer of activeRenderers) {
    await act(async () => {
      renderer.unmount()
      await flush()
    })
  }
  activeRenderers.clear()
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
  globalThis.document = originalDocument
  qz.websocket.isActive = qzOriginals.isActive
  qz.printers.getDefault = qzOriginals.getDefault
  qz.configs.create = qzOriginals.create
  qz.print = qzOriginals.print
})

after(async () => {
  await vite?.close()
})

test('day ticket scopes detail and cancellation, uses closed reasons, and prints the shared order', async () => {
  const calls = []
  let detailReads = 0
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      detailReads += 1
      return response(200, { ok: true, data: order(detailReads > 1 ? 'cancel' : 'sale') })
    }
    if (url === '/odoo-api/pwa-admin/sale-cancel') {
      return response(200, { result: { ok: true, data: { id: 9001, state: 'cancel' } } })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const printCalls = []
  qz.websocket.isActive = () => true
  qz.printers.getDefault = async () => 'POS-80'
  qz.configs.create = (printer, options) => ({ printer, options })
  qz.print = async (config, data) => { printCalls.push({ config, data }) }

  const renderer = await mountTicket()
  assert.match(renderedText(renderer), /DIA-9001/)

  await act(async () => {
    findButton(renderer, 'Imprimir').props.onClick()
    await flush()
  })
  assert.equal(printCalls.length, 1)
  const rawTicket = printCalls[0].data.map((item) => String(item.data || '')).join('')
  assert.match(rawTicket, /DIA-9001/)
  assert.match(rawTicket, /VENTA PUBLICO IGUALA/)
  assert.match(rawTicket, /Hielo Prueba/)

  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  assert.equal(renderer.root.findAllByType('textarea').length, 0)
  const reasons = renderer.root.findAllByType('input').filter((input) => input.props.type === 'radio')
  assert.deepEqual(reasons.map((reason) => reason.props.value), [
    'duplicate',
    'error',
    'customer_cancelled',
    'out_of_stock',
  ])
  act(() => renderer.root.findByProps({ value: 'duplicate' }).props.onChange())
  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })

  const cancellation = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-cancel')
  assert.deepEqual(cancellation.payload.params, {
    order_id: 9001,
    reason_code: 'duplicate',
    pos_scope: 'day',
  })
  assert.equal(detailReads, 2)
  assert.ok(calls.filter((call) => call.url.includes('/sale-detail?')).every((call) => (
    new URL(call.url, 'http://local').searchParams.get('pos_scope') === 'day'
  )))

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('cached day ticket shows a safe 403 error once without retry or scope downgrade', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return response(403, { message: 'SENSITIVE_TICKET_SCOPE_DETAIL', code: 'forbidden' })
  }

  const renderer = await mountTicket()
  assert.match(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
  assert.doesNotMatch(renderedText(renderer), /SENSITIVE_TICKET_SCOPE_DETAIL/)
  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day',
  ])
  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('revoked day permission during cancellation fails closed without retry or false success', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, { ok: true, data: order('sale') })
    }
    if (url === '/odoo-api/pwa-admin/sale-cancel') {
      return response(403, {
        message: 'SENSITIVE_REVOKED_CANCEL_DETAIL',
        code: 'forbidden',
      })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const renderer = await mountTicket()
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'duplicate' }).props.onChange())
  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })

  assert.equal(
    renderedInstanceText(renderer.root.findByProps({ role: 'alert' })),
    'Tu perfil ya no tiene acceso al POS día. Solicita revisar el permiso.',
  )
  const text = renderedText(renderer)
  assert.match(text, /DIA-9001/)
  assert.doesNotMatch(text, /SENSITIVE_REVOKED_CANCEL_DETAIL/)
  assert.doesNotMatch(text, /Venta cancelada|Esta venta está cancelada/)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.equal(renderer.root.findByProps({ value: 'duplicate' }).props.checked, true)

  const cancellationCalls = calls.filter((call) => (
    call.url === '/odoo-api/pwa-admin/sale-cancel'
  ))
  assert.equal(cancellationCalls.length, 1)
  assert.deepEqual(cancellationCalls[0].payload.params, {
    order_id: 9001,
    reason_code: 'duplicate',
    pos_scope: 'day',
  })
  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day',
    '/odoo-api/pwa-admin/sale-cancel',
  ])

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('ticket route A to B ignores late A and cancellation stays bound to displayed B', async () => {
  const detailA = deferred()
  const detailB = deferred()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return detailA.promise
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day') {
      return detailB.promise
    }
    if (url === '/odoo-api/pwa-admin/sale-cancel') {
      return response(403, { message: 'SENSITIVE_B_CANCEL', code: 'forbidden' })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const { renderer, navigateTo } = await mountTicketHarness(9001)
  await act(async () => {
    navigateTo(9002)
    await flush()
  })
  await act(async () => {
    detailB.resolve(response(200, {
      ok: true,
      data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
    }))
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /DIA-9001/)

  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'error' }).props.onChange())
  await act(async () => {
    detailA.resolve(response(200, { ok: true, data: order('sale') }))
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /DIA-9001/)
  assert.equal(renderer.root.findByProps({ value: 'error' }).props.checked, true)

  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })
  const cancelCalls = calls.filter((call) => call.url === '/odoo-api/pwa-admin/sale-cancel')
  assert.equal(cancelCalls.length, 1)
  assert.deepEqual(cancelCalls[0].payload.params, {
    order_id: 9002,
    reason_code: 'error',
    pos_scope: 'day',
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /Venta cancelada/)

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('ticket route change resets modal and reason state before rendering B', async () => {
  const detailB = deferred()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, { ok: true, data: order('sale') })
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day') {
      return detailB.promise
    }
    throw new Error(`Unexpected ${url}`)
  }

  const { renderer, navigateTo } = await mountTicketHarness(9001)
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'out_of_stock' }).props.onChange())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)

  await act(async () => {
    navigateTo(9002)
    await flush()
  })
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.doesNotMatch(renderedText(renderer), /DIA-9001/)

  await act(async () => {
    detailB.resolve(response(200, {
      ok: true,
      data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
    }))
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  assert.equal(renderer.root.findByProps({ value: 'out_of_stock' }).props.checked, false)
  assert.equal(findButton(renderer, 'Sí, cancelar').props.disabled, true)

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day',
    '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day',
  ])

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('late A error cannot affect B and a detail response after unmount is ignored', async () => {
  const detailA = deferred()
  const detailC = deferred()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return detailA.promise
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day') {
      return response(200, {
        ok: true,
        data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
      })
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9003&pos_scope=day') {
      return detailC.promise
    }
    throw new Error(`Unexpected ${url}`)
  }

  const { renderer, navigateTo } = await mountTicketHarness(9001)
  await act(async () => {
    navigateTo(9002)
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  await act(async () => {
    detailA.resolve(response(403, {
      message: 'SENSITIVE_STALE_ROUTE_ERROR',
      code: 'forbidden',
    }))
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /SENSITIVE_STALE_ROUTE_ERROR|Tu perfil ya no tiene acceso/)

  await act(async () => {
    navigateTo(9003)
    await flush()
  })
  await act(async () => {
    renderer.unmount()
    activeRenderers.delete(renderer)
    detailC.resolve(response(403, {
      message: 'SENSITIVE_UNMOUNTED_ROUTE_ERROR',
      code: 'forbidden',
    }))
    await flush()
  })
  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day',
    '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day',
    '/odoo-api/pwa-admin/sale-detail?order_id=9003&pos_scope=day',
  ])
})

test('ticket rejects a detail payload whose order ID does not match the route', async () => {
  globalThis.fetch = async (url) => {
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, {
        ok: true,
        data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
      })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const renderer = await mountTicket()
  assert.match(renderedText(renderer), /No se pudo validar el ticket solicitado/)
  assert.doesNotMatch(renderedText(renderer), /DIA-9001|DIA-9002/)
  assert.equal(findButton(renderer, 'Cancelar venta'), undefined)

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('pending cancellation from ticket A cannot mutate ticket B after route change', async () => {
  const pendingCancellation = deferred()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, { ok: true, data: order('sale') })
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day') {
      return response(200, {
        ok: true,
        data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
      })
    }
    if (url === '/odoo-api/pwa-admin/sale-cancel') return pendingCancellation.promise
    throw new Error(`Unexpected ${url}`)
  }

  const { renderer, navigateTo } = await mountTicketHarness(9001)
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'duplicate' }).props.onChange())
  act(() => { findButton(renderer, 'Sí, cancelar').props.onClick() })
  await act(async () => { await flush() })
  assert.equal(calls.filter((call) => call.url === '/odoo-api/pwa-admin/sale-cancel').length, 1)

  await act(async () => {
    navigateTo(9002)
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  await act(async () => {
    pendingCancellation.resolve(response(200, {
      result: { ok: true, data: { id: 9001, state: 'cancel' } },
    }))
    await flush()
  })

  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /DIA-9001|Venta cancelada/)
  assert.deepEqual(calls.filter((call) => call.url.includes('/sale-detail?')).map((call) => call.url), [
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day',
    '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day',
  ])

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('route change clears ticket A print fallback notice before rendering ticket B', async () => {
  globalThis.fetch = async (url) => {
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, { ok: true, data: order('sale') })
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day') {
      return response(200, {
        ok: true,
        data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
      })
    }
    throw new Error(`Unexpected ${url}`)
  }
  qz.websocket.isActive = () => true
  qz.printers.getDefault = async () => 'POS-80'
  qz.configs.create = () => ({})
  qz.print = async () => { throw new Error('QZ unavailable') }

  const { renderer, navigateTo } = await mountTicketHarness(9001)
  await act(async () => {
    findButton(renderer, 'Imprimir').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /Impresión directa no disponible/)

  await act(async () => {
    navigateTo(9002)
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /Impresión directa no disponible/)

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('late QZ failure from ticket A cannot show a notice or print fallback on ticket B', async () => {
  const pendingPrint = deferred()
  let fallbackCreates = 0
  const createElement = globalThis.document.createElement
  globalThis.document.createElement = (...args) => {
    fallbackCreates += 1
    return createElement(...args)
  }
  globalThis.fetch = async (url) => {
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, { ok: true, data: order('sale') })
    }
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9002&pos_scope=day') {
      return response(200, {
        ok: true,
        data: { ...order('sale'), id: 9002, name: 'DIA-9002' },
      })
    }
    throw new Error(`Unexpected ${url}`)
  }
  qz.websocket.isActive = () => true
  qz.printers.getDefault = async () => 'POS-80'
  qz.configs.create = () => ({})
  qz.print = () => pendingPrint.promise

  const { renderer, navigateTo } = await mountTicketHarness(9001)
  act(() => { findButton(renderer, 'Imprimir').props.onClick() })
  await act(async () => { await flush() })
  await act(async () => {
    navigateTo(9002)
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)

  await act(async () => {
    pendingPrint.reject(new Error('QZ A failed late'))
    await flush()
  })
  assert.match(renderedText(renderer), /DIA-9002/)
  assert.doesNotMatch(renderedText(renderer), /Impresión directa no disponible/)
  assert.equal(fallbackCreates, 0)

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('standalone ticket back control has a stable accessible name and 44px touch target', async () => {
  globalThis.fetch = async (url) => {
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day') {
      return response(200, { ok: true, data: order('sale') })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const renderer = await mountTicket()
  const back = renderer.root.findByProps({ 'aria-label': 'Volver al POS' })
  assert.ok(Number(back.props.style?.width || back.props.style?.minWidth) >= 44)
  assert.ok(Number(back.props.style?.height || back.props.style?.minHeight) >= 44)

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})
