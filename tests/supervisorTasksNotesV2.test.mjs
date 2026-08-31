import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  TASKS_V2,
  unwrapTasksEnvelope,
  listTasks,
  createTask,
  updateTask,
  completeTask,
  setTasksTransportForTests,
  IS_STUB as TASKS_IS_STUB,
} from '../src/modules/supervisor-ventas/tareasService.js'
import {
  NOTES_V2,
  unwrapNotesEnvelope,
  listNotes,
  createNote,
  deleteNote,
  setNotesTransportForTests,
  IS_STUB as NOTES_IS_STUB,
} from '../src/modules/supervisor-ventas/notasService.js'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8')

const backendTaskDto = {
  task_id: 11,
  name: 'Visitar zona norte',
  description: 'Priorizar clientes fríos',
  state: 'pending',
  priority: 'high',
  due_date: '2026-09-01',
  assignee_id: 718,
  assignee_name: 'Sugey',
  assigned_by_id: 100,
  assigned_by_name: 'Supervisor',
  partner_id: null,
  partner_name: null,
  completion_notes: null,
  completed_at: null,
  create_date: '2026-08-30 10:00:00',
}

const FEATURE_DISABLED_ENV = Object.freeze({
  status: 'error',
  code: 'FEATURE_DISABLED',
  user_message: 'Escrituras de supervisor deshabilitadas',
})

test('tareasService apunta a endpoints V2 y no a /pwa-supv/tasks', () => {
  const s = src('modules/supervisor-ventas/tareasService.js')
  assert.match(s, /\/gf\/salesops\/supervisor\/v2\/tasks\/list/)
  assert.doesNotMatch(s, /\/pwa-supv\/tasks/)
  assert.equal(TASKS_V2.list, '/gf/salesops/supervisor/v2/tasks/list')
  assert.equal(TASKS_V2.complete, '/gf/salesops/supervisor/v2/tasks/complete')
  assert.equal(TASKS_IS_STUB, false)
})

test('notasService apunta a endpoints V2 y no envía author_id como autoridad', () => {
  const s = src('modules/supervisor-ventas/notasService.js')
  assert.match(s, /\/gf\/salesops\/supervisor\/v2\/notes\/list/)
  assert.doesNotMatch(s, /\/pwa-supv\/notes/)
  // Payload object keys only (comments may mention the forbidden fields).
  assert.doesNotMatch(s, /^\s*author_id\s*:/m)
  assert.doesNotMatch(s, /^\s*company_id\s*:/m)
  assert.equal(NOTES_V2.create, '/gf/salesops/supervisor/v2/notes/create')
  assert.equal(NOTES_IS_STUB, false)
})

test('Tareas renderiza DTO backend-shaped (normalize)', async () => {
  const data = unwrapTasksEnvelope({ status: 'ok', data: { count: 1, tasks: [backendTaskDto] } })
  assert.equal(data.count, 1)
  assert.equal(data.tasks[0].task_id, 11)
  assert.equal(data.tasks[0].name, 'Visitar zona norte')
  assert.equal(data.tasks[0].assignee_name, 'Sugey')
})

test('create/update/complete usan V2 paths (source contract)', () => {
  const s = src('modules/supervisor-ventas/tareasService.js')
  assert.match(s, /TASKS_V2\.create/)
  assert.match(s, /TASKS_V2\.update/)
  assert.match(s, /TASKS_V2\.complete/)
  assert.match(s, /patch: patch \|\| \{\}/)
  assert.match(s, /completion_notes/)
})

test('completion_notes se conserva en unwrap de complete', () => {
  const data = unwrapTasksEnvelope({
    status: 'ok',
    data: { ...backendTaskDto, state: 'done', completion_notes: 'listo en ruta', completed_at: '2026-08-31 12:00:00' },
  })
  assert.equal(data.completion_notes, 'listo en ruta')
  assert.equal(data.state, 'done')
})

