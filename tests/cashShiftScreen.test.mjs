import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createServer } from 'vite'
import { normalizeCashShift, normalizePendingCashShiftPreview } from '../src/modules/admin/cashShiftModel.js'
import * as closeModel from '../src/modules/admin/cashShiftCloseModel.js'

const { buildCashShiftCloseOperation, calculateCloseFeedback } = closeModel

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let vite
let runtimePromise
let firstOpenRuntimePromise
let closeRuntimePromise

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

function pendingDetail({
  allowedLevels = ['manager'],
  authorizations = [],
  needsManagerAuth = true,
  needsDirectorAuth = false,
} = {}) {
  return {
    detail_kind: 'pending_authorization',
    shift_id: 77,
    version_id: 901,
    version: 1,
    state: 'pending_auth',
    scope: { company: 'Glaciem', warehouse: 'Iguala', analytic: 'IGU34' },
    difference: 245.5,
    needs_manager_auth: needsManagerAuth,
    needs_director_auth: needsDirectorAuth,
    note: 'Diferencia revisada',
    evidence_present: true,
    allowed_levels: allowedLevels,
    authorizations,
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

async function loadCloseRuntime() {
  await loadRuntime()
  if (!closeRuntimePromise) {
    closeRuntimePromise = vite.ssrLoadModule('/src/modules/admin/components/CashShiftCloseForm.jsx')
  }
  return closeRuntimePromise
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

function assertNoClosePhotoInput(renderer) {
  const removedName = ['evidence', 'Photo'].join('')
  assert.equal(renderer.root.findAllByType('input').some((item) => item.props.name === removedName), false)
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

async function mountClose(props) {
  await loadRuntime()
  const { default: CloseForm } = await loadCloseRuntime()
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(CloseForm, props))
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
  assert.equal(button(renderer, 'Autorizar gerencia')?.type, 'button')
  assert.equal(button(renderer, 'Autorizar dirección'), undefined)
  assert.doesNotMatch(renderedText(renderer), /Turno activo|Abrir primer turno|Historial|Imprimir|Reabrir|Hacer corte/)

  await act(async () => {
    button(renderer, 'Autorizar gerencia').props.onClick()
    await flush()
  })
  assert.deepEqual(calls[1], ['authorize', { shiftId: 77, versionId: 901, level: 'manager' }])
  assert.deepEqual(calls[2], ['detail', { shiftId: 77 }])
  act(() => renderer.unmount())
})

test('pending authorization actions require backend level, outstanding need and no prior approval', async () => {
  const authorization = (level) => ({
    level,
    actor_employee_id: 717,
    actor_name: 'Autorizador',
    authorized_at: '2026-07-27 07:00:00',
  })
  const scenarios = [
    {
      detail: pendingDetail({ allowedLevels: ['manager'], needsDirectorAuth: true }),
      visible: 'Autorizar gerencia', hidden: 'Autorizar dirección', waiting: false,
    },
    {
      detail: pendingDetail({ allowedLevels: ['director'], needsDirectorAuth: true }),
      visible: 'Autorizar dirección', hidden: 'Autorizar gerencia', waiting: false,
    },
    {
      detail: pendingDetail({
        allowedLevels: ['manager', 'director'],
        needsDirectorAuth: true,
        authorizations: [authorization('manager')],
      }),
      visible: 'Autorizar dirección', hidden: 'Autorizar gerencia', waiting: false,
    },
    {
      detail: pendingDetail({
        allowedLevels: ['manager'],
        needsDirectorAuth: true,
        authorizations: [authorization('manager')],
      }),
      visible: null, hidden: 'Autorizar dirección', waiting: true,
    },
  ]

  for (const scenario of scenarios) {
    const renderer = await mount({
      accessMode: 'authorize',
      scopeReady: true,
      authorizerShiftId: 77,
      loadPendingDetail: async () => ({ ok: true, data: scenario.detail }),
    })
    if (scenario.visible) assert.equal(button(renderer, scenario.visible)?.type, 'button')
    assert.equal(Boolean(button(renderer, scenario.hidden)), false)
    if (scenario.waiting) assert.match(renderedText(renderer), /espera autorización de otro nivel/i)
    act(() => renderer.unmount())
  }
})

test('manager authorization reload keeps prior level and offers only actor-permitted remainder', async () => {
  let reads = 0
  const renderer = await mount({
    accessMode: 'authorize',
    scopeReady: true,
    authorizerShiftId: 77,
    loadPendingDetail: async () => {
      reads += 1
      return {
        ok: true,
        data: reads === 1
          ? pendingDetail({ allowedLevels: ['manager', 'director'], needsDirectorAuth: true })
          : pendingDetail({
              allowedLevels: ['manager', 'director'],
              needsDirectorAuth: true,
              authorizations: [{
                level: 'manager',
                actor_employee_id: 717,
                actor_name: 'Gerencia',
                authorized_at: '2026-07-27 07:00:00',
              }],
            }),
      }
    },
    authorizePending: async () => ({
      status: 'completed',
      data: { ok: true, data: { state: 'pending_auth' } },
      key: 'manager-auth',
    }),
  })
  await act(async () => {
    button(renderer, 'Autorizar gerencia').props.onClick()
    await flush()
  })
  assert.equal(reads, 2)
  assert.equal(Boolean(button(renderer, 'Autorizar gerencia')), false)
  assert.equal(button(renderer, 'Autorizar dirección')?.type, 'button')
  act(() => renderer.unmount())
})

test('pending authorization rejects malformed level grants and authorization rows', async () => {
  for (const detail of [
    pendingDetail({ allowedLevels: ['manager', 'manager'] }),
    pendingDetail({ allowedLevels: ['owner'] }),
    pendingDetail({ authorizations: [{ level: 'manager' }] }),
  ]) {
    const renderer = await mount({
      accessMode: 'authorize',
      scopeReady: true,
      authorizerShiftId: 77,
      loadPendingDetail: async () => ({ ok: true, data: detail }),
    })
    assert.match(renderedText(renderer), /No se pudo consultar el turno activo/)
    act(() => renderer.unmount())
  }
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

test('late completed, pending or failed authorization from session A cannot affect session B', async () => {
  for (const lateKind of ['completed', 'pending', 'error']) {
    const authorizationA = deferred()
    const authorizationB = deferred()
    const calls = []
    const preservedB = {
      shiftId: 77,
      versionId: 901,
      level: 'manager',
      idempotencyKey: `session-b-${lateKind}`,
    }
    const props = {
      accessMode: 'authorize',
      scopeReady: true,
      authorizerShiftId: 77,
      loadPendingDetail: async () => ({ ok: true, data: pendingDetail() }),
      authorizePending: async (request) => {
        calls.push(structuredClone(request))
        if (calls.length === 1) return authorizationA.promise
        if (calls.length === 2) return authorizationB.promise
        return { status: 'pending', request: preservedB, key: preservedB.idempotencyKey }
      },
    }
    const renderer = await mount({ ...props, sessionIdentity: `session-a-${lateKind}` })
    act(() => { void button(renderer, 'Autorizar gerencia').props.onClick() })
    await act(async () => {
      renderer.update(React.createElement((await loadRuntime()).default, {
        ...props,
        sessionIdentity: `session-b-${lateKind}`,
      }))
      await flush()
    })
    act(() => { void button(renderer, 'Autorizar gerencia').props.onClick() })

    if (lateKind === 'completed') {
      await act(async () => {
        authorizationA.resolve({ status: 'completed', data: { ok: true, data: { state: 'closed' } } })
        await flush()
      })
      assert.equal(button(renderer, 'Autorizar gerencia')?.props.disabled, true, 'A no libera la operación B en curso')
      assert.doesNotMatch(renderedText(renderer), /Corte autorizado/)
      authorizationB.resolve({ status: 'pending', request: preservedB, key: preservedB.idempotencyKey })
    } else {
      authorizationB.resolve({ status: 'pending', request: preservedB, key: preservedB.idempotencyKey })
      await act(async () => { await flush() })
      await act(async () => {
        if (lateKind === 'pending') {
          authorizationA.resolve({
            status: 'pending',
            request: { ...preservedB, idempotencyKey: 'session-a-key' },
            key: 'session-a-key',
          })
        } else {
          authorizationA.reject(new Error('late session A failure'))
        }
        await flush()
      })
    }
    await act(async () => { await flush() })
    assert.match(renderedText(renderer), /Reintentar misma autorización/)
    assert.match(renderedText(renderer), /autorización quedó pendiente/i)
    assert.doesNotMatch(renderedText(renderer), /No se pudo autorizar|Corte autorizado/)
    await act(async () => { button(renderer, 'Reintentar misma autorización').props.onClick(); await flush() })
    assert.deepEqual(calls[2], preservedB, 'la respuesta tardía de A no reemplaza el pending de B')
    act(() => renderer.unmount())
  }
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

test('opening in flight freezes the previewed fund and pending retry reuses the exact request and key', async () => {
  const firstOpen = deferred()
  const attempts = []
  const frozenRequest = {
    shiftType: 'night',
    businessDate: '2026-07-27',
    startAt: '2026-07-27 00:00:00',
    openingFund: 500,
    idempotencyKey: 'frozen-open-key',
  }
  const renderer = await mountFirstOpen({
    onPreview: async () => ({ ok: true, data: initialPreview() }),
    onOpen: async (request) => {
      attempts.push(request)
      return attempts.length === 1
        ? firstOpen.promise
        : { status: 'completed', data: { ok: true }, key: 'frozen-open-key' }
    },
  })
  fillOpenDraft(renderer)
  submitPreview(renderer)
  await act(async () => { await flush() })

  act(() => { void button(renderer, 'Confirmar apertura').props.onClick() })
  const fund = renderer.root.findByProps({ name: 'openingFund' })
  assert.equal(fund.props.disabled, true)
  act(() => fund.props.onChange({ target: { value: '900' } }))
  assert.equal(renderer.root.findByProps({ name: 'openingFund' }).props.value, '500')

  await act(async () => {
    firstOpen.resolve({ status: 'pending', request: frozenRequest, key: 'frozen-open-key' })
    await flush()
  })
  assert.equal(renderer.root.findByProps({ name: 'openingFund' }).props.value, '500')
  assert.equal(renderer.root.findByProps({ name: 'openingFund' }).props.disabled, true)
  assert.match(renderedText(renderer), /misma solicitud y clave/i)
  assert.equal(button(renderer, 'Confirmar apertura')?.props.disabled, true)

  await act(async () => {
    button(renderer, 'Reintentar misma apertura').props.onClick()
    await flush()
  })
  assert.deepEqual(attempts, [
    {
      shiftType: 'night',
      businessDate: '2026-07-27',
      startAt: '2026-07-27 00:00:00',
      openingFund: 500,
    },
    frozenRequest,
  ])
  act(() => renderer.unmount())
})

test('completed pending opening reloads active state exactly once and ignores completion after unmount', async () => {
  let activeReads = 0
  let openCalls = 0
  const lateOpen = deferred()
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return activeReads === 1
        ? { ok: true, data: { active: false, config_state: 'inactive' } }
        : { ok: true, data: validShift() }
    },
    previewInitial: async () => ({ ok: true, data: initialPreview() }),
    openInitial: async (request) => {
      openCalls += 1
      return openCalls === 1
        ? { status: 'pending', request: { ...request, idempotencyKey: 'same-open' } }
        : { status: 'completed', data: { ok: true }, key: 'same-open' }
    },
  })
  fillOpenDraft(renderer)
  submitPreview(renderer)
  await act(async () => { await flush() })
  await act(async () => {
    button(renderer, 'Confirmar apertura').props.onClick()
    await flush()
  })
  assert.equal(activeReads, 1)
  await act(async () => {
    button(renderer, 'Reintentar misma apertura').props.onClick()
    await flush()
  })
  assert.equal(activeReads, 2)
  assert.match(renderedText(renderer), /Turno activo/)
  act(() => renderer.unmount())

  const unmounted = await mountFirstOpen({
    onPreview: async () => ({ ok: true, data: initialPreview() }),
    onOpen: () => lateOpen.promise,
  })
  fillOpenDraft(unmounted)
  submitPreview(unmounted)
  await act(async () => { await flush() })
  act(() => { void button(unmounted, 'Confirmar apertura').props.onClick() })
  act(() => unmounted.unmount())
  await act(async () => {
    lateOpen.resolve({ status: 'completed', data: { ok: true } })
    await flush()
  })
})

test('active manager refreshes manually and every 60s without flicker or overlapping late requests', async () => {
  let intervalCallback = null
  let intervalMs = null
  let intervalCleared = false
  const scheduleRefresh = (callback, milliseconds) => {
    intervalCallback = callback
    intervalMs = milliseconds
    return 41
  }
  const cancelRefresh = (intervalId) => {
    assert.equal(intervalId, 41)
    intervalCleared = true
    intervalCallback = null
  }
  const tickRefresh = () => act(() => intervalCallback?.())
  const periodic = deferred()
  let reads = 0
  const refreshed = validShift()
  refreshed.totals.sales_cash = 1234
  refreshed.totals.sales_total = 1434
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      reads += 1
      if (reads === 1) return { ok: true, data: validShift() }
      return periodic.promise
    },
    scheduleRefresh,
    cancelRefresh,
  })
  assert.equal(reads, 1)
  assert.equal(intervalMs, 60_000)
  assert.equal(button(renderer, 'Actualizar turno')?.type, 'button')

  tickRefresh()
  await act(async () => { await Promise.resolve() })
  assert.equal(reads, 2)
  assert.doesNotMatch(renderedText(renderer), /^Cargando|Consultando el corte/)
  assert.equal(button(renderer, 'Actualizando…')?.props.disabled, true)

  tickRefresh()
  tickRefresh()
  act(() => { void button(renderer, 'Actualizando…').props.onClick() })
  await act(async () => { await Promise.resolve() })
  assert.equal(reads, 2, 'poll y botón reutilizan el request en curso')

  await act(async () => {
    periodic.resolve({ ok: true, data: refreshed })
    await flush()
  })
  assert.match(renderedText(renderer), /\$1,234\.00/)
  assert.equal(button(renderer, 'Actualizar turno')?.type, 'button')
  act(() => renderer.unmount())
  assert.equal(intervalCleared, true)
  tickRefresh()
  assert.equal(reads, 2)
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
    if (overdue) assert.match(renderedText(renderer), /alcanzó su frontera operativa/i)
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

function cashShiftForClose({ state = 'open', version = 0, type = 'night' } = {}) {
  const raw = validShift({ type })
  raw.shift.state = state
  raw.shift.version = version
  raw.version_number = version
  raw.totals.expected_cash = 1200
  raw.opening_fund = 500
  raw.sales = [{
    order_id: 1001,
    name: 'POS/1001',
    amount_total: 1000,
    payment_method: 'cash',
    employee_id: 717,
    recorded_at: '2026-07-27 05:30:00',
    channel: 'admin',
  }]
  raw.payments.rows = [{ order_id: 1001, method: 'cash', amount: 1000 }]
  raw.expenses = [{
    expense_id: 2001,
    name: 'EXP/2001',
    concept: 'Bolsas',
    amount: 100,
    approval_state: 'pending',
    employee_id: 717,
    recorded_at: '2026-07-27 05:40:00',
  }]
  return normalizeCashShift(raw)
}

function closedResultDetail({ state = 'closed', version = 1, type = 'night' } = {}) {
  const raw = validShift({ type })
  raw.shift.state = state
  raw.shift.version = version
  raw.version_number = version
  raw.version_id = 900 + version
  raw.closing_type = version === 1 ? 'close' : 'reclose'
  raw.period.closed_at = '2026-07-27 06:10:00'
  raw.closed_or_reclosed_at = '2026-07-27 06:10:00'
  raw.printable = true
  return raw
}

async function prepareCloseDifference(renderer, {
  note = 'Arqueo pendiente',
} = {}) {
  act(() => renderer.root.findByProps({ name: 'denomination-500' }).props.onChange({ target: { value: '2' } }))
  act(() => renderer.root.findByProps({ name: 'differenceNote' }).props.onChange({ target: { value: note } }))
  act(() => renderer.root.findByProps({ name: 'nextOpeningFund' }).props.onChange({ target: { value: '300' } }))
}

test('close draft uses exact denomination math, validates adjustments and gates every nonzero difference', async () => {
  const shift = cashShiftForClose()
  assert.deepEqual(calculateCloseFeedback({
    serverExpectedCash: 1200,
    denominations: [{ denomination: '500', count: 2 }],
    adjustments: [
      { type: 'income', concept: 'Cambio recuperado', amount: 50 },
      { type: 'expense', concept: 'Bolsas extras', amount: 25 },
    ],
  }), {
    serverExpectedCash: 1200,
    adjustedExpectedCash: 1225,
    physicalCash: 1000,
    difference: -225,
  })

  const base = {
    cashShift: shift,
    denominations: [{ denomination: '500', count: 2 }],
    adjustments: [],
    nextOpeningFund: 300,
  }
  assert.throws(
    () => buildCashShiftCloseOperation({ ...base, notes: '' }),
    { message: 'Toda diferencia requiere nota.' },
  )
  assert.throws(
    () => buildCashShiftCloseOperation({
      ...base,
      notes: 'Revisado',
      adjustments: [{ type: 'income', concept: ' ', amount: 10 }],
    }),
    /concepto/i,
  )

  const operation = buildCashShiftCloseOperation({
    ...base,
    notes: '  Arqueo revisado  ',
  })
  assert.equal(operation.operation, 'close')
  assert.equal(operation.label, 'Cerrar Noche 27 y abrir Día 27')
  assert.deepEqual(operation.request, {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '500', count: 2 }],
    adjustments: [],
    notes: 'Arqueo revisado',
    nextOpeningFund: 300,
  })
})

