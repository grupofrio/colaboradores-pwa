import test from 'node:test'
import assert from 'node:assert/strict'

const state = await import('../src/modules/asistencias/attendanceState.js').catch(() => null)

test('attendance state: datetime-local values gain the named Mexico timezone offset', () => {
  assert.equal(
    state.toAttendanceIsoWithOffset('2026-07-27T08:00'),
    '2026-07-27T08:00-06:00',
  )
  assert.equal(
    state.toAttendanceIsoWithOffset('2026-07-27T08:00:30.125'),
    '2026-07-27T08:00:30.125-06:00',
  )
})

test('attendance state: explicit valid offsets are preserved and invalid local times fail closed', () => {
  assert.equal(
    state.toAttendanceIsoWithOffset('2026-07-27T14:00:00Z'),
    '2026-07-27T14:00:00Z',
  )
  assert.equal(
    state.toAttendanceIsoWithOffset('2026-07-27T08:00:00-06:00'),
    '2026-07-27T08:00:00-06:00',
  )
  assert.throws(() => state.toAttendanceIsoWithOffset('2026-02-30T08:00'))
  assert.throws(() => state.toAttendanceIsoWithOffset('2026-07-27T08:00+25:00'))
  assert.throws(() => state.toAttendanceIsoWithOffset(
    '2026-03-08T02:30',
    { timeZone: 'America/New_York' },
  ), /inexistente|ambigua/i)
  assert.throws(() => state.toAttendanceIsoWithOffset(
    '2026-11-01T01:30',
    { timeZone: 'America/New_York' },
  ), /inexistente|ambigua/i)
})

test('attendance state: day week and custom presets use local YYYY-MM-DD values', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  const now = new Date(2026, 6, 29, 23, 30, 0)

  assert.deepEqual(state.getAttendanceDatePreset('day', { now }), {
    preset: 'day',
    date_from: '2026-07-29',
    date_to: '2026-07-29',
  })
  assert.deepEqual(state.getAttendanceDatePreset('week', { now }), {
    preset: 'week',
    date_from: '2026-07-27',
    date_to: '2026-08-02',
  })
  assert.deepEqual(state.getAttendanceDatePreset('custom', {
    now,
    date_from: '2026-06-01',
    date_to: '2026-06-30',
  }), {
    preset: 'custom',
    date_from: '2026-06-01',
    date_to: '2026-06-30',
  })
})

test('attendance state: filters enforce real dates, ordering, 93 inclusive days and fixed enums', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  assert.deepEqual(state.validateAttendanceFilters({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    analytic_code: 'IGU34',
    status: 'absence_pending',
    employee_id: 15,
  }), { valid: true, errors: {} })

  const invalid = state.validateAttendanceFilters({
    date_from: '2026-02-30',
    date_to: '2026-07-31',
    analytic_code: 'IGU-other',
    status: 'invented',
    employee_id: '01',
  })
  assert.equal(invalid.valid, false)
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    'analytic_code', 'date_from', 'employee_id', 'status',
  ])

  assert.equal(state.validateAttendanceFilters({
    date_from: '2026-01-01',
    date_to: '2026-04-03',
  }).valid, true, '93 días inclusivos son válidos')
  assert.equal(state.validateAttendanceFilters({
    date_from: '2026-01-01',
    date_to: '2026-04-04',
  }).errors.date_to.length > 0, true, '94 días se rechazan')
  assert.equal(state.validateAttendanceFilters({
    date_from: '2026-07-31',
    date_to: '2026-07-01',
  }).valid, false)
})

test('attendance state: strict attendance form validation covers create update and time order', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  const valid = state.validateAttendanceForm({
    employee_id: 22,
    check_in: '2026-07-27T08:00',
    check_out: '2026-07-27T17:00',
    change_reason: 'Captura autorizada',
  }, { mode: 'create' })
  assert.deepEqual(valid, { valid: true, errors: {} })

  const invalidCreate = state.validateAttendanceForm({
    employee_id: 0,
    check_in: '2026-02-30T08:00',
    check_out: '2026-07-27T07:00',
    change_reason: '  ',
  }, { mode: 'create' })
  assert.equal(invalidCreate.valid, false)
  assert.deepEqual(Object.keys(invalidCreate.errors).sort(), [
    'change_reason', 'check_in', 'employee_id',
  ])

  const invalidUpdate = state.validateAttendanceForm({
    version: '',
    change_reason: 'Corrección',
  }, { mode: 'update' })
  assert.equal(invalidUpdate.valid, false)
  assert.deepEqual(Object.keys(invalidUpdate.errors).sort(), ['check_in', 'version'])

  const badRange = state.validateAttendanceForm({
    check_in: '2026-07-27T18:00:00-06:00',
    check_out: '2026-07-27T17:00:00-06:00',
    version: 'v1',
    change_reason: 'Corrección',
  }, { mode: 'update' })
  assert.equal(Boolean(badRange.errors.check_out), true)
})

