import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window

let vite
let runtimePromise
const adminContextSource = readFileSync(new URL('../src/modules/admin/AdminContext.jsx', import.meta.url), 'utf8')

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
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload) },
  }
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
      })
      const [apiModule, serviceModule, adminServiceModule] = await Promise.all([
        vite.ssrLoadModule('/src/modules/admin/api.js'),
        vite.ssrLoadModule('/src/modules/admin/cashShiftService.js'),
        vite.ssrLoadModule('/src/modules/admin/adminService.js'),
      ])
      return { apiModule, serviceModule, adminServiceModule }
    })()
  }
  return runtimePromise
}

function installSuccessApi() {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, method: options.method, headers: options.headers, payload })
    return createJsonResponse(200, { result: { ok: true, data: { accepted: true } } })
  }
  return calls
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'session-token',
    gf_employee_token: 'employee-token',
    api_key: 'api-key',
    employee_id: 717,
    company_id: 34,
    warehouse_id: 89,
  }))
  globalThis.window = { dispatchEvent() {}, addEventListener() {} }
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
})

after(async () => {
  if (vite) await vite.close()
})

test('wrappers GET usan paths y query exactos sin alcance cliente', async () => {
  const { apiModule } = await loadRuntime()
  const calls = installSuccessApi()

  await apiModule.getActiveCashShift()
  await apiModule.previewCashShift({
    mode: 'initial', shiftType: 'night', businessDate: '2026-07-27', startAt: '2026-07-26 18:00:00',
    companyId: 34,
  })
  await apiModule.getCashShiftHistory({ businessDate: '2026-07-27', warehouseId: 89 })
  await apiModule.getCashShiftDetail({ shiftId: 41, versionId: 7, analyticAccountId: 999 })
  await apiModule.getCashShiftOperationStatus({ operation: 'reclose', idempotencyKey: 'same-key' })

  assert.deepEqual(calls.map(({ url, method }) => [method, url]), [
    ['GET', '/odoo-api/pwa-admin/cash-shifts/active'],
    ['GET', '/odoo-api/pwa-admin/cash-shifts/preview?mode=initial&shift_type=night&business_date=2026-07-27&start_at=2026-07-26+18%3A00%3A00'],
    ['GET', '/odoo-api/pwa-admin/cash-shifts/history?business_date=2026-07-27'],
    ['GET', '/odoo-api/pwa-admin/cash-shifts/detail?shift_id=41&version_id=7'],
    ['GET', '/odoo-api/pwa-admin/cash-shifts/operations/status?operation=reclose&key=same-key'],
  ])
})

test('wrappers v2 aíslan los arqueos pendientes y no modifican los reads v1', async () => {
  const { apiModule } = await loadRuntime()
  const calls = installSuccessApi()

  await apiModule.getPendingCashShiftCounts()
  await apiModule.previewCashShift({ mode: 'pending', shiftId: 41 })

  assert.deepEqual(calls.map(({ url, method }) => [method, url]), [
    ['GET', '/odoo-api/pwa-admin/cash-shifts/pending-counts?contract_version=v2'],
    ['GET', '/odoo-api/pwa-admin/cash-shifts/preview?mode=pending&shift_id=41&contract_version=v2'],
  ])
})

