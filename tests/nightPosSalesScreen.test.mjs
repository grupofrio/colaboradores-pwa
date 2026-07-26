import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const screenUrl = new URL('../src/modules/admin/ScreenNightPosSales.jsx', import.meta.url)
const screenPath = fileURLToPath(screenUrl)
const posSource = readFileSync(new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url), 'utf8')
const flowSource = readFileSync(new URL('../src/modules/admin/posFlow.js', import.meta.url), 'utf8')

const SESSION = {
  employee_id: 730,
  session_token: 'h.p.s',
  name: 'Héctor Tapia',
  warehouse_id: 89,
  company_id: 34,
}

let vite
let runtimePromise

async function loadRuntime() {
  assert.ok(existsSync(screenPath), 'falta ScreenNightPosSales.jsx')
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const screenModule = await vite.ssrLoadModule('/src/modules/admin/ScreenNightPosSales.jsx')
      const appModule = await vite.ssrLoadModule('/src/App.jsx')
      return {
        Screen: screenModule.default,
        SessionContext: appModule.SessionContext,
        formatNightPosSaleTime: screenModule.formatNightPosSaleTime,
      }
    })()
  }
  return runtimePromise
}

after(async () => {
  await vite?.close()
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

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function createScreen({
  loadSales,
  navigateOverride = () => {},
  session = SESSION,
} = {}) {
  const { Screen, SessionContext } = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: ['/pos-nocturno/ventas'],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        React.createElement(
          SessionContext.Provider,
          { value: { session } },
          React.createElement(Screen, { loadSales, navigateOverride }),
        ),
      ),
    )
    await flush()
  })
  return renderer
}

test('loads without client scope assertions for a cross-company warehouse session', async () => {
  const request = deferred()
  const calls = []
  const renderer = await createScreen({
    session: { ...SESSION, company_id: 1, warehouse_id: 89 },
    loadSales: (...args) => {
      calls.push(args)
      return request.promise
    },
  })

  assert.deepEqual(calls, [[]])
  assert.match(renderedText(renderer), /Cargando ventas de hoy/)
  assert.equal(renderer.root.findAllByType('input').length, 0, 'sin control de fecha')

  await act(async () => {
    request.resolve({ ok: true, data: { items: [] } })
    await flush()
  })

  assert.match(renderedText(renderer), /No hay ventas registradas hoy/)
  assert.equal(calls.length, 1, 'no hace polling ni recargas automáticas')

  act(() => renderer.unmount())
})

test('does not require client company or warehouse assertions to load night sales', async () => {
  const calls = []
  const renderer = await createScreen({
    session: {
      employee_id: SESSION.employee_id,
      session_token: SESSION.session_token,
      name: SESSION.name,
    },
    loadSales: (...args) => {
      calls.push(args)
      return Promise.resolve({ ok: true, data: { items: [] } })
    },
  })

  assert.deepEqual(calls, [[]])
  assert.match(renderedText(renderer), /No hay ventas registradas hoy/)
  assert.doesNotMatch(renderedText(renderer), /Falta configurar|Sesión incompleta/)

  act(() => renderer.unmount())
})

test('resolved failure envelope shows the safe retryable error and can recover', async () => {
  let attempts = 0
  const loadSales = async () => {
    attempts += 1
    if (attempts === 1) {
      return {
        ok: false,
        message: 'Detalle sensible del backend',
        data: {},
      }
    }
    return {
      ok: true,
      data: {
        items: [{ order_id: 9010, name: 'VENTA RECUPERADA', state: 'sale' }],
      },
    }
  }
  const renderer = await createScreen({ loadSales })

  let text = renderedText(renderer)
  assert.match(text, /No se pudieron cargar las ventas de hoy/)
  assert.doesNotMatch(text, /Detalle sensible del backend/)
  assert.doesNotMatch(text, /No hay ventas registradas hoy/)
  const retry = renderer.root.findAllByType('button').find((button) => (
    button.children.join('') === 'Reintentar'
  ))
  assert.ok(retry)

  await act(async () => {
    retry.props.onClick()
    await flush()
  })

  text = renderedText(renderer)
  assert.match(text, /VENTA RECUPERADA/)
  assert.doesNotMatch(text, /No se pudieron cargar las ventas de hoy/)
  assert.equal(attempts, 2)

  act(() => renderer.unmount())
})

