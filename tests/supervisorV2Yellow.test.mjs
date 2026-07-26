// Supervisor V2 · YELLOW — identidad canónica + nonce legacy + capabilities.editable.
// Ejercita lógica PURA real (buildSessionIdentity, ensureSessionScopeNonce,
// sessionScopeKey) + aserciones de cableado sobre el código fuente (App.jsx y
// sessionStore usan la identidad canónica; ScreenPronostico respeta
// capabilities.editable). No es solo scan: las funciones de identidad se ejecutan.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildSessionIdentity,
  ensureSessionScopeNonce,
  sessionScopeKey,
  sessionScopeFields,
} from '../src/modules/supervisor-ventas/v2/sessionScope.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── §3: buildSessionIdentity — forma canónica + aliases reales ───────────────
test('identity: forma canónica con todos los campos documentados', () => {
  const id = buildSessionIdentity({
    odoo_employee_session_id: 'sess-1', employee_id: 7,
    effective_branch_config_id: 10, warehouse_id: 3, company_id: 2, role: 'supervisor_ventas',
  })
  for (const k of ['sessionKey', 'employeeId', 'branchId', 'warehouseId', 'companyId', 'role', 'credentialVersion']) {
    assert.ok(k in id, `falta ${k}`)
  }
  assert.equal(id.employeeId, 7)
  assert.equal(id.branchId, 10)
  assert.equal(id.warehouseId, 3)
  assert.equal(id.companyId, 2)
  assert.equal(id.role, 'supervisor_ventas')
  // credentialVersion deriva de la huella no sensible (no del token).
  assert.equal(id.credentialVersion, 'sess-1')
  assert.ok(!id.sessionKey.includes('token'))
})

test('identity: branchId respeta precedencia effective → branch_config → branch → analytic', () => {
  assert.equal(buildSessionIdentity({ effective_branch_config_id: 10, branch_config_id: 20, branch_id: 30, analytic_account_id: 40 }).branchId, 10)
  assert.equal(buildSessionIdentity({ branch_config_id: 20, branch_id: 30, analytic_account_id: 40 }).branchId, 20)
  assert.equal(buildSessionIdentity({ branch_id: 30, analytic_account_id: 40 }).branchId, 30)
  assert.equal(buildSessionIdentity({ analytic_account_id: 40 }).branchId, 40)
})

test('identity: session_id aliases alimentan credentialVersion (magic-link/gf/legacy)', () => {
  assert.equal(buildSessionIdentity({ odoo_employee_session_id: 'a' }).credentialVersion, 'a')
  assert.equal(buildSessionIdentity({ gf_employee_session_id: 'b' }).credentialVersion, 'b')
  assert.equal(buildSessionIdentity({ session_id: 'c' }).credentialVersion, 'c')
  assert.equal(buildSessionIdentity({ gf_scope_nonce: 'd' }).credentialVersion, 'd')
})

// ── §4: multi-tab — la clave distingue cambios de identidad ──────────────────
test('multi-tab: misma persona, distinta sucursal ⇒ scopeKey distinto', () => {
  const a = buildSessionIdentity({ odoo_employee_session_id: 's', employee_id: 7, effective_branch_config_id: 10 }).sessionKey
  const b = buildSessionIdentity({ odoo_employee_session_id: 's', employee_id: 7, effective_branch_config_id: 11 }).sessionKey
  assert.notEqual(a, b)
})
test('multi-tab: cambio de session_id (re-login mismo empleado) ⇒ scopeKey distinto', () => {
  const a = buildSessionIdentity({ odoo_employee_session_id: 's1', employee_id: 7 }).sessionKey
  const b = buildSessionIdentity({ odoo_employee_session_id: 's2', employee_id: 7 }).sessionKey
  assert.notEqual(a, b)
})
test('multi-tab: identidad idéntica ⇒ misma scopeKey (estable, no falsos cambios)', () => {
  const s = { odoo_employee_session_id: 's', employee_id: 7, effective_branch_config_id: 10, warehouse_id: 3, company_id: 2, role: 'supervisor_ventas' }
  assert.equal(buildSessionIdentity({ ...s }).sessionKey, buildSessionIdentity({ ...s }).sessionKey)
})
test('multi-tab: warehouse/company/role también mueven la clave', () => {
  const base = { odoo_employee_session_id: 's', employee_id: 7, effective_branch_config_id: 10, warehouse_id: 3, company_id: 2, role: 'supervisor_ventas' }
  const k = buildSessionIdentity(base).sessionKey
  assert.notEqual(k, buildSessionIdentity({ ...base, warehouse_id: 99 }).sessionKey)
  assert.notEqual(k, buildSessionIdentity({ ...base, company_id: 99 }).sessionKey)
  assert.notEqual(k, buildSessionIdentity({ ...base, role: 'gerente_sucursal' }).sessionKey)
})