test('reclose binds the current version and omits next opening fund completely', async () => {
  const shift = cashShiftForClose({ state: 'reopened', version: 2 })
  assert.deepEqual(closeModel.cashShiftCloseBinding(shift), {
    shiftId: 41,
    expectedVersion: 2,
    purpose: 'reclose',
    key: '41:2:reclose',
  })
  const operation = buildCashShiftCloseOperation({
    cashShift: shift,
    denominations: [{ denomination: '500', count: 2 }, { denomination: '200', count: 1 }],
    adjustments: [],
    notes: '',
    nextOpeningFund: 999,
  })
  assert.equal(operation.operation, 'reclose')
  assert.equal(operation.label, 'Volver a cerrar Noche 27')
  assert.equal(operation.request.expectedVersion, 2)
  assert.equal(Object.hasOwn(operation.request, 'nextOpeningFund'), false)
})

test('pending count binds settle at version zero, confirms separation and requires a dynamic note', () => {
  const shift = {
    formKind: 'pendingCount',
    expectedVersion: 0,
    shift: { id: 41, type: 'night', businessDate: '2026-07-27', state: 'pending_count' },
    totals: { expectedCash: 212 },
    boundary: {
      lateExecution: true,
      separationConfirmed: false,
      separationExceptionNote: '',
    },
  }
  assert.deepEqual(closeModel.cashShiftCloseBinding(shift), {
    shiftId: 41,
    expectedVersion: 0,
    purpose: 'settle',
    key: '41:0:settle',
  })
  assert.throws(() => buildCashShiftCloseOperation({
    cashShift: shift,
    denominations: [],
    adjustments: [],
    notes: 'Conteo pendiente',
  }), /confirmación/i)
  assert.throws(() => buildCashShiftCloseOperation({
    cashShift: shift,
    denominations: [{ denomination: '200', count: 1 }],
    adjustments: [],
    notes: '',
    separationConfirmed: false,
    separationExceptionNote: 'Efectivo separado al terminar',
    nextOpeningFund: 999,
  }), /nota/i)
  assert.throws(() => buildCashShiftCloseOperation({
    cashShift: {
      ...shift,
      notesRequired: false,
      totals: { expectedCash: 200 },
      boundary: {
        lateExecution: false,
        separationConfirmed: true,
        separationExceptionNote: '',
      },
    },
    denominations: [{ denomination: '200', count: 1 }],
    adjustments: [],
    notes: '',
    separationConfirmed: true,
    separationExceptionNote: 'Efectivo entregado después',
  }), /nota/i)
  const operation = buildCashShiftCloseOperation({
    cashShift: shift,
    denominations: [{ denomination: '200', count: 1 }],
    adjustments: [],
    notes: 'Conteo tardío',
    separationConfirmed: false,
    separationExceptionNote: 'Efectivo separado al terminar',
    nextOpeningFund: 999,
  })
  assert.equal(operation.operation, 'settle')
  assert.deepEqual(operation.request, {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '200', count: 1 }],
    adjustments: [],
    notes: 'Conteo tardío',
    separationConfirmed: false,
    separationExceptionNote: 'Efectivo separado al terminar',
  })
  assert.equal(Object.hasOwn(operation.request, 'nextOpeningFund'), false)
  assert.equal(operation.label, 'Arqueo pendiente · Noche 27')
})

