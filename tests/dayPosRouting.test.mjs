import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const mobileSource = readFileSync(new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url), 'utf8')
const desktopSource = readFileSync(new URL('../src/modules/admin/forms/AdminPosForm.jsx', import.meta.url), 'utf8')

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

let vite
let runtimePromise
const activeRenderers = new Set()

function createLocalStorageMock() {
  const values = new Map()
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
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

function LocationProbe() {
  const location = useLocation()
  return React.createElement('span', { 'data-pos-test-location': location.pathname })
}

async function settle(delay = 0) {
  await new Promise((resolve) => setTimeout(resolve, delay))
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const [posModule, salesModule, appModule, flowModule] = await Promise.all([
        vite.ssrLoadModule('/src/modules/admin/ScreenPOS.jsx'),
        vite.ssrLoadModule('/src/modules/admin/ScreenDayPosSales.jsx'),
        vite.ssrLoadModule('/src/App.jsx'),
        vite.ssrLoadModule('/src/modules/admin/posFlow.js'),
      ])
      return {
        ScreenPOS: posModule.default,
        ScreenDayPosSales: salesModule.default,
        SessionContext: appModule.SessionContext,
        ADMIN_POS_FLOW: flowModule.ADMIN_POS_FLOW,
        DAY_POS_FLOW: flowModule.DAY_POS_FLOW,
        NIGHT_POS_FLOW: flowModule.NIGHT_POS_FLOW,
      }
    })()
  }
  return runtimePromise
}

function installWindow(width) {
  globalThis.window = {
    innerWidth: width,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    location: { origin: 'http://localhost', reload() {} },
  }
  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
  }
}

async function mountPos(width, flowKey = 'DAY_POS_FLOW') {
  installWindow(width)
  const runtime = await loadRuntime()
  const flow = runtime[flowKey]
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [runtime.DAY_POS_FLOW.posRoute],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(
          runtime.SessionContext.Provider,
          { value: { session: DAY_SESSION, updateSession() {} } },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(LocationProbe),
            React.createElement(runtime.ScreenPOS, { flow }),
          ),
        ),
      ),
    )
    await settle()
    await settle()
    await settle()
  })
  activeRenderers.add(renderer)
  return renderer
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.localStorage.setItem('gf_session', JSON.stringify(DAY_SESSION))
})

afterEach(async () => {
  for (const renderer of activeRenderers) {
    await act(async () => {
      renderer.unmount()
      await settle()
    })
  }
  activeRenderers.clear()
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
  globalThis.document = originalDocument
})

after(async () => {
  await vite?.close()
})

test('all day routes are lazy, authenticated AppShell children guarded by pos_diurno', () => {
  assert.match(appSource, /import \{ DAY_POS_FLOW, NIGHT_POS_FLOW \} from '\.\/modules\/admin\/posFlow'/)
  assert.match(
    appSource,
    /const ScreenDayPosSales\s*=\s*lazy\(\(\) => import\('\.\/modules\/admin\/ScreenDayPosSales'\)\)/,
  )

  const routes = [
    '<Route path="/pos-diurno" element={<ModuleRoleRoute moduleId="pos_diurno"><ScreenPOS flow={DAY_POS_FLOW} /></ModuleRoleRoute>} />',
    '<Route path="/pos-diurno/ventas" element={<ModuleRoleRoute moduleId="pos_diurno"><ScreenDayPosSales /></ModuleRoleRoute>} />',
    '<Route path="/pos-diurno/ticket/:orderId" element={<ModuleRoleRoute moduleId="pos_diurno"><ScreenTicket flow={DAY_POS_FLOW} /></ModuleRoleRoute>} />',
  ]
  for (const route of routes) assert.ok(appSource.includes(route), route)

  const shellStart = appSource.indexOf('<Route element={<AppShell />}>')
  const shellEnd = appSource.indexOf('</Route>', appSource.lastIndexOf('<Route path="*"'))
  for (const route of routes) {
    const index = appSource.indexOf(route)
    assert.ok(index > shellStart && index < shellEnd, `${route} dentro de AppShell`)
  }
})

test('both POS layouts declare strict scoped calls while admin/night omit the scope byte-for-byte', () => {
  for (const source of [mobileSource, desktopSource]) {
    assert.match(source, /posScope: flow\.posScope/)
    assert.match(
      source,
      /searchCustomers\(\s*customerQuery,\s*companyId,\s*\{ posScope: flow\.posScope \},?\s*\)/,
    )
    assert.match(source, /getDefaultCustomer\([\s\S]{0,160}\{ posScope: flow\.posScope \},?\s*\)/)
    assert.match(source, /flow\.posScope === undefined[\s\S]{0,180}\{ pos_scope: flow\.posScope \}/)
  }
})