// ── §5: nonce legacy — no `emp<id>`/`anon` como identidad compartible ────────
test('nonce: sesión legacy (sin id/nonce, con empleado) recibe gf_scope_nonce', () => {
  const migrated = ensureSessionScopeNonce({ employee_id: 5 })
  assert.ok(migrated.gf_scope_nonce, 'se añadió nonce')
  assert.notEqual(migrated.gf_scope_nonce, '')
  // la huella ahora es el nonce, no `emp5`.
  assert.equal(buildSessionIdentity(migrated).credentialVersion, migrated.gf_scope_nonce)
  assert.notEqual(buildSessionIdentity(migrated).credentialVersion, 'emp5')
})
test('nonce: sesión con session_id NO se toca (misma referencia)', () => {
  const s = { employee_id: 5, odoo_employee_session_id: 'sess-1' }
  assert.equal(ensureSessionScopeNonce(s), s)
})
test('nonce: sesión sin empleado (no logueada) NO recibe nonce', () => {
  const s = {}
  assert.equal(ensureSessionScopeNonce(s), s)
})
test('nonce: dos migraciones legacy del MISMO empleado ⇒ scopeKeys distintos', () => {
  const a = ensureSessionScopeNonce({ employee_id: 5 })
  const b = ensureSessionScopeNonce({ employee_id: 5 })
  assert.notEqual(a.gf_scope_nonce, b.gf_scope_nonce, 'nonces únicos por sesión')
  assert.notEqual(buildSessionIdentity(a).sessionKey, buildSessionIdentity(b).sessionKey)
})

// ── §3: delegación (una sola fuente de identidad) ────────────────────────────
test('delegación: sessionScopeKey/Fields derivan de buildSessionIdentity', () => {
  const s = { odoo_employee_session_id: 's', employee_id: 7, effective_branch_config_id: 10, warehouse_id: 3, company_id: 2, role: 'supervisor_ventas' }
  const id = buildSessionIdentity(s)
  assert.equal(sessionScopeKey(s), id.sessionKey)
  const f = sessionScopeFields(s)
  assert.equal(f.employeeId, id.employeeId)
  assert.equal(f.effectiveBranchConfigId, id.branchId)
  assert.equal(f.warehouseId, id.warehouseId)
  assert.equal(f.companyId, id.companyId)
  assert.equal(f.role, id.role)
  assert.equal(f.tokenFingerprint, id.credentialVersion)
})

// ── §3/§4/§5: cableado — App y store usan la identidad canónica ──────────────
test('wiring: App.jsx usa buildSessionIdentity + ensureSessionScopeNonce', () => {
  const s = src('App.jsx')
  assert.ok(/import \{ buildSessionIdentity, ensureSessionScopeNonce \}/.test(s), 'importa la identidad canónica')
  assert.ok(/return buildSessionIdentity\(s\)\.sessionKey/.test(s), 'sessionIdentitySig delega en la canónica')
  // migración de nonce en init y en adopción multi-tab.
  assert.ok(/useState\(\(\) => withScopeNonce\(getStoredSession\(\)\)\)/.test(s), 'nonce en init')
  assert.ok(/setSession\(withScopeNonce\(normalizeSessionRoleContext\(stored\)\)\)/.test(s), 'nonce al adoptar')
})
test('wiring: sessionStore.js deriva el snapshot de la identidad canónica', () => {
  const s = src('lib/sessionStore.js')
  assert.ok(/import \{ buildSessionIdentity \}/.test(s))
  assert.ok(/buildSessionIdentity\(\)\.sessionKey/.test(s), 'recompute compara la sessionKey canónica')
  assert.ok(!/sessionScopeFields/.test(s), 'ya no recomputa campos por separado')
})

// ── §8/§11: ScreenPronostico respeta capabilities.editable ───────────────────
test('wiring: handleStartEdit bloquea edición si editable===false (sin request)', () => {
  const s = src('modules/supervisor-ventas/ScreenPronostico.jsx')
  assert.ok(/dto\.capabilities\.editable === false/.test(s), 'gate por capabilities.editable')
  // el gate PRECEDE a cualquier setEditingForecastId/updateForecastLines.
  const gateIdx = s.indexOf('dto.capabilities.editable === false')
  const openIdx = s.indexOf('setEditingForecastId(forecast.id)')
  assert.ok(gateIdx !== -1 && openIdx !== -1 && gateIdx < openIdx, 'el gate está antes de abrir la edición')
})
test('wiring: capabilities se cachean y la UI ofrece Solo lectura', () => {
  const s = src('modules/supervisor-ventas/ScreenPronostico.jsx')
  assert.ok(/forecastCapsCache/.test(s), 'cache de capabilities por forecast')
  assert.ok(/const knownReadOnly = !!\(caps && caps\.editable === false\)/.test(s))
  assert.ok(/Solo lectura/.test(s), 'indicador read-only en lugar del botón Editar')
  // en conflicto se re-chequea editable y se cierra la edición.
  assert.ok(/ya no es editable/.test(s), 'conflict re-check cierra edición si dejó de ser editable')
})
test('wiring: el DTO GET adapter no fabrica líneas ante error (ok:false)', () => {
  const s = src('lib/api.js')
  assert.ok(/pwa-supv\/forecast-get/.test(s))
  // ante error devuelve ok:false con code/message (no cae a demo/empty).
  assert.ok(/ok: false/.test(s) && /code/.test(s))
})