test('close form refreshes authoritative preview and renders every audit section', async () => {
  const calls = []
  const shift = cashShiftForClose()
  const renderer = await mountClose({
    cashShift: shift,
    onPreview: async (request) => {
      calls.push(request)
      return { ok: true, data: validShift() }
    },
    onClose: async () => { throw new Error('not submitted') },
  })
  assert.deepEqual(calls, [{ mode: 'active', shiftId: 41 }])
  const text = renderedText(renderer)
  for (const section of [
    'Tickets y ventas', 'Pagos', 'Productos', 'Cancelaciones', 'Gastos',
    'Fondo inicial', 'Efectivo esperado', 'Arqueo por denominación', 'Ajustes de caja',
  ]) assert.match(text, new RegExp(section, 'i'))
  assert.match(text, /servidor.*autoritativ/i)
  assertNoClosePhotoInput(renderer)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27')?.type, 'button')
  act(() => renderer.unmount())
})

test('close UI replays a pending request exactly and accepts completed recovery without photo', async () => {
  const attempts = []
  const shift = cashShiftForClose()
  const pendingRequest = {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '500', count: 2 }],
    adjustments: [],
    notes: 'Conteo revisado',
    nextOpeningFund: 300,
    idempotencyKey: 'close-stable-key',
  }
  const renderer = await mountClose({
    cashShift: shift,
    onPreview: async () => ({ ok: true, data: validShift() }),
    onClose: async (operation, request) => {
      assert.equal(operation, 'close')
      attempts.push(structuredClone(request))
      return attempts.length < 3
        ? { status: 'pending', request: pendingRequest, key: 'close-stable-key' }
        : { status: 'completed', data: { ok: true }, key: 'close-stable-key' }
    },
    onCompleted: async () => {},
  })

  const denomination = renderer.root.findByProps({ name: 'denomination-500' })
  act(() => denomination.props.onChange({ target: { value: '2' } }))
  assert.match(renderedText(renderer), /Diferencia.*-\$200\.00/i)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27')?.props.disabled, true)
  act(() => renderer.root.findByProps({ name: 'differenceNote' }).props.onChange({ target: { value: 'Conteo revisado' } }))
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27')?.props.disabled, true)
  act(() => renderer.root.findByProps({ name: 'nextOpeningFund' }).props.onChange({ target: { value: '300' } }))
  assertNoClosePhotoInput(renderer)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27')?.props.disabled, false)

  await act(async () => {
    button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /misma operación/i)
  assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.disabled, true)
  await act(async () => {
    button(renderer, 'Reintentar mismo corte').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /misma operación/i)
  assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.disabled, true)
  await act(async () => {
    button(renderer, 'Reintentar mismo corte').props.onClick()
    await flush()
  })
  assert.deepEqual(attempts, [
    {
      shiftId: 41,
      expectedVersion: 0,
      denominations: [
        { denomination: '1000', count: 0 },
        { denomination: '500', count: 2 },
        { denomination: '200', count: 0 },
        { denomination: '100', count: 0 },
        { denomination: '50', count: 0 },
        { denomination: '20', count: 0 },
        { denomination: '10', count: 0 },
        { denomination: '5', count: 0 },
        { denomination: '2', count: 0 },
        { denomination: '1', count: 0 },
        { denomination: '0.50', count: 0 },
      ],
      adjustments: [],
      notes: 'Conteo revisado',
      nextOpeningFund: 300,
    },
    pendingRequest,
    pendingRequest,
  ])
  act(() => renderer.unmount())
})