test('mobile and desktop day POS send scoped catalog, default, customer, and create requests', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      const payload = options.body ? JSON.parse(options.body) : null
      calls.push({ url, options, payload })
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: {
            pricelist_id: [9, 'Público'],
            products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }],
          },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
      }
      if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
        return response(200, { ok: true, data: { customers: [] } })
      }
      if (url === '/odoo-api/pwa-admin/sale-create') {
        return response(200, { result: { ok: true, data: { order_id: 9001 } } })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    await act(async () => { await settle(10) })

    const customerButton = findButton(renderer, viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar')
    assert.ok(customerButton, `${viewport}: selector de cliente`)
    act(() => customerButton.props.onClick())
    await act(async () => { await settle(420) })

    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    assert.ok(productButton, `${viewport}: catálogo listo`)
    act(() => productButton.props.onClick())
    act(() => findButton(renderer, 'Efectivo').props.onClick())
    await act(async () => {
      findButton(renderer, 'Confirmar').props.onClick()
      await settle()
    })

    const reads = calls.filter((call) => /\/(pos-products|default-customer|customers)\?/.test(call.url))
    assert.ok(reads.some((call) => call.url.includes('/pos-products?')))
    assert.ok(reads.some((call) => call.url.includes('/default-customer?')))
    assert.ok(reads.some((call) => call.url.includes('/customers?')))
    assert.ok(reads.every((call) => new URL(call.url, 'http://local').searchParams.get('pos_scope') === 'day'))

    const create = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-create')
    assert.equal(create.payload.params.pos_scope, 'day')
    assert.equal(create.payload.params.partner_id, 61)
    assert.equal(create.payload.params.employee_id, undefined)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('cached day role fails closed on 403 in mobile and desktop without stripping scope or retrying admin', async () => {
  for (const width of [390, 1280]) {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options })
      return response(403, { message: 'SENSITIVE_REVOKED_ROLE_DETAIL', code: 'forbidden' })
    }

    const renderer = await mountPos(width)
    await act(async () => { await settle(20) })

    assert.match(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
    assert.doesNotMatch(renderedText(renderer), /SENSITIVE_REVOKED_ROLE_DETAIL/)
    assert.ok(calls.length >= 1)
    assert.ok(calls.every((call) => call.url.startsWith('/odoo-api/pwa-admin/')))
    const posCalls = calls.filter((call) => !call.url.endsWith('/pwa-admin/capabilities'))
    assert.ok(posCalls.length >= 1)
    assert.ok(posCalls.every((call) => (
      new URL(call.url, 'http://local').searchParams.get('pos_scope') === 'day'
    )))
    assert.ok(calls.every((call) => !call.url.startsWith('/api-n8n/')))

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('revoked day role maps customer-search 403 to the safe access state in both layouts', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options })
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, { ok: true, data: { products: [] } })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
      }
      if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
        return response(403, { message: 'SENSITIVE_CUSTOMER_SCOPE', code: 'forbidden' })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    const customerButton = findButton(renderer, viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar')
    act(() => customerButton.props.onClick())
    await act(async () => { await settle(420) })

    assert.match(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
    assert.doesNotMatch(renderedText(renderer), /SENSITIVE_CUSTOMER_SCOPE/)
    const searches = calls.filter((call) => call.url.includes('/customers?'))
    assert.ok(searches.length >= 1)
    assert.ok(searches.every((call) => new URL(call.url, 'http://local').searchParams.get('pos_scope') === 'day'))

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('revoked day role maps sale-create 403 to the safe access state in both layouts', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      const payload = options.body ? JSON.parse(options.body) : null
      calls.push({ url, options, payload })
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: { products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }] },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
      }
      if (url === '/odoo-api/pwa-admin/sale-create') {
        return response(403, { message: 'SENSITIVE_CREATE_SCOPE', code: 'forbidden' })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    await act(async () => { await settle(10) })
    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    act(() => findButton(renderer, 'Efectivo').props.onClick())
    await act(async () => {
      findButton(renderer, 'Confirmar').props.onClick()
      await settle()
    })

    assert.match(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
    assert.doesNotMatch(renderedText(renderer), /SENSITIVE_CREATE_SCOPE/)
    const create = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-create')
    assert.equal(create.payload.params.pos_scope, 'day', `${viewport}: conserva el scope`)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('mobile and desktop customer search debounce once, ignore stale results/errors, and sell to the newest selection', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const calls = []
    const pending = new Map([
      ['al', deferred()],
      ['be', deferred()],
      ['ca', deferred()],
      ['di', deferred()],
    ])
    globalThis.fetch = async (url, options = {}) => {
      const payload = options.body ? JSON.parse(options.body) : null
      calls.push({ url, options, payload })
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: {
            products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }],
          },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
      }
      if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
        const query = new URL(url, 'http://local').searchParams.get('q') || ''
        if (!pending.has(query)) return response(200, { ok: true, data: { customers: [] } })
        return pending.get(query).promise
      }
      if (url === '/odoo-api/pwa-admin/sale-create') {
        return response(200, { result: { ok: true, data: { order_id: 9001 } } })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    act(() => findButton(renderer, viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar').props.onClick())
    const searchInput = renderer.root.findAllByType('input').find((input) => (
      String(input.props.placeholder || '').startsWith('Buscar cliente')
    ))

    act(() => searchInput.props.onChange({ target: { value: 'al' } }))
    await act(async () => { await settle(420) })
    act(() => searchInput.props.onChange({ target: { value: 'be' } }))
    await act(async () => { await settle(420) })
    await act(async () => {
      pending.get('be').resolve(response(200, {
        ok: true,
        data: { customers: [{ id: 72, name: 'BERTA NUEVA' }] },
      }))
      await settle()
    })
    assert.match(renderedText(renderer), /BERTA NUEVA/)
    await act(async () => {
      pending.get('al').resolve(response(200, {
        ok: true,
        data: { customers: [{ id: 71, name: 'ALICIA VIEJA' }] },
      }))
      await settle()
    })
    assert.match(renderedText(renderer), /BERTA NUEVA/)
    assert.doesNotMatch(renderedText(renderer), /ALICIA VIEJA/)

    const staleBertaButton = findButton(renderer, 'BERTA NUEVA')
    act(() => {
      searchInput.props.onChange({ target: { value: 'bx' } })
      staleBertaButton.props.onClick()
    })
    await act(async () => { await settle() })
    assert.equal(
      calls.some((call) => (
        call.url.startsWith('/odoo-api/pwa-admin/pos-products?')
        && new URL(call.url, 'http://local').searchParams.get('partner_id') === '72'
      )),
      false,
      `${viewport}: una fila de la consulta anterior no puede seleccionarse`,
    )
    assert.doesNotMatch(renderedText(renderer), /BERTA NUEVA/)

    act(() => searchInput.props.onChange({ target: { value: 'ca' } }))
    await act(async () => { await settle(420) })
    act(() => searchInput.props.onChange({ target: { value: 'di' } }))
    await act(async () => { await settle(420) })
    await act(async () => {
      pending.get('di').resolve(response(200, {
        ok: true,
        data: { customers: [{ id: 74, name: 'DIANA ACTUAL' }] },
      }))
      await settle()
    })
    act(() => findButton(renderer, 'DIANA ACTUAL').props.onClick())
    await act(async () => { await settle() })
    await act(async () => {
      pending.get('ca').resolve(response(403, {
        message: 'SENSITIVE_STALE_CUSTOMER_ERROR',
        code: 'forbidden',
      }))
      await settle()
    })

    assert.match(renderedText(renderer), /DIANA ACTUAL/)
    assert.doesNotMatch(renderedText(renderer), /ALICIA VIEJA|SENSITIVE_STALE_CUSTOMER_ERROR/)
    assert.doesNotMatch(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
    const searches = calls.filter((call) => call.url.includes('/customers?'))
    for (const query of ['al', 'be', 'ca', 'di']) {
      assert.equal(
        searches.filter((call) => new URL(call.url, 'http://local').searchParams.get('q') === query).length,
        1,
        `${viewport}: una solicitud para ${query}`,
      )
    }

    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    act(() => findButton(renderer, 'Efectivo').props.onClick())
    await act(async () => {
      findButton(renderer, 'Confirmar').props.onClick()
      await settle()
    })
    const create = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-create')
    assert.equal(create.payload.params.partner_id, 74, `${viewport}: vende a la selección vigente`)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('day POS keeps its configured default-customer label on configuration error without enabling checkout', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options })
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: {
            products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }],
          },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(500, {
          message: 'SENSITIVE_DEFAULT_CUSTOMER_CONFIGURATION',
          code: 'configuration_error',
        })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    assert.match(renderedText(renderer), /VENTA PUBLICO IGUALA/)
    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    assert.equal(findButton(renderer, 'Efectivo').props.disabled, true, `${viewport}: checkout bloqueado`)
    assert.equal(calls.some((call) => call.url === '/odoo-api/pwa-admin/sale-create'), false)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('manual customer selection wins over a late default-customer response in both layouts', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const lateDefault = deferred()
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      const payload = options.body ? JSON.parse(options.body) : null
      calls.push({ url, options, payload })
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: {
            products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }],
          },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) return lateDefault.promise
      if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
        return response(200, {
          ok: true,
          data: { customers: [{ id: 74, name: 'DIANA MANUAL' }] },
        })
      }
      if (url === '/odoo-api/pwa-admin/sale-create') {
        return response(200, { result: { ok: true, data: { order_id: 9001 } } })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    act(() => findButton(renderer, viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar').props.onClick())
    const searchInput = renderer.root.findAllByType('input').find((input) => (
      String(input.props.placeholder || '').startsWith('Buscar cliente')
    ))
    act(() => searchInput.props.onChange({ target: { value: 'di' } }))
    await act(async () => { await settle(420) })
    act(() => findButton(renderer, 'DIANA MANUAL').props.onClick())
    await act(async () => { await settle() })

    await act(async () => {
      lateDefault.resolve(response(200, {
        ok: true,
        data: { id: 61, name: 'VENTA PUBLICO IGUALA' },
      }))
      await settle()
    })
    assert.match(renderedText(renderer), /DIANA MANUAL/)
    assert.doesNotMatch(renderedText(renderer), /VENTA PUBLICO IGUALA/)

    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    act(() => findButton(renderer, 'Efectivo').props.onClick())
    await act(async () => {
      findButton(renderer, 'Confirmar').props.onClick()
      await settle()
    })
    const create = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-create')
    assert.equal(create.payload.params.partner_id, 74, `${viewport}: conserva selección manual`)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('day checkout stays blocked after failed default resolution even with a manual customer', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const calls = []
    const warnings = []
    const previousWarn = console.warn
    console.warn = (...args) => { warnings.push(args.map(String).join(' ')) }
    try {
      globalThis.fetch = async (url, options = {}) => {
        const payload = options.body ? JSON.parse(options.body) : null
        calls.push({ url, options, payload })
        if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
          return response(200, {
            ok: true,
            data: { products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }] },
          })
        }
        if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
          return response(500, {
            message: 'SENSITIVE_DEFAULT_DATABASE_TRACE',
            code: 'pwa_admin_internal_error',
          })
        }
        if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
          return response(200, {
            ok: true,
            data: { customers: [{ id: 74, name: 'DIANA MANUAL' }] },
          })
        }
        throw new Error(`Unexpected ${url}`)
      }

      const renderer = await mountPos(width)
      act(() => findButton(renderer, viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar').props.onClick())
      await act(async () => { await settle(420) })
      act(() => findButton(renderer, 'DIANA MANUAL').props.onClick())
      await act(async () => { await settle() })
      const productButton = renderer.root.findAllByType('button').find((button) => (
        renderedInstanceText(button).includes('Hielo Prueba')
      ))
      act(() => productButton.props.onClick())

      assert.equal(findButton(renderer, 'Efectivo').props.disabled, true, `${viewport}: default fallido bloquea`)
      assert.equal(calls.some((call) => call.url === '/odoo-api/pwa-admin/sale-create'), false)
      assert.doesNotMatch(renderedText(renderer), /SENSITIVE_DEFAULT_DATABASE_TRACE/)
      assert.doesNotMatch(warnings.join('\n'), /SENSITIVE_DEFAULT_DATABASE_TRACE/)

      act(() => renderer.unmount())
      activeRenderers.delete(renderer)
    } finally {
      console.warn = previousWarn
    }
  }
})

