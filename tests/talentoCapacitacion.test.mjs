import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import {
  mergeCapacitacionAndMe,
  mapTalentError,
  isTalentAuthError,
} from '../src/modules/talento/talentoApi.js'

const screenSrc = await readFile(
  fileURLToPath(new URL('../src/modules/talento/ScreenMiCapacitacion.jsx', import.meta.url)),
  'utf8',
)

test('Mi capacitación no usa cap || me (no descarta /me)', () => {
  assert.equal(/cap\s*\|\|\s*me/.test(screenSrc), false)
  assert.match(screenSrc, /mergeCapacitacionAndMe/)
})

function fulfilled(value) {
  return { status: 'fulfilled', value }
}

function rejected(code) {
  const err = new Error(mapTalentError(code))
  err.code = code
  return { status: 'rejected', reason: err }
}

const PASSPORT = {
  pendientes: [{ enrollment_id: 1, name: 'Inducción chofer', progress_pct: 40, modules_pending: 2 }],
  completadas: [{ enrollment_id: 2, name: 'Seguridad', score: 90 }],
  certificaciones: [{ certificate_id: 3, name: 'Manejo', state: 'vigente', valid_until: '2027-01-01' }],
}

const ME = {
  ok: true,
  academy: 'on',
  labor_state: 'activo',
  first_day_state: 'asistio',
  operating: { released_to_operate: false, missing_count: 1, blockers: ['Falta academia'] },
  induction: [{ id: 9, name: 'Uniforme', state: 'pending', deadline: '2026-08-20' }],
  passport: { pendientes: [{ enrollment_id: 99, name: 'NO USAR ESTE' }] },
}

const { Component: View } = await loadJsxDefault(
  fileURLToPath(new URL('../src/modules/talento/ScreenMiCapacitacionView.jsx', import.meta.url)),
)
const html = (result) => renderToStaticMarkup(createElement(View, { result, onRetry() {} }))

test('ambas OK: passport + operating + induction', () => {
  const result = mergeCapacitacionAndMe(
    fulfilled({ ok: true, academy: 'on', passport: PASSPORT }),
    fulfilled(ME),
  )
  assert.equal(result.status, 'ready')
  assert.equal(result.data.passport, PASSPORT)
  assert.equal(result.data.operating, ME.operating)
  assert.equal(result.data.induction, ME.induction)
  assert.equal(result.data.passport.pendientes[0].name, 'Inducción chofer')
  const out = html(result)
  assert.match(out, /Inducción chofer/)
  assert.match(out, /Seguridad/)
  assert.match(out, /Manejo/)
  assert.match(out, /Falta academia/)
  assert.match(out, /Uniforme/)
  assert.doesNotMatch(out, /NO USAR ESTE/)
})

test('capacitación OK /me falla: passport sí, operating no inventado', () => {
  const result = mergeCapacitacionAndMe(
    fulfilled({ ok: true, academy: 'on', passport: PASSPORT }),
    rejected('network'),
  )
  assert.equal(result.status, 'ready')
  assert.equal(result.degraded.me, true)
  assert.equal(result.data.operating, undefined)
  assert.equal(result.data.induction, undefined)
  assert.equal(result.data.passport.pendientes[0].name, 'Inducción chofer')
  const out = html(result)
  assert.match(out, /Inducción chofer/)
  assert.match(out, /No se pudo cargar tu estado laboral/)
  assert.doesNotMatch(out, /Ya puedes operar/)
  assert.doesNotMatch(out, /Faltan/)
})

test('/me OK / capacitación falla: operating sí, passport no', () => {
  const result = mergeCapacitacionAndMe(
    rejected('internal_error'),
    fulfilled(ME),
  )
  assert.equal(result.status, 'ready')
  assert.equal(result.degraded.capacitacion, true)
  assert.equal(result.data.operating.missing_count, 1)
  assert.equal(result.data.passport, null)
  const out = html(result)
  assert.match(out, /Falta academia/)
  assert.match(out, /No se pudo cargar tu pasaporte de capacitación/)
  assert.doesNotMatch(out, /Inducción chofer/)
})

test('ambas 401: sesión expirada', () => {
  const result = mergeCapacitacionAndMe(
    rejected('invalid_employee_token'),
    rejected('no_session'),
  )
  assert.equal(result.status, 'expired')
  assert.equal(result.data, null)
  assert.equal(isTalentAuthError(result.errors.me), true)
  const out = html(result)
  assert.match(out, /sesión venció/i)
})

test('Academy OFF: empty state', () => {
  const result = mergeCapacitacionAndMe(
    fulfilled({ ok: true, academy: 'off', passport: null }),
    fulfilled({ ...ME, academy: 'off', operating: { released_to_operate: true, missing_count: 0, blockers: [] } }),
  )
  const out = html(result)
  assert.match(out, /Tu capacitación aún no está activa/)
})

test('Academy ON sin programas: empty de programas', () => {
  const result = mergeCapacitacionAndMe(
    fulfilled({
      ok: true,
      academy: 'on',
      passport: { pendientes: [], completadas: [], certificaciones: [] },
    }),
    fulfilled({ ...ME, operating: { released_to_operate: true, missing_count: 0, blockers: [] } }),
  )
  const out = html(result)
  assert.match(out, /Todavía no tienes programas de capacitación asignados/)
  assert.match(out, /Ya puedes operar/)
})

test('empleado NO liberado: blockers', () => {
  const result = mergeCapacitacionAndMe(
    fulfilled({ ok: true, academy: 'on', passport: PASSPORT }),
    fulfilled(ME),
  )
  const out = html(result)
  assert.match(out, /Faltan 1 cosas para liberarte/)
  assert.match(out, /Falta academia/)
})

test('empleado liberado: Ya puedes operar', () => {
  const result = mergeCapacitacionAndMe(
    fulfilled({ ok: true, academy: 'on', passport: PASSPORT }),
    fulfilled({
      ...ME,
      operating: { released_to_operate: true, missing_count: 0, blockers: [] },
    }),
  )
  const out = html(result)
  assert.match(out, /Ya puedes operar/)
})
