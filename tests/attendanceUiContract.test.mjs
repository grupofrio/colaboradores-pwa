import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(import.meta.dirname, '..')
const moduleRoot = path.join(root, 'src/modules/asistencias')
const bundleDir = await mkdtemp(path.join(tmpdir(), 'attendance-ui-contract-'))

test.after(async () => {
  await rm(bundleDir, { force: true, recursive: true })
})

async function importJsx(relativePath) {
  const entry = path.join(moduleRoot, relativePath)
  const outfile = path.join(bundleDir, `${relativePath.replaceAll('/', '-')}.mjs`)
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    logLevel: 'silent',
  })
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}`)
}

async function source(relativePath) {
  return readFile(path.join(moduleRoot, relativePath), 'utf8')
}

test('attendance ui: screen checks capabilities before loading attendance rows', async () => {
  const screen = await source('ScreenAsistencias.jsx')
  assert.ok(screen.indexOf('getCapabilities(') < screen.indexOf('getAttendance('))
  assert.match(screen, /capabilities\.allowed/)
  assert.match(screen, /attendance_access_denied/)
  assert.match(screen, /requestSequenceRef/)
  assert.match(screen, /loading/)
  assert.match(screen, /refreshing/)
  assert.match(screen, /saving/)
  assert.match(screen, /exporting/)
})

test('attendance ui: summary keeps expected categories separate from incomplete diagnostics', async () => {
  const { buildAttendanceSummaryCards } = await importJsx('components/AttendanceSummary.jsx')
  assert.deepEqual(buildAttendanceSummaryCards({
    expected: 10,
    present: 7,
    unscheduled_present: 2,
    absent: 1,
    unscheduled_absent: 3,
    incomplete: 2,
    worked_hours: 77.5,
  }), [
    { key: 'expected', label: 'Jornadas esperadas', value: 10, detail: '' },
    { key: 'present', label: 'Presentes', value: 9, detail: '2 no programadas' },
    { key: 'absent', label: 'Faltas', value: 4, detail: '3 no programadas' },
    { key: 'incomplete', label: 'Incompletos', value: 2, detail: 'Diagnóstico; ya incluidos en presentes' },
    { key: 'hours', label: 'Horas trabajadas', value: '77.5 h', detail: '' },
  ])
})

test('attendance ui: desktop table and mobile cards expose every segment with stable keys', async () => {
  const { buildAttendanceRowViewModels } = await importJsx('components/AttendanceRows.jsx')
  const rows = buildAttendanceRowViewModels([{
    employee: { id: 12, number: 'IG-12', name: 'Ana', analytic_code: 'IGU' },
    date: '2026-07-27',
    attendances: [
      { id: 8, check_in: '2026-07-27T08:00:00-06:00', check_out: '2026-07-27T12:00:00-06:00' },
      { id: 9, check_in: '2026-07-27T13:00:00-06:00', check_out: null },
    ],
    absence: null,
    status: 'open',
  }])
  assert.equal(rows[0].key, '12:2026-07-27')
  assert.deepEqual(rows[0].segments.map((segment) => segment.key), [
    '12:2026-07-27:attendance:8',
    '12:2026-07-27:attendance:9',
  ])

  const componentSource = await source('components/AttendanceRows.jsx')
  assert.match(componentSource, /attendance-table/)
  assert.match(componentSource, /attendance-mobile-cards/)
  assert.match(componentSource, /Corregir horario/)
  assert.match(componentSource, /Registrar salida/)
})

test('attendance ui: mutation drafts retain employee date version and administrative reason', async () => {
  const attendance = await importJsx('components/AttendanceModal.jsx')
  const absence = await importJsx('components/AbsenceModal.jsx')
  const row = {
    employee: { id: 12, name: 'Ana' },
    date: '2026-07-27',
    expected_workday: false,
    absence: { id: 19, version: 'absence-v3' },
  }
  assert.deepEqual(attendance.buildAttendanceDraft({
    mode: 'correct',
    row,
    attendance: {
      id: 8,
      check_in: '2026-07-27T08:00:00-06:00',
      check_out: '2026-07-27T17:00:00-06:00',
      version: 'attendance-v2',
    },
  }), {
    employee_id: 12,
    date: '2026-07-27',
    check_in: '2026-07-27T08:00',
    check_out: '2026-07-27T17:00',
    version: 'attendance-v2',
    change_reason: '',
  })
  assert.deepEqual(absence.buildAbsenceDraft({ mode: 'justify', row }), {
    employee_id: 12,
    date: '2026-07-27',
    justification_type: '',
    notes: '',
    version: 'absence-v3',
    change_reason: '',
  })
})

test('attendance ui: unscheduled absence confirms explicitly and attachments fail before FileReader', async () => {
  const { validateAttachmentFile, readAttendanceAttachment } = await importJsx('components/AbsenceModal.jsx')
  assert.equal(validateAttachmentFile({
    name: 'comprobante.pdf',
    type: 'application/pdf',
    size: 5 * 1024 * 1024,
  }), '')
  assert.match(validateAttachmentFile({
    name: 'enorme.pdf',
    type: 'application/pdf',
    size: 5 * 1024 * 1024 + 1,
  }), /5 MiB/)

  let readersCreated = 0
  await assert.rejects(
    readAttendanceAttachment({
      name: 'enorme.pdf',
      type: 'application/pdf',
      size: 5 * 1024 * 1024 + 1,
    }, {
      readerFactory() {
        readersCreated += 1
        return {}
      },
    }),
    /5 MiB/,
  )
  assert.equal(readersCreated, 0)

  const modalSource = await source('components/AbsenceModal.jsx')
  assert.match(modalSource, /confirm_unscheduled/)
  assert.match(modalSource, /Falta no programada/)
})

test('attendance ui: save controls remain disabled while requests are pending', async () => {
  for (const relativePath of [
    'components/AttendanceModal.jsx',
    'components/AbsenceModal.jsx',
  ]) {
    const componentSource = await source(relativePath)
    assert.match(componentSource, /disabled=\{saving\}/, relativePath)
  }
  const screen = await source('ScreenAsistencias.jsx')
  assert.match(screen, /setSaving\(true\)/)
  assert.match(screen, /setSaving\(false\)/)
  assert.match(screen, /mutationInFlightRef\.current/)
  assert.match(screen, /toast\.success/)
})

test('attendance ui: modal and drawer dialogs trap keyboard focus', async () => {
  for (const relativePath of [
    'components/AttendanceModal.jsx',
    'components/AbsenceModal.jsx',
    'components/AuditDrawer.jsx',
  ]) {
    const componentSource = await source(relativePath)
    assert.match(componentSource, /event\.key === 'Tab'/, relativePath)
    assert.match(componentSource, /querySelectorAll/, relativePath)
  }
})

test('attendance ui: audit drawer sends model record ID and stable pagination', async () => {
  const { buildAuditRequest, nextAuditOffset } = await importJsx('components/AuditDrawer.jsx')
  assert.deepEqual(buildAuditRequest({
    model: 'hr.attendance',
    recordId: 8,
    limit: 25,
    offset: 50,
  }), {
    model: 'hr.attendance',
    recordId: 8,
    pagination: { limit: 25, offset: 50 },
  })
  assert.equal(nextAuditOffset({ offset: 50, limit: 25, total: 81 }, 1), 75)
  assert.equal(nextAuditOffset({ offset: 75, limit: 25, total: 81 }, 1), 75)
  assert.equal(nextAuditOffset({ offset: 50, limit: 25, total: 81 }, -1), 25)

  const drawerSource = await source('components/AuditDrawer.jsx')
  assert.match(drawerSource, /aria-modal="true"/)
  assert.doesNotMatch(drawerSource, /JSON\.stringify/)
  assert.match(drawerSource, /changed_at/)
})

test('attendance ui: filters expose date presets bounds scope search status and Excel', async () => {
  const filters = await source('components/AttendanceFilters.jsx')
  for (const contract of [
    'Día', 'Semana', 'Rango', 'date_from', 'date_to', 'Todas', 'IGU', 'IGU34',
    'Buscar empleado', 'Estado', 'Exportar Excel',
  ]) {
    assert.match(filters, new RegExp(contract), contract)
  }
  assert.match(filters, /type="date"/)
  assert.match(filters, /type="search"/)
})