test('a deterministic pending replay rejection preserves the draft for a fresh operation', async () => {
  const attempts = []
  const pendingRequest = {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '500', count: 2 }],
    adjustments: [],
    notes: 'Arqueo pendiente',
    nextOpeningFund: 300,
    idempotencyKey: 'pending-close-key',
  }
  const renderer = await mountClose({
    cashShift: cashShiftForClose(),
    onPreview: async () => ({ ok: true, data: validShift() }),
    onClose: async (_operation, request) => {
      attempts.push(structuredClone(request))
      if (attempts.length === 1) {
        return { status: 'pending', request: pendingRequest, key: 'pending-close-key' }
      }
      if (attempts.length === 2) {
        throw Object.assign(new Error('deterministic rejection'), {
          code: 'cash_shift_rejected',
        })
      }
      return { status: 'pending', request: { ...request, idempotencyKey: 'fresh-close-key' } }
    },
  })

  act(() => renderer.root.findByProps({ name: 'denomination-500' }).props.onChange({ target: { value: '2' } }))
  act(() => renderer.root.findByProps({ name: 'differenceNote' }).props.onChange({ target: { value: 'Arqueo pendiente' } }))
  act(() => renderer.root.findByProps({ name: 'nextOpeningFund' }).props.onChange({ target: { value: '300' } }))
  await act(async () => { button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick(); await flush() })
  await act(async () => { button(renderer, 'Reintentar mismo corte').props.onClick(); await flush() })

  assert.equal(attempts.length, 2)
  assert.deepEqual(attempts[1], pendingRequest)
  assert.equal(Boolean(button(renderer, 'Reintentar mismo corte')), false)
  assert.match(renderedText(renderer), /intento.*rechazado.*operación nueva/i)
  assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.value, '2')
  assert.equal(renderer.root.findByProps({ name: 'differenceNote' }).props.value, 'Arqueo pendiente')
  assert.equal(renderer.root.findByProps({ name: 'nextOpeningFund' }).props.value, '300')
  assertNoClosePhotoInput(renderer)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.disabled, false)

  await act(async () => { button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick(); await flush() })
  assert.equal(attempts.length, 3)
  assert.equal(Object.hasOwn(attempts[2], 'evidenceToken'), false)
  assert.equal(Object.hasOwn(attempts[2], 'idempotencyKey'), false)
  act(() => renderer.unmount())
})

test('generic validation and forbidden errors settle an existing pending cut', async () => {
  for (const deterministicError of [
    Object.assign(new Error('validation rejected'), { code: 'validation_error' }),
    Object.assign(new Error('access rejected'), { code: 'forbidden', status: 403 }),
  ]) {
    let calls = 0
    const pendingRequest = {
      shiftId: 41,
      expectedVersion: 0,
      denominations: [{ denomination: '500', count: 2 }],
      adjustments: [],
      notes: 'Arqueo pendiente',
      nextOpeningFund: 300,
      idempotencyKey: `pending-${deterministicError.code}`,
    }
    const renderer = await mountClose({
      cashShift: cashShiftForClose(),
      onPreview: async () => ({ ok: true, data: validShift() }),
      onClose: async () => {
        calls += 1
        if (calls === 1) return { status: 'pending', request: pendingRequest }
        throw deterministicError
      },
    })
    await prepareCloseDifference(renderer)
    await act(async () => { button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick(); await flush() })
    await act(async () => { button(renderer, 'Reintentar mismo corte').props.onClick(); await flush() })

    assert.equal(calls, 2)
    assert.equal(Boolean(button(renderer, 'Reintentar mismo corte')), false)
    assert.match(renderedText(renderer), /intento.*rechazado.*operación nueva/i)
    assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.value, '2')
    assert.equal(renderer.root.findByProps({ name: 'differenceNote' }).props.value, 'Arqueo pendiente')
    assert.equal(renderer.root.findByProps({ name: 'nextOpeningFund' }).props.value, '300')
    assertNoClosePhotoInput(renderer)
    act(() => renderer.unmount())
  }
})

test('a deterministic fresh close error preserves the draft and allows a fresh retry', async () => {
  const attempts = []
  const renderer = await mountClose({
    cashShift: cashShiftForClose(),
    onPreview: async () => ({ ok: true, data: validShift() }),
    onClose: async (_operation, request) => {
      attempts.push(structuredClone(request))
      if (attempts.length === 1) {
        throw Object.assign(new Error('validation rejected'), { code: 'cash_shift_rejected' })
      }
      return { status: 'pending', request: { ...request, idempotencyKey: 'fresh-retry-key' } }
    },
  })
  await prepareCloseDifference(renderer, { note: 'Arqueo fresco' })
  await act(async () => { button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick(); await flush() })

  assert.equal(attempts.length, 1)
  assert.equal(Boolean(button(renderer, 'Reintentar mismo corte')), false)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.disabled, false)
  assertNoClosePhotoInput(renderer)
  await act(async () => { button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick(); await flush() })
  assert.deepEqual(attempts[1], attempts[0])
  act(() => renderer.unmount())
})

test('a boundary guard that cannot navigate still removes normal close retry and offers only the pending-count action', async () => {
  const redirects = []
  const renderer = await mountClose({
    cashShift: cashShiftForClose(),
    onPreview: async () => ({ ok: true, data: validShift() }),
    onClose: async () => {
      throw Object.assign(new Error('boundary reached'), {
        code: 'pending_count_required',
        details: { shift_id: 41 },
      })
    },
    onPendingCountRequired: async (request) => {
      redirects.push(request)
      throw new Error('pending preview unavailable')
    },
  })
  changeOpenField(renderer, 'denomination-1000', '1')
  changeOpenField(renderer, 'denomination-200', '1')
  changeOpenField(renderer, 'nextOpeningFund', '0')

  await act(async () => {
    button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick()
    await flush()
  })

  assert.deepEqual(redirects, [{ shiftId: 41 }])
  assert.match(renderedText(renderer), /separó automáticamente/i)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27'), undefined)
  assert.equal(button(renderer, 'Reintentar mismo corte'), undefined)
  assert.equal(button(renderer, 'Abrir arqueo pendiente')?.type, 'button')
  act(() => renderer.unmount())
})

test('only a manager can enter the active close workflow and a completed close reloads its successor', async () => {
  const calls = []
  let activeReads = 0
  const successor = validShift({ type: 'day' })
  successor.shift.id = 42
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return { ok: true, data: activeReads === 1 ? validShift() : successor }
    },
    previewActive: async (request) => {
      calls.push(['preview', request])
      return { ok: true, data: validShift() }
    },
    closeShift: async (operation, request) => {
      calls.push([operation, request])
      return {
        status: 'completed',
        data: {
          ok: true,
          data: {
            shift_id: 41,
            version_id: 901,
            version: 1,
            state: 'closed',
            next_shift_id: 42,
            detail: closedResultDetail(),
          },
        },
        key: 'close-success',
      }
    },
  })
  assert.equal(button(renderer, 'Hacer corte')?.type, 'button')
  await act(async () => {
    button(renderer, 'Hacer corte').props.onClick()
    await flush()
  })
  assert.deepEqual(calls, [['preview', { mode: 'active', shiftId: 41 }]])
  act(() => renderer.root.findByProps({ name: 'denomination-1000' }).props.onChange({ target: { value: '1' } }))
  act(() => renderer.root.findByProps({ name: 'denomination-200' }).props.onChange({ target: { value: '1' } }))
  act(() => renderer.root.findByProps({ name: 'nextOpeningFund' }).props.onChange({ target: { value: '300' } }))
  await act(async () => {
    button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick()
    await flush()
  })
  assert.equal(calls[1][0], 'close')
  assert.equal(calls[1][1].nextOpeningFund, 300)
  assert.equal(activeReads, 2)
  assert.match(renderedText(renderer), /Turno activo · Día 27/)
  act(() => renderer.unmount())
})