test('day checkout remains blocked while default is pending and unlocks manual selection only after unique success', async () => {
  for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
    const pendingDefault = deferred()
    globalThis.fetch = async (url) => {
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: { products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }] },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) return pendingDefault.promise
      if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
        return response(200, {
          ok: true,
          data: { customers: [{ id: 74, name: 'DIANA MANUAL' }] },
        })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    act(() => findButton(renderer, viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar').props.onClick())
    await act(async () => { await settle(420) })
    act(() => findButton(renderer, 'DIANA MANUAL').props.onClick())
    await act(async () => { await settle() })
    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    assert.equal(findButton(renderer, 'Efectivo').props.disabled, true, `${viewport}: pending bloquea`)

    await act(async () => {
      pendingDefault.resolve(response(200, {
        ok: true,
        data: { id: 61, name: 'VENTA PUBLICO IGUALA' },
      }))
      await settle()
    })
    assert.match(renderedText(renderer), /DIANA MANUAL/)
    assert.equal(findButton(renderer, 'Efectivo').props.disabled, false, `${viewport}: unique default habilita`)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('mobile terminal requires a four-character reference and submits the valid reference', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
      return response(200, {
        ok: true,
        data: { products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }] },
      })
    }
    if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
      return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
    }
    if (url === '/odoo-api/pwa-admin/sale-create') {
      return response(200, { result: { ok: true, data: { order_id: 9001 } } })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const renderer = await mountPos(390)
  const productButton = renderer.root.findAllByType('button').find((button) => (
    renderedInstanceText(button).includes('Hielo Prueba')
  ))
  act(() => productButton.props.onClick())
  act(() => findButton(renderer, 'Terminal').props.onClick())
  const terminalInput = renderer.root.findAllByType('input').find((input) => (
    String(input.props.placeholder || '').includes('0012345')
  ))
  assert.ok(terminalInput, 'mobile: captura folio terminal')
  act(() => terminalInput.props.onChange({ target: { value: 'abc' } }))
  assert.equal(findButton(renderer, 'Confirmar').props.disabled, true)
  assert.equal(calls.some((call) => call.url === '/odoo-api/pwa-admin/sale-create'), false)

  act(() => terminalInput.props.onChange({ target: { value: ' A1234 ' } }))
  await act(async () => {
    findButton(renderer, 'Confirmar').props.onClick()
    await settle()
  })
  const create = calls.find((call) => call.url === '/odoo-api/pwa-admin/sale-create')
  assert.equal(create.payload.params.payment_method, 'card')
  assert.equal(create.payload.params.payment_reference, 'A1234')

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

for (const [width, viewport] of [[390, 'mobile'], [1280, 'desktop']]) {
  test(`${viewport} terminal field has a programmatic label and described help`, async () => {
    globalThis.fetch = async (url) => {
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: { products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }] },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    act(() => findButton(renderer, 'Terminal').props.onClick())
    const input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.ok(input?.props.id, `${viewport}: input con id estable`)
    const label = renderer.root.findAllByType('label').find((candidate) => (
      candidate.props.htmlFor === input.props.id
    ))
    assert.ok(label, `${viewport}: etiqueta asociada por htmlFor`)
    assert.ok(input.props['aria-describedby'], `${viewport}: ayuda descrita`)
    const help = renderer.root.findAll((candidate) => (
      candidate.props?.id === input.props['aria-describedby']
    ))
    assert.equal(help.length, 1, `${viewport}: texto de ayuda enlazado`)
  })

  test(`${viewport} terminal reference resets across payment context changes`, async () => {
    globalThis.fetch = async (url) => {
      if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
        return response(200, {
          ok: true,
          data: { products: [{ id: 501, name: 'Hielo Prueba', price_unit: 42, stock: 10 }] },
        })
      }
      if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
        return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
      }
      if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
        return response(200, {
          ok: true,
          data: { customers: [{ id: 74, name: 'CLIENTE ALTERNO' }] },
        })
      }
      throw new Error(`Unexpected ${url}`)
    }

    const renderer = await mountPos(width)
    const productButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => productButton.props.onClick())
    act(() => findButton(renderer, 'Terminal').props.onClick())
    let input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    act(() => input.props.onChange({ target: { value: 'KEEP-1234' } }))
    await act(async () => { await settle() })
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.equal(input.props.value, 'KEEP-1234', `${viewport}: no borra al escribir`)

    await act(async () => {
      findButton(renderer, 'Actualizar lista').props.onClick()
      await settle()
    })
    assert.equal(renderer.root.findAllByType('input').some((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    )), false, `${viewport}: refrescar/repreciar cierra confirmación`)
    act(() => findButton(renderer, 'Terminal').props.onClick())
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.equal(input.props.value, '', `${viewport}: refrescar/repreciar limpia folio`)

    const refreshedProductButton = renderer.root.findAllByType('button').find((button) => (
      renderedInstanceText(button).includes('Hielo Prueba')
    ))
    act(() => refreshedProductButton.props.onClick())
    assert.equal(renderer.root.findAllByType('input').some((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    )), false, `${viewport}: cambio de carrito cierra confirmación`)
    act(() => findButton(renderer, 'Terminal').props.onClick())
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.equal(input.props.value, '', `${viewport}: el folio no reaparece`)

    act(() => input.props.onChange({ target: { value: 'CANCEL-1234' } }))
    act(() => findButton(renderer, 'Cancelar').props.onClick())
    act(() => findButton(renderer, 'Terminal').props.onClick())
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.equal(input.props.value, '', `${viewport}: cancelar limpia el folio`)

    act(() => input.props.onChange({ target: { value: 'OPEN-1234' } }))
    const customerButtonLabel = viewport === 'mobile' ? 'Cambiar cliente' : 'Cambiar'
    act(() => findButton(renderer, customerButtonLabel).props.onClick())
    assert.equal(renderer.root.findAllByType('input').some((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    )), false, `${viewport}: abrir selector cierra confirmación`)

    act(() => findButton(renderer, 'Terminal').props.onClick())
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    act(() => input.props.onChange({ target: { value: 'CLOSE-1234' } }))
    act(() => findButton(renderer, customerButtonLabel).props.onClick())
    assert.equal(renderer.root.findAllByType('input').some((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    )), false, `${viewport}: cerrar selector cierra confirmación`)
    act(() => findButton(renderer, 'Terminal').props.onClick())
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.equal(input.props.value, '', `${viewport}: cerrar selector limpia folio`)

    act(() => input.props.onChange({ target: { value: 'CUSTOMER-1234' } }))
    act(() => findButton(
      renderer,
      customerButtonLabel,
    ).props.onClick())
    await act(async () => { await settle(420) })
    act(() => findButton(renderer, 'CLIENTE ALTERNO').props.onClick())
    await act(async () => {
      await settle()
      await settle()
    })
    assert.equal(renderer.root.findAllByType('input').some((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    )), false, `${viewport}: cambio de cliente cierra confirmación`)
    act(() => findButton(renderer, 'Terminal').props.onClick())
    input = renderer.root.findAllByType('input').find((candidate) => (
      String(candidate.props.placeholder || '').includes('0012345')
    ))
    assert.equal(input.props.value, '', `${viewport}: cambio de cliente no revive el folio`)
  })
}

