import { ApiError, api } from '../../lib/api.js'
import { toAttendanceIsoWithOffset } from './attendanceState.js'

const READ_FILTER_FIELDS = [
  'date_from',
  'date_to',
  'analytic_code',
  'employee_id',
  'status',
]
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ZIP_LOCAL_FILE_HEADER = [0x50, 0x4b, 0x03, 0x04]
const ZIP_END_OF_CENTRAL_DIRECTORY = [0x50, 0x4b, 0x05, 0x06]
const ZIP_END_MIN_SIZE = 22
const ZIP_MAX_COMMENT_SIZE = 0xffff
const XLSX_REQUIRED_ENTRIES = ['[Content_Types].xml', 'xl/workbook.xml']

export const ATTENDANCE_ACCESS_DENIED_EVENT = 'gf:attendance-access-denied'

const ATTENDANCE_ERROR_MESSAGES = {
  invalid_employee_token: () => 'Tu sesión venció. Inicia sesión nuevamente.',
  no_session: () => 'Tu sesión venció. Inicia sesión nuevamente.',
  attendance_access_denied: () => 'No tienes acceso a la administración de asistencias.',
  analytic_scope_not_configured: (details) => {
    const missing = safeList(details?.missing_codes).filter((code) => code === 'IGU' || code === 'IGU34')
    return missing.length
      ? `Falta configurar en Odoo la cuenta analítica ${missing.join(' y ')}. Corrige la configuración y recarga.`
      : 'Falta configurar en Odoo alguna de las cuentas analíticas IGU o IGU34. Corrige la configuración y recarga.'
  },
  invalid_analytic_filter: () => 'Selecciona una cuenta analítica válida: Todas, IGU o IGU34.',
  invalid_employee_filter: () => 'El filtro de empleado no es válido. Limpia el filtro y vuelve a consultar.',
  invalid_date_range: () => 'Revisa la fecha inicial y final del rango.',
  date_range_too_large: (details) => `El rango no puede exceder ${positiveNumber(details?.max_days) || 93} días.`,
  invalid_status_filter: () => 'Selecciona un estado de asistencia válido.',
  invalid_json: () => 'No fue posible procesar la solicitud. Recarga y vuelve a intentarlo.',
  invalid_payload: () => 'Revisa los datos capturados antes de volver a guardar.',
  change_reason_required: () => 'Escribe el motivo administrativo antes de guardar.',
  invalid_record_id: () => 'El registro seleccionado no es válido. Recarga el listado.',
  invalid_employee_id: () => 'El empleado seleccionado no es válido. Recarga el listado.',
  invalid_attendance_id: () => 'La asistencia seleccionada no es válida. Recarga el listado.',
  invalid_absence_id: () => 'La falta seleccionada no es válida. Recarga el listado.',
  invalid_datetime: () => 'Revisa la fecha y hora capturadas.',
  invalid_datetime_range: () => 'La salida debe ser posterior a la entrada. Corrige el horario.',
  employee_out_of_scope: () => 'El empleado cambió de cuenta o ya no está activo. Recarga el listado antes de reintentar.',
  attendance_overlap: (details) => {
    const id = positiveNumber(details?.conflict_id)
    return id
      ? `El horario se traslapa con la asistencia #${id}. Revisa la entrada y salida.`
      : 'El horario se traslapa con otra asistencia. Revisa la entrada y salida.'
  },
  absence_exists_for_date: (details) => existingRecordMessage('falta', details?.absence_id || details?.conflict_id, details?.date),
  absence_already_exists: (details) => existingRecordMessage('falta', details?.absence_id || details?.conflict_id, details?.date),
  attendance_exists_for_date: (details) => existingRecordMessage('asistencia', details?.attendance_id || details?.conflict_id, details?.date),
  absence_not_found: () => 'La falta ya no existe. Recarga el listado.',
  attendance_not_found: () => 'La asistencia ya no existe. Recarga el listado.',
  absence_not_editable: () => 'Solo una falta pendiente puede justificarse. Recarga para consultar su estado actual.',
  stale_record: () => 'El registro cambió. Recarga antes de volver a guardar.',
  invalid_attachment: () => 'Adjunta un PDF, JPG o PNG válido de hasta 5 MiB y vuelve a intentarlo.',
  unscheduled_absence_confirmation_required: () => 'Es una falta no programada. Confirma explícitamente después de verificar el calendario.',
  attendance_manager_user_not_configured: () => 'No se puede justificar: el empleado 717 debe estar vinculado a una cuenta res.users activa en Odoo antes de reintentar.',
  invalid_audit_target: () => 'No es posible consultar el historial de ese tipo de registro.',
  audit_target_not_found: () => 'El registro del historial ya no existe. Recarga el listado.',
  invalid_pagination: () => 'No fue posible avanzar en la paginación del historial. Cierra y vuelve a abrirlo.',
  internal_error: () => 'Ocurrió un error interno. Intenta nuevamente y, si persiste, contacta al equipo de soporte.',
  network: () => 'No hay conexión con Odoo. Verifica tu red e intenta nuevamente.',
  invalid_workbook: () => 'Odoo no devolvió un archivo Excel válido y completo. Conserva los filtros y vuelve a exportar.',
  route_not_found: () => 'El servicio de asistencias no está disponible. Contacta al equipo de soporte.',
  method_not_allowed: () => 'La operación solicitada no está disponible. Recarga la aplicación.',
  http_error: () => 'No fue posible completar la operación. Intenta nuevamente.',
}

function safeList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : 0
}

function safeDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : ''
}