test('manager reopens by exact ID/reason, preserves pending request and enters reclose without reloading successor', async () => {
  const reopenAttempts = []
  let activeReads = 0
  const closed = validShift()
  closed.shift.state = 'closed'
  closed.shift.version = 1
  closed.version_number = 1
  closed.version_id = 901
  const reopened = structuredClone(closed)
  reopened.shift.state = 'reopened'
  reopened.closing_type = false
  reopened.version_id = false
  reopened.printable = false
  const preserved = {
    shiftId: 41,
    expectedVersion: 1,
    reason: 'Cancelar venta duplicada',
    idempotencyKey: 'same-reopen-key',
  }
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => { activeReads += 1; return { ok: true, data: validShift({ type: 'day' }) } },
    loadShiftDetail: async (request) => {
      assert.deepEqual(request, { shiftId: 41 })
      return { ok: true, data: closed }
    },
    reopenShift: async (request) => {
      reopenAttempts.push(structuredClone(request))
      return reopenAttempts.length === 1
        ? { status: 'pending', request: preserved, key: 'same-reopen-key' }
        : { status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } }, key: 'same-reopen-key' }
    },
    previewActive: async (request) => {
      assert.deepEqual(request, { mode: 'active', shiftId: 41 })
      return { ok: true, data: reopened }
    },
  })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => {
    button(renderer, 'Consultar corte').props.onClick()
    await flush()
  })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Cancelar venta duplicada' } }))
  await act(async () => {
    button(renderer, 'Reabrir corte').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /Reintentar misma reapertura/)
  await act(async () => {
    button(renderer, 'Reintentar misma reapertura').props.onClick()
    await flush()
  })
  assert.deepEqual(reopenAttempts, [
    { shiftId: 41, expectedVersion: 1, reason: 'Cancelar venta duplicada' },
    preserved,
  ])
  assert.equal(activeReads, 1, 'el sucesor activo no cambia ni se recarga al reabrir')
  assert.match(renderedText(renderer), /Volver a cerrar Noche 27/)
  assert.equal(renderer.root.findAllByProps({ name: 'nextOpeningFund' }).length, 0)
  act(() => renderer.unmount())
})

test('a boundary guard while re-closing opens the returned pending count instead of leaving the reclose retry', async () => {
  let activeReads = 0
  let pendingReads = 0
  const closeCalls = []
  const pendingPreviewRequests = []
  const closed = closedResultDetail()
  const reopened = structuredClone(closed)
  reopened.shift.state = 'reopened'
  reopened.version_id = false
  reopened.closing_type = false
  reopened.printable = false
  const successor = validShift({ type: 'day' })
  successor.shift.id = 42
  const pendingRow = {
    shift_id: 41,
    shift_type: 'night',
    business_date: '2026-07-27',
    state: 'pending_count',
    expected_version: 0,
    expected_cash: 212,
    operational_closed_at: '2026-07-27 06:00:00',
    scheduled_boundary_at: '2026-07-27 06:00:00',
    boundary_executed_at: '2026-07-27 06:03:00',
    late_execution: false,
    next_shift_id: 42,
  }
  const renderer = await mount({
    sessionIdentity: 'reclose-pending-count-guard',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return { ok: true, data: successor }
    },
    loadPendingCounts: async () => {
      pendingReads += 1
      return { ok: true, data: { shifts: pendingReads === 1 ? [] : [pendingRow] } }
    },
    loadShiftDetail: async () => ({ ok: true, data: closed }),
    reopenShift: async () => ({
      status: 'completed',
      data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } },
    }),
    previewActive: async () => ({ ok: true, data: reopened }),
    previewPending: async (request) => {
      pendingPreviewRequests.push(request)
      return { ok: true, data: pendingCountPreview() }
    },
    closeShift: async (operation, request) => {
      closeCalls.push({ operation, request })
      throw Object.assign(new Error('boundary reached'), {
        code: 'pending_count_required',
        details: { shift_id: 41 },
      })
    },
  })

  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  changeOpenField(renderer, 'reopenShiftId', '41')
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  changeOpenField(renderer, 'reopenReason', 'Corrección de conteo')
  await act(async () => { button(renderer, 'Reabrir corte').props.onClick(); await flush() })
  changeOpenField(renderer, 'denomination-1000', '1')
  changeOpenField(renderer, 'denomination-200', '1')
  await act(async () => {
    button(renderer, 'Volver a cerrar Noche 27').props.onClick()
    await flush()
  })

  assert.equal(closeCalls.length, 1)
  assert.equal(closeCalls[0].operation, 'reclose')
  assert.equal(activeReads, 2)
  assert.equal(pendingReads, 2)
  assert.equal(pendingPreviewRequests.length >= 1, true)
  assert.equal(pendingPreviewRequests.every((request) => (
    request.mode === 'pending' && request.shiftId === 41
  )), true)
  assert.match(renderedText(renderer), /Arqueo posterior a cierre automático/)
  assert.equal(button(renderer, 'Volver a cerrar Noche 27'), undefined)
  assert.equal(button(renderer, 'Reintentar mismo corte'), undefined)
  act(() => renderer.unmount())
})

test('a stale normal close never retargets its draft when authoritative active changed shift', async () => {
  let activeReads = 0
  let closeAttempts = 0
  const original = validShift()
  const updated = validShift({ type: 'day' })
  updated.shift.id = 42
  updated.totals.expected_cash = 1300
  const preserved = {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [],
    adjustments: [],
    notes: 'Borrador preservado',
    nextOpeningFund: 300,
    idempotencyKey: 'pending-close-key',
  }
  const renderer = await mount({
    sessionIdentity: 'session-a|34|89|manage',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      if (activeReads === 2) throw new Error('reload unavailable')
      return { ok: true, data: activeReads === 1 ? original : updated }
    },
    previewActive: async () => ({ ok: true, data: activeReads >= 3 ? updated : original }),
    closeShift: async (_operation, request) => {
      closeAttempts += 1
      if (closeAttempts === 1) return { status: 'pending', request: preserved, key: 'pending-close-key' }
      if (closeAttempts === 2) throw Object.assign(new Error('stale'), { code: 'stale_version' })
      throw new Error(`unexpected close for ${request.shiftId}`)
    },
  })
  await act(async () => { button(renderer, 'Hacer corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'denomination-500' }).props.onChange({ target: { value: '2' } }))
  act(() => renderer.root.findByProps({ name: 'differenceNote' }).props.onChange({ target: { value: 'Borrador preservado' } }))
  act(() => renderer.root.findByProps({ name: 'nextOpeningFund' }).props.onChange({ target: { value: '300' } }))
  assertNoClosePhotoInput(renderer)
  await act(async () => {
    button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick()
    await flush()
  })
  assert.match(renderedText(renderer), /Reintentar mismo corte/)
  await act(async () => {
    button(renderer, 'Reintentar mismo corte').props.onClick()
    await flush()
  })
  assert.equal(activeReads, 2)
  assert.equal(button(renderer, 'Reintentar mismo corte'), undefined)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27'), undefined)
  assert.equal(button(renderer, 'Recargar corte')?.type, 'button')
  assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.value, '2')
  assert.equal(renderer.root.findByProps({ name: 'differenceNote' }).props.value, 'Borrador preservado')
  assert.equal(renderer.root.findByProps({ name: 'nextOpeningFund' }).props.value, '300')
  assert.match(renderedText(renderer), /cambió.*totales.*no son autoritativos/i)

  await act(async () => {
    button(renderer, 'Recargar corte').props.onClick()
    await flush()
  })
  assert.equal(activeReads, 3)
  assert.match(renderedText(renderer), /El turno cambió; el arqueo anterior se descartó y no se aplicó/i)
  assert.match(renderedText(renderer), /Turno activo · Día 27/)
  assert.equal(renderer.root.findAllByProps({ name: 'denomination-500' }).length, 0)
  assert.equal(closeAttempts, 2)

  act(() => button(renderer, 'Hacer corte').props.onClick())
  assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.value, '0')
  assert.equal(renderer.root.findByProps({ name: 'differenceNote' }).props.value, '')
  assert.equal(renderer.root.findByProps({ name: 'nextOpeningFund' }).props.value, '')
  assert.equal(button(renderer, 'Cerrar Día 27 y abrir Noche 28')?.props.disabled, true)
  assert.equal(closeAttempts, 2, 'el turno nuevo no recibe el submit del borrador descartado')
  act(() => renderer.unmount())
})