test('both POS layouts clear card state when company or warehouse changes', () => {
  for (const [source, viewport] of [[mobileSource, 'mobile'], [desktopSource, 'desktop']]) {
    const effect = source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[companyId, warehouseId\]\)/)?.[0] || ''
    assert.match(effect, /setPayConfirm\(null\)/, `${viewport}: cierra confirmación`)
    assert.match(effect, /setCardRef\(''\)/, `${viewport}: limpia el folio`)
  }
})

test('day catalog and customer-search 5xx details are neither rendered nor logged', async () => {
  for (const target of ['catalog', 'customers']) {
    const secret = `SENSITIVE_${target.toUpperCase()}_INTERNAL_TRACE`
    const warnings = []
    const previousWarn = console.warn
    console.warn = (...args) => { warnings.push(args.map(String).join(' ')) }
    try {
      globalThis.fetch = async (url) => {
        if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
          return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
        }
        if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
          return target === 'catalog'
            ? response(500, { message: secret, code: 'internal_error' })
            : response(200, { ok: true, data: { products: [] } })
        }
        if (url.startsWith('/odoo-api/pwa-admin/customers?')) {
          return response(500, { message: secret, code: 'internal_error' })
        }
        throw new Error(`Unexpected ${url}`)
      }
      const renderer = await mountPos(390)
      if (target === 'customers') {
        act(() => findButton(renderer, 'Cambiar cliente').props.onClick())
        await act(async () => { await settle(420) })
      }
      assert.doesNotMatch(renderedText(renderer), new RegExp(secret))
      assert.doesNotMatch(warnings.join('\n'), new RegExp(secret))
      assert.match(
        renderedText(renderer),
        /No se pudo consultar el POS día|servicio del POS día no está disponible/i,
      )
      act(() => renderer.unmount())
      activeRenderers.delete(renderer)
    } finally {
      console.warn = previousWarn
    }
  }
})