test('wrappers de mutación envían allowlists exactas y jamás scope ni totales', async () => {
  const { apiModule } = await loadRuntime()
  const calls = installSuccessApi()
  const forbidden = {
    company_id: 34,
    warehouse_id: 89,
    analytic_account_id: 12,
    movement_ids: [1],
    attachment_id: 99,
    sales_total: 5000,
    expected_cash: 2000,
    physical_cash: 1900,
  }

  await apiModule.openCashShift({
    shiftType: 'night', businessDate: '2026-07-27', startAt: '2026-07-26 18:00:00',
    openingFund: 500, idempotencyKey: 'open-key', ...forbidden,
  })
  const closeInput = {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '500', count: 2, subtotal: 1000 }],
    adjustments: [{ type: 'expense', concept: 'Bolsas', amount: 20, total: 20 }],
    notes: 'Arqueo revisado',
    nextOpeningFund: 300,
    idempotencyKey: 'close-key',
    ...forbidden,
  }
  await apiModule.closeCashShift(closeInput)
  await apiModule.recloseCashShift({
    ...closeInput,
    expectedVersion: 1,
    nextOpeningFund: 999,
    idempotencyKey: 'reclose-key',
  })
  await apiModule.reopenCashShift({
    shiftId: 41, expectedVersion: 1, reason: 'Cancelar venta duplicada',
    idempotencyKey: 'reopen-key', ...forbidden,
  })
  await apiModule.authorizeCashShift({
    shiftId: 41, versionId: 7, expectedVersion: 999, level: 'manager',
    idempotencyKey: 'authorize-key', ...forbidden,
  })

  const bodies = calls.map((call) => call.payload.params)
  assert.deepEqual(bodies, [
    {
      shift_type: 'night', business_date: '2026-07-27', start_at: '2026-07-26 18:00:00',
      opening_fund: 500, idempotency_key: 'open-key',
    },
    {
      shift_id: 41, expected_version: 0,
      denominations: [{ denomination: '500', count: 2 }],
      adjustments: [{ type: 'expense', concept: 'Bolsas', amount: 20 }],
      notes: 'Arqueo revisado', next_opening_fund: 300,
      idempotency_key: 'close-key',
    },
    {
      shift_id: 41, expected_version: 1,
      denominations: [{ denomination: '500', count: 2 }],
      adjustments: [{ type: 'expense', concept: 'Bolsas', amount: 20 }],
      notes: 'Arqueo revisado',
      idempotency_key: 'reclose-key',
    },
    {
      shift_id: 41, expected_version: 1, reason: 'Cancelar venta duplicada',
      idempotency_key: 'reopen-key',
    },
    {
      shift_id: 41, version_id: 7, level: 'manager', idempotency_key: 'authorize-key',
    },
  ])
  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/cash-shifts/open',
    '/odoo-api/pwa-admin/cash-shifts/close',
    '/odoo-api/pwa-admin/cash-shifts/close',
    '/odoo-api/pwa-admin/cash-shifts/reopen',
    '/odoo-api/pwa-admin/cash-shifts/authorize',
  ])
})

test('close y reclose validan localmente la versión semántica exacta', async () => {
  const { apiModule } = await loadRuntime()
  const calls = installSuccessApi()
  const closeDraft = {
    shiftId: 41,
    denominations: [],
    adjustments: [],
    notes: '',
    nextOpeningFund: 300,
    idempotencyKey: 'semantic-version',
  }
  await assert.rejects(async () => apiModule.closeCashShift({
    ...closeDraft,
    expectedVersion: 1,
  }), TypeError)
  await assert.rejects(async () => apiModule.recloseCashShift({
    ...closeDraft,
    expectedVersion: 0,
  }), TypeError)
  assert.equal(calls.length, 0)
})

test('settle envía únicamente el arqueo pendiente v2 permitido, sin scope ni fondo sucesor', async () => {
  const { apiModule } = await loadRuntime()
  const calls = installSuccessApi()
  await apiModule.settleCashShift({
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '200', count: 1, subtotal: 200 }],
    adjustments: [{ type: 'expense', concept: 'Bolsas', amount: 20, total: 20 }],
    notes: 'Conteo tardío',
    separationConfirmed: false,
    separationExceptionNote: 'El efectivo se entregó después',
    nextOpeningFund: 999,
    companyId: 34,
    warehouseId: 89,
    expectedCash: 212,
    idempotencyKey: 'settle-key',
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/cash-shifts/settle')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].payload.params, {
    shift_id: 41,
    expected_version: 0,
    denominations: [{ denomination: '200', count: 1 }],
    adjustments: [{ type: 'expense', concept: 'Bolsas', amount: 20 }],
    notes: 'Conteo tardío',
    separation_confirmed: false,
    separation_exception_note: 'El efectivo se entregó después',
    idempotency_key: 'settle-key',
  })
  await assert.rejects(async () => apiModule.settleCashShift({
    shiftId: 41,
    expectedVersion: 1,
    denominations: [], adjustments: [], separationConfirmed: true, idempotencyKey: 'wrong-version',
  }), TypeError)
})