test('resolved success, status, and error envelopes also fail safely', async () => {
  const envelopes = [
    { success: false, message: 'SENSITIVE_SUCCESS', data: {} },
    { status: 'ERROR', user_message: 'SENSITIVE_STATUS', data: {} },
    { data: { error: { message: 'SENSITIVE_NESTED_ERROR' } } },
  ]

  for (const envelope of envelopes) {
    const renderer = await createScreen({ loadSales: async () => envelope })
    const text = renderedText(renderer)

    assert.match(text, /No se pudieron cargar las ventas de hoy/)
    assert.doesNotMatch(text, /SENSITIVE_/)
    assert.doesNotMatch(text, /No hay ventas registradas hoy/)

    act(() => renderer.unmount())
  }
})

test('renders a safe retryable error and fetches again only after Retry', async () => {
  let attempts = 0
  const loadSales = async () => {
    attempts += 1
    if (attempts === 1) {
      throw new Error('cancel_block_code=not_owner; detalle interno')
    }
    return { data: { items: [] } }
  }
  const renderer = await createScreen({ loadSales })

  let text = renderedText(renderer)
  assert.match(text, /No se pudieron cargar las ventas de hoy/)
  assert.doesNotMatch(text, /not_owner|detalle interno|cancel_block_code/)
  assert.equal(attempts, 1)
  const retry = renderer.root.findAllByType('button').find((button) => (
    button.children.join('') === 'Reintentar'
  ))
  assert.ok(retry, 'error explícito con acción Reintentar')

  await act(async () => {
    retry.props.onClick()
    await flush()
  })

  text = renderedText(renderer)
  assert.match(text, /No hay ventas registradas hoy/)
  assert.equal(attempts, 2)

  act(() => renderer.unmount())
})

test('renders Mexico time, folio, customer, money, and stable state labels', async () => {
  const renderer = await createScreen({
    loadSales: async () => ({
      data: {
        items: [
          {
            order_id: 9001,
            name: 'S09001',
            partner_name: 'Cliente Iguala',
            date_order: '2026-07-25 03:10:00',
            amount_total: 1234.5,
            state: 'sale',
            cancel_block_code: 'not_owner',
          },
          { order_id: 9002, name: 'S09002', partner_name: 'Público', state: 'done' },
          { order_id: 9003, name: 'S09003', partner_name: 'Público', state: 'cancel' },
          { order_id: 9004, name: 'S09004', partner_name: 'Público', state: 'draft' },
        ],
      },
    }),
  })

  const text = renderedText(renderer)
  assert.match(text, /21:10/)
  assert.match(text, /S09001/)
  assert.match(text, /Cliente Iguala/)
  assert.match(text, /\$1,234\.50/)
  for (const label of ['Activa', 'Cerrada', 'Cancelada', 'Desconocida']) {
    assert.match(text, new RegExp(label))
  }
  assert.doesNotMatch(text, /not_owner|cancel_block_code/)

  act(() => renderer.unmount())
})

test('sale rows are keyboard-native buttons and only safe ids navigate to night tickets', async () => {
  const navigations = []
  const renderer = await createScreen({
    navigateOverride: (...args) => navigations.push(args),
    loadSales: async () => ({
      data: {
        items: [
          {
            order_id: 9001,
            name: 'S09001',
            partner_name: 'Cliente Iguala',
            date_order: '2026-07-25 03:10:00',
            amount_total: 98.75,
            state: 'sale',
          },
          { order_id: 'unsafe', name: 'NO-DEBE-MONTAR' },
        ],
      },
    }),
  })

  const row = renderer.root.findByProps({ 'data-sale-order-id': 9001 })
  assert.equal(row.type, 'button')
  assert.equal(row.props.type, 'button')
  assert.equal(row.props.disabled, false)
  assert.equal(row.props['aria-label'], undefined, 'descendant text supplies the full accessible name')
  const accessibleText = renderedInstanceText(row)
  for (const value of ['S09001', 'Cliente Iguala', '21:10', '$98.75', 'Activa']) {
    assert.match(accessibleText, new RegExp(value.replace('$', '\\$')))
  }
  assert.doesNotMatch(renderedText(renderer), /NO-DEBE-MONTAR/)

  const back = renderer.root.findByProps({ 'aria-label': 'Volver al POS nocturno' })
  act(() => back.props.onClick())
  act(() => row.props.onClick())
  assert.deepEqual(navigations, [
    ['/pos-nocturno'],
    ['/pos-nocturno/ticket/9001'],
  ])

  act(() => renderer.unmount())
})

