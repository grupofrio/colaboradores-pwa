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
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function littleEndian(value, byteLength) {
  const bytes = new Uint8Array(byteLength)
  const view = new DataView(bytes.buffer)
  if (byteLength === 2) view.setUint16(0, value, true)
  else view.setUint32(0, value, true)
  return bytes
}

function joinBytes(parts) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function minimalZipBlob({
  names = ['[Content_Types].xml', 'xl/workbook.xml'],
  type = XLSX_MIME,
} = {}) {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let localOffset = 0

  for (const name of names) {
    const filename = encoder.encode(name)
    const local = joinBytes([
      littleEndian(0x04034b50, 4),
      littleEndian(20, 2),
      new Uint8Array(8),
      new Uint8Array(12),
      littleEndian(filename.length, 2),
      littleEndian(0, 2),
      filename,
    ])
    localParts.push(local)
    centralParts.push(joinBytes([
      littleEndian(0x02014b50, 4),
      littleEndian(20, 2),
      littleEndian(20, 2),
      new Uint8Array(8),
      new Uint8Array(12),
      littleEndian(filename.length, 2),
      new Uint8Array(12),
      littleEndian(0, 4),
      littleEndian(localOffset, 4),
      filename,
    ]))
    localOffset += local.length
  }

  const locals = joinBytes(localParts)
  const central = joinBytes(centralParts)
  const eocd = joinBytes([
    littleEndian(0x06054b50, 4),
    new Uint8Array(4),
    littleEndian(names.length, 2),
    littleEndian(names.length, 2),
    littleEndian(central.length, 4),
    littleEndian(locals.length, 4),
    littleEndian(0, 2),
  ])
  return new Blob([locals, central, eocd], { type })
}

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

test('attendance api: create and update always send explicit Mexico offsets', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  await attendanceApi.createAttendance({
    employee_id: 105,
    check_in: '2026-07-27T08:00',
    check_out: '2026-07-27T17:00',
    change_reason: 'Captura autorizada',
  })
  await attendanceApi.updateAttendance(9, {
    check_in: '2026-07-28T08:15',
    check_out: '2026-07-28T17:30:15',
    version: 'v1',
    change_reason: 'Corrección autorizada',
  })

  assert.deepEqual(JSON.parse(calls[0].options.body), {
    employee_id: 105,
    check_in: '2026-07-27T08:00-06:00',
    check_out: '2026-07-27T17:00-06:00',
    change_reason: 'Captura autorizada',
  })
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    check_in: '2026-07-28T08:15-06:00',
    check_out: '2026-07-28T17:30:15-06:00',
    version: 'v1',
    change_reason: 'Corrección autorizada',
  })
})

test('attendance api: optional empty checkout is safe without erasing an update implicitly', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  await attendanceApi.createAttendance({
    employee_id: 105,
    check_in: '2026-07-27T08:00',
    check_out: '',
    change_reason: 'Entrada abierta',
  })
  await attendanceApi.updateAttendance(9, {
    check_in: '2026-07-27T08:15',
    check_out: '   ',
    version: 'v1',
    change_reason: 'Ajustar entrada',
  })
  await attendanceApi.updateAttendance(9, {
    check_out: null,
    version: 'v2',
    change_reason: 'Reabrir asistencia',
  })

  assert.deepEqual(JSON.parse(calls[0].options.body), {
    employee_id: 105,
    check_in: '2026-07-27T08:00-06:00',
    check_out: null,
    change_reason: 'Entrada abierta',
  })
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    check_in: '2026-07-27T08:15-06:00',
    version: 'v1',
    change_reason: 'Ajustar entrada',
  })
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    check_out: null,
    version: 'v2',
    change_reason: 'Reabrir asistencia',
  })
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