test('capacidades de cash shift fallan cerradas incluso tras respuestas parciales', async () => {
  const { adminServiceModule } = await loadRuntime()
  const keys = [
    'cashShiftRead', 'cashShiftManage', 'cashShiftAuthorize',
    'cashShiftPendingDetail', 'cashShiftReopen', 'cashShiftPrint',
  ]
  for (const key of keys) adminServiceModule.BACKEND_CAPS[key] = true

  adminServiceModule.applyCapabilities({ expenseAnalytics: true })

  for (const key of keys) assert.equal(adminServiceModule.BACKEND_CAPS[key], false, key)
  adminServiceModule.applyCapabilities({ cashShiftManage: true, cashShiftPendingDetail: true })
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftManage, true)
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftPendingDetail, true)
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftRead, false)

  adminServiceModule.applyCapabilities({
    cashShiftRead: 'true',
    cashShiftManage: 1,
    cashShiftAuthorize: {},
    cashShiftPendingDetail: [],
  })
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftRead, false)
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftManage, false)
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftAuthorize, false)
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftPendingDetail, false)
})

test('bootCapabilities consulta el controller Odoo autenticado y aplica cashShift server-authoritative', async () => {
  const { adminServiceModule } = await loadRuntime()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, headers: options.headers })
    return createJsonResponse(200, {
      ok: true,
      data: {
        cashShiftRead: true,
        cashShiftManage: true,
        cashShiftAuthorize: false,
        cashShiftPendingDetail: false,
        cashShiftReopen: true,
        cashShiftPrint: true,
      },
    })
  }

  const pending = adminServiceModule.bootCapabilities()
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftManage, false)
  const caps = await pending

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/capabilities')
  assert.equal(calls[0].headers['Api-Key'], 'api-key')
  assert.equal(calls[0].headers['X-GF-Employee-Token'], 'employee-token')
  assert.equal(caps.cashShiftRead, true)
  assert.equal(caps.cashShiftManage, true)
  assert.equal(caps.cashShiftAuthorize, false)
})

test('bootCapabilities con token ausente o stale falla cerrado y nunca conserva permisos locales', async () => {
  const { adminServiceModule } = await loadRuntime()
  for (const tokenCase of ['missing', 'stale']) {
    globalThis.localStorage.setItem('gf_session', JSON.stringify({
      session_token: 'session-token',
      api_key: 'api-key',
      ...(tokenCase === 'stale' ? { gf_employee_token: 'stale-token' } : {}),
    }))
    for (const key of [
      'cashShiftRead', 'cashShiftManage', 'cashShiftAuthorize',
      'cashShiftPendingDetail', 'cashShiftReopen', 'cashShiftPrint',
    ]) adminServiceModule.BACKEND_CAPS[key] = true
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, headers: options.headers })
      return createJsonResponse(200, {
        ok: false,
        data: { code: 'employee_token_required' },
      })
    }

    const caps = await adminServiceModule.bootCapabilities()
    assert.equal(calls.length, tokenCase === 'missing' ? 0 : 1, tokenCase)
    if (tokenCase === 'stale') assert.equal(calls[0].url, '/odoo-api/pwa-admin/capabilities')
    if (tokenCase === 'missing') {
      assert.equal(calls[0], undefined)
    }
    for (const key of [
      'cashShiftRead', 'cashShiftManage', 'cashShiftAuthorize',
      'cashShiftPendingDetail', 'cashShiftReopen', 'cashShiftPrint',
    ]) assert.equal(caps[key], false, `${tokenCase}:${key}`)
  }
})