test('a stale normal close for the same shift preserves the complete draft without photo', async () => {
  let activeReads = 0
  const closeRequests = []
  const original = validShift()
  const refreshed = validShift()
  refreshed.totals.expected_cash = 1300
  const renderer = await mount({
    sessionIdentity: 'session-a|34|89|manage',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return { ok: true, data: activeReads === 1 ? original : refreshed }
    },
    previewActive: async () => ({ ok: true, data: activeReads > 1 ? refreshed : original }),
    closeShift: async (_operation, request) => {
      closeRequests.push(structuredClone(request))
      if (closeRequests.length === 1) throw Object.assign(new Error('stale'), { code: 'stale_version' })
      return { status: 'pending', request, key: 'same-shift-retry' }
    },
  })
  await act(async () => { button(renderer, 'Hacer corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'denomination-500' }).props.onChange({ target: { value: '2' } }))
  act(() => button(renderer, 'Agregar ajuste').props.onClick())
  act(() => renderer.root.findByProps({ name: 'adjustment-type-0' }).props.onChange({ target: { value: 'expense' } }))
  act(() => renderer.root.findByProps({ name: 'adjustment-concept-0' }).props.onChange({ target: { value: 'Bolsas' } }))
  act(() => renderer.root.findByProps({ name: 'adjustment-amount-0' }).props.onChange({ target: { value: '25' } }))
  act(() => renderer.root.findByProps({ name: 'differenceNote' }).props.onChange({ target: { value: 'Mismo turno revisado' } }))
  act(() => renderer.root.findByProps({ name: 'nextOpeningFund' }).props.onChange({ target: { value: '300' } }))
  assertNoClosePhotoInput(renderer)
  await act(async () => { button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick(); await flush() })
  assert.equal(renderer.root.findByProps({ name: 'denomination-500' }).props.value, '2')
  assert.equal(renderer.root.findByProps({ name: 'adjustment-type-0' }).props.value, 'expense')
  assert.equal(renderer.root.findByProps({ name: 'adjustment-concept-0' }).props.value, 'Bolsas')
  assert.equal(renderer.root.findByProps({ name: 'adjustment-amount-0' }).props.value, '25')
  assert.equal(renderer.root.findByProps({ name: 'differenceNote' }).props.value, 'Mismo turno revisado')
  assert.equal(renderer.root.findByProps({ name: 'nextOpeningFund' }).props.value, '300')
  assert.match(renderedText(renderer), /totales actualizados.*revisa.*arqueo/i)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27')?.props.disabled, false)
  assert.equal(Object.hasOwn(closeRequests[0], 'evidenceToken'), false)
  act(() => renderer.unmount())
})

test('stale reclose consumes the refreshed detail and current version without photo', async () => {
  const closed = closedResultDetail()
  const reopened = structuredClone(closed)
  reopened.shift.state = 'reopened'
  reopened.version_id = false
  reopened.closing_type = false
  reopened.printable = false
  const refreshed = structuredClone(reopened)
  refreshed.shift.version = 2
  refreshed.version_number = 2
  refreshed.totals.expected_cash = 1300
  const detailReads = []
  const closeRequests = []
  const renderer = await mount({
    sessionIdentity: 'session-a|34|89|manage',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => ({ ok: true, data: validShift({ type: 'day' }) }),
    loadShiftDetail: async (request) => {
      detailReads.push(request)
      return { ok: true, data: detailReads.length === 1 ? closed : refreshed }
    },
    reopenShift: async () => ({ status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } } }),
    previewActive: async () => ({ ok: true, data: detailReads.length > 1 ? refreshed : reopened }),
    closeShift: async (_operation, request) => {
      closeRequests.push(structuredClone(request))
      if (closeRequests.length === 1) throw Object.assign(new Error('stale'), { code: 'stale_version' })
      return { status: 'pending', request, key: 'reclose-v2' }
    },
  })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Corrección' } }))
  await act(async () => { button(renderer, 'Reabrir corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'denomination-500' }).props.onChange({ target: { value: '2' } }))
  act(() => renderer.root.findByProps({ name: 'differenceNote' }).props.onChange({ target: { value: 'Revisado' } }))
  assertNoClosePhotoInput(renderer)
  await act(async () => { button(renderer, 'Volver a cerrar Noche 27').props.onClick(); await flush() })
  assert.deepEqual(detailReads, [{ shiftId: 41 }, { shiftId: 41 }])
  assert.equal(button(renderer, 'Volver a cerrar Noche 27').props.disabled, false)
  await act(async () => { button(renderer, 'Volver a cerrar Noche 27').props.onClick(); await flush() })
  assert.deepEqual(closeRequests.map((request) => request.expectedVersion), [1, 2])
  assert.equal(closeRequests.every((request) => !Object.hasOwn(request, 'evidenceToken')), true)
  act(() => renderer.unmount())
})

test('reclose verifies the current active shift and never trusts historical result.next_shift_id', async () => {
  let activeReads = 0
  const closeCalls = []
  const active = validShift({ type: 'day' })
  active.shift.id = 88
  const closed = validShift()
  closed.shift.state = 'closed'
  closed.shift.version = 1
  closed.version_number = 1
  closed.version_id = 901
  const reopened = structuredClone(closed)
  reopened.shift.state = 'reopened'
  reopened.version_id = false
  reopened.closing_type = false
  reopened.printable = false
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => { activeReads += 1; return { ok: true, data: active } },
    loadShiftDetail: async () => ({ ok: true, data: closed }),
    reopenShift: async () => ({ status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } }, key: 'reopen-done' }),
    previewActive: async () => ({ ok: true, data: reopened }),
    closeShift: async (operation, request) => {
      closeCalls.push([operation, structuredClone(request)])
      return {
        status: 'completed',
        data: { ok: true, data: { shift_id: 41, version_id: 902, version: 2, state: 'closed', next_shift_id: 77, detail: closedResultDetail({ version: 2 }) } },
        key: 'reclose-done',
      }
    },
  })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Corrección' } }))
  await act(async () => { button(renderer, 'Reabrir corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'denomination-1000' }).props.onChange({ target: { value: '1' } }))
  act(() => renderer.root.findByProps({ name: 'denomination-200' }).props.onChange({ target: { value: '1' } }))
  await act(async () => { button(renderer, 'Volver a cerrar Noche 27').props.onClick(); await flush() })
  assert.equal(closeCalls.length, 1)
  assert.equal(closeCalls[0][0], 'reclose')
  assert.equal(closeCalls[0][1].expectedVersion, 1)
  assert.equal(Object.hasOwn(closeCalls[0][1], 'nextOpeningFund'), false)
  assert.equal(activeReads, 2)
  assert.match(renderedText(renderer), /versión 2.*turno activo #88.*verificado/i)
  assert.doesNotMatch(renderedText(renderer), /#77.*no cambió|sucesor #77/i)
  assert.match(renderedText(renderer), /Turno activo · Día 27/)
  act(() => renderer.unmount())
})

test('confirmed reclose with lost or inconsistent active read stays read-only and never mutates twice', async () => {
  let activeReads = 0
  let closeCalls = 0
  const activeBefore = validShift({ type: 'day' })
  activeBefore.shift.id = 88
  const activeChanged = validShift({ type: 'night' })
  activeChanged.shift.id = 99
  const closed = closedResultDetail()
  const reopened = structuredClone(closed)
  reopened.shift.state = 'reopened'
  reopened.version_id = false
  reopened.closing_type = false
  reopened.printable = false
  const renderer = await mount({
    sessionIdentity: 'session-a|34|89|manage',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      if (activeReads === 2) throw new Error('active read lost')
      return { ok: true, data: activeReads === 1 ? activeBefore : activeChanged }
    },
    loadShiftDetail: async () => ({ ok: true, data: closed }),
    reopenShift: async () => ({ status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } } }),
    previewActive: async () => ({ ok: true, data: reopened }),
    closeShift: async () => {
      closeCalls += 1
      return {
        status: 'completed',
        data: { ok: true, data: { shift_id: 41, version_id: 902, version: 2, state: 'closed', next_shift_id: 77, detail: closedResultDetail({ version: 2 }) } },
      }
    },
  })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Corrección' } }))
  await act(async () => { button(renderer, 'Reabrir corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'denomination-1000' }).props.onChange({ target: { value: '1' } }))
  act(() => renderer.root.findByProps({ name: 'denomination-200' }).props.onChange({ target: { value: '1' } }))
  await act(async () => { button(renderer, 'Volver a cerrar Noche 27').props.onClick(); await flush() })
  assert.equal(closeCalls, 1)
  assert.match(renderedText(renderer), /recierre confirmado.*verificación del turno activo.*pendiente/i)
  assert.equal(button(renderer, 'Verificar turno activo')?.type, 'button')
  assert.equal(button(renderer, 'Volver a cerrar Noche 27'), undefined)
  assert.doesNotMatch(renderedText(renderer), /#77.*no cambió|turno activo #88.*verificado/i)

  await act(async () => { button(renderer, 'Verificar turno activo').props.onClick(); await flush() })
  assert.equal(activeReads, 3)
  assert.equal(closeCalls, 1, 'la recuperación solo relee; nunca repite el recierre confirmado')
  assert.match(renderedText(renderer), /recierre confirmado.*turno activo cambió.*#88.*#99/i)
  assert.equal(button(renderer, 'Verificar turno activo')?.type, 'button')
  assert.doesNotMatch(renderedText(renderer), /#77.*no cambió|turno activo #88.*verificado/i)
  act(() => renderer.unmount())
})

test('a completed reopen with a lost preview retries only loading reclose and never reopens again', async () => {
  let reopenCalls = 0
  let previewCalls = 0
  const closed = validShift()
  closed.shift.state = 'closed'
  closed.shift.version = 1
  closed.version_number = 1
  closed.version_id = 901
  const reopened = structuredClone(closed)
  reopened.shift.state = 'reopened'
  reopened.version_id = false
  reopened.closing_type = false
  reopened.printable = false
  const renderer = await mount({
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => ({ ok: true, data: validShift({ type: 'day' }) }),
    loadShiftDetail: async () => ({ ok: true, data: closed }),
    reopenShift: async () => {
      reopenCalls += 1
      return { status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } }, key: 'reopen-committed' }
    },
    previewActive: async () => {
      previewCalls += 1
      if (previewCalls === 1) throw Object.assign(new Error('lost'), { status: 0 })
      return { ok: true, data: reopened }
    },
  })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Corrección confirmada' } }))
  await act(async () => { button(renderer, 'Reabrir corte').props.onClick(); await flush() })
  assert.equal(reopenCalls, 1)
  assert.match(renderedText(renderer), /reapertura.*confirmada/i)
  await act(async () => { button(renderer, 'Cargar recierre reabierto').props.onClick(); await flush() })
  assert.equal(reopenCalls, 1)
  assert.equal(previewCalls, 3, 'carga el reopened y el formulario refresca su preview autoritativo')
  assert.match(renderedText(renderer), /Volver a cerrar Noche 27/)
  act(() => renderer.unmount())
})

test('an in-flight reopen from session A is ignored after session B replaces the same dashboard', async () => {
  const mutation = deferred()
  let reopenCalls = 0
  let previewCalls = 0
  const closed = closedResultDetail()
  const sharedProps = {
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => ({ ok: true, data: validShift({ type: 'day' }) }),
    loadShiftDetail: async () => ({ ok: true, data: closed }),
    reopenShift: async () => { reopenCalls += 1; return mutation.promise },
    previewActive: async () => { previewCalls += 1; return { ok: true, data: validShift() } },
  }
  const renderer = await mount({ ...sharedProps, sessionIdentity: 'session-a|34|89|manage' })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Corrección A' } }))
  await act(async () => {
    button(renderer, 'Reabrir corte').props.onClick()
    await flush()
  })

  await act(async () => {
    renderer.update(React.createElement((await loadRuntime()).default, {
      ...sharedProps,
      sessionIdentity: 'session-b|34|89|manage',
    }))
    await flush()
  })
  await act(async () => {
    mutation.resolve({ status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } } })
    await flush()
  })
  assert.equal(reopenCalls, 1)
  assert.equal(previewCalls, 0, 'la sesión nueva no consume la reapertura iniciada por la anterior')
  assert.doesNotMatch(renderedText(renderer), /Volver a cerrar/)
  assert.match(renderedText(renderer), /Turno activo/)
  act(() => renderer.unmount())
})

test('losing scope/access clears a loaded reclose and an unmounted pending reopen cannot publish it', async () => {
  const reopened = validShift()
  reopened.shift.state = 'reopened'
  reopened.shift.version = 1
  reopened.version_number = 1
  const closed = closedResultDetail()
  let mutation = Promise.resolve({ status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } } })
  let previewCalls = 0
  const props = {
    sessionIdentity: 'session-a|34|89|manage',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => ({ ok: true, data: validShift({ type: 'day' }) }),
    loadShiftDetail: async () => ({ ok: true, data: closed }),
    reopenShift: async () => mutation,
    previewActive: async () => { previewCalls += 1; return { ok: true, data: reopened } },
  }
  const renderer = await mount(props)
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Corrección' } }))
  await act(async () => { button(renderer, 'Reabrir corte').props.onClick(); await flush() })
  assert.match(renderedText(renderer), /Volver a cerrar/)

  await act(async () => {
    renderer.update(React.createElement((await loadRuntime()).default, { ...props, scopeReady: false }))
    await flush()
  })
  assert.doesNotMatch(renderedText(renderer), /Volver a cerrar/)
  assert.match(renderedText(renderer), /Falta alcance/)

  const pending = deferred()
  mutation = pending.promise
  await act(async () => {
    renderer.update(React.createElement((await loadRuntime()).default, props))
    await flush()
  })
  act(() => button(renderer, 'Reabrir un corte').props.onClick())
  act(() => renderer.root.findByProps({ name: 'reopenShiftId' }).props.onChange({ target: { value: '41' } }))
  await act(async () => { button(renderer, 'Consultar corte').props.onClick(); await flush() })
  act(() => renderer.root.findByProps({ name: 'reopenReason' }).props.onChange({ target: { value: 'Otra corrección' } }))
  await act(async () => {
    button(renderer, 'Reabrir corte').props.onClick()
    await flush()
  })
  act(() => renderer.unmount())
  await act(async () => {
    pending.resolve({ status: 'completed', data: { ok: true, data: { shift_id: 41, state: 'reopened', version: 1 } } })
    await flush()
  })
  assert.equal(previewCalls, 2, 'desmontar no inicia una carga adicional del recierre')
})

function pendingCountPreview() {
  return {
    form_kind: 'pending_count',
    expected_version: 0,
    shift: { id: 41, type: 'night', business_date: '2026-07-27', state: 'pending_count' },
    opening_fund: 0,
    totals: {
      sales_cash: 212,
      sales_card: 0,
      sales_total: 212,
      expenses: 0,
      expected_cash: 212,
    },
    denominations: [],
    adjustments: [],
    notes_required: false,
    boundary: {
      operational_closed_at: '2026-07-27 06:00:00',
      scheduled_boundary_at: '2026-07-27 06:00:00',
      executed_at: '2026-07-27 06:03:00',
      late_execution: true,
      separation_confirmed: false,
      separation_exception_note: '',
      next_shift_id: 42,
    },
  }
}

test('a boundary guard refreshes the manager view and opens its authoritative pending count instead of retrying the normal close', async () => {
  let activeReads = 0
  let pendingReads = 0
  const closeCalls = []
  const pendingPreviewRequests = []
  const successor = validShift({ type: 'day' })
  successor.shift.id = 42
  const pendingRow = {
    shift_id: 41,
    shift_type: 'night',
    business_date: '2026-07-27',
    state: 'pending_count',
    expected_version: 0,
    expected_cash: 212,
    operational_closed_at: '2026-07-27 06:00:00',
    scheduled_boundary_at: '2026-07-27 06:00:00',
    boundary_executed_at: '2026-07-27 06:03:00',
    late_execution: false,
    next_shift_id: 42,
  }
  const renderer = await mount({
    sessionIdentity: 'pending-count-guard-session',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return { ok: true, data: activeReads === 1 ? validShift() : successor }
    },
    loadPendingCounts: async () => {
      pendingReads += 1
      return { ok: true, data: { shifts: pendingReads === 1 ? [] : [pendingRow] } }
    },
    previewActive: async () => ({ ok: true, data: validShift() }),
    previewPending: async (request) => {
      pendingPreviewRequests.push(request)
      return { ok: true, data: pendingCountPreview() }
    },
    closeShift: async (operation, request) => {
      closeCalls.push({ operation, request })
      throw Object.assign(new Error('boundary reached'), {
        code: 'pending_count_required',
        details: { shift_id: 41 },
      })
    },
  })

  await act(async () => { button(renderer, 'Hacer corte').props.onClick(); await flush() })
  changeOpenField(renderer, 'denomination-1000', '1')
  changeOpenField(renderer, 'denomination-200', '1')
  changeOpenField(renderer, 'nextOpeningFund', '0')
  await act(async () => {
    button(renderer, 'Cerrar Noche 27 y abrir Día 27').props.onClick()
    await flush()
  })

  assert.equal(closeCalls.length, 1)
  assert.equal(activeReads, 2, 'el guard refresca el turno sucesor')
  assert.equal(pendingReads, 2, 'el guard refresca la lista pendiente con el mismo corte')
  assert.equal(pendingPreviewRequests.length >= 1, true)
  assert.equal(pendingPreviewRequests.every((request) => (
    request.mode === 'pending' && request.shiftId === 41
  )), true)
  assert.match(renderedText(renderer), /Arqueo posterior a cierre automático/)
  assert.match(renderedText(renderer), /Efectivo esperado.*\$212\.00/)
  assert.equal(button(renderer, 'Reintentar mismo corte'), undefined)
  assert.equal(button(renderer, 'Cerrar Noche 27 y abrir Día 27'), undefined)
  act(() => renderer.unmount())
})

