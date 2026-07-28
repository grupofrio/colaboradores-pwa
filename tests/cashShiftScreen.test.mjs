import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let vite
let runtimePromise
let firstOpenRuntimePromise

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function validShift({ type = 'night', overdue = false } = {}) {
  const businessDate = '2026-07-27'
  return {
    folio: 'CT/POS/2026/00041',
    version_id: false,
    version_number: 0,
    closing_type: false,
    responsible: { employee_id: false, employee_name: '', user_id: false, user_name: '' },
    closed_or_reclosed_at: false,
    evidence: false,
    previous_version_id: false,
    prior_totals: {},
    reopen_reason: '',
    shift: { id: 41, type, business_date: businessDate, state: 'open', version: 0 },
    scope: {
      company_id: 34,
      company_name: 'Glaciem',
      warehouse_id: 89,
      warehouse_name: 'Iguala',
      analytic_account_id: 12,
      analytic_account_name: 'IGU34',
    },
    period: {
      opened_at: type === 'night' ? '2026-07-26 18:04:00' : '2026-07-27 06:04:00',
      closed_at: false,
      timezone: 'America/Mexico_City',
    },
    schedule: {
      expected_close: `2026-07-27 ${type === 'night' ? '06' : '18'}:00:00`,
      overdue,
    },
    totals: {
      sales_cash: 800,
      sales_card: 200,
      sales_total: 1000,
      expenses: 100,
      expected_cash: 1200,
    },
    opening_fund: 500,
    payments: { cash: 800, card: 200, total: 1000, rows: [] },
    products: [],
    product_totals: { quantity: 0, amount_total: 0, weight_total_kg: 0, products_without_weight: 0 },
    sales: [],
    cancellations: [],
    expenses: [],
    denominations: [],
    adjustments: [],
    authorizations: [],
    physical_cash: 0,
    difference: -1200,
    difference_note: '',
    evidence_present: false,
    needs_manager_auth: false,
    needs_director_auth: false,
    printable: false,
  }
}

function pendingDetail() {
  return {
    detail_kind: 'pending_authorization',
    shift_id: 77,
    version_id: 901,
    version: 1,
    state: 'pending_auth',
    scope: { company: 'Glaciem', warehouse: 'Iguala', analytic: 'IGU34' },
    difference: 245.5,
    needs_manager_auth: true,
    needs_director_auth: false,
    note: 'Diferencia revisada',
    evidence_present: true,
    authorizations: [],
  }
}

function initialPreview({ serverPreviewAt = '2026-07-26 23:55:00', saleName = 'POS/1001' } = {}) {
  return {
    mode: 'initial',
    config_state: 'inactive',
    server_preview_at: serverPreviewAt,
    interval: ['2026-07-26 18:00:00', '2026-07-26 23:55:00'],
    requested_shift: { shift_type: 'night', business_date: '2026-07-27' },
    eligible_sales: [
      { id: 1001, display_name: saleName, total: 350, state: 'sale', payment_method: 'cash', channel: 'admin' },
    ],
    eligible_expenses: [
      { id: 2001, display_name: 'Hielo', total: 50 },
    ],
    eligible_order_ids: [1001],
    eligible_expense_ids: [2001],
    displayed_totals: { sales_cash: 350, sales_card: 0, sales_total: 350, expenses_total: 50 },
    exclusion_counts: {},
  }
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
      return vite.ssrLoadModule('/src/modules/admin/components/CashShiftDashboard.jsx')
    })()
  }
  return runtimePromise
}

async function loadFirstOpenRuntime() {
  if (!firstOpenRuntimePromise) {
    firstOpenRuntimePromise = vite.ssrLoadModule('/src/modules/admin/components/CashShiftFirstOpenForm.jsx')
  }
  return firstOpenRuntimePromise
}

after(async () => {
  await vite?.close()
})

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.children)
}

function renderedText(renderer) {
  return textOf(renderer.toJSON()).replace(/\s+/g, ' ').trim()
}

function button(renderer, label) {
  return renderer.root.findAllByType('button').find((item) => textOf(item).trim() === label)
}

async function mount(props) {
  const { default: Dashboard } = await loadRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Dashboard, props))
    await flush()
  })
  return renderer
}

async function mountFirstOpen(props) {
  await loadRuntime()
  const { default: FirstOpenForm } = await loadFirstOpenRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(FirstOpenForm, props))
    await flush()
  })
  return renderer
}

function changeOpenField(renderer, name, value) {
  const control = renderer.root.findByProps({ name })
  act(() => control.props.onChange({ target: { value } }))
}