test('capabilities ignora la respuesta tardía de la sesión anterior', async () => {
  const { adminServiceModule } = await loadRuntime()
  const slowA = deferred()
  const fastB = deferred()
  const seenTokens = []
  globalThis.fetch = async (_url, options = {}) => {
    const token = options.headers['X-GF-Employee-Token']
    seenTokens.push(token)
    if (token === 'token-a') return slowA.promise
    if (token === 'token-b') return fastB.promise
    throw new Error(`Token inesperado: ${token}`)
  }
  const sessionA = {
    session_token: 'session-a',
    gf_employee_token: 'token-a',
    api_key: 'api-key',
    employee_id: 717,
    company_id: 34,
    warehouse_id: 89,
    odoo_employee_session_id: 'identity-a',
  }
  const sessionB = {
    ...sessionA,
    session_token: 'session-b',
    gf_employee_token: 'token-b',
    employee_id: 801,
    odoo_employee_session_id: 'identity-b',
  }
  globalThis.localStorage.setItem('gf_session', JSON.stringify(sessionA))
  const requestA = adminServiceModule.bootCapabilities(sessionA)
  while (!seenTokens.includes('token-a')) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  globalThis.localStorage.setItem('gf_session', JSON.stringify(sessionB))
  const requestB = adminServiceModule.bootCapabilities(sessionB)
  while (!seenTokens.includes('token-b')) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  fastB.resolve(createJsonResponse(200, { ok: true, data: { cashShiftManage: false } }))
  await requestB
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftManage, false)
  slowA.resolve(createJsonResponse(200, { ok: true, data: { cashShiftManage: true } }))
  await requestA
  assert.equal(adminServiceModule.BACKEND_CAPS.cashShiftManage, false)
})

test('AdminProvider reinicia readiness y estado cash al cambiar identidad de sesión', () => {
  assert.match(adminContextSource, /buildSessionIdentity\(session\)\.sessionKey/)
  assert.match(adminContextSource, /setCapsReady\(false\)/)
  assert.match(adminContextSource, /bootCapabilities\(session\)/)
  assert.match(adminContextSource, /invalidateCashShiftCapabilities\(\)/)
  assert.match(adminContextSource, /\[[^\]]*sessionIdentity[^\]]*employeeToken[^\]]*\]/)
})

function uncertain(message = 'network lost') {
  return Object.assign(new Error(message), { status: 0, code: 'network' })
}

test('errores de validación locales no son respuestas inciertas ni disparan replay/status', async () => {
  const { serviceModule } = await loadRuntime()
  assert.equal(serviceModule.isUncertainCashShiftError(new TypeError('dato inválido')), false)
  let mutationCalls = 0
  let statusCalls = 0
  await assert.rejects(serviceModule.mutateShiftWithRecovery('close', {
    shiftId: 41,
    expectedVersion: 0,
    idempotencyKey: 'local-validation',
  }, {
    mutate: async () => {
      mutationCalls += 1
      throw new TypeError('dato inválido')
    },
    getOperationStatus: async () => { statusCalls += 1 },
    requestRegistry: new Map(),
  }), /dato inválido/)
  assert.equal(mutationCalls, 1)
  assert.equal(statusCalls, 0)
})

test('errores lógicos del envelope se rechazan y no se reportan como completed', async () => {
  const { serviceModule } = await loadRuntime()
  await assert.rejects(serviceModule.mutateShiftWithRecovery('authorize', {
    shiftId: 41,
    versionId: 7,
    level: 'manager',
    idempotencyKey: 'logical-error',
  }, {
    mutate: async () => ({
      ok: false,
      message: 'Versión obsoleta',
      data: { code: 'stale_version' },
    }),
    getOperationStatus: async () => { throw new Error('no debe consultarse') },
    requestRegistry: new Map(),
  }), (error) => error?.code === 'stale_version')
})

