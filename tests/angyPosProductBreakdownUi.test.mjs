import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let AngyPosProductBreakdown
let vite

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const module = await vite.ssrLoadModule(
    '/src/modules/admin/components/AngyPosProductBreakdown.jsx',
  )
  AngyPosProductBreakdown = module.default
})

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

function salesResponse({
  date,
  name = 'Rolito 5.5 kg',
  sku = 'ROL-55',
  quantity = 3,
  amount = 336,
  weight = 16.5,
  weightConfigured = true,
  productsWithoutWeight = 0,
} = {}) {
  return {
    data: {
      date,
      products: [{
        product_id: 55,
        sku,
        product_name: name,
        quantity,
        amount_total: amount,
        weight_per_unit_kg: weightConfigured ? 5.5 : 0,
        weight_total_kg: weight,
        weight_configured: weightConfigured,
      }],
      product_totals: {
        quantity,
        amount_total: amount,
        weight_total_kg: weightConfigured ? weight : 0,
        products_without_weight: productsWithoutWeight,
      },
    },
  }
}

function emptyResponse(date) {
  return {
    data: {
      date,
      products: [],
      product_totals: {
        quantity: 0,
        amount_total: 0,
        weight_total_kg: 0,
        products_without_weight: 0,
      },
    },
  }
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

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('loads a selected day, renders totals, handles empty dates, and retries errors', async () => {
  const calls = []
  const emptyRequest = deferred()
  let retryAttempts = 0
  const loadSales = async (scope) => {
    calls.push(scope)
    if (scope.date === '2026-07-24') {
      return salesResponse({ date: scope.date })
    }
    if (scope.date === '2026-07-23') {
      return emptyRequest.promise
    }
    retryAttempts += 1
    if (retryAttempts === 1) throw new Error('Sin conexion')
    return salesResponse({ date: scope.date, name: 'Producto recuperado' })
  }

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(AngyPosProductBreakdown, {
      warehouseId: 89,
      companyId: 34,
      loadSales,
      todayOverride: '2026-07-24',
    }))
    await flush()
  })

  assert.deepEqual(calls[0], {
    date: '2026-07-24',
    warehouseId: 89,
    companyId: 34,
  })
  let text = renderedText(renderer)
  assert.match(text, /ROL-55/)
  assert.match(text, /Rolito 5\.5 kg/)
  assert.match(text, /336/)
  assert.match(text, /16\.5 kg/)

  const dateInput = renderer.root.findByType('input')
  const dateLabel = renderer.root.findByProps({ htmlFor: 'angy-pos-sales-date' })
  assert.equal(dateInput.props.type, 'date')
  assert.equal(dateInput.props.value, '2026-07-24')
  assert.equal(dateInput.props.max, '2026-07-24')
  assert.equal(dateLabel.findByType('span').children.join(''), 'Fecha')

  act(() => {
    dateInput.props.onChange({ target: { value: '2026-07-23' } })
  })
  text = renderedText(renderer)
  assert.match(text, /Cargando desglose…/)
  assert.doesNotMatch(text, /Rolito 5\.5 kg/)
  assert.doesNotMatch(text, /sin peso configurado/i)

  await act(async () => {
    emptyRequest.resolve(emptyResponse('2026-07-23'))
    await flush()
  })
  text = renderedText(renderer)
  const emptyMessage = renderer.root
    .findByProps({ className: 'angy-pos-breakdown__empty' })
    .findByType('p')
  assert.equal(emptyMessage.children.join(''), 'No hay ventas POS para esta fecha.')
  assert.match(text, /0 unidades/)
  assert.match(text, /\$0\.00/)
  assert.match(text, /0 kg/)

  await act(async () => {
    renderer.root.findByType('input').props.onChange({
      target: { value: '2026-07-22' },
    })
    await flush()
  })
  text = renderedText(renderer)
  assert.match(text, /Sin conexion/)
  assert.equal(renderer.root.findByProps({ role: 'alert' }).type, 'div')

  await act(async () => {
    renderer.root.findByType('button').props.onClick()
    await flush()
  })
  text = renderedText(renderer)
  assert.match(text, /Producto recuperado/)
  assert.equal(retryAttempts, 2)

  act(() => {
    renderer.unmount()
  })
})