function fillOpenDraft(renderer, {
  shiftType = 'night',
  businessDate = '2026-07-27',
  startAt = '2026-07-26T18:00',
  openingFund = '500',
} = {}) {
  changeOpenField(renderer, 'shiftType', shiftType)
  changeOpenField(renderer, 'businessDate', businessDate)
  changeOpenField(renderer, 'startAt', startAt)
  changeOpenField(renderer, 'openingFund', openingFund)
}

function submitPreview(renderer) {
  act(() => {
    void renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })
  })
}

test('loading, denied capability and missing scope fail closed without backend reads', async () => {
  const calls = []
  const deps = {
    loadActive: async () => { calls.push('active') },
    loadPendingDetail: async () => { calls.push('detail') },
    previewInitial: async () => { calls.push('preview') },
  }

  for (const scenario of [
    { accessMode: 'loading', scopeReady: true, expected: /Verificando acceso/ },
    { accessMode: 'denied', scopeReady: true, expected: /no confirmó permiso/i },
    { accessMode: 'manage', scopeReady: false, expected: /alcance de sucursal/i },
  ]) {
    const renderer = await mount({ ...scenario, ...deps })
    assert.match(renderedText(renderer), scenario.expected)
    act(() => renderer.unmount())
  }
  assert.deepEqual(calls, [])
})

test('authorizer-only asks for an explicit shift and calls only minimum detail/authorize', async () => {
  const calls = []
  const forbidden = (name) => async () => { throw new Error(`${name} must not be called`) }
  const renderer = await mount({
    accessMode: 'authorize',
    scopeReady: true,
    authorizerShiftId: 77,
    loadActive: forbidden('active'),
    previewInitial: forbidden('preview'),
    openInitial: forbidden('open'),
    loadHistory: forbidden('history'),
    printShift: forbidden('print'),
    reopenShift: forbidden('reopen'),
    loadPendingDetail: async (input) => {
      calls.push(['detail', input])
      return { ok: true, data: pendingDetail() }
    },
    authorizePending: async (input) => {
      calls.push(['authorize', input])
      return { status: 'completed', data: { ok: true }, key: 'auth-key' }
    },
  })

  assert.deepEqual(calls, [['detail', { shiftId: 77 }]])
  assert.match(renderedText(renderer), /Autorización pendiente/)
  assert.match(renderedText(renderer), /\$245\.50/)
  assert.doesNotMatch(renderedText(renderer), /Turno activo|Abrir primer turno|Historial|Imprimir|Reabrir|Hacer corte/)

  await act(async () => {
    button(renderer, 'Autorizar gerencia').props.onClick()
    await flush()
  })
  assert.deepEqual(calls[1], ['authorize', { shiftId: 77, versionId: 901, level: 'manager' }])
  assert.deepEqual(calls[2], ['detail', { shiftId: 77 }])
  act(() => renderer.unmount())
})

test('authorizer-only without deep-link stays safe and validates a manually entered shift ID', async () => {
  const calls = []
  const renderer = await mount({
    accessMode: 'authorize',
    scopeReady: true,
    authorizerShiftId: null,
    loadPendingDetail: async (input) => { calls.push(input); return { ok: true, data: pendingDetail() } },
  })
  assert.match(renderedText(renderer), /ID del turno pendiente/)
  assert.deepEqual(calls, [])

  const input = renderer.root.findByProps({ name: 'pendingShiftId' })
  act(() => input.props.onChange({ target: { value: '__proto__' } }))
  act(() => button(renderer, 'Consultar corte pendiente').props.onClick())
  assert.match(renderedText(renderer), /ID de turno válido/)
  assert.deepEqual(calls, [])
  act(() => renderer.unmount())
})