test('standalone mobile POS back control has a stable accessible name and 44px touch target', async () => {
  globalThis.fetch = async (url) => {
    if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
      return response(200, { ok: true, data: { products: [] } })
    }
    if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
      return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const renderer = await mountPos(390)
  const back = renderer.root.findByProps({ 'aria-label': 'Volver al inicio' })
  assert.ok(Number(back.props.style?.width || back.props.style?.minWidth) >= 44)
  assert.ok(Number(back.props.style?.height || back.props.style?.minHeight) >= 44)

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('standalone desktop day POS back control is accessible and navigates to the configured return route', async () => {
  globalThis.fetch = async (url) => {
    if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
      return response(200, { ok: true, data: { products: [] } })
    }
    if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
      return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO IGUALA' } })
    }
    throw new Error(`Unexpected ${url}`)
  }

  const renderer = await mountPos(1280)
  const back = renderer.root.findByProps({ 'aria-label': 'Volver al inicio' })
  assert.equal(back.props.type, 'button')
  assert.ok(Number(back.props.style?.width || back.props.style?.minWidth) >= 44)
  assert.ok(Number(back.props.style?.height || back.props.style?.minHeight) >= 44)
  assert.ok(renderer.root.findByProps({ 'data-pos-test-location': '/pos-diurno' }))

  await act(async () => {
    back.props.onClick()
    await settle()
  })
  assert.ok(renderer.root.findByProps({ 'data-pos-test-location': '/' }))

  act(() => renderer.unmount())
  activeRenderers.delete(renderer)
})