test('Notas vendor/customer usan subject_type + subject_id (no employee authority keys)', () => {
  const s = src('modules/supervisor-ventas/notasService.js')
  assert.match(s, /subject_type/)
  assert.match(s, /subject_id: Number\(subject_id\)/)
  const note = unwrapNotesEnvelope({
    status: 'ok',
    data: {
      note_id: 9,
      body: 'Coach',
      subject_type: 'vendor',
      employee_id: 718,
      employee_name: 'Sugey',
      partner_id: null,
      partner_name: null,
      author_id: 100,
      author_name: 'Supervisor',
      create_date: '2026-08-31 09:00:00',
    },
  })
  assert.equal(note.employee_id, 718)
  assert.equal(note.subject_type, 'vendor')
})

test('Error/unavailable no se presenta como lista vacía exitosa', () => {
  assert.throws(
    () => unwrapTasksEnvelope({ status: 'error', code: 'UNAVAILABLE', user_message: 'No disponible' }),
    /No disponible/,
  )
  assert.throws(
    () => unwrapNotesEnvelope({ status: 'error', code: 'FEATURE_DISABLED', user_message: 'Apagado' }),
    /Apagado/,
  )
  const emptyTasks = unwrapTasksEnvelope({ status: 'ok', data: { count: 0 } })
  assert.equal(Array.isArray(emptyTasks.tasks), false)
  const emptyNotes = unwrapNotesEnvelope({ status: 'ok', data: { count: 0 } })
  assert.equal(Array.isArray(emptyNotes.notes), false)
})

test('FEATURE_DISABLED: unwrap Tasks/Notes lanza con code (no empty success)', () => {
  assert.throws(
    () => unwrapTasksEnvelope(FEATURE_DISABLED_ENV),
    (err) => err.code === 'FEATURE_DISABLED' && /deshabilitadas/i.test(err.message),
  )
  assert.throws(
    () => unwrapNotesEnvelope(FEATURE_DISABLED_ENV),
    (err) => err.code === 'FEATURE_DISABLED',
  )
})

test('FEATURE_DISABLED: listTasks/createTask lanzan vía transport mock', async () => {
  setTasksTransportForTests(async () => FEATURE_DISABLED_ENV)
  try {
    await assert.rejects(
      () => listTasks(),
      (err) => err.code === 'FEATURE_DISABLED' && /deshabilitadas/i.test(err.message),
    )
    await assert.rejects(
      () => createTask({ title: 'Visita norte zona', assignee_id: 718 }),
      (err) => err.code === 'FEATURE_DISABLED',
    )
  } finally {
    setTasksTransportForTests(null)
  }
})

test('FEATURE_DISABLED: listNotes/createNote lanzan vía transport mock', async () => {
  setNotesTransportForTests(async () => FEATURE_DISABLED_ENV)
  try {
    await assert.rejects(
      () => listNotes({ subject_type: 'vendor', subject_id: 718 }),
      (err) => err.code === 'FEATURE_DISABLED',
    )
    await assert.rejects(
      () => createNote({ subject_type: 'vendor', subject_id: 718, body: 'Coach note' }),
      (err) => err.code === 'FEATURE_DISABLED',
    )
  } finally {
    setNotesTransportForTests(null)
  }
})

test('listTasks ok path normaliza DTO vía transport mock', async () => {
  setTasksTransportForTests(async (method, path) => {
    assert.equal(method, 'POST')
    assert.equal(path, TASKS_V2.list)
    return { status: 'ok', data: { count: 1, tasks: [backendTaskDto] } }
  })
  try {
    const tasks = await listTasks()
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].id, 11)
    assert.equal(tasks[0].title, 'Visitar zona norte')
  } finally {
    setTasksTransportForTests(null)
  }
})

