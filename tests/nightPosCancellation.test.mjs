import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const screenUrl = new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url)
const screenPath = fileURLToPath(screenUrl)
const screenSource = readFileSync(screenUrl, 'utf8')

const SESSION = {
  employee_id: 730,
  session_token: 'session-token-test',
  gf_employee_token: 'employee-token-test',
  api_key: 'api-key-test',
  name: 'Héctor Tapia',
  warehouse_id: 89,
  warehouse_name: 'Iguala',
  company_id: 34,
}

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window

let vite
let runtimePromise

function createLocalStorageMock() {
  const values = new Map()
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
    clear() { values.clear() },
  }
}

function createJsonResponse(status, payload) {
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

async function loadRuntime() {
  assert.ok(existsSync(screenPath), 'falta ScreenTicket.jsx')
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const [screenModule, appModule, flowModule, serviceModule] = await Promise.all([
        vite.ssrLoadModule('/src/modules/admin/ScreenTicket.jsx'),
        vite.ssrLoadModule('/src/App.jsx'),
        vite.ssrLoadModule('/src/modules/admin/posFlow.js'),
        vite.ssrLoadModule('/src/modules/admin/adminService.js'),
      ])
      return {
        Screen: screenModule.default,
        SessionContext: appModule.SessionContext,
        ADMIN_POS_FLOW: flowModule.ADMIN_POS_FLOW,
        NIGHT_POS_FLOW: flowModule.NIGHT_POS_FLOW,
        BACKEND_CAPS: serviceModule.BACKEND_CAPS,
      }
    })()
  }
  return runtimePromise
}

function orderFixture(overrides = {}) {
  return {
    id: 9001,
    name: 'S09001',
    state: 'sale',
    can_cancel: true,
    cancel_block_code: null,
    date_order: '2026-07-25 03:10:00',
    partner_name: 'Cliente Iguala',
    payment_method: 'cash',
    lines: [{ qty: 1, price_unit: 100, product_name: 'Bolsa de hielo' }],
    ...overrides,
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

function installSaleApi({
  initialOrder = orderFixture(),
  reloadedOrder,
  cancelResponse,
} = {}) {
  const calls = []
  let detailReads = 0
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001') {
      detailReads += 1
      const order = detailReads > 1 && reloadedOrder ? reloadedOrder : initialOrder
      return createJsonResponse(200, { ok: true, data: order })
    }
    if (url === '/odoo-api/pwa-admin/sale-cancel') {
      if (cancelResponse) return cancelResponse({ calls, payload })
      return createJsonResponse(200, {
        result: { ok: true, data: { id: 9001, state: 'cancel' } },
      })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }
  return calls
}

async function createTicket({ flowName = 'night', order = orderFixture(), apiOptions = {} } = {}) {
  const runtime = await loadRuntime()
  const flow = flowName === 'admin' ? runtime.ADMIN_POS_FLOW : runtime.NIGHT_POS_FLOW
  const calls = installSaleApi({ initialOrder: order, ...apiOptions })
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [flow.ticketBasePath + '/9001'],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(
          runtime.SessionContext.Provider,
          { value: { session: SESSION } },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: flow.ticketBasePath + '/:orderId',
              element: React.createElement(runtime.Screen, { flow }),
            }),
          ),
        ),
      ),
    )
    await flush()
  })
  return { renderer, calls, runtime }
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.localStorage.setItem('gf_session', JSON.stringify(SESSION))
  globalThis.window = {
    innerWidth: 390,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  }
})

afterEach(async () => {
  if (runtimePromise) {
    const { BACKEND_CAPS } = await runtimePromise
    BACKEND_CAPS.saleCancel = true
  }
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
})

after(async () => {
  await vite?.close()
})

