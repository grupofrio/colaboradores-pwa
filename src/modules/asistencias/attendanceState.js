const ANALYTIC_CODES = new Set(['IGU', 'IGU34'])
const ATTENDANCE_STATUSES = new Set([
  'complete',
  'open',
  'absence_pending',
  'absence_justified',
  'absence_processed',
  'missing_expected',
  'not_scheduled',
])
const ABSENCE_REASONS = new Set(['retardo_bloqueado', 'no_show', 'otro'])
const JUSTIFICATION_TYPES = new Set(['imss', 'funeral', 'cita_medica', 'otro'])
const ATTACHMENT_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_RANGE_DAYS = 93
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

const STATUS_LABELS = {
  complete: 'Completa',
  open: 'Registro abierto',
  absence_pending: 'Falta pendiente',
  absence_justified: 'Falta justificada',
  absence_processed: 'Falta procesada',
  missing_expected: 'Asistencia faltante',
  not_scheduled: 'Día no programado',
}

function localDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return { year, month, day, date }
}

function parseDateTimeValue(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?$/,
  )
  if (!match || !parseDateValue(`${match[1]}-${match[2]}-${match[3]}`)) return null
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] || 0)
  if (hour > 23 || minute > 59 || second > 59) return null
  const timestamp = Date.parse(String(value))
  return Number.isFinite(timestamp) ? timestamp : null
}

function positiveInteger(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0
  return /^[1-9]\d*$/.test(String(value || ''))
}

function requiredText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validation(errors) {
  return { valid: Object.keys(errors).length === 0, errors }
}

export function getAttendanceDatePreset(preset, {
  now = new Date(),
  date_from: dateFrom,
  date_to: dateTo,
} = {}) {
  if (preset === 'custom') {
    return { preset, date_from: dateFrom, date_to: dateTo }
  }

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  if (preset === 'week') {
    const daysSinceMonday = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - daysSinceMonday)
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 6)
  }
  return {
    preset: preset === 'week' ? 'week' : 'day',
    date_from: localDateValue(start),
    date_to: localDateValue(end),
  }
}

export function validateAttendanceFilters(filters = {}) {
  const errors = {}
  const from = parseDateValue(filters.date_from)
  const to = parseDateValue(filters.date_to)
  if (!from) errors.date_from = 'Selecciona una fecha inicial válida.'
  if (!to) errors.date_to = 'Selecciona una fecha final válida.'
  if (from && to) {
    const fromUtc = Date.UTC(from.year, from.month - 1, from.day)
    const toUtc = Date.UTC(to.year, to.month - 1, to.day)
    const inclusiveDays = Math.round((toUtc - fromUtc) / 86400000) + 1
    if (inclusiveDays < 1) errors.date_to = 'La fecha final no puede ser anterior a la inicial.'
    else if (inclusiveDays > MAX_RANGE_DAYS) errors.date_to = 'El rango no puede exceder 93 días.'
  }
  if (filters.analytic_code && !ANALYTIC_CODES.has(filters.analytic_code)) {
    errors.analytic_code = 'Selecciona IGU, IGU34 o Todas.'
  }
  if (filters.status && !ATTENDANCE_STATUSES.has(filters.status)) {
    errors.status = 'Selecciona un estado válido.'
  }
  if (filters.employee_id !== undefined && filters.employee_id !== null
    && filters.employee_id !== '' && !positiveInteger(filters.employee_id)) {
    errors.employee_id = 'Selecciona un empleado válido.'
  }
  return validation(errors)
}

export function validateAttendanceForm(form = {}, { mode = 'create' } = {}) {
  const errors = {}
  const create = mode === 'create'
  if (create && !positiveInteger(form.employee_id)) errors.employee_id = 'Selecciona un empleado.'

  const checkIn = form.check_in ? parseDateTimeValue(form.check_in) : null
  const checkOut = form.check_out ? parseDateTimeValue(form.check_out) : null
  if ((create || (!form.check_in && !form.check_out)) && checkIn === null) {
    errors.check_in = create ? 'Indica una entrada válida.' : 'Indica una entrada o una salida.'
  } else if (form.check_in && checkIn === null) {
    errors.check_in = 'Indica una entrada válida.'
  }
  if (form.check_out && checkOut === null) errors.check_out = 'Indica una salida válida.'
  if (checkIn !== null && checkOut !== null && checkOut <= checkIn) {
    errors.check_out = 'La salida debe ser posterior a la entrada.'
  }
  if (!create && !requiredText(form.version)) errors.version = 'Recarga el registro antes de corregirlo.'
  if (!requiredText(form.change_reason)) errors.change_reason = 'Escribe el motivo administrativo.'
  return validation(errors)
}