test('AdminShell keeps the legacy admin and night back contract when day overrides are omitted', async () => {
  globalThis.fetch = async (url) => {
    if (url.startsWith('/odoo-api/pwa-admin/pos-products?')) {
      return response(200, { ok: true, data: { products: [] } })
    }
    if (url.startsWith('/odoo-api/pwa-admin/default-customer?')) {
      return response(200, { ok: true, data: { id: 61, name: 'VENTA PUBLICO' } })
    }
    throw new Error(`Unexpected ${url}`)
  }

  for (const flowKey of ['ADMIN_POS_FLOW', 'NIGHT_POS_FLOW']) {
    const renderer = await mountPos(1280, flowKey)
    const legacyBack = renderer.root.findAllByType('button').find((button) => (
      button.props.style?.width === 38 && button.props.style?.height === 38
    ))
    assert.ok(legacyBack, `${flowKey}: conserva 38x38`)
    assert.equal(legacyBack.props['aria-label'], undefined, `${flowKey}: conserva markup sin aria`)

    act(() => renderer.unmount())
    activeRenderers.delete(renderer)
  }
})

test('cached day role history shows a safe 403 state and makes one scoped request', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return response(403, { message: 'SENSITIVE_HISTORY_SCOPE', code: 'forbidden' })
  }
  installWindow(390)
  const runtime = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [runtime.DAY_POS_FLOW.salesRoute],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(runtime.ScreenDayPosSales),
      ),
    )
    await settle()
    await settle()
  })

  assert.match(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
  assert.doesNotMatch(renderedText(renderer), /SENSITIVE_HISTORY_SCOPE/)
  assert.equal(renderer.root.findAllByType('button').some((button) => (
    renderedInstanceText(button) === 'Reintentar'
  )), false)
  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/today-sales?pos_scope=day',
  ])
  act(() => renderer.unmount())
})

test('legacy day history forbidden envelope stays safe and never offers retry', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return response(200, {
      ok: false,
      message: 'SENSITIVE_LEGACY_HISTORY_SCOPE',
      data: { code: 'pos_access_denied' },
    })
  }
  installWindow(390)
  const runtime = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [runtime.DAY_POS_FLOW.salesRoute],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(runtime.ScreenDayPosSales),
      ),
    )
    await settle()
    await settle()
  })

  assert.match(renderedText(renderer), /Tu perfil ya no tiene acceso al POS día/)
  assert.doesNotMatch(renderedText(renderer), /SENSITIVE_LEGACY_HISTORY_SCOPE/)
  assert.equal(renderer.root.findAllByType('button').some((button) => (
    renderedInstanceText(button) === 'Reintentar'
  )), false)
  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/today-sales?pos_scope=day',
  ])
  act(() => renderer.unmount())
})