test('night ticket shows exactly four accessible closed reasons and no free text', async () => {
  const { renderer } = await createTicket()
  const open = findButton(renderer, 'Cancelar venta')
  assert.ok(open)
  assert.ok(Number(open.props.style.minHeight) >= 44)

  act(() => open.props.onClick())

  const radios = renderer.root.findAllByType('input').filter((input) => input.props.type === 'radio')
  assert.equal(radios.length, 4)
  assert.equal(renderer.root.findAllByType('textarea').length, 0)
  assert.deepEqual(radios.map((radio) => radio.props.value), [
    'duplicate',
    'error',
    'customer_cancelled',
    'out_of_stock',
  ])
  assert.deepEqual(
    radios.map((radio) => (
      renderer.root.findByProps({ htmlFor: radio.props.id }).props.children.at(-1).props.children
    )),
    ['Duplicidad', 'Error', 'Canceló', 'Falta de stock'],
  )
  for (const radio of radios) {
    const label = renderer.root.findByProps({ htmlFor: radio.props.id })
    assert.ok(Number(label.props.style.minHeight) >= 44)
    assert.equal(radio.props.name, 'cancel-reason')
  }
  assert.match(screenSource, /\.night-cancel-reason:focus-visible/)

  const confirm = findButton(renderer, 'Sí, cancelar')
  assert.equal(confirm.props.disabled, true)
  assert.ok(Number(confirm.props.style.minHeight) >= 44)
  assert.ok(Number(findButton(renderer, 'Volver').props.style.minHeight) >= 44)
  act(() => radios[0].props.onChange())
  assert.equal(findButton(renderer, 'Sí, cancelar').props.disabled, false)

  act(() => renderer.unmount())
})

test('admin ticket keeps the free-text workflow and trims its transport reason', async () => {
  const { renderer, calls } = await createTicket({
    flowName: 'admin',
    order: orderFixture({ can_cancel: false }),
    apiOptions: { reloadedOrder: orderFixture({ state: 'cancel', can_cancel: false }) },
  })
  const open = findButton(renderer, 'Cancelar venta')
  assert.ok(open, 'admin must ignore the night-only can_cancel flag')
  act(() => open.props.onClick())

  assert.equal(renderer.root.findAllByType('input').filter((input) => input.props.type === 'radio').length, 0)
  const textarea = renderer.root.findByType('textarea')
  act(() => textarea.props.onChange({ target: { value: '  Captura duplicada  ' } }))
  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })

  const cancelCall = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-cancel')
  assert.deepEqual(cancelCall.payload.params, {
    order_id: 9001,
    reason: 'Captura duplicada',
    employee_id: 730,
  })

  act(() => renderer.unmount())
})

test('night cancellation sends only the selected code, reloads, and labels the cancelled state', async () => {
  const { renderer, calls } = await createTicket({
    apiOptions: { reloadedOrder: orderFixture({ state: 'cancel', can_cancel: false }) },
  })
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  const duplicate = renderer.root.findByProps({ value: 'duplicate' })
  act(() => duplicate.props.onChange())

  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })

  const cancelCall = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-cancel')
  assert.deepEqual(cancelCall.payload.params, { order_id: 9001, reason_code: 'duplicate' })
  assert.equal(calls.filter((call) => call.url.includes('/sale-detail?')).length, 2)
  assert.equal(findButton(renderer, 'Cancelar venta'), undefined)
  assert.match(renderedText(renderer), /Cancelada/)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)

  act(() => renderer.unmount())
})

