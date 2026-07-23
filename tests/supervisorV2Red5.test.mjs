// Supervisor V2 · RED#5 — tests de comportamiento + cableado (Codex §17).
// Lógica PURA real (sessionScope: fingerprint por session_id, claves de caché) +
// aserciones de cableado sobre el código fuente (forecast sin éxito falso, cierres
// parciales en UI, sesión reactiva). No se limitan a scans de strings: la sección
// de sessionScope ejercita la implementación real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  sessionScopeKey, sessionScopeFields,
} from '../src/modules/supervisor-ventas/v2/sessionScope.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── §4/§6: fingerprint por session_id NO sensible; separa cachés ─────────────
test('sessionScope: fingerprint deriva de odoo_employee_session_id (no del token)', () => {
  const a = sessionScopeKey({ odoo_employee_session_id: 'sess-AAA', employee_id: 1, company_id: 34 })
  const b = sessionScopeKey({ odoo_employee_session_id: 'sess-BBB', employee_id: 1, company_id: 34 })
  assert.notEqual(a, b) // distinta sesión ⇒ distinta clave (aunque igual empleado)
  // NO usa longitud/sufijo del token: el token NO aparece en la clave.
  const withToken = sessionScopeKey({ odoo_employee_session_id: 'sess-AAA', odoo_employee_token: 'SECRET-TOKEN-123456', employee_id: 1 })
  assert.ok(!withToken.includes('SECRET'))
  assert.ok(!withToken.includes('123456'))
})
test('sessionScope: misma sesión ⇒ clave estable', () => {
  const s = { odoo_employee_session_id: 'sess-1', employee_id: 1, company_id: 34 }
  assert.equal(sessionScopeKey(s), sessionScopeKey(s))
})
test('sessionScope: cambio de sucursal/company/warehouse ⇒ clave distinta', () => {
  const base = { odoo_employee_session_id: 'sess-1', employee_id: 1, company_id: 34, warehouse_id: 89, branch_config_id: 29 }
  assert.notEqual(sessionScopeKey(base), sessionScopeKey({ ...base, branch_config_id: 30 }))
  assert.notEqual(sessionScopeKey(base), sessionScopeKey({ ...base, company_id: 35 }))
  assert.notEqual(sessionScopeKey(base), sessionScopeKey({ ...base, warehouse_id: 90 }))
})
test('sessionScopeFields: expone campos de scope SIN credenciales', () => {
  const f = sessionScopeFields({ odoo_employee_session_id: 'sess-1', odoo_employee_token: 'SECRET', employee_id: 7, company_id: 34, branch_config_id: 29, warehouse_id: 89 })
  assert.equal(f.employeeId, 7)
  assert.equal(f.effectiveBranchConfigId, 29)
  assert.equal(f.companyId, 34)
  assert.equal(f.warehouseId, 89)
  assert.equal(f.tokenFingerprint, 'sess-1')
  // No filtra el token completo.
  assert.ok(!JSON.stringify(f).includes('SECRET'))
})

// ── §5: sesión reactiva conectada al ciclo ───────────────────────────────────
test('wiring: sessionStore expone useSessionScope + notify + invalidación', () => {
  const s = src('lib/sessionStore.js')
  assert.ok(/useSyncExternalStore/.test(s), 'usa useSyncExternalStore')
  assert.ok(/export function useSessionScope/.test(s))
  assert.ok(/notifySessionChanged/.test(s))
  assert.ok(/registerSessionScopedCache/.test(s) && /invalidateSessionScopedCaches/.test(s))
  assert.ok(/gf:session-expired/.test(s) && /storage/.test(s), 'escucha ciclo real (expired/storage)')
})
test('wiring: App.jsx emite gf:session-changed al cambiar la sesión', () => {
  const s = src('App.jsx')
  assert.ok(/dispatchEvent\(new Event\('gf:session-changed'\)\)/.test(s))
})
test('wiring: useOperationalDay depende del snapshot reactivo (no lectura imperativa)', () => {
  const s = src('modules/supervisor-ventas/v2/useOperationalDay.js')
  assert.ok(/useSessionScope/.test(s), 'usa el hook reactivo')
  assert.ok(/registerSessionScopedCache/.test(s), 'registra su invalidador')
  assert.ok(/scope\.scopeKey/.test(s), 'la clave de caché usa el snapshot')
  assert.ok(!/sessionScopeKey\(\)/.test(s), 'ya no lee sessionScopeKey() imperativo')
})

// ── §7/§8/§9/§10: forecast caller sin éxito falso ────────────────────────────
test('wiring: ScreenPronostico inspecciona el resultado (sin éxito falso)', () => {
  const s = src('modules/supervisor-ventas/ScreenPronostico.jsx')
  assert.ok(/result\.ok !== true/.test(s), 'no muestra éxito ante result.ok!=true')
  assert.ok(/expectedWriteDate: editingWriteDate/.test(s), 'envía expected_write_date del backend')
  assert.ok(/confirmReplaceAll: true/.test(s), 'confirma reemplazo total')
  assert.ok(/phase === 'conflict'/.test(s), 'en conflicto recarga')
})
test('wiring: updateForecastLines envía expected_write_date + confirmaciones', () => {
  const s = src('modules/supervisor-ventas/api.js')
  assert.ok(/expected_write_date: opts\.expectedWriteDate/.test(s))
  assert.ok(/confirm_replace_all: opts\.confirmReplaceAll/.test(s))
  assert.ok(/confirm_empty_replace: opts\.confirmEmptyReplace/.test(s))
})
test('wiring: forecasts adapter expone write_date; sin claim de idempotencia forecast', () => {
  const s = src('lib/api.js')
  assert.ok(/'line_ids', 'write_date'/.test(s), 'forecast read expone write_date')
  // §10: no se declara idempotencia para forecast/update_lines (frase en una línea).
  assert.ok(/NO se declara idempotencia/.test(s))
})

// ── §13: cierres parciales en la UI ──────────────────────────────────────────
test('wiring: HoyView representa parcialidad + sin dato (§13)', () => {
  const s = src('modules/supervisor-ventas/v2/hoy/HoyView.jsx')
  assert.ok(/Info\. parcial/.test(s), 'muestra "Info. parcial" cuando partial')
  assert.ok(/Sin dato/.test(s), 'muestra "Sin dato" cuando no available')
  assert.ok(/m\.partial === true/.test(s) && /m\.missing/.test(s), 'usa partial + missing del contrato')
})
