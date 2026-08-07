import test from 'node:test'
import assert from 'node:assert/strict'

import { isValidAuthenticatedSession } from '../src/lib/session.js'
import { getNavModules, buildMobileNav, buildDesktopNav } from '../src/lib/navModel.js'

// Sesión mínima VÁLIDA según el contrato real de login
// (ScreenLogin.buildSessionFromOdoo: employee_id + session_token [+ exp]).
const VALID = { employee_id: 718, session_token: 'aaa.bbb.ccc', role: 'supervisor_ventas' }
const futureExp = Math.floor(Date.now() / 1000) + 3600
const pastExp = Math.floor(Date.now() / 1000) - 3600

// ── isValidAuthenticatedSession: matriz fail-closed (Codex BLOCKER 1) ────────
test('sesión null/undefined/no-objeto → NO autenticado', () => {
  assert.equal(isValidAuthenticatedSession(null), false)
  assert.equal(isValidAuthenticatedSession(undefined), false)
  assert.equal(isValidAuthenticatedSession('str'), false)
  assert.equal(isValidAuthenticatedSession(42), false)
  assert.equal(isValidAuthenticatedSession([]), false)
})

test('sesión {} (vacía) → NO autenticado', () => {
  assert.equal(isValidAuthenticatedSession({}), false)
})

// ── employee_id: SOLO entero positivo seguro (Codex ronda 2 BLOCKER) ─────────
const withId = (employee_id) => ({ employee_id, session_token: 'x.y.z' })

test('employee_id VÁLIDO: entero positivo (number o string decimal puro)', () => {
  for (const id of [1, 5, 718, '1', '5', '718']) {
    assert.equal(isValidAuthenticatedSession(withId(id)), true, `válido: ${JSON.stringify(id)}`)
  }
})

test('employee_id INVÁLIDO: string no numérico / decimal / negativo / cero / vacío', () => {
  for (const id of ['abc', '5abc', '1.5', '-1', '0', '', ' ', '  ', '01', '+5', ' 5x', '5.0', '0x10']) {
    assert.equal(isValidAuthenticatedSession(withId(id)), false, `inválido string: ${JSON.stringify(id)}`)
  }
})

test('employee_id: string con espacios alrededor se recorta (trim) y vale si es entero puro', () => {
  // La spec pide trim: " 5 " → "5" → válido; " 5x" → "5x" → inválido.
  assert.equal(isValidAuthenticatedSession(withId(' 5 ')), true)
  assert.equal(isValidAuthenticatedSession(withId('718 ')), true)
})

test('employee_id INVÁLIDO: number no entero / no positivo / no finito / fuera de rango', () => {
  for (const id of [0, -1, -3, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isValidAuthenticatedSession(withId(id)), false, `inválido number: ${String(id)}`)
  }
})

test('employee_id INVÁLIDO: ausente / tipo no numérico', () => {
  assert.equal(isValidAuthenticatedSession({ session_token: 'x.y.z' }), false)
  for (const id of [null, undefined, [], {}, true, false]) {
    assert.equal(isValidAuthenticatedSession(withId(id)), false, `inválido tipo: ${JSON.stringify(id)}`)
  }
})

test('employee_id VÁLIDO en el límite: MAX_SAFE_INTEGER exacto', () => {
  assert.equal(isValidAuthenticatedSession(withId(Number.MAX_SAFE_INTEGER)), true)
  assert.equal(isValidAuthenticatedSession(withId(String(Number.MAX_SAFE_INTEGER))), true)
})

test('session_token ausente/vacío/no-string → NO autenticado', () => {
  assert.equal(isValidAuthenticatedSession({ employee_id: 718 }), false)
  assert.equal(isValidAuthenticatedSession({ employee_id: 718, session_token: '' }), false)
  assert.equal(isValidAuthenticatedSession({ employee_id: 718, session_token: '   ' }), false)
  assert.equal(isValidAuthenticatedSession({ employee_id: 718, session_token: 12345 }), false)
  assert.equal(isValidAuthenticatedSession({ employee_id: 718, session_token: null }), false)
})

test('exp vencido o no numérico → NO autenticado; exp futuro → sí', () => {
  assert.equal(isValidAuthenticatedSession({ ...VALID, exp: pastExp }), false)
  assert.equal(isValidAuthenticatedSession({ ...VALID, exp: 'corrupto' }), false)
  assert.equal(isValidAuthenticatedSession({ ...VALID, exp: futureExp }), true)
})

test('marcada expired/inactive → NO autenticado', () => {
  assert.equal(isValidAuthenticatedSession({ ...VALID, expired: true }), false)
  assert.equal(isValidAuthenticatedSession({ ...VALID, inactive: true }), false)
})

test('sesión válida básica (con o sin rol) → SÍ autenticado', () => {
  assert.equal(isValidAuthenticatedSession(VALID), true)
  // Sin rol ≠ sin sesión: empleado sin x_job_key sigue autenticado.
  assert.equal(isValidAuthenticatedSession({ employee_id: 5, session_token: 't.t.t', role: '' }), true)
  assert.equal(isValidAuthenticatedSession({ employee_id: '5', session_token: 't.t.t' }), true)
})

// ── navModel fail-closed: sin sesión válida NO hay navegación ────────────────
test('getNavModules(null) / ({}) / inválidas → [] (cero nav, cero universales)', () => {
  assert.deepEqual(getNavModules(null), [])
  assert.deepEqual(getNavModules(undefined), [])
  assert.deepEqual(getNavModules({}), [])
  assert.deepEqual(getNavModules({ employee_id: 718 }), []) // sin token
  assert.deepEqual(getNavModules({ ...VALID, exp: pastExp }), []) // expirada
})

test('buildMobileNav/buildDesktopNav con sesión inválida: cero módulos', () => {
  const m = buildMobileNav(null, '/')
  assert.equal(m.primary.length, 0)
  assert.equal(m.overflow.length, 0)
  assert.equal(m.hasMore, false)
  const d = buildDesktopNav({}, '/')
  assert.equal(d.modules.length, 0)
})

test('sesión válida sin roles especiales → SOLO universales (no gestión)', () => {
  const nav = getNavModules({ employee_id: 5, session_token: 't.t.t', role: '' }).map((m) => m.id)
  assert.ok(nav.includes('kpis') && nav.includes('encuestas') && nav.includes('logros'))
  assert.ok(!nav.includes('admin_sucursal') && !nav.includes('gerente') && !nav.includes('supervisor_ventas'))
})