test('successful cancellation clears both reason controls before a later confirmation', async () => {
  const night = await createTicket({
    apiOptions: { reloadedOrder: orderFixture({ state: 'sale', can_cancel: true }) },
  })
  act(() => findButton(night.renderer, 'Cancelar venta').props.onClick())
  act(() => night.renderer.root.findByProps({ value: 'duplicate' }).props.onChange())
  await act(async () => {
    findButton(night.renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })
  act(() => findButton(night.renderer, 'Cancelar venta').props.onClick())
  assert.equal(night.renderer.root.findByProps({ value: 'duplicate' }).props.checked, false)
  assert.equal(findButton(night.renderer, 'Sí, cancelar').props.disabled, true)
  act(() => night.renderer.unmount())

  const admin = await createTicket({
    flowName: 'admin',
    order: orderFixture({ can_cancel: false }),
    apiOptions: { reloadedOrder: orderFixture({ state: 'sale', can_cancel: false }) },
  })
  act(() => findButton(admin.renderer, 'Cancelar venta').props.onClick())
  act(() => admin.renderer.root.findByType('textarea').props.onChange({ target: { value: 'Duplicada' } }))
  await act(async () => {
    findButton(admin.renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })
  act(() => findButton(admin.renderer, 'Cancelar venta').props.onClick())
  assert.equal(admin.renderer.root.findByType('textarea').props.value, '')
  assert.equal(findButton(admin.renderer, 'Sí, cancelar').props.disabled, true)
  act(() => admin.renderer.unmount())
})

test('terminal night states and backend denial hide cancellation and show stable safe copy', async () => {
  const cases = [
    ['manager_required', 'sale', 'Esta venta requiere autorización de un gerente.', 'Activa'],
    ['already_cancelled', 'cancel', 'Esta venta ya está cancelada.', 'Cancelada'],
    ['closed', 'done', 'Esta venta está cerrada y requiere reversión manual.', 'Cerrada'],
    ['invalid_state', 'draft', 'Esta venta no se puede cancelar en su estado actual.', 'Desconocida'],
    ['not_owner', 'sale', 'Esta venta no se puede cancelar.', 'Activa'],
    ['unexpected_private_detail', 'sale', 'Esta venta no se puede cancelar.', 'Activa'],
  ]

  for (const [code, state, safeMessage, stateLabel] of cases) {
    const { renderer } = await createTicket({
      order: orderFixture({ state, can_cancel: false, cancel_block_code: code }),
    })
    const text = renderedText(renderer)
    assert.equal(findButton(renderer, 'Cancelar venta'), undefined, `${code} must be blocked`)
    assert.match(text, new RegExp(safeMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(text, new RegExp(stateLabel))
    assert.doesNotMatch(text, new RegExp(code))
    act(() => renderer.unmount())
  }
})

test('terminal state overrides a malformed night can_cancel approval', async () => {
  for (const [state, label] of [['cancel', 'Cancelada'], ['done', 'Cerrada']]) {
    const { renderer } = await createTicket({
      order: orderFixture({ state, can_cancel: true, cancel_block_code: null }),
    })
    assert.equal(findButton(renderer, 'Cancelar venta'), undefined)
    assert.match(renderedText(renderer), new RegExp(label))
    act(() => renderer.unmount())
  }
})

test('closing the modal resets both workflows and cancellation errors preserve the selected retry', async () => {
  const { renderer } = await createTicket({
    apiOptions: {
      cancelResponse: () => createJsonResponse(409, {
        error: { code: 'not_owner', message: 'cancel_block_code=not_owner; detalle sensible' },
      }),
    },
  })
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'error' }).props.onChange())
  act(() => findButton(renderer, 'Volver').props.onClick())
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  assert.equal(renderer.root.findByProps({ value: 'error' }).props.checked, false)

  act(() => renderer.root.findByProps({ value: 'out_of_stock' }).props.onChange())
  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })
  const text = renderedText(renderer)
  assert.match(text, /Esta venta no se puede cancelar\./)
  assert.doesNotMatch(text, /not_owner|detalle sensible|cancel_block_code/)
  assert.match(renderedInstanceText(renderer.root.findByProps({ role: 'alert' })), /Esta venta no se puede cancelar\./)
  assert.equal(renderer.root.findByProps({ value: 'out_of_stock' }).props.checked, true)
  assert.equal(findButton(renderer, 'Sí, cancelar').props.disabled, false)

  act(() => renderer.unmount())

  const admin = await createTicket({ flowName: 'admin', order: orderFixture({ can_cancel: false }) })
  act(() => findButton(admin.renderer, 'Cancelar venta').props.onClick())
  act(() => admin.renderer.root.findByType('textarea').props.onChange({ target: { value: 'Motivo temporal' } }))
  act(() => findButton(admin.renderer, 'Volver').props.onClick())
  act(() => findButton(admin.renderer, 'Cancelar venta').props.onClick())
  assert.equal(admin.renderer.root.findByType('textarea').props.value, '')
  act(() => admin.renderer.unmount())
})