test('manager sees only the server pending list and opens the authoritative deferred count', async () => {
  const calls = []
  const renderer = await mount({
    sessionIdentity: 'pending-count-session',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      calls.push('active')
      return { ok: true, data: validShift({ type: 'day' }) }
    },
    loadPendingCounts: async () => {
      calls.push('pending-list')
      return {
        ok: true,
        data: {
          shifts: [{
            shift_id: 41,
            shift_type: 'night',
            business_date: '2026-07-27',
            state: 'pending_count',
            expected_version: 0,
            expected_cash: 212,
            operational_closed_at: '2026-07-27 06:00:00',
            scheduled_boundary_at: '2026-07-27 06:00:00',
            boundary_executed_at: '2026-07-27 06:03:00',
            late_execution: true,
            next_shift_id: 42,
          }],
        },
      }
    },
    previewPending: async (request) => {
      calls.push(['pending-preview', request])
      return { ok: true, data: pendingCountPreview() }
    },
  })

  assert.deepEqual(calls.sort((left, right) => String(left).localeCompare(String(right))), ['active', 'pending-list'])
  const listing = renderedText(renderer)
  assert.match(listing, /Arqueos pendientes/)
  assert.match(listing, /Noche 27/)
  assert.match(listing, /06:00:00/)
  assert.match(listing, /Importe esperado.*\$212\.00/)
  assert.match(listing, /ejecutó tarde/i)
  assert.match(listing, /Separe y etiquete el efectivo/i)
  assert.doesNotMatch(listing, /hora esperada funciona como referencia/i)

  await act(async () => {
    button(renderer, 'Capturar arqueo Noche 27').props.onClick()
    await flush()
  })
  assert.deepEqual(calls.at(-1), ['pending-preview', { mode: 'pending', shiftId: 41 }])
  const form = renderedText(renderer)
  assert.match(form, /Arqueo posterior a cierre automático/)
  assert.match(form, /Efectivo esperado.*\$212\.00/)
  assert.match(form, /Confirmo que el efectivo fue separado y etiquetado/i)
  assert.equal(renderer.root.findAllByProps({ name: 'nextOpeningFund' }).length, 0)
  assert.equal(renderer.root.findAllByProps({ name: 'evidence' }).length, 0)
  act(() => renderer.unmount())
})