test('attendance api: xlsx uses exact active filters and verifies the complete workbook container', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  const xlsx = minimalZipBlob()
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return new Response(xlsx, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="../../asistencias Iguala.xlsx"',
      },
    })
  }

  const file = await attendanceApi.downloadAttendanceWorkbook({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    analytic_code: 'IGU',
    employee_id: 105,
    status: 'open',
    search: 'no debe viajar',
  })
  assert.equal(file.blob instanceof Blob, true)
  assert.equal(file.filename, 'asistencias Iguala.xlsx')
  assert.deepEqual(calls, [
    '/odoo-api/pwa-hr/attendance/export.xlsx?date_from=2026-07-01&date_to=2026-07-31&analytic_code=IGU&employee_id=105&status=open',
  ])

  const truncated = xlsx.slice(0, xlsx.size - 8, XLSX_MIME)
  for (const invalidBlob of [
    new Blob([], { type: XLSX_MIME }),
    new Blob(['xlsx-bytes'], { type: XLSX_MIME }),
    truncated,
    minimalZipBlob({ type: 'application/zip' }),
    minimalZipBlob({ names: ['readme.txt'], type: XLSX_MIME }),
  ]) {
    globalThis.fetch = async () => new Response(invalidBlob, { status: 200 })
    await assert.rejects(
      attendanceApi.downloadAttendanceWorkbook({
        date_from: '2026-07-01',
        date_to: '2026-07-31',
      }),
      (error) => error instanceof coreApi.ApiError
        && error.code === 'invalid_workbook'
        && /Excel/.test(error.message),
    )
  }
})

test('attendance api: download helper attaches one anchor and always removes and revokes it', async () => {
  const file = {
    blob: minimalZipBlob(),
    filename: 'asistencias Iguala.xlsx',
  }

  const lifecycle = []
  const anchor = {
    click() { lifecycle.push('click') },
    remove() { lifecycle.push('remove') },
  }
  globalThis.document = {
    body: {
      appendChild(node) {
        assert.equal(node, anchor)
        lifecycle.push('append')
      },
    },
    createElement() {
      lifecycle.push('anchor')
      return anchor
    },
  }
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
  assert.deepEqual(lifecycle, [
    'create', 'anchor', 'append', 'click', 'remove', 'revoke:blob:attendance',
  ])

  lifecycle.length = 0
  anchor.click = () => {
    lifecycle.push('click')
    throw new Error('click failed')
  }
  assert.throws(() => attendanceApi.saveAttendanceWorkbook(file), /click failed/)
  assert.deepEqual(lifecycle, [
    'create', 'anchor', 'append', 'click', 'remove', 'revoke:blob:attendance',
  ])
})

test('attendance api: unsafe or absent workbook filename uses the canonical fallback', async () => {
  assert.ok(attendanceApi, 'debe existir la fachada API de asistencias')
  globalThis.fetch = async () => new Response(minimalZipBlob({ type: '' }), {
    status: 200,
    headers: { 'Content-Disposition': 'attachment; filename="not-a-workbook.txt"' },
  })

  const file = await attendanceApi.downloadAttendanceWorkbook({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
  })
  assert.equal(file.filename, 'asistencias_IGU_IGU34_2026-07-01_2026-07-31.xlsx')
})

test('attendance api: audit access denial emits only the dedicated safe screen event', async () => {
  const events = []
  globalThis.window = {
    dispatchEvent(event) {
      events.push(event)
    },
  }
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    error: {
      code: 'attendance_access_denied',
      message: 'Attendance access denied.',
      details: { token: 'must-not-be-forwarded' },
    },
  }), { status: 403 })

  await assert.rejects(
    attendanceApi.getAuditHistory('hr.attendance', 9),
    (error) => error.code === 'attendance_access_denied'
      && /acceso/i.test(error.message),
  )
  assert.deepEqual(events.map((event) => event.type), ['gf:attendance-access-denied'])
  assert.equal('detail' in events[0], false, 'el evento no replica details ni token')

  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    error: {
      code: 'employee_out_of_scope',
      message: 'Employee is outside scope.',
      details: {},
    },
  }), { status: 403 })
  await assert.rejects(attendanceApi.getAuditHistory('hr.attendance', 9))
  assert.deepEqual(events.map((event) => event.type), ['gf:attendance-access-denied'])
})

