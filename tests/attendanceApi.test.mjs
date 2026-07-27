import test from 'node:test'
import assert from 'node:assert/strict'

const routeModule = await import('../src/lib/pwaHrRoute.js').catch(() => null)
const attendanceApi = await import('../src/modules/asistencias/api.js').catch(() => null)
const coreApi = await import('../src/lib/api.js')

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalURL = globalThis.URL

function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      store = {}
    },
  }
}

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'web-session',
    gf_employee_token: 'employee-mobile-token',
    employee_id: 717,
    ...session,
  }))
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
  setSession()
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
  globalThis.document = originalDocument
  globalThis.URL = originalURL
})

test('attendance api: only the eight exact path and method shapes are approved', () => {
  assert.ok(routeModule, 'debe existir el reconocedor directo de asistencias')
  const { matchPwaHrAttendanceRoute } = routeModule
  const approved = [
    ['GET', '/pwa-hr/attendance/capabilities'],
    ['GET', '/pwa-hr/attendance'],
    ['POST', '/pwa-hr/attendance'],
    ['PATCH', '/pwa-hr/attendance/42'],
    ['POST', '/pwa-hr/faltas'],
    ['POST', '/pwa-hr/faltas/81/justify'],
    ['GET', '/pwa-hr/audit'],
    ['GET', '/pwa-hr/attendance/export.xlsx'],
  ]

  for (const [method, path] of approved) {
    assert.deepEqual(matchPwaHrAttendanceRoute(method, `${path}?x=1`).allowed, true, `${method} ${path}`)
  }

  for (const path of [
    '/pwa-hr/attendance/',
    '/pwa-hr/attendance/0',
    '/pwa-hr/attendance/01',
    '/pwa-hr/attendance/-1',
    '/pwa-hr/attendance/42/extra',
    '/pwa-hr/falta',
    '/pwa-hr/faltas/81/justify/extra',
    '/pwa-hr/auditor',
    '/pwa-hr/attendance/export.xlsx/extra',
    '/other/pwa-hr/attendance',
  ]) {
    assert.equal(matchPwaHrAttendanceRoute('GET', path).recognized, false, path)
  }

  const wrongMethod = matchPwaHrAttendanceRoute('DELETE', '/pwa-hr/attendance/42')
  assert.equal(wrongMethod.recognized, true)
  assert.equal(wrongMethod.allowed, false)
})

test('attendance api: attendance paths never fall through to n8n', async () => {
  let fetchCount = 0
  globalThis.fetch = async () => {
    fetchCount += 1
    throw new Error('no debe llamar fetch')
  }

  await assert.rejects(
    coreApi.api('DELETE', '/pwa-hr/attendance'),
    (error) => error instanceof coreApi.ApiError
      && error.status === 405
      && error.code === 'method_not_allowed',
  )
  await assert.rejects(
    coreApi.api('GET', '/pwa-hr/attendance/export.xlsx/extra'),
    (error) => error instanceof coreApi.ApiError
      && error.status === 404
      && error.code === 'route_not_found',
  )
  assert.equal(fetchCount, 0)
})

test('attendance api: facade uses Odoo, token header, encoded filters and mutation whitelists', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await attendanceApi.getAttendance({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    analytic_code: 'IGU34',
    employee_id: 105,
    status: 'missing_expected',
    actor_id: 999,
    meta: { sudo: true },
  })
  await attendanceApi.createAttendance({
    employee_id: 105,
    check_in: '2026-07-27T08:00:00-06:00',
    check_out: null,
    change_reason: 'Captura autorizada',
    actor_id: 999,
    company_id: 35,
    analytic_code: 'OTHER',
    meta: { sudo: true },
  })

  assert.equal(
    calls[0].url,
    '/odoo-api/pwa-hr/attendance?date_from=2026-07-01&date_to=2026-07-31&analytic_code=IGU34&employee_id=105&status=missing_expected',
  )
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-mobile-token')
  assert.equal(calls[0].url.startsWith('/api-n8n'), false)

  assert.equal(calls[1].url, '/odoo-api/pwa-hr/attendance')
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    employee_id: 105,
    check_in: '2026-07-27T08:00:00-06:00',
    check_out: null,
    change_reason: 'Captura autorizada',
  })
})

