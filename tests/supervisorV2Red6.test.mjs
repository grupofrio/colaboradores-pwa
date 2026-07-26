// Supervisor V2 · RED#6 — comportamiento + cableado (Codex §17).
// Ejercita lógica PURA real (clasificación DATE_CONTEXT_UNAVAILABLE en ambos
// normalizadores; fingerprint fallback no vacío) + aserciones de cableado sobre el
// código fuente (expiración central por envelope UNAUTHORIZED, multi-tab por
// identidad completa, forecast DTO GET, conflict actualiza write_date, cierres
// accesibles). No se limita a scans: los normalizadores y sessionScope se ejecutan.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PHASE, normalizeSupervisorV2Response } from '../src/modules/supervisor-ventas/v2/normalizeResponse.js'
import { WRITE_PHASE, normalizeWriteResponse } from '../src/modules/supervisor-ventas/v2/normalizeWriteResponse.js'
import { sessionScopeKey } from '../src/modules/supervisor-ventas/v2/sessionScope.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── §14: DATE_CONTEXT_UNAVAILABLE clasificado (fase propia, no conflacionado) ─
test('read: DATE_CONTEXT_UNAVAILABLE ⇒ fase propia (no date_not_allowed/network/empty)', () => {
  const r = normalizeSupervisorV2Response({ status: 'error', code: 'DATE_CONTEXT_UNAVAILABLE' })
  assert.equal(r.phase, PHASE.DATE_CONTEXT_UNAVAILABLE)
  assert.notEqual(r.phase, PHASE.DATE_NOT_ALLOWED)
  assert.notEqual(r.phase, PHASE.NETWORK)
  assert.notEqual(r.phase, PHASE.EMPTY)
  assert.notEqual(r.phase, PHASE.MALFORMED)
})
test('read: DATE_NOT_ALLOWED sigue siendo distinto de DATE_CONTEXT_UNAVAILABLE', () => {
  assert.equal(normalizeSupervisorV2Response({ status: 'error', code: 'DATE_NOT_ALLOWED' }).phase, PHASE.DATE_NOT_ALLOWED)
})
test('write: DATE_CONTEXT_UNAVAILABLE ⇒ fase propia, no éxito (add_customer)', () => {
  const r = normalizeWriteResponse({ status: 'error', code: 'DATE_CONTEXT_UNAVAILABLE' })
  assert.equal(r.ok, false)
  assert.equal(r.phase, WRITE_PHASE.DATE_CONTEXT_UNAVAILABLE)
})

// ── §6: fingerprint fallback NO vacío ────────────────────────────────────────
test('sessionScope: prefiere session_id; luego nonce; nunca vacío', () => {
  // La HUELLA es el 2.º segmento de la clave (CACHE_VERSION:fingerprint:...).
  const fp = (k) => k.split(':')[1]
  // Sesión sin session_id ni empleado ⇒ huella NO vacía ('anon').
  assert.notEqual(fp(sessionScopeKey({})), '')
  assert.equal(fp(sessionScopeKey({})), 'anon')
  // Empleado sin session_id ⇒ 'emp<id>' (distingue empleados).
  const kEmpA = sessionScopeKey({ employee_id: 5 })
  const kEmpB = sessionScopeKey({ employee_id: 6 })
  assert.equal(fp(kEmpA), 'emp5')
  assert.notEqual(kEmpA, kEmpB)
  // Nonce separa re-logins del MISMO empleado (session_id ausente).
  const base = { employee_id: 5 }
  assert.notEqual(sessionScopeKey({ ...base, gf_scope_nonce: 'n1' }), sessionScopeKey({ ...base, gf_scope_nonce: 'n2' }))
  // session_id tiene prioridad sobre el nonce.
  const withBoth = sessionScopeKey({ employee_id: 5, odoo_employee_session_id: 'sess-1', gf_scope_nonce: 'n1' })
  assert.ok(withBoth.includes('sess-1'))
})

// ── §2/§4: expiración central por envelope UNAUTHORIZED ──────────────────────
test('wiring: api.js expira sesión ante envelope UNAUTHORIZED (central, idempotente)', () => {
  const s = src('lib/api.js')
  assert.ok(/function isUnauthorizedEnvelope/.test(s), 'detector estructural de UNAUTHORIZED')
  assert.ok(/expireSessionIfUnauthorizedEnvelope/.test(s), 'helper central de expiración')
  // odooJson (y odooHttp) invocan el detector antes de devolver el result.
  assert.ok((s.match(/expireSessionIfUnauthorizedEnvelope\(json/g) || []).length >= 2, 'odooJson + odooHttp lo llaman')
  // idempotente: guardia de una sola emisión.
  assert.ok(/_sessionExpireFired/.test(s))
  // no expira por códigos que NO son UNAUTHORIZED.
  assert.ok(/UNAUTHORIZED/.test(s) && !/FORBIDDEN.*expireSession/.test(s))
})
test('wiring: App.jsx compara IDENTIDAD completa multi-tab (no solo employee_id)', () => {
  const s = src('App.jsx')
  assert.ok(/function sessionIdentitySig/.test(s))
  assert.ok(/odoo_employee_session_id/.test(s) && /branch_config_id/.test(s) && /company_id/.test(s))
  assert.ok(/gf_scope_nonce/.test(s), 'genera nonce de scope en login (§6)')
})

// ── §7/§10/§11: forecast DTO GET + conflict ──────────────────────────────────
test('wiring: ScreenPronostico usa el DTO GET seguro, no forecast-lines ORM', () => {
  const s = src('modules/supervisor-ventas/ScreenPronostico.jsx')
  assert.ok(/getForecastDto/.test(s), 'usa el DTO GET seguro')
  assert.ok(!/getForecastLines/.test(s), 'ya no usa la lectura ORM de líneas')
  // §11: en conflict actualiza editingWriteDate (no solo recarga líneas).
  assert.ok(/setEditingWriteDate\(dto\.write_date/.test(s))
})
test('wiring: forecast DTO GET adapter existe (token-only server-side)', () => {
  const s = src('lib/api.js')
  assert.ok(/pwa-supv\/forecast-get/.test(s))
  assert.ok(/supervisor\/v2\/forecast\/get/.test(s))
})

// ── §15: cierres accesibles (no solo title) ──────────────────────────────────
test('wiring: HoyView expone parcialidad de forma accesible (no solo title)', () => {
  const s = src('modules/supervisor-ventas/v2/hoy/HoyView.jsx')
  assert.ok(/clip: 'rect\(0 0 0 0\)'/.test(s), 'span visually-hidden para lector de pantalla')
  assert.ok(/sin: /.test(s), 'etapas faltantes VISIBLES (no solo hover/title)')
})