test('wrappers y recovery rechazan accessors sin ejecutarlos', async () => {
  const { apiModule, serviceModule } = await loadRuntime()
  let reads = 0
  const input = {
    shiftId: 41,
    expectedVersion: 1,
    reason: 'Corrección',
    get idempotencyKey() { reads += 1; return 'accessor-key' },
  }
  assert.throws(() => apiModule.reopenCashShift(input), TypeError)
  await assert.rejects(serviceModule.mutateShiftWithRecovery('reopen', input, {
    mutate: async () => ({ ok: true }),
    requestRegistry: new Map(),
  }), TypeError)
  assert.equal(reads, 0)
})

test('cada mutación recupera una respuesta perdida repitiendo el mismo body/key', async () => {
  const { serviceModule } = await loadRuntime()
  for (const operation of ['open', 'close', 'reclose', 'reopen', 'authorize']) {
    const requests = []
    const result = await serviceModule.mutateShiftWithRecovery(operation, {
      shiftId: 41,
      expectedVersion: operation === 'close' ? 0 : 1,
      versionId: 7,
      notes: undefined,
      idempotencyKey: `${operation}-stable`,
    }, {
      mutate: async (_operation, request) => {
        requests.push(structuredClone(request))
        if (requests.length === 1) throw uncertain()
        return { ok: true, operation }
      },
      getOperationStatus: async () => { throw new Error('status no debe consultarse') },
      createKey: () => { throw new Error('la key existente debe conservarse') },
      requestRegistry: new Map(),
    })
    assert.equal(result.status, 'completed')
    assert.equal(result.key, `${operation}-stable`)
    assert.deepEqual(requests[0], requests[1])
    assert.equal(Object.hasOwn(requests[0], 'notes'), false)
  }
})

test('cada mutación con dos respuestas perdidas recupera la respuesta guardada por status', async () => {
  const { serviceModule } = await loadRuntime()
  for (const operation of ['open', 'close', 'reclose', 'reopen', 'authorize']) {
    const requests = []
    const statuses = []
    const key = `${operation}-double-lost`
    const result = await serviceModule.mutateShiftWithRecovery(operation, {
      shiftId: 41,
      expectedVersion: operation === 'close' ? 0 : 2,
      versionId: 701,
      idempotencyKey: key,
    }, {
      mutate: async (_operation, request) => {
        requests.push(structuredClone(request))
        throw uncertain()
      },
      getOperationStatus: async (query) => {
        statuses.push(query)
        return {
          ok: true,
          data: {
            operation, key, state: 'completed',
            response: { ok: true, data: { shift_id: 41, version: 3 } },
          },
        }
      },
      createKey: () => 'unused',
      requestRegistry: new Map(),
    })

    assert.equal(requests.length, 2)
    assert.deepEqual(requests[0], requests[1])
    assert.deepEqual(statuses, [{ operation, idempotencyKey: key }])
    assert.deepEqual(result, {
      status: 'completed',
      data: { ok: true, data: { shift_id: 41, version: 3 } },
      key,
    })
  }
})

test('settle conserva la misma key y el registro al recuperar un timeout', async () => {
  const { serviceModule } = await loadRuntime()
  const registry = new Map()
  const draft = {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '200', count: 1 }],
    adjustments: [],
    notes: 'Conteo pendiente',
    separationConfirmed: true,
    idempotencyKey: 'settle-after-timeout',
  }
  const pending = await serviceModule.mutateShiftWithRecovery('settle', draft, {
    mutate: async () => { throw uncertain() },
    getOperationStatus: async () => { throw uncertain('status lost') },
    requestRegistry: registry,
    sessionIdentity: 'settle-session',
  })
  assert.equal(pending.status, 'pending')
  const attempts = []
  const recovered = await serviceModule.mutateShiftWithRecovery('settle', draft, {
    mutate: async (_operation, request) => {
      attempts.push(request)
      return { ok: true, data: { state: 'closed', shift_id: 41 } }
    },
    requestRegistry: registry,
    sessionIdentity: 'settle-session',
  })
  assert.equal(recovered.status, 'completed')
  assert.deepEqual(attempts, [draft])
  assert.ok([...registry.keys()].some((key) => key.endsWith(':settle:settle-after-timeout')))
})