function existingRecordMessage(kind, recordId, date) {
  const id = positiveNumber(recordId)
  const onDate = safeDate(date)
  const record = id ? `${kind} #${id}` : kind
  const dateText = onDate ? ` del ${onDate}` : ''
  return `Ya existe una ${record}${dateText}. Se recargará y abrirá su historial.`
}

export function getAttendanceErrorMessage(error = {}) {
  const formatter = ATTENDANCE_ERROR_MESSAGES[error?.code]
  return formatter
    ? formatter(error?.details || {})
    : 'No fue posible completar la operación. Intenta nuevamente.'
}

export function getAttendanceErrorField(error = {}) {
  return ({
    attendance_overlap: 'check_in',
    invalid_datetime: 'check_in',
    invalid_datetime_range: 'check_out',
    invalid_attachment: 'attachment',
    unscheduled_absence_confirmation_required: 'confirm_unscheduled',
  })[error?.code] || ''
}

export function getAttendanceConflictTarget(error = {}) {
  const details = error?.details || {}
  const date = safeDate(details.date)
  const suffix = date ? ` · ${date}` : ''
  if (error?.code === 'absence_already_exists' || error?.code === 'absence_exists_for_date') {
    const recordId = positiveNumber(details.absence_id || details.conflict_id)
    return recordId ? {
      model: 'x_kold.hr.falta',
      recordId,
      label: `Falta existente${suffix}`,
    } : null
  }
  if (error?.code === 'attendance_exists_for_date') {
    const recordId = positiveNumber(details.attendance_id || details.conflict_id)
    return recordId ? {
      model: 'hr.attendance',
      recordId,
      label: `Asistencia existente${suffix}`,
    } : null
  }
  return null
}

function hasBytesAt(bytes, offset, expected) {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function includesAscii(bytes, text) {
  const expected = [...text].map((character) => character.charCodeAt(0))
  for (let offset = 0; offset <= bytes.length - expected.length; offset += 1) {
    if (hasBytesAt(bytes, offset, expected)) return true
  }
  return false
}

function hasTerminalZipDirectory(bytes) {
  if (bytes.length < ZIP_END_MIN_SIZE) return false
  const firstCandidate = Math.max(0, bytes.length - ZIP_END_MIN_SIZE - ZIP_MAX_COMMENT_SIZE)
  for (let offset = bytes.length - ZIP_END_MIN_SIZE; offset >= firstCandidate; offset -= 1) {
    if (!hasBytesAt(bytes, offset, ZIP_END_OF_CENTRAL_DIRECTORY)) continue
    const commentLength = bytes[offset + 20] | (bytes[offset + 21] << 8)
    if (offset + ZIP_END_MIN_SIZE + commentLength === bytes.length) return true
  }
  return false
}

async function isWorkbookBlob(blob) {
  if (!(blob instanceof Blob) || blob.size < ZIP_END_MIN_SIZE) return false
  const mime = String(blob.type || '').split(';')[0].trim().toLowerCase()
  if (mime && mime !== XLSX_MIME) return false

  const bytes = new Uint8Array(await blob.arrayBuffer())
  return hasBytesAt(bytes, 0, ZIP_LOCAL_FILE_HEADER)
    && hasTerminalZipDirectory(bytes)
    && XLSX_REQUIRED_ENTRIES.every((entry) => includesAscii(bytes, entry))
}

function dispatchAttendanceAccessDenied() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new Event(ATTENDANCE_ACCESS_DENIED_EVENT))
}

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

function withExplicitAttendanceOffsets(payload, { emptyCheckout } = {}) {
  const result = { ...payload }
  for (const field of ['check_in', 'check_out']) {
    if (field === 'check_out' && typeof result[field] === 'string' && !result[field].trim()) {
      if (emptyCheckout === 'null') result[field] = null
      else delete result[field]
      continue
    }
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
  ]), { emptyCheckout: 'null' }))
}

export function updateAttendance(id, payload = {}) {
  return api('PATCH', `/pwa-hr/attendance/${positiveId(id, 'attendance_id')}`, withExplicitAttendanceOffsets(pickFields(payload, [
    'check_in',
    'check_out',
    'version',
    'change_reason',
  ]), { emptyCheckout: 'omit' }))
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

export async function getAuditHistory(model, recordId, pagination = {}) {
  try {
    return await api('GET', queryPath('/pwa-hr/audit', {
      model,
      record_id: positiveId(recordId),
      ...pickFields(pagination, ['limit', 'offset']),
    }))
  } catch (error) {
    if (error?.code === 'attendance_access_denied') dispatchAttendanceAccessDenied()
    if (error && typeof error === 'object') error.message = getAttendanceErrorMessage(error)
    throw error
  }
}

export async function downloadAttendanceWorkbook(filters = {}) {
  const workbook = await api('GET', queryPath(
    '/pwa-hr/attendance/export.xlsx',
    pickFields(filters, READ_FILTER_FIELDS),
  ))
  if (!workbook || !(await isWorkbookBlob(workbook.blob))) {
    throw new ApiError(getAttendanceErrorMessage({ code: 'invalid_workbook' }), {
      status: 502,
      code: 'invalid_workbook',
    })
  }
  return workbook
}

export function saveAttendanceWorkbook({ blob, filename }) {
  if (!(blob instanceof Blob) || blob.size <= 0 || !String(filename || '').toLowerCase().endsWith('.xlsx')) {
    throw new ApiError(getAttendanceErrorMessage({ code: 'invalid_workbook' }), {
      status: 502,
      code: 'invalid_workbook',
    })
  }

  let objectUrl = ''
  let anchor = null
  try {
    objectUrl = URL.createObjectURL(blob)
    anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor?.remove?.()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