test('night cancellation trusts structured user messages only for known block codes', async () => {
  const cases = [
    ['manager_required', 'Solicita autorización nocturna al gerente.'],
    ['already_cancelled', 'La venta nocturna ya fue cancelada.'],
    ['closed', 'La venta nocturna cerrada requiere reversión manual.'],
    ['invalid_state', 'El estado actual impide cancelar esta venta nocturna.'],
  ]

  for (const [code, safeUserMessage] of cases) {
    const sensitiveMessage = `detalle interno sensible para ${code}`
    const { renderer, calls } = await createTicket({
      apiOptions: {
        cancelResponse: () => createJsonResponse(200, {
          result: {
            ok: false,
            message: sensitiveMessage,
            data: {
              cancel_block_code: code,
              user_message: safeUserMessage,
            },
          },
        }),
      },
    })
    act(() => findButton(renderer, 'Cancelar venta').props.onClick())
    act(() => renderer.root.findByProps({ value: 'duplicate' }).props.onChange())

    await act(async () => {
      findButton(renderer, 'Sí, cancelar').props.onClick()
      await flush()
    })

    const alert = renderer.root.findByProps({ role: 'alert' })
    assert.equal(renderedInstanceText(alert), safeUserMessage)
    assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
    assert.equal(renderer.root.findByProps({ value: 'duplicate' }).props.checked, true)
    assert.equal(findButton(renderer, 'Sí, cancelar').props.disabled, false)
    assert.doesNotMatch(renderedText(renderer), new RegExp(sensitiveMessage))
    assert.doesNotMatch(renderedText(renderer), /Venta cancelada/)
    assert.equal(calls.filter((call) => call.url.includes('/sale-detail?')).length, 1)
    assert.equal(calls.filter((call) => call.url === '/odoo-api/pwa-admin/sale-cancel').length, 1)

    act(() => renderer.unmount())
  }
})

test('night cancellation hides unstructured and unknown backend messages', async () => {
  const cases = [
    {
      data: { cancel_block_code: 'manager_required' },
      expected: 'Esta venta requiere autorización de un gerente.',
    },
    {
      data: {
        cancel_block_code: 'private_backend_code',
        user_message: 'Mensaje no autorizado por el contrato.',
      },
      expected: 'Esta venta no se puede cancelar.',
    },
  ]

  for (const { data, expected } of cases) {
    const { renderer } = await createTicket({
      apiOptions: {
        cancelResponse: () => createJsonResponse(200, {
          result: {
            ok: false,
            message: 'Detalle interno sensible del servidor.',
            data,
          },
        }),
      },
    })
    act(() => findButton(renderer, 'Cancelar venta').props.onClick())
    act(() => renderer.root.findByProps({ value: 'duplicate' }).props.onChange())

    await act(async () => {
      findButton(renderer, 'Sí, cancelar').props.onClick()
      await flush()
    })

    assert.equal(renderedInstanceText(renderer.root.findByProps({ role: 'alert' })), expected)
    assert.doesNotMatch(
      renderedText(renderer),
      /Detalle interno sensible|Mensaje no autorizado|private_backend_code/,
    )
    act(() => renderer.unmount())
  }
})