export function validateAbsenceForm(form = {}, { expectedWorkday = true } = {}) {
  const errors = {}
  if (!positiveInteger(form.employee_id)) errors.employee_id = 'Selecciona un empleado.'
  if (!parseDateValue(form.date)) errors.date = 'Selecciona una fecha válida.'
  if (!ABSENCE_REASONS.has(form.absence_reason)) errors.absence_reason = 'Selecciona el motivo de la falta.'
  if (!requiredText(form.change_reason)) errors.change_reason = 'Escribe el motivo administrativo.'
  if (!expectedWorkday && form.confirm_unscheduled !== true) {
    errors.confirm_unscheduled = 'Confirma la falta no programada.'
  }
  return validation(errors)
}

function estimatedBase64Bytes(value) {
  const text = String(value || '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) return null
  const padding = text.endsWith('==') ? 2 : (text.endsWith('=') ? 1 : 0)
  return (text.length * 3) / 4 - padding
}

export function validateJustificationForm(form = {}) {
  const errors = {}
  if (!JUSTIFICATION_TYPES.has(form.justification_type)) {
    errors.justification_type = 'Selecciona un tipo de justificación.'
  }
  if (!requiredText(form.version)) errors.version = 'Recarga la falta antes de justificarla.'
  if (!requiredText(form.change_reason)) errors.change_reason = 'Escribe el motivo administrativo.'

  const hasAttachment = ['document_base64', 'document_name', 'document_mime']
    .some((field) => form[field] !== undefined && form[field] !== null && form[field] !== '')
  if (hasAttachment) {
    const bytes = estimatedBase64Bytes(form.document_base64)
    if (bytes === null || bytes <= 0 || bytes > MAX_ATTACHMENT_BYTES) {
      errors.document_base64 = 'Adjunta un archivo válido de hasta 5 MiB.'
    }
    if (!requiredText(form.document_name)) errors.document_name = 'Indica el nombre del comprobante.'
    if (!ATTACHMENT_MIMES.has(form.document_mime)) {
      errors.document_mime = 'El comprobante debe ser PDF, JPG o PNG.'
    }
  }
  return validation(errors)
}

export function getAttendanceStatusLabel(status) {
  return STATUS_LABELS[status] || 'Desconocido'
}

function normalizedSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .trim()
}

export function filterAttendanceRows(rows = [], filters = {}) {
  const search = normalizedSearch(filters.search)
  return rows.filter((row) => {
    if (filters.status && row?.status !== filters.status) return false
    if (filters.analytic_code && row?.employee?.analytic_code !== filters.analytic_code) return false
    if (!search) return true
    const employeeText = normalizedSearch([
      row?.employee?.number,
      row?.employee?.name,
      row?.employee?.job,
    ].filter(Boolean).join(' '))
    return employeeText.includes(search)
  })
}

export function getAttendanceActionEligibility(row = {}) {
  const attendances = Array.isArray(row.attendances) ? row.attendances : []
  const absence = row.absence || null
  const hasAttendance = attendances.length > 0
  const hasOpen = attendances.some((attendance) => !attendance?.check_out)
  const hasAbsence = Boolean(absence)
  return {
    registerAttendance: !hasAttendance && !hasAbsence,
    addSegment: hasAttendance && !hasOpen && !hasAbsence,
    correctAttendance: hasAttendance && !hasAbsence,
    registerExit: hasOpen && !hasAbsence,
    registerAbsence: !hasAttendance && !hasAbsence,
    justifyAbsence: hasAbsence && absence.state === 'pendiente' && absence.justified !== true,
    viewHistory: hasAttendance || hasAbsence,
  }
}

export function serializeAttendanceFilters(filters = {}) {
  const result = {}
  for (const key of ['date_from', 'date_to', 'analytic_code', 'employee_id', 'status']) {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      result[key] = filters[key]
    }
  }
  return result
}

const ERROR_MESSAGES = {
  invalid_employee_token: 'Tu sesión venció. Inicia sesión nuevamente.',
  attendance_access_denied: 'No tienes acceso a la administración de asistencias.',
  analytic_scope_not_configured: 'Falta configurar IGU o IGU34 en Odoo. Recarga después de corregirlo.',
  employee_out_of_scope: 'El empleado cambió de cuenta. Recarga el listado.',
  attendance_overlap: 'El horario se traslapa con otra asistencia del empleado.',
  stale_record: 'El registro cambió. Recarga antes de volver a guardar.',
  invalid_datetime_range: 'Revisa las fechas y horas capturadas.',
  absence_already_exists: 'Ya existe una falta para ese empleado y fecha.',
  attendance_exists_for_date: 'No se puede registrar la falta porque ya existen tramos de asistencia.',
  unscheduled_absence_confirmation_required: 'El día no era programado. Confirma explícitamente la falta no programada.',
  invalid_attachment: 'Adjunta un PDF, JPG o PNG válido de hasta 5 MiB.',
}

export function getAttendanceErrorMessage(error = {}) {
  return ERROR_MESSAGES[error.code]
    || (requiredText(error.message) ? error.message : 'No fue posible completar la operación. Intenta nuevamente.')
}

export function needsReload(error = {}) {
  return new Set([
    'stale_record',
    'employee_out_of_scope',
    'analytic_scope_not_configured',
  ]).has(error.code)
}