test('keeps a late response from replacing the newest selected date', async () => {
  const firstRequest = deferred()
  const secondRequest = deferred()
  const calls = []
  const loadSales = (scope) => {
    calls.push(scope)
    return scope.date === '2026-07-24' ? firstRequest.promise : secondRequest.promise
  }

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(AngyPosProductBreakdown, {
      warehouseId: 89,
      companyId: 34,
      loadSales,
      todayOverride: '2026-07-24',
    }))
    await flush()
  })

  act(() => {
    renderer.root.findByType('input').props.onChange({
      target: { value: '2026-07-23' },
    })
  })
  assert.equal(calls.length, 2)

  await act(async () => {
    secondRequest.resolve(salesResponse({
      date: '2026-07-23',
      name: 'Respuesta nueva',
    }))
    await flush()
  })
  assert.match(renderedText(renderer), /Respuesta nueva/)

  await act(async () => {
    firstRequest.resolve(salesResponse({
      date: '2026-07-24',
      name: 'Respuesta vieja',
    }))
    await flush()
  })
  const text = renderedText(renderer)
  assert.match(text, /Respuesta nueva/)
  assert.doesNotMatch(text, /Respuesta vieja/)

  act(() => {
    renderer.unmount()
  })
})

test('renders SKU and weight fallbacks plus the excluded-kilos warning', async () => {
  const loadSales = async ({ date }) => salesResponse({
    date,
    name: 'Bolsa sin ficha',
    sku: '',
    quantity: 1,
    amount: 25,
    weight: 0,
    weightConfigured: false,
    productsWithoutWeight: 1,
  })

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(AngyPosProductBreakdown, {
      warehouseId: 89,
      companyId: 34,
      loadSales,
      todayOverride: '2026-07-24',
    }))
    await flush()
  })

  const text = renderedText(renderer)
  assert.match(text, /Sin SKU/)
  assert.match(text, /Peso no configurado/)
  let warning = renderer.root.findByProps({
    className: 'angy-pos-breakdown__warning',
  })
  assert.equal(
    warning.children.join(''),
    '1 producto(s) sin peso configurado no se incluyeron en el total de kilos.',
  )

  const loadSalesWithTwoMissingWeights = async ({ date }) => salesResponse({
    date,
    name: 'Bolsa sin ficha',
    sku: '',
    quantity: 2,
    amount: 50,
    weight: 0,
    weightConfigured: false,
    productsWithoutWeight: 2,
  })
  await act(async () => {
    renderer.update(React.createElement(AngyPosProductBreakdown, {
      warehouseId: 89,
      companyId: 34,
      loadSales: loadSalesWithTwoMissingWeights,
      todayOverride: '2026-07-24',
    }))
    await flush()
  })
  warning = renderer.root.findByProps({
    className: 'angy-pos-breakdown__warning',
  })
  assert.equal(
    warning.children.join(''),
    '2 producto(s) sin peso configurado no se incluyeron en el total de kilos.',
  )

  act(() => {
    renderer.unmount()
  })
})

test('keeps the required copy and responsive table-card CSS contract', async () => {
  const componentPath = new URL(
    '../src/modules/admin/components/AngyPosProductBreakdown.jsx',
    import.meta.url,
  )
  const cssPath = new URL(
    '../src/modules/admin/components/AngyPosProductBreakdown.css',
    import.meta.url,
  )
  const [component, css] = await Promise.all([
    readFile(componentPath, 'utf8'),
    readFile(cssPath, 'utf8'),
  ])

  for (const label of [
    'SKU',
    'Producto',
    'Cantidad',
    'Monto total',
    'Peso',
    'Sin SKU',
    'Peso no configurado',
  ]) {
    assert.match(component, new RegExp(label))
  }
  assert.match(component, /productsWithoutWeight/)
  assert.doesNotMatch(component, /style=\{\{/)
  assert.doesNotMatch(component, /POLL_MS/)
  assert.match(css, /@media\s*\(max-width:\s*720px\)/)
  assert.match(css, /\.angy-pos-breakdown__table/)
  assert.match(css, /\.angy-pos-breakdown__cards/)
  assert.match(css, /\.angy-pos-breakdown__card/)
})

test('keeps the exact approved date label in source', async () => {
  const component = await readFile(new URL(
    '../src/modules/admin/components/AngyPosProductBreakdown.jsx',
    import.meta.url,
  ), 'utf8')

  assert.match(component, /<span>Fecha<\/span>/)
})

test('keeps the exact approved empty-state sentence in source', async () => {
  const component = await readFile(new URL(
    '../src/modules/admin/components/AngyPosProductBreakdown.jsx',
    import.meta.url,
  ), 'utf8')

  assert.match(component, /<p>No hay ventas POS para esta fecha\.<\/p>/)
})

test('guards request completion with effect-local unmount cleanup', async () => {
  const component = await readFile(new URL(
    '../src/modules/admin/components/AngyPosProductBreakdown.jsx',
    import.meta.url,
  ), 'utf8')

  assert.match(component, /let active = true/)
  assert.equal(
    component.match(/active && requestTracker\.isCurrent\(requestId\)/g)?.length,
    2,
  )
  assert.match(component, /return \(\) => \{\s*active = false\s*\}/)
})