test('V2 shell independence: Tareas/Notas montan sin V2ExcludedRoute; servicios siempre V2', () => {
  const app = src('App.jsx')
  const tareas = src('modules/supervisor-ventas/tareasService.js')
  const notas = src('modules/supervisor-ventas/notasService.js')
  // Pure check: routes work regardless of isV2Active — no V2ExcludedRoute gate.
  assert.match(app, /path="\/equipo\/tareas"[^\n]*ModuleRoleRoute moduleId="supervisor_ventas"[^\n]*ScreenTareasSupervisor/)
  assert.match(app, /path="\/equipo\/notas"[^\n]*ModuleRoleRoute moduleId="supervisor_ventas"[^\n]*ScreenNotasCliente/)
  assert.doesNotMatch(app, /path="\/equipo\/tareas"[^\n]*V2ExcludedRoute/)
  assert.doesNotMatch(app, /path="\/equipo\/notas"[^\n]*V2ExcludedRoute/)
  assert.doesNotMatch(app, /path="\/equipo\/tareas"[^\n]*isV2Active/)
  assert.doesNotMatch(app, /path="\/equipo\/notas"[^\n]*isV2Active/)
  // Services always hit V2 contract (no IS_STUB localStorage branch).
  assert.match(tareas, /canonical shared capability|capacidad compartida/i)
  assert.match(notas, /canonical shared capability|capacidad compartida/i)
  assert.match(tareas, /FEATURE_DISABLED/)
  assert.match(notas, /FEATURE_DISABLED/)
  assert.equal(TASKS_IS_STUB, false)
  assert.equal(NOTES_IS_STUB, false)
})

test('App: /equipo/tareas y /equipo/notas sin V2ExcludedRoute; Nota rápida y Bajas sí', () => {
  const app = src('App.jsx')
  assert.match(app, /path="\/equipo\/tareas"[^\n]*ModuleRoleRoute moduleId="supervisor_ventas"[^\n]*ScreenTareasSupervisor/)
  assert.match(app, /path="\/equipo\/notas"[^\n]*ModuleRoleRoute moduleId="supervisor_ventas"[^\n]*ScreenNotasCliente/)
  assert.doesNotMatch(app, /path="\/equipo\/tareas"[^\n]*V2ExcludedRoute/)
  assert.doesNotMatch(app, /path="\/equipo\/notas"[^\n]*V2ExcludedRoute/)
  assert.match(app, /path="\/equipo\/nota-rapida"[^\n]*V2ExcludedRoute/)
  assert.match(app, /path="\/equipo\/bajas"[^\n]*V2ExcludedRoute/)
})

test('Más muestra Tareas/Notas tras migración; Bajas sigue excluido', async () => {
  const { Component: MasView, cleanup } = await loadJsxDefault(fileURLToPath(
    new URL('../src/modules/supervisor-ventas/v2/mas/MasView.jsx', import.meta.url),
  ))
  try {
    const html = renderToStaticMarkup(createElement(MasView, { onNavigate: () => {} }))
    assert.match(html, /data-route="\/equipo\/tareas"/)
    assert.match(html, /data-route="\/equipo\/notas"/)
    assert.match(html, />Coaching</)
    assert.doesNotMatch(html, /data-route="\/equipo\/bajas"/)
    assert.doesNotMatch(html, /data-route="\/equipo\/nota-rapida"/)
  } finally {
    await cleanup()
  }
})

test('ModuleRoleRoute sigue protegiendo tareas/notas (supervisor_ventas)', () => {
  const app = src('App.jsx')
  assert.match(app, /path="\/equipo\/tareas"[^\n]*moduleId="supervisor_ventas"/)
  assert.match(app, /path="\/equipo\/notas"[^\n]*moduleId="supervisor_ventas"/)
})

test('api.js cablea V2 tasks/notes paths en directSupervisorDayControl', () => {
  const api = src('lib/api.js')
  assert.match(api, /\/gf\/salesops\/supervisor\/v2\/tasks\/list/)
  assert.match(api, /\/gf\/salesops\/supervisor\/v2\/notes\/create/)
  assert.match(api, /SUPERVISOR_TASKS_NOTES_V2_PATHS/)
})

test('exports de servicio existen (smoke import)', () => {
  assert.equal(typeof listTasks, 'function')
  assert.equal(typeof createTask, 'function')
  assert.equal(typeof updateTask, 'function')
  assert.equal(typeof completeTask, 'function')
  assert.equal(typeof listNotes, 'function')
  assert.equal(typeof createNote, 'function')
  assert.equal(typeof deleteNote, 'function')
})