test('does not restart the backend-scoped request when client company context changes', async () => {
  const { Screen, SessionContext } = await loadRuntime()
  const request = deferred()
  const calls = []
  const loadSales = (...args) => {
    calls.push(args)
    return request.promise
  }
  const element = (session) => React.createElement(
    MemoryRouter,
    {
      initialEntries: ['/pos-nocturno/ventas'],
      future: { v7_startTransition: true, v7_relativeSplatPath: true },
    },
    React.createElement(
      SessionContext.Provider,
      { value: { session } },
      React.createElement(Screen, { loadSales, navigateOverride: () => {} }),
    ),
  )

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(element(SESSION))
    await flush()
  })
  await act(async () => {
    renderer.update(element({ ...SESSION, company_id: 35, warehouse_id: 91 }))
    await flush()
  })
  assert.deepEqual(calls, [[]])

  await act(async () => {
    request.resolve({ data: { items: [{ order_id: 9002, name: 'RESPUESTA DEL BACKEND' }] } })
    await flush()
  })
  assert.match(renderedText(renderer), /RESPUESTA DEL BACKEND/)

  act(() => renderer.unmount())
})

test('formats Odoo server datetimes deterministically in Mexico City time', async () => {
  const { formatNightPosSaleTime } = await loadRuntime()

  assert.equal(formatNightPosSaleTime('2026-07-25 03:10:00'), '21:10')
  assert.equal(formatNightPosSaleTime('invalid'), 'Hora no disponible')
  assert.equal(formatNightPosSaleTime(null), 'Hora no disponible')
})

test('screen source has no client scope, date, or Hector identity policy', () => {
  assert.ok(existsSync(screenPath), 'falta ScreenNightPosSales.jsx')
  const source = readFileSync(screenUrl, 'utf8')

  assert.match(source, /loadSales = getNightTodaySales/)
  assert.match(source, /normalizeNightPosSalesResponse/)
  assert.match(source, /buildPosTicketPath\(NIGHT_POS_FLOW, sale\.order_id\)/)
  assert.doesNotMatch(source, /type=["']date["']/)
  assert.doesNotMatch(source, /\bdate_from\b|\bdate_to\b|\bdate\s*:/)
  assert.doesNotMatch(source, /useSession|softWarehouse|SessionErrorState/)
  assert.doesNotMatch(source, /\bcompanyId\b|\bwarehouseId\b/)
  assert.doesNotMatch(source, /canAccessHectorNightPos|hasHectorTapiaIdentity/)
})

test('mobile and desktop POS expose sales only through flow.salesRoute', () => {
  const actionMatches = posSource.match(/\{flow\.salesRoute && \(/g) || []

  assert.equal(actionMatches.length, 2, 'una acción en desktop y otra en mobile')
  assert.ok(posSource.indexOf('flow.salesRoute') < posSource.indexOf('<AdminPosForm flow={flow} />'))
  assert.match(posSource, /navigate\(flow\.salesRoute\)/)
  const adminFlow = flowSource.match(/export const ADMIN_POS_FLOW = Object\.freeze\(\{[\s\S]*?\n\}\)/)
  assert.ok(adminFlow)
  assert.doesNotMatch(adminFlow[0], /salesRoute/)
})

test('all Task 5 controls enforce the 44px minimum touch target', async () => {
  const request = deferred()
  const renderer = await createScreen({ loadSales: () => request.promise })
  const back = renderer.root.findByProps({ 'aria-label': 'Volver al POS nocturno' })
  const source = readFileSync(screenUrl, 'utf8')

  assert.equal(back.props.style.width, 44)
  assert.equal(back.props.style.height, 44)
  assert.match(
    source,
    /\.night-pos-sales-main button\s*\{\s*min-height:\s*44px;/,
    'retry and sale-row buttons inherit a 44px minimum height',
  )
  assert.equal(
    (posSource.match(/minHeight:\s*44/g) || []).length,
    2,
    'desktop and mobile Ventas de hoy controls each enforce 44px',
  )

  act(() => renderer.unmount())
})