test('attendance api: every attendance backend code has an actionable Spanish message with details', () => {
  const cases = [
    ['invalid_employee_token', {}, /sesión/i],
    ['no_session', {}, /sesión/i],
    ['attendance_access_denied', {}, /acceso/i],
    ['analytic_scope_not_configured', { missing_codes: ['IGU34'] }, /IGU34/],
    ['invalid_analytic_filter', {}, /IGU.*IGU34/i],
    ['invalid_employee_filter', {}, /empleado/i],
    ['invalid_date_range', {}, /fecha/i],
    ['date_range_too_large', { max_days: 93 }, /93 días/i],
    ['invalid_status_filter', {}, /estado/i],
    ['invalid_json', {}, /solicitud/i],
    ['invalid_payload', {}, /datos/i],
    ['change_reason_required', {}, /motivo administrativo/i],
    ['invalid_record_id', {}, /registro/i],
    ['invalid_employee_id', {}, /empleado/i],
    ['invalid_attendance_id', {}, /asistencia/i],
    ['invalid_absence_id', {}, /falta/i],
    ['invalid_datetime', {}, /fecha.*hora/i],
    ['invalid_datetime_range', {}, /salida.*entrada/i],
    ['employee_out_of_scope', {}, /cuenta.*recarg/i],
    ['attendance_overlap', { conflict_id: 88 }, /#88/],
    ['absence_exists_for_date', { absence_id: 41, date: '2026-07-27' }, /falta #41.*2026-07-27/i],
    ['absence_already_exists', { absence_id: 42, date: '2026-07-28' }, /falta #42.*2026-07-28/i],
    ['attendance_exists_for_date', { attendance_id: 93, date: '2026-07-29' }, /asistencia #93.*2026-07-29/i],
    ['absence_not_found', {}, /falta.*no existe/i],
    ['attendance_not_found', {}, /asistencia.*no existe/i],
    ['absence_not_editable', {}, /pendiente/i],
    ['stale_record', {}, /cambió.*recarg/i],
    ['invalid_attachment', {}, /PDF.*JPG.*PNG.*5 MiB/i],
    ['unscheduled_absence_confirmation_required', {}, /no programad.*confirma/i],
    ['attendance_manager_user_not_configured', {}, /empleado 717.*res\.users/i],
    ['invalid_audit_target', {}, /historial/i],
    ['audit_target_not_found', {}, /historial.*no existe/i],
    ['invalid_pagination', {}, /paginación/i],
    ['internal_error', {}, /equipo de soporte/i],
    ['network', {}, /conexión/i],
    ['invalid_workbook', {}, /Excel/i],
    ['route_not_found', {}, /servicio.*no está disponible/i],
    ['method_not_allowed', {}, /operación.*no está disponible/i],
    ['http_error', {}, /intenta nuevamente/i],
  ]

  for (const [code, details, expected] of cases) {
    const message = attendanceApi.getAttendanceErrorMessage({
      code,
      details,
      message: 'Raw backend error in English',
    })
    assert.match(message, expected, code)
    assert.doesNotMatch(message, /Raw backend error|Attendance|The /, code)
  }

  assert.equal(attendanceApi.getAttendanceErrorField({ code: 'attendance_overlap' }), 'check_in')
  assert.equal(attendanceApi.getAttendanceErrorField({ code: 'invalid_datetime_range' }), 'check_out')
  assert.equal(attendanceApi.getAttendanceErrorField({ code: 'invalid_attachment' }), 'attachment')
  assert.equal(attendanceApi.getAttendanceErrorField({ code: 'unscheduled_absence_confirmation_required' }), 'confirm_unscheduled')
  assert.deepEqual(attendanceApi.getAttendanceConflictTarget({
    code: 'absence_already_exists',
    details: { absence_id: 42, date: '2026-07-28' },
  }), {
    model: 'x_kold.hr.falta',
    recordId: 42,
    label: 'Falta existente · 2026-07-28',
  })
  assert.deepEqual(attendanceApi.getAttendanceConflictTarget({
    code: 'attendance_exists_for_date',
    details: { attendance_id: 93, date: '2026-07-29' },
  }), {
    model: 'hr.attendance',
    recordId: 93,
    label: 'Asistencia existente · 2026-07-29',
  })
})
