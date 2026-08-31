// ─── Tareas del Supervisor — contrato V2 canónico ────────────────────────────
// Endpoints: /gf/salesops/supervisor/v2/tasks/{list,create,update,complete}
// Autoridad: X-GF-Employee-Token (nunca company_id/employee_id/author del cliente).
//
// V2 OFF rollback (canonical shared capability):
// - Tareas es capacidad compartida independiente del shell flag Supervisor V2.
// - V2 OFF y V2 ON montan las mismas pantallas y el mismo contrato
//   `/gf/salesops/supervisor/v2/tasks/*` (no hay fallback localStorage / IS_STUB).
// - Rollback del shell NO debe romper lecturas: las rutas /equipo/tareas NO usan
//   V2ExcludedRoute; este servicio siempre habla V2.
// - Con `supervisor_writes` OFF el backend responde FEATURE_DISABLED: unwrap /
//   list/create DEBEN lanzar (UI muestra error, nunca lista vacía exitosa).
// ─────────────────────────────────────────────────────────────────────────────
import { api as defaultApi, ApiError } from '../../lib/api.js'

export const IS_STUB = false

/** @internal test-only — inject api mock; pass null to restore. */
let _api = defaultApi
export function setTasksTransportForTests(fn) {
  _api = typeof fn === 'function' ? fn : defaultApi
}

export const TASKS_V2 = Object.freeze({
  list: '/gf/salesops/supervisor/v2/tasks/list',
  create: '/gf/salesops/supervisor/v2/tasks/create',
  update: '/gf/salesops/supervisor/v2/tasks/update',
  complete: '/gf/salesops/supervisor/v2/tasks/complete',
})

export const TASK_STATES = {
  pending:     { label: 'Pendiente',  color: '#f59e0b' },
  in_progress: { label: 'En curso',   color: '#2B8FE0' },
  done:        { label: 'Completada', color: '#22c55e' },
  cancelled:   { label: 'Cancelada',  color: '#94a3b8' },
}

export const TASK_PRIORITIES = {
  low:    { label: 'Baja',  color: '#94a3b8' },
  medium: { label: 'Media', color: '#f59e0b' },
  high:   { label: 'Alta',  color: '#ef4444' },
}

function requestId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Envelope V2 → data o throw. Nunca inventa listas vacías exitosas. */
export function unwrapTasksEnvelope(raw, fallbackMessage = 'Tareas no disponibles') {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError(fallbackMessage, { status: 0, code: 'UNAVAILABLE' })
  }
  if (raw.status === 'ok' || raw.ok === true) {
    return raw.data && typeof raw.data === 'object' ? raw.data : {}
  }
  const code = String(raw.code || 'UNAVAILABLE').toUpperCase()
  const message = raw.user_message || raw.message || fallbackMessage
  throw new ApiError(message, { status: 0, code })
}

function normalizeTask(t) {
  if (!t) return t
  return {
    ...t,
    id: t.task_id ?? t.id,
    title: t.name ?? t.title ?? '',
    created_at: t.create_date ?? t.created_at ?? null,
  }
}

async function postTasks(path, data) {
  const raw = await _api('POST', path, {
    meta: { request_id: requestId('tasks') },
    data: data || {},
  })
  return unwrapTasksEnvelope(raw)
}

/** Lista tareas filtradas. Acepta assignee_id, state, priority. */
export async function listTasks(filter = {}) {
  const data = {}
  if (filter.assignee_id) data.assignee_id = Number(filter.assignee_id)
  if (filter.state) data.state = filter.state
  if (filter.priority) data.priority = filter.priority
  if (filter.limit) data.limit = Number(filter.limit)
  const payload = await postTasks(TASKS_V2.list, data)
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : null
  if (!tasks) {
    throw new ApiError('Respuesta de tareas inválida', { status: 0, code: 'UNAVAILABLE' })
  }
  return tasks.map(normalizeTask)
}

/** Crea una tarea. Requiere title, assignee_id. No envía company/author authority. */
export async function createTask({ title, assignee_id, description, priority = 'medium', due_date, partner_id }) {
  if (!title || !assignee_id) {
    throw new Error('Título y vendedor asignado son obligatorios')
  }
  const data = await postTasks(TASKS_V2.create, {
    title,
    assignee_id: Number(assignee_id),
    description: description || undefined,
    priority,
    due_date: due_date || undefined,
    partner_id: partner_id ? Number(partner_id) : undefined,
  })
  return normalizeTask(data)
}

/** Actualiza via { task_id, patch }. */
export async function updateTask(task_id, patch) {
  const data = await postTasks(TASKS_V2.update, {
    task_id: Number(task_id),
    patch: patch || {},
  })
  return normalizeTask(data)
}

/** Marca como completada conservando completion_notes. */
export async function completeTask(task_id, completion_notes = '') {
  const data = await postTasks(TASKS_V2.complete, {
    task_id: Number(task_id),
    completion_notes: String(completion_notes || '').trim(),
  })
  return normalizeTask(data)
}

/** Cancela una tarea (soft via update). */
export async function cancelTask(task_id) {
  return updateTask(task_id, { state: 'cancelled' })
}

export function isStubMode() {
  return IS_STUB
}