test('an uncertain authorization preserves and retries the exact request/key', async () => {
  const attempts = []
  const preserved = { shiftId: 77, versionId: 901, level: 'manager', idempotencyKey: 'same-auth-key' }
  const renderer = await mount({
    accessMode: 'authorize',
    scopeReady: true,
    authorizerShiftId: 77,
    loadPendingDetail: async () => ({ ok: true, data: pendingDetail() }),
    authorizePending: async (input) => {
      attempts.push(input)
      return attempts.length === 1
        ? { status: 'pending', request: preserved, key: 'same-auth-key' }
        : { status: 'completed', data: { ok: true }, key: 'same-auth-key' }
    },
  })
  await act(async () => {
    button(renderer, 'Autorizar gerencia').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /Reintentar misma autorización/)
  await act(async () => {
    button(renderer, 'Reintentar misma autorización').props.onClick()
    await flush()
  })
  assert.deepEqual(attempts, [
    { shiftId: 77, versionId: 901, level: 'manager' },
    preserved,
  ])
  act(() => renderer.unmount())
})

test('a final authorization renders success without rereading a detail that is no longer pending', async () => {
  let detailReads = 0
  const renderer = await mount({
    accessMode: 'authorize',
    scopeReady: true,
    authorizerShiftId: 77,
    loadPendingDetail: async () => {
      detailReads += 1
      return { ok: true, data: pendingDetail() }
    },
    authorizePending: async () => ({
      status: 'completed',
      data: { ok: true, data: { shift_id: 77, version_id: 901, level: 'manager', state: 'closed' } },
      key: 'auth-finished',
    }),
  })
  await act(async () => {
    button(renderer, 'Autorizar gerencia').props.onClick()
    await flush()
  })
  assert.equal(detailReads, 1)
  assert.match(renderedText(renderer), /Corte autorizado/)
  assert.match(renderedText(renderer), /quedó cerrado/)
  act(() => renderer.unmount())
})

test('inactive config validates the four-field initial form and previews the server half-open interval', async () => {
  const previews = []
  const opens = []
  let activeReads = 0
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return activeReads === 1
        ? { ok: true, data: { active: false, config_state: 'inactive' } }
        : { ok: true, data: validShift() }
    },
    previewInitial: async (input) => { previews.push(input); return { ok: true, data: initialPreview() } },
    openInitial: async (input) => {
      opens.push(input)
      return { status: 'completed', data: { ok: true }, key: 'open-key' }
    },
  })

  assert.match(renderedText(renderer), /Abrir primer turno/)
  act(() => button(renderer, 'Revisar movimientos elegibles').props.onClick())
  assert.match(renderedText(renderer), /Completa tipo, fecha operativa, hora inicial y fondo inicial/)
  assert.deepEqual(previews, [])

  const controls = Object.fromEntries(
    renderer.root.findAll((node) => ['input', 'select'].includes(node.type) && node.props.name)
      .map((node) => [node.props.name, node]),
  )
  act(() => {
    controls.shiftType.props.onChange({ target: { value: 'night' } })
    controls.businessDate.props.onChange({ target: { value: '2026-07-27' } })
    controls.startAt.props.onChange({ target: { value: '2026-07-26T18:00' } })
    controls.openingFund.props.onChange({ target: { value: '500' } })
  })
  await act(async () => {
    button(renderer, 'Revisar movimientos elegibles').props.onClick()
    await flush()
  })

  assert.equal(previews.length, 1)
  assert.deepEqual(Object.keys(previews[0]).sort(), ['businessDate', 'mode', 'shiftType', 'startAt'])
  assert.equal(previews[0].mode, 'initial')
  assert.equal(previews[0].startAt, '2026-07-27 00:00:00', '18:00 México se envía como UTC')
  const previewText = renderedText(renderer)
  assert.match(previewText, /Vista previa del servidor/)
  assert.match(previewText, /Incluye el inicio y excluye la hora final/)
  assert.match(previewText, /1 venta elegible/)
  assert.match(previewText, /1 gasto elegible/)
  assert.match(previewText, /POS\/1001/)
  assert.match(previewText, /Hielo/)
  assert.match(previewText, /Ventas en efectivo/)
  assert.match(previewText, /Ventas con terminal/)
  assert.match(previewText, /2026-07-26 23:55:00/)
  assert.match(previewText, /vuelve a evaluar bajo bloqueo/i)

  await act(async () => {
    button(renderer, 'Confirmar apertura').props.onClick()
    await flush()
  })
  assert.equal(opens.length, 1)
  assert.deepEqual(Object.keys(opens[0]).sort(), ['businessDate', 'openingFund', 'shiftType', 'startAt'])
  assert.equal(opens[0].startAt, '2026-07-27 00:00:00')
  assert.equal('companyId' in opens[0], false)
  assert.equal('warehouseId' in opens[0], false)
  assert.equal('analyticAccountId' in opens[0], false)
  assert.equal('employeeId' in opens[0], false)
  assert.equal('movementIds' in opens[0], false)
  assert.match(renderedText(renderer), /Turno activo · Noche 27/)
  act(() => renderer.unmount())
})

test('a preview response is ignored after any field changes to a different draft', async () => {
  const previewA = deferred()
  const renderer = await mountFirstOpen({
    onPreview: () => previewA.promise,
    onOpen: async () => ({ status: 'completed' }),
  })
  fillOpenDraft(renderer)
  submitPreview(renderer)
  changeOpenField(renderer, 'openingFund', '750')

  await act(async () => {
    previewA.resolve({ ok: true, data: initialPreview({ saleName: 'VENTA-A' }) })
    await flush()
  })

  assert.doesNotMatch(renderedText(renderer), /Vista previa del servidor|VENTA-A/)
  assert.equal(button(renderer, 'Confirmar apertura'), undefined)
  act(() => renderer.unmount())
})

