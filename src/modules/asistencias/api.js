import { ApiError, api } from '../../lib/api.js'
import { toAttendanceIsoWithOffset } from './attendanceState.js'

const READ_FILTER_FIELDS = [
  'date_from',
  'date_to',
  'analytic_code',
  'employee_id',
  'status',
]

function pickFields(source, fields) {
  const result = {}
  for (const field of fields) {
    const value = source?.[field]
    if (value !== undefined) result[field] = value
  }
  return result
}

function queryPath(path, params) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `${path}?${serialized}` : path
}

function positiveId(value, field = 'record_id') {
  const text = String(value ?? '')
  if (!/^[1-9]\d*$/.test(text)) {
    throw new ApiError(`${field} inválido`, { status: 400, code: 'invalid_record_id' })
  }
  return text
}

function withExplicitAttendanceOffsets(payload) {
  const result = { ...payload }
  for (const field of ['check_in', 'check_out']) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = toAttendanceIsoWithOffset(result[field])
    }
  }
  return result
}

export function getCapabilities() {
  return api('GET', '/pwa-hr/attendance/capabilities')
}

export function getAttendance(filters = {}) {
  return api('GET', queryPath('/pwa-hr/attendance', pickFields(filters, READ_FILTER_FIELDS)))
}

export function createAttendance(payload = {}) {
  return api('POST', '/pwa-hr/attendance', withExplicitAttendanceOffsets(pickFields(payload, [
    'employee_id',
    'check_in',
    'check_out',
    'change_reason',
  ])))
}

export function updateAttendance(id, payload = {}) {
  return api('PATCH', `/pwa-hr/attendance/${positiveId(id, 'attendance_id')}`, withExplicitAttendanceOffsets(pickFields(payload, [
    'check_in',
    'check_out',
    'version',
    'change_reason',
  ])))
}

export function createAbsence(payload = {}) {
  return api('POST', '/pwa-hr/faltas', pickFields(payload, [
    'employee_id',
    'date',
    'absence_reason',
    'notes',
    'confirm_unscheduled',
    'change_reason',
  ]))
}

export function justifyAbsence(id, payload = {}) {
  return api('POST', `/pwa-hr/faltas/${positiveId(id, 'falta_id')}/justify`, pickFields(payload, [
    'justification_type',
    'notes',
    'document_base64',
    'document_name',
    'document_mime',
    'version',
    'change_reason',
  ]))
}

export function getAuditHistory(model, recordId, pagination = {}) {
  return api('GET', queryPath('/pwa-hr/audit', {
    model,
    record_id: positiveId(recordId),
    ...pickFields(pagination, ['limit', 'offset']),
  }))
}

export function downloadAttendanceWorkbook(filters = {}) {
  return api('GET', queryPath(
    '/pwa-hr/attendance/export.xlsx',
    pickFields(filters, READ_FILTER_FIELDS),
  ))
}

export function saveAttendanceWorkbook({ blob, filename }) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  try {
    anchor.href = objectUrl
    anchor.download = filename
    anchor.click()
  } finally {
    anchor.remove?.()
    URL.revokeObjectURL(objectUrl)
  }
}
