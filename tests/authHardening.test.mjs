import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { isValidAuthenticatedSession } from '../src/lib/session.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const navSrc = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')

// ── /login: decisión por validación estricta, NO truthiness (Codex ronda 2) ──
// Comportamiento: replica EXACTAMENTE lo que evalúa la ruta /login usando la
// función real isValidAuthenticatedSession. Si algún día alguien vuelve a
// truthiness, estos casos (sesión truthy pero inválida) fallarían.
function loginRedirects(session) {
  return isValidAuthenticatedSession(session) ? '/' : 'login'
}

test('/login: sesión válida → home; inválida (aunque truthy) → login', () => {
  assert.equal(loginRedirects({ employee_id: 718, session_token: 't.t.t' }), '/')
  assert.equal(loginRedirects(null), 'login')
  assert.equal(loginRedirects({}), 'login')
  assert.equal(loginRedirects({ employee_id: 'abc', session_token: 't.t.t' }), 'login', 'employee_id no numérico')
  assert.equal(loginRedirects({ employee_id: 718, session_token: '' }), 'login', 'token vacío')
  assert.equal(loginRedirects({ employee_id: 718, session_token: 't.t.t', exp: 1 }), 'login', 'exp vencida')
  // truthy-pero-inválida: un objeto no vacío sin contrato válido
  assert.equal(loginRedirects({ foo: 'bar' }), 'login')
})

test('/login (estructural exacto): usa isValidAuthenticatedSession, no truthiness', () => {
  assert.ok(
    appSrc.includes('<Route path="/login" element={isValidAuthenticatedSession(session) ? <Navigate to="/" replace /> : <ScreenLogin />} />'),
    '/login debe gatear con isValidAuthenticatedSession',
  )
  // Guard de regresión: no vuelve el patrón de truthiness.
  assert.ok(!/session \? <Navigate/.test(appSrc), 'sin "session ? <Navigate" en ninguna ruta')
})

// ── getStoredSession: JSON corrupto se elimina de localStorage ───────────────
// getStoredSession no se exporta (App.jsx no es importable en node:test por sus
// deps React/router/lazy), así que se verifica de forma estructural EXACTA: el
// catch limpia gf_session y devuelve null, de forma defensiva.
test('getStoredSession: el catch elimina gf_session corrupto y no lanza', () => {
  const start = appSrc.indexOf('function getStoredSession')
  assert.ok(start !== -1, 'existe getStoredSession')
  const block = appSrc.slice(start, start + 900)
  // El catch limpia gf_session (defensivo) y devuelve null.
  assert.match(block, /\} catch \{[\s\S]*localStorage\.removeItem\('gf_session'\)[\s\S]*return null/, 'catch limpia gf_session y devuelve null')
  assert.match(block, /try \{ localStorage\.removeItem\('gf_session'\) \} catch \{/, 'removeItem defensivo (no propaga)')
  // No borra otras claves ni hace clear global.
  assert.ok(!/localStorage\.clear\(\)/.test(block), 'no usa clear() global')
})

// ── aria-current único en el menú "Más" (Codex ronda 2 MINOR) ────────────────
// Sin infraestructura DOM en la suite (node --test text-scan), se garantiza de
// forma estructural EXACTA que jamás coexisten dos aria-current="page":
//   · botón "Más": aria-current="page" SOLO con sheet cerrado (nav.moreActive && !moreOpen)
//   · item del dialog: aria-current="page" cuando active
// ⇒ cerrado: solo el botón; abierto: botón undefined + solo el item activo.
test('aria-current: botón "Más" solo cuando el sheet está cerrado', () => {
  assert.ok(
    navSrc.includes("aria-current={nav.moreActive && !moreOpen ? 'page' : undefined}"),
    'el botón Más quita aria-current al abrir el sheet',
  )
  // Regresión: no vuelve el aria-current permanente del botón.
  assert.ok(!/aria-current=\{nav\.moreActive \? 'true'/.test(navSrc), 'sin aria-current permanente en el botón')
  assert.ok(!/aria-current=\{nav\.moreActive \? 'page'/.test(navSrc), 'el botón no marca page sin considerar moreOpen')
})

test('aria-current: el item activo del dialog "Más" lo lleva', () => {
  // Dentro del MoreSheet, cada item usa aria-current={active ? 'page' : undefined}.
  const sheetStart = navSrc.indexOf('function MoreSheet')
  const sheetEnd = navSrc.indexOf('function DesktopRail')
  const sheet = navSrc.slice(sheetStart, sheetEnd)
  assert.match(sheet, /aria-current=\{active \? 'page' : undefined\}/, 'item activo con aria-current page')
})

test('aria-current: nunca hay dos "page" — el botón depende de !moreOpen', () => {
  // Con sheet abierto (moreOpen=true), la expresión del botón => undefined,
  // así el único page del DOM es el item del dialog. Verificamos que la
  // condición del botón incluye !moreOpen (excluyente con el dialog abierto).
  const btnCond = navSrc.match(/aria-current=\{nav\.moreActive && !moreOpen \? 'page' : undefined\}/)
  assert.ok(btnCond, 'la condición del botón excluye el estado abierto')
})