test('overlapping previews keep the newest Mexico draft when the older response arrives last', async () => {
  const previewA = deferred()
  const previewB = deferred()
  const opens = []
  let calls = 0
  const renderer = await mountFirstOpen({
    onPreview: () => {
      calls += 1
      return calls === 1 ? previewA.promise : previewB.promise
    },
    onOpen: async (request) => {
      opens.push(request)
      return { status: 'completed' }
    },
  })

  fillOpenDraft(renderer)
  submitPreview(renderer)
  changeOpenField(renderer, 'businessDate', '2026-07-28')
  changeOpenField(renderer, 'startAt', '2026-07-27T18:00')
  changeOpenField(renderer, 'openingFund', '750')
  submitPreview(renderer)

  await act(async () => {
    previewB.resolve({ ok: true, data: initialPreview({ serverPreviewAt: 'B-PREVIEW', saleName: 'VENTA-B' }) })
    await flush()
  })
  assert.match(renderedText(renderer), /B-PREVIEW|VENTA-B/)

  await act(async () => {
    previewA.resolve({ ok: true, data: initialPreview({ serverPreviewAt: 'A-PREVIEW', saleName: 'VENTA-A' }) })
    await flush()
  })
  assert.match(renderedText(renderer), /B-PREVIEW|VENTA-B/)
  assert.doesNotMatch(renderedText(renderer), /A-PREVIEW|VENTA-A/)

  await act(async () => {
    button(renderer, 'Confirmar apertura').props.onClick()
    await flush()
  })
  assert.deepEqual(opens, [{
    shiftType: 'night',
    businessDate: '2026-07-28',
    startAt: '2026-07-28 00:00:00',
    openingFund: 750,
  }])
  act(() => renderer.unmount())
})

test('a stale confirm handler cannot open a draft different from the previewed draft', async () => {
  const opens = []
  const renderer = await mountFirstOpen({
    onPreview: async () => ({ ok: true, data: initialPreview() }),
    onOpen: async (request) => { opens.push(request); return { status: 'completed' } },
  })
  fillOpenDraft(renderer)
  submitPreview(renderer)
  await act(async () => { await flush() })
  const staleConfirm = button(renderer, 'Confirmar apertura').props.onClick

  changeOpenField(renderer, 'openingFund', '900')
  await act(async () => {
    staleConfirm()
    await flush()
  })

  assert.deepEqual(opens, [])
  assert.match(renderedText(renderer), /vuelve a revisar los movimientos/i)
  act(() => renderer.unmount())
})

test('an unmounted first-open form ignores its pending preview completion', async () => {
  const pending = deferred()
  const renderer = await mountFirstOpen({
    onPreview: () => pending.promise,
    onOpen: async () => ({ status: 'completed' }),
  })
  fillOpenDraft(renderer)
  submitPreview(renderer)
  act(() => renderer.unmount())
  await act(async () => {
    pending.resolve({ ok: true, data: initialPreview() })
    await flush()
  })
})

test('desktop and mobile render the same authoritative active source, day/night copy and overdue warning', async () => {
  for (const [layout, type, overdue, expected] of [
    ['desktop', 'night', true, /Turno activo · Noche 27/],
    ['mobile', 'day', false, /Turno activo · Día 27/],
  ]) {
    const renderer = await mount({
      accessMode: 'manage',
      scopeReady: true,
      layout,
      loadActive: async () => ({ ok: true, data: validShift({ type, overdue }) }),
    })
    assert.match(renderedText(renderer), expected)
    assert.match(renderedText(renderer), /Ventas en efectivo/)
    assert.match(renderedText(renderer), /Ventas con terminal/)
    assert.match(renderedText(renderer), /Efectivo esperado/)
    assert.equal(renderer.root.findByProps({ 'data-cash-shift-source': 'server-active' }).props['data-layout'], layout)
    if (overdue) assert.match(renderedText(renderer), /turno excedió la hora esperada/i)
    act(() => renderer.unmount())
  }
})

test('load errors are sanitized, retry is explicit, and an unmounted completion is ignored', async () => {
  let attempt = 0
  const request = deferred()
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      attempt += 1
      if (attempt === 1) throw new Error('SENSITIVE_BACKEND_TRACE')
      return { ok: true, data: validShift() }
    },
  })
  assert.match(renderedText(renderer), /No se pudo consultar el turno activo/)
  assert.doesNotMatch(renderedText(renderer), /SENSITIVE_BACKEND_TRACE/)
  await act(async () => {
    button(renderer, 'Reintentar').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /Turno activo/)
  act(() => renderer.unmount())

  const pendingRenderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: () => request.promise,
  })
  act(() => pendingRenderer.unmount())
  await act(async () => {
    request.resolve({ ok: true, data: validShift() })
    await flush()
  })
})