test('deferred count disables a lost response and retries the exact settlement request', async () => {
  const calls = []
  const cashShift = normalizePendingCashShiftPreview(pendingCountPreview())
  const renderer = await mountClose({
    cashShift,
    onPreview: async () => ({ ok: true, data: pendingCountPreview() }),
    onClose: async (operation, request) => {
      calls.push({ operation, request })
      return { status: 'pending', request }
    },
  })
  act(() => renderer.root.findAllByProps({ name: 'cashSeparationConfirmed' }).find((input) => input.props.checked === false).props.onChange())
  changeOpenField(renderer, 'differenceNote', 'Conteo tardío documentado')
  changeOpenField(renderer, 'denomination-200', '1')
  await act(async () => {
    button(renderer, 'Guardar arqueo pendiente Noche 27').props.onClick()
    await flush()
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'settle')
  assert.equal(Object.hasOwn(calls[0].request, 'nextOpeningFund'), false)
  assert.equal(calls[0].request.separationConfirmed, true)
  await act(async () => {
    button(renderer, 'Reintentar mismo corte').props.onClick()
    await flush()
  })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[1], calls[0])
  act(() => renderer.unmount())
})

test('manual and scheduled active refresh also reload the pending selector coherently', async () => {
  let activeReads = 0
  let pendingReads = 0
  let scheduledRefresh
  const renderer = await mount({
    sessionIdentity: 'coherent-refresh',
    accessMode: 'manage',
    scopeReady: true,
    loadActive: async () => {
      activeReads += 1
      return { ok: true, data: validShift({ type: 'day' }) }
    },
    loadPendingCounts: async () => {
      pendingReads += 1
      return { ok: true, data: { shifts: [] } }
    },
    scheduleRefresh: (callback) => {
      scheduledRefresh = callback
      return 1
    },
    cancelRefresh() {},
  })
  assert.equal(activeReads, 1)
  assert.equal(pendingReads, 1)
  await act(async () => { button(renderer, 'Actualizar turno').props.onClick(); await flush() })
  assert.equal(activeReads, 2)
  assert.equal(pendingReads, 2)
  await act(async () => { scheduledRefresh(); await flush() })
  assert.equal(activeReads, 3)
  assert.equal(pendingReads, 3)
  act(() => renderer.unmount())
})