test('night cancellation hides arbitrary thrown messages even with a known block code', async () => {
  const { renderer } = await createTicket({
    apiOptions: {
      cancelResponse: () => createJsonResponse(409, {
        error: {
          code: 'manager_required',
          message: 'Credencial interna y detalle sensible.',
        },
      }),
    },
  })
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'duplicate' }).props.onChange())

  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })

  assert.equal(
    renderedInstanceText(renderer.root.findByProps({ role: 'alert' })),
    'Esta venta requiere autorización de un gerente.',
  )
  assert.doesNotMatch(renderedText(renderer), /Credencial interna|detalle sensible/)
  act(() => renderer.unmount())
})

test('admin logical cancellation failures preserve useful legacy backend messages', async () => {
  const { renderer, calls } = await createTicket({
    flowName: 'admin',
    order: orderFixture({ can_cancel: false }),
    apiOptions: {
      cancelResponse: () => createJsonResponse(200, {
        result: {
          ok: false,
          code: 'admin_validation',
          message: 'La venta tiene una entrega validada y no se puede cancelar.',
          data: {},
        },
      }),
    },
  })
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByType('textarea').props.onChange({
    target: { value: 'Corrección administrativa' },
  }))

  await act(async () => {
    findButton(renderer, 'Sí, cancelar').props.onClick()
    await flush()
  })

  const alert = renderer.root.findByProps({ role: 'alert' })
  assert.match(
    renderedInstanceText(alert),
    /La venta tiene una entrega validada y no se puede cancelar\./,
  )
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.equal(renderer.root.findByType('textarea').props.value, 'Corrección administrativa')
  assert.equal(calls.filter((call) => call.url.includes('/sale-detail?')).length, 1)
  assert.doesNotMatch(renderedText(renderer), /Venta cancelada/)

  act(() => renderer.unmount())
})

test('pending cancellation ignores duplicate confirmation clicks', async () => {
  const pending = deferred()
  const { renderer, calls } = await createTicket({
    apiOptions: {
      reloadedOrder: orderFixture({ state: 'cancel', can_cancel: false }),
      cancelResponse: () => pending.promise,
    },
  })
  act(() => findButton(renderer, 'Cancelar venta').props.onClick())
  act(() => renderer.root.findByProps({ value: 'customer_cancelled' }).props.onChange())
  const confirm = findButton(renderer, 'Sí, cancelar')

  await act(async () => {
    confirm.props.onClick()
    confirm.props.onClick()
    await flush()
  })
  assert.equal(calls.filter((call) => call.url === '/odoo-api/pwa-admin/sale-cancel').length, 1)
  assert.equal(findButton(renderer, 'Cancelando…').props.disabled, true)

  await act(async () => {
    pending.resolve(createJsonResponse(200, {
      result: { ok: true, data: { id: 9001, state: 'cancel' } },
    }))
    await flush()
  })
  assert.match(renderedText(renderer), /Cancelada/)

  act(() => renderer.unmount())
})

test('backend sale-cancel capability hides both night and admin cancellation', async () => {
  const runtime = await loadRuntime()
  runtime.BACKEND_CAPS.saleCancel = false

  for (const flowName of ['night', 'admin']) {
    const { renderer } = await createTicket({
      flowName,
      order: orderFixture({ can_cancel: true }),
    })
    assert.equal(findButton(renderer, 'Cancelar venta'), undefined)
    act(() => renderer.unmount())
  }
})

test('ticket source delegates cancellation policy and transport to the shared contracts', () => {
  assert.match(screenSource, /canCancelPosOrder\(flow, order, BACKEND_CAPS\.saleCancel\)/)
  assert.match(screenSource, /getPosCancelBlockMessage/)
  assert.match(screenSource, /getPosSaleStateLabel/)
  assert.match(screenSource, /submitPosCancellation\(\{[\s\S]{0,300}cancelFn: cancelSaleOrder/)
  assert.doesNotMatch(screenSource, /saleCreateManagerThreshold|amount_total\s*[<>]=?|5000/)
})
