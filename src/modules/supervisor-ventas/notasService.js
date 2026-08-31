// ─── Notas de Coaching — contrato V2 canónico ────────────────────────────────
// Endpoints: /gf/salesops/supervisor/v2/notes/{list,create,delete}
// Autoridad: X-GF-Employee-Token. No enviar author_id/company_id como autoridad.
// subject_type=vendor → employee_id; subject_type=customer → partner_id (backend).
// ─────────────────────────────────────────────────────────────────────────────
import { api, ApiError } from '../../lib/api.js'

export const IS_STUB = false

export const NOTES_V2 = Object.freeze({
  list: '/gf/salesops/supervisor/v2/notes/list',
  create: '/gf/salesops/supervisor/v2/notes/create',
  delete: '/gf/salesops/supervisor/v2/notes/delete',
})

function requestId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Envelope V2 → data o throw. Error/unavailable ≠ lista vacía exitosa. */
export function unwrapNotesEnvelope(raw, fallbackMessage = 'Notas no disponibles') {
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

function normalizeNote(n) {
  if (!n) return n
  const body = n.body ?? n.content ?? ''
  return {
    ...n,
    id: n.note_id ?? n.id,
    created_at: n.create_date ?? n.created_at ?? null,
    body,
    content: body,
  }
}

async function postNotes(path, data) {
  const raw = await api('POST', path, {
    meta: { request_id: requestId('notes') },
    data: data || {},
  })
  return unwrapNotesEnvelope(raw)
}

/** Lista notas de un sujeto (vendor/customer). */
export async function listNotes({ subject_type, subject_id }) {
  if (!subject_type || !subject_id) {
    throw new Error('subject_type y subject_id son requeridos')
  }
  const payload = await postNotes(NOTES_V2.list, {
    subject_type,
    subject_id: Number(subject_id),
  })
  const notes = Array.isArray(payload.notes) ? payload.notes : null
  if (!notes) {
    throw new ApiError('Respuesta de notas inválida', { status: 0, code: 'UNAVAILABLE' })
  }
  return notes.map(normalizeNote)
}

/**
 * Crea una nota de coaching.
 * No envía author_id/company_id: el backend los deriva del token.
 */
export async function createNote({ subject_type, subject_id, body }) {
  if (!body || !body.trim()) throw new Error('El contenido de la nota es obligatorio')
  if (!subject_type || !subject_id) throw new Error('subject_type y subject_id son requeridos')

  const data = await postNotes(NOTES_V2.create, {
    body: body.trim(),
    subject_type,
    subject_id: Number(subject_id),
  })
  return normalizeNote(data)
}

/** Soft-delete (active=False) vía V2. */
export async function deleteNote(note_id) {
  const data = await postNotes(NOTES_V2.delete, {
    note_id: Number(note_id),
  })
  return data || { note_id: Number(note_id) }
}

export function isStubMode() {
  return IS_STUB
}