test('attendance api: every mutation and audit request keeps only its contract fields', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  const forbidden = { actor_id: 999, company_id: 1, analytic_code: 'OTHER', sudo: true, meta: { ip: 'fake' } }
  await attendanceApi.updateAttendance(9, {
    check_in: '2026-07-27T08:00:00-06:00',
    check_out: '2026-07-27T17:00:00-06:00',
    version: 'v1',
    change_reason: 'Corrección',
    employee_id: 888,
    ...forbidden,
  })
  await attendanceApi.createAbsence({
    employee_id: 105,
    date: '2026-07-27',
    absence_reason: 'no_show',
    notes: 'Sin aviso',
    confirm_unscheduled: false,
    change_reason: 'Confirmado por supervisión',
    ...forbidden,
  })
  await attendanceApi.justifyAbsence(15, {
    justification_type: 'cita_medica',
    notes: 'Consulta',
    document_base64: 'JVBERi0=',
    document_name: 'comprobante.pdf',
    document_mime: 'application/pdf',
    version: 'v2',
    change_reason: 'Documento revisado',
    ...forbidden,
  })
  await attendanceApi.getAuditHistory('hr.attendance', 9, { limit: 25, offset: 50, actor_id: 999 })

  assert.deepEqual(JSON.parse(calls[0].options.body), {
    check_in: '2026-07-27T08:00:00-06:00',
    check_out: '2026-07-27T17:00:00-06:00',
    version: 'v1',
    change_reason: 'Corrección',
  })
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    employee_id: 105,
    date: '2026-07-27',
    absence_reason: 'no_show',
    notes: 'Sin aviso',
    confirm_unscheduled: false,
    change_reason: 'Confirmado por supervisión',
  })
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    justification_type: 'cita_medica',
    notes: 'Consulta',
    document_base64: 'JVBERi0=',
    document_name: 'comprobante.pdf',
    document_mime: 'application/pdf',
    version: 'v2',
    change_reason: 'Documento revisado',
  })
  assert.equal(calls[3].url, '/odoo-api/pwa-hr/audit?model=hr.attendance&record_id=9&limit=25&offset=50')
})

test('attendance api: structured backend errors preserve status code details and expire invalid token', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  const events = []
  globalThis.window = { dispatchEvent(event) { events.push(event.type) } }
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    error: {
      code: 'invalid_employee_token',
      message: 'Sesión móvil inválida',
      details: { reason: 'expired' },
    },
  }), { status: 401 })

  await assert.rejects(attendanceApi.getCapabilities(), (error) => {
    assert.equal(error instanceof coreApi.ApiError, true)
    assert.equal(error.status, 401)
    assert.equal(error.code, 'invalid_employee_token')
    assert.equal(error.message, 'Sesión móvil inválida')
    assert.deepEqual(error.details, { reason: 'expired' })
    return true
  })
  assert.deepEqual(events, ['gf:session-expired'])
})

test('attendance api: xlsx returns a Blob, safe filename and download helper always revokes URL', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  const xlsx = new Blob(['xlsx-bytes'], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  globalThis.fetch = async () => new Response(xlsx, {
    status: 200,
    headers: {
      'Content-Disposition': 'attachment; filename="../../asistencias Iguala.xlsx"',
    },
  })

  const file = await attendanceApi.downloadAttendanceWorkbook({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    analytic_code: 'IGU',
  })
  assert.equal(file.blob instanceof Blob, true)
  assert.equal(file.filename, 'asistencias Iguala.xlsx')

  const lifecycle = []
  const anchor = {
    click() { lifecycle.push('click') },
    remove() { lifecycle.push('remove') },
  }
  globalThis.document = { createElement() { return anchor } }
  globalThis.URL = {
    createObjectURL(blob) {
      assert.equal(blob, file.blob)
      lifecycle.push('create')
      return 'blob:attendance'
    },
    revokeObjectURL(url) {
      lifecycle.push(`revoke:${url}`)
    },
  }

  attendanceApi.saveAttendanceWorkbook(file)
  assert.equal(anchor.href, 'blob:attendance')
  assert.equal(anchor.download, 'asistencias Iguala.xlsx')
  assert.deepEqual(lifecycle, ['create', 'click', 'remove', 'revoke:blob:attendance'])
})

test('attendance api: unsafe or absent workbook filename uses the canonical fallback', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  globalThis.fetch = async () => new Response(new Blob(['xlsx']), {
    status: 200,
    headers: { 'Content-Disposition': 'attachment; filename="not-a-workbook.txt"' },
  })

  const file = await attendanceApi.downloadAttendanceWorkbook({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
  })
  assert.equal(file.filename, 'asistencias_IGU_IGU34_2026-07-01_2026-07-31.xlsx')
})