test('si también se pierde status preserva pending con key, request y draft estables', async () => {
  const { serviceModule } = await loadRuntime()
  const draft = {
    shiftId: 41,
    expectedVersion: 0,
    denominations: [{ denomination: '500', count: 1 }],
    idempotencyKey: 'status-lost',
  }
  const result = await serviceModule.mutateShiftWithRecovery('close', draft, {
    mutate: async () => { throw uncertain() },
    getOperationStatus: async () => { throw uncertain('status lost') },
    requestRegistry: new Map(),
  })
  assert.equal(result.status, 'pending')
  assert.equal(result.key, 'status-lost')
  assert.deepEqual(result.request, draft)
  assert.deepEqual(result.draft, draft)
  assert.equal(result.retryable, true)
})

test('status incierto conserva la key generada y el draft en las cinco operaciones', async () => {
  const { serviceModule } = await loadRuntime()
  for (const operation of ['open', 'close', 'reclose', 'reopen', 'authorize']) {
    const key = `${operation}-generated`
    const input = {
      shiftId: 41,
      expectedVersion: operation === 'close' ? 0 : 2,
      versionId: 701,
    }
    const expected = { ...input, idempotencyKey: key }
    const result = await serviceModule.mutateShiftWithRecovery(operation, input, {
      mutate: async () => { throw uncertain() },
      getOperationStatus: async () => { throw uncertain('status lost') },
      createKey: () => key,
      requestRegistry: new Map(),
    })
    assert.equal(result.status, 'pending', operation)
    assert.equal(result.key, key, operation)
    assert.deepEqual(result.request, expected, operation)
    assert.deepEqual(result.draft, expected, operation)
    assert.equal(result.retryable, true, operation)
  }
})

test('status determinista solo acepta completed propio, processing u operation_not_found', async () => {
  const { serviceModule } = await loadRuntime()
  const base = {
    shiftId: 41,
    expectedVersion: 0,
    idempotencyKey: 'status-contract',
  }
  const run = (statusResponse) => serviceModule.mutateShiftWithRecovery('close', base, {
    mutate: async () => { throw uncertain() },
    getOperationStatus: async () => statusResponse,
    requestRegistry: new Map(),
  })

  for (const pendingResponse of [
    { ok: false, data: { code: 'operation_not_found' } },
    { ok: true, data: { operation: 'close', key: 'status-contract', state: 'processing' } },
  ]) {
    const result = await run(pendingResponse)
    assert.equal(result.status, 'pending')
    assert.equal(result.key, 'status-contract')
  }

  await assert.rejects(run({
    ok: true,
    data: {
      operation: 'reclose', key: 'status-contract', state: 'completed',
      response: { ok: true },
    },
  }), (error) => error?.code === 'cash_shift_status_mismatch')
  await assert.rejects(run({
    ok: false,
    data: { code: 'forbidden' },
  }), (error) => error?.code === 'forbidden')
  await assert.rejects(run({ ok: true, data: { state: 'wat' } }), (error) => (
    error?.code === 'cash_shift_status_invalid'
  ))
})