test('attendance state: absence and justification forms enforce enums confirmation and attachment tuple', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  assert.deepEqual(state.validateAbsenceForm({
    employee_id: 22,
    date: '2026-07-27',
    absence_reason: 'no_show',
    change_reason: 'Sin registro confirmado',
    confirm_unscheduled: false,
  }, { expectedWorkday: true }), { valid: true, errors: {} })

  const absence = state.validateAbsenceForm({
    employee_id: 22,
    date: '2026-07-27',
    absence_reason: 'invalid',
    change_reason: '',
    confirm_unscheduled: false,
  }, { expectedWorkday: false })
  assert.deepEqual(Object.keys(absence.errors).sort(), [
    'absence_reason', 'change_reason', 'confirm_unscheduled',
  ])

  assert.deepEqual(state.validateJustificationForm({
    justification_type: 'cita_medica',
    notes: 'Consulta',
    document_base64: 'JVBERi0=',
    document_name: 'comprobante.pdf',
    document_mime: 'application/pdf',
    version: 'v2',
    change_reason: 'Documento revisado',
  }), { valid: true, errors: {} })

  const attachment = state.validateJustificationForm({
    justification_type: 'otro',
    document_base64: 'abc',
    document_name: '',
    document_mime: 'text/plain',
    version: '',
    change_reason: '',
  })
  assert.deepEqual(Object.keys(attachment.errors).sort(), [
    'change_reason', 'document_base64', 'document_mime', 'document_name', 'version',
  ])
})

test('attendance state: labels and local search normalize accents and employee numbers', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  assert.equal(state.getAttendanceStatusLabel('complete'), 'Completa')
  assert.equal(state.getAttendanceStatusLabel('absence_justified'), 'Falta justificada')
  assert.equal(state.getAttendanceStatusLabel('unknown'), 'Desconocido')

  const rows = [
    { employee: { number: 'IG-001', name: 'Ángel Pérez', job: 'Operador', analytic_code: 'IGU' }, status: 'complete' },
    { employee: { number: 'IG-002', name: 'Beatriz Luna', job: 'Almacén', analytic_code: 'IGU34' }, status: 'open' },
  ]
  assert.deepEqual(state.filterAttendanceRows(rows, { search: 'angel perez' }), [rows[0]])
  assert.deepEqual(state.filterAttendanceRows(rows, { search: 'ig-002', status: 'open' }), [rows[1]])
  assert.deepEqual(state.filterAttendanceRows(rows, { analytic_code: 'IGU' }), [rows[0]])
})

test('attendance state: row actions enforce absence open and closed segment rules', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  const blank = state.getAttendanceActionEligibility({ attendances: [], absence: null })
  assert.deepEqual(blank, {
    registerAttendance: true,
    addSegment: false,
    correctAttendance: false,
    registerExit: false,
    registerAbsence: true,
    justifyAbsence: false,
    viewHistory: false,
  })

  const closed = state.getAttendanceActionEligibility({
    attendances: [{ id: 1, check_out: '2026-07-27T17:00:00-06:00' }],
    absence: null,
  })
  assert.equal(closed.addSegment, true)
  assert.equal(closed.correctAttendance, true)
  assert.equal(closed.registerAbsence, false)
  assert.equal(closed.viewHistory, true)

  const open = state.getAttendanceActionEligibility({
    attendances: [{ id: 2, check_out: null }],
    absence: null,
  })
  assert.equal(open.addSegment, false)
  assert.equal(open.registerExit, true)

  const pending = state.getAttendanceActionEligibility({
    attendances: [],
    absence: { id: 4, state: 'pendiente', justified: false },
  })
  assert.equal(pending.registerAttendance, false)
  assert.equal(pending.justifyAbsence, true)
  assert.equal(pending.viewHistory, true)

  const processed = state.getAttendanceActionEligibility({
    attendances: [],
    absence: { id: 5, state: 'procesada', justified: true },
  })
  assert.equal(processed.justifyAbsence, false)
})

test('attendance state: filter serialization is bounded and never includes actor scope', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  assert.deepEqual(state.serializeAttendanceFilters({
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    analytic_code: 'IGU',
    employee_id: 22,
    status: 'complete',
    search: 'Ángel',
    actor_id: 717,
    company_id: 35,
  }), {
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    analytic_code: 'IGU',
    employee_id: 22,
    status: 'complete',
  })
})

test('attendance state: documented backend errors map to actionable Spanish UX', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  assert.match(state.getAttendanceErrorMessage({ code: 'attendance_overlap' }), /traslapa/i)
  assert.match(state.getAttendanceErrorMessage({ code: 'invalid_attachment' }), /PDF, JPG o PNG/i)
  assert.match(state.getAttendanceErrorMessage({ code: 'unscheduled_absence_confirmation_required' }), /no programad/i)
  assert.equal(
    state.getAttendanceErrorMessage({ code: 'unknown', message: 'Mensaje seguro del servidor' }),
    'Mensaje seguro del servidor',
  )
})

test('attendance state: stale records and scope changes request reload instead of blind retry', () => {
  assert.ok(state, 'debe existir el estado puro de asistencias')
  assert.equal(state.needsReload({ code: 'stale_record', status: 409 }), true)
  assert.equal(state.needsReload({ code: 'employee_out_of_scope', status: 403 }), true)
  assert.equal(state.needsReload({ code: 'analytic_scope_not_configured', status: 404 }), true)
  assert.equal(state.needsReload({ code: 'attendance_overlap', status: 409 }), false)
  assert.equal(state.needsReload({ code: 'invalid_datetime_range', status: 422 }), false)
})