test('status incompleto preserva borrador/key y nunca infiere recierre por turno activo', async () => {
  const { serviceModule } = await loadRuntime()
  let activeReads = 0
  const draft = {
    shiftId: 41,
    expectedVersion: 2,
    denominations: [{ denomination: '500', count: 1 }],
    idempotencyKey: 'pending-reclose',
  }
  const result = await serviceModule.mutateShiftWithRecovery('reclose', draft, {
    mutate: async () => { throw uncertain() },
    getOperationStatus: async () => ({
      ok: false, data: { code: 'operation_not_found' },
    }),
    getActiveShift: async () => { activeReads += 1; return { shift: { id: 42 } } },
    createKey: () => 'unused',
    requestRegistry: new Map(),
  })

  assert.equal(result.status, 'pending')
  assert.equal(result.key, 'pending-reclose')
  assert.deepEqual(result.request, draft)
  assert.equal(activeReads, 0)
})

test('una key reservada solo puede reintentarse con el mismo body', async () => {
  const { serviceModule } = await loadRuntime()
  const registry = new Map()
  const deps = {
    mutate: async () => { throw uncertain() },
    getOperationStatus: async () => ({ ok: false, data: { code: 'operation_not_found' } }),
    createKey: () => 'unused',
    requestRegistry: registry,
  }
  await serviceModule.mutateShiftWithRecovery('close', {
    shiftId: 41, expectedVersion: 0, notes: 'Primera', idempotencyKey: 'no-reuse',
  }, deps)
  await assert.rejects(
    serviceModule.mutateShiftWithRecovery('close', {
      shiftId: 41, expectedVersion: 0, notes: 'Cambiada', idempotencyKey: 'no-reuse',
    }, deps),
    /idempotencia|mismo contenido/i,
  )
})

test('stableValue rechaza arrays con getters, huecos, propiedades extra o ciclos sin ejecutar accessors', async () => {
  const { serviceModule } = await loadRuntime()
  let reads = 0
  const getterArray = []
  Object.defineProperty(getterArray, '0', {
    enumerable: true,
    configurable: true,
    get() { reads += 1; return { denomination: '500', count: 1 } },
  })
  const holeArray = Array(1)
  const expandoArray = []
  expandoArray.extra = true
  const cyclicArray = []
  cyclicArray.push(cyclicArray)
  let mutations = 0
  for (const [index, denominations] of [
    getterArray, holeArray, expandoArray, cyclicArray,
  ].entries()) {
    await assert.rejects(async () => serviceModule.mutateShiftWithRecovery('close', {
      shiftId: 41,
      expectedVersion: 0,
      denominations,
      idempotencyKey: `hostile-array-${index}`,
    }, {
      mutate: async () => { mutations += 1; return { ok: true } },
      requestRegistry: new Map(),
    }), TypeError)
  }
  assert.equal(reads, 0)
  assert.equal(mutations, 0)
})

test('registry default se limpia y aísla la misma key manual al cambiar sesión', async () => {
  const { serviceModule } = await loadRuntime()
  const baseSession = {
    session_token: 'registry-session',
    gf_employee_token: 'registry-token',
    employee_id: 717,
    company_id: 34,
    warehouse_id: 89,
  }
  const run = (notes) => serviceModule.mutateShiftWithRecovery('close', {
    shiftId: 41,
    expectedVersion: 0,
    notes,
    idempotencyKey: 'same-manual-key-across-sessions',
  }, {
    mutate: async () => ({ ok: true }),
  })
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    ...baseSession,
    odoo_employee_session_id: 'registry-a',
  }))
  await run('Sesión A')
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    ...baseSession,
    gf_employee_token: 'registry-token-b',
    odoo_employee_session_id: 'registry-b',
  }))
  await run('Sesión B')
})

test('registry acotado conserva pending y elimina operaciones terminadas antiguas', async () => {
  const { serviceModule } = await loadRuntime()
  const registry = new Map()
  const registryLimit = 3
  const pending = await serviceModule.mutateShiftWithRecovery('close', {
    shiftId: 41,
    expectedVersion: 0,
    idempotencyKey: 'pending-key',
  }, {
    mutate: async () => { throw uncertain() },
    getOperationStatus: async () => ({ ok: false, data: { code: 'operation_not_found' } }),
    requestRegistry: registry,
    registryLimit,
    sessionIdentity: 'bounded-session',
  })
  assert.equal(pending.status, 'pending')
  for (let index = 0; index < 8; index += 1) {
    await serviceModule.mutateShiftWithRecovery('close', {
      shiftId: 41,
      expectedVersion: 0,
      idempotencyKey: `completed-${index}`,
    }, {
      mutate: async () => ({ ok: true }),
      requestRegistry: registry,
      registryLimit,
      sessionIdentity: 'bounded-session',
    })
  }
  assert.ok(registry.size <= registryLimit)
  assert.ok([...registry.keys()].some((key) => key.endsWith(':close:pending-key')))
})

test('registry rechaza una key nueva si el límite está ocupado solo por pending', async () => {
  const { serviceModule } = await loadRuntime()
  const registry = new Map()
  const registryLimit = 2
  let mutationCalls = 0
  let statusCalls = 0
  const pendingDependencies = {
    mutate: async () => { mutationCalls += 1; throw uncertain() },
    getOperationStatus: async () => {
      statusCalls += 1
      return { ok: false, data: { code: 'operation_not_found' } }
    },
    requestRegistry: registry,
    registryLimit,
    sessionIdentity: 'hard-bound-session',
  }
  const input = (key) => ({
    shiftId: 41,
    expectedVersion: 0,
    idempotencyKey: key,
  })
  await serviceModule.mutateShiftWithRecovery('close', input('pending-1'), pendingDependencies)
  await serviceModule.mutateShiftWithRecovery('close', input('pending-2'), pendingDependencies)
  const callsBeforeReject = { mutationCalls, statusCalls }

  await assert.rejects(
    serviceModule.mutateShiftWithRecovery('close', input('pending-3'), pendingDependencies),
    (error) => error?.code === 'cash_shift_pending_limit' && /pendientes/i.test(error.message),
  )
  assert.deepEqual({ mutationCalls, statusCalls }, callsBeforeReject)
  assert.equal(registry.size, 2)
  assert.ok([...registry.keys()].some((key) => key.endsWith(':close:pending-1')))
  assert.ok([...registry.keys()].some((key) => key.endsWith(':close:pending-2')))

  await serviceModule.mutateShiftWithRecovery('close', input('pending-1'), {
    ...pendingDependencies,
    mutate: async () => { mutationCalls += 1; return { ok: true } },
  })
  await serviceModule.mutateShiftWithRecovery('close', input('pending-3'), {
    ...pendingDependencies,
    mutate: async () => { mutationCalls += 1; return { ok: true } },
  })
  assert.equal(registry.size, 2)
  assert.ok([...registry.keys()].some((key) => key.endsWith(':close:pending-3')))
})

test('adminService elimina siempre employee_id del gasto aunque el caller lo inyecte', async () => {
  const { adminServiceModule } = await loadRuntime()
  const calls = installSuccessApi()

  await adminServiceModule.createExpense({
    name: 'Gasolina', total_amount: 300, quantity: 1,
    date: '2026-07-27', company_id: 34, warehouse_id: 89,
    employee_id: 999999,
  })

  const directPayload = calls.find((call) => call.url === '/odoo-api/pwa-admin/expense-create')
  assert.ok(directPayload, 'expense-create debe llegar al controller autenticado')
  assert.equal(Object.hasOwn(directPayload.payload.params, 'employee_id'), false)
  assert.equal(directPayload.headers['Api-Key'], 'api-key')
  assert.equal(directPayload.headers['X-GF-Employee-Token'], 'employee-token')
  assert.equal(JSON.stringify(calls).includes('999999'), false)
})

test('AdminGastosForm no construye employee_id controlado por la UI', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(
    new URL('../src/modules/admin/forms/AdminGastosForm.jsx', import.meta.url),
    'utf8',
  ))
  assert.doesNotMatch(source, /employee_id\s*:/)
})
