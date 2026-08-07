// KOLD OS · M7 — acceso (fail-closed), API GET-only, allowlist, run_id/scope_key.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readM7Access, M7_ALLOWED_JOB_KEYS } from '../src/modules/rentabilidad-costos/m7/access.js'
import {
  isKoldOsM7Path, filterKoldOsM7Params, KOLD_OS_M7_FINDINGS_PARAMS,
  KOLD_OS_M7_RUNS_PARAMS, KOLD_OS_M7_LATEST_PATH, KOLD_OS_M7_FINDINGS_PATH,
  KOLD_OS_M7_RUNS_PATH,
} from '../src/lib/koldOsM7Route.js'
import {
  classifyM7Error, fetchM7Latest, fetchM7Findings, fetchM7Runs,
} from '../src/modules/rentabilidad-costos/m7/m7Api.js'
import { M7_UNSUPPORTED_FILTERS } from '../src/modules/rentabilidad-costos/m7/filters.js'

// ── ACCESO ───────────────────────────────────────────────────────────────────
// Forma de sesión canónica (espeja m6Surface): { employee_id, session_token, role }.
const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })

test('sólo direccion_general obtiene acceso global', () => {
  const r = readM7Access(s('direccion_general'))
  assert.equal(r.level, 'global')
  assert.equal(r.reason, 'job_key_direccion_general')
})

test('roles NO autorizados: fail-closed', () => {
  for (const role of ['admin_plataforma', 'gerente_sucursal', 'operaciones',
    'finanzas', 'contador', 'comercial', 'cobranza', 'supervisor_ventas', 'chofer']) {
    assert.equal(readM7Access(s(role)).level, 'none', role)
  }
})

test('tower_status admin_plataforma NO abre M7 (backend sólo valida job key)', () => {
  const towerAdmin = s('supervisor_ventas', { employee: { tower_status: 'admin_plataforma' } })
  assert.equal(readM7Access(towerAdmin).level, 'none')
})

test('sesión inválida => none (fail-closed)', () => {
  for (const bad of [null, undefined, {}, { employee_id: 1 }, { session_token: '' },
    { employee_id: 100, session_token: '   ' }]) {
    assert.equal(readM7Access(bad).level, 'none')
  }
})

test('la única constante de acceso es direccion_general', () => {
  assert.deepEqual([...M7_ALLOWED_JOB_KEYS], ['direccion_general'])
})

// ── ROUTE / ALLOWLIST ────────────────────────────────────────────────────────
test('isKoldOsM7Path reconoce los 3 endpoints', () => {
  assert.ok(isKoldOsM7Path(KOLD_OS_M7_LATEST_PATH))
  assert.ok(isKoldOsM7Path(KOLD_OS_M7_FINDINGS_PATH))
  assert.ok(isKoldOsM7Path(KOLD_OS_M7_RUNS_PATH))
  assert.ok(!isKoldOsM7Path('/pwa-kold-os/m6/latest'))
})

test('filterKoldOsM7Params deja pasar SÓLO la allowlist', () => {
  const out = filterKoldOsM7Params(
    { verdict: 'riesgo', partner_id: '5', employee_id: '9', company_id: '1' },
    KOLD_OS_M7_FINDINGS_PATH)
  assert.equal(out.verdict, 'riesgo')
  assert.ok(!('partner_id' in out))
  assert.ok(!('employee_id' in out))
  assert.ok(!('company_id' in out))
})

test('runs usa su propia allowlist (subconjunto)', () => {
  const out = filterKoldOsM7Params({ run_id: 'r', verdict: 'riesgo' }, KOLD_OS_M7_RUNS_PATH)
  assert.equal(out.run_id, 'r')
  assert.ok(!('verdict' in out), 'verdict no es param de runs')
})

test('filtros NO soportados: ninguno en la allowlist', () => {
  assert.ok(M7_UNSUPPORTED_FILTERS.length >= 12)
  for (const { key, reason } of M7_UNSUPPORTED_FILTERS) {
    assert.ok(!KOLD_OS_M7_FINDINGS_PARAMS.includes(key), key)
    assert.ok(reason.length > 10, key)
  }
})

test('partner_id (PII) jamás filtrable', () => {
  assert.ok(!KOLD_OS_M7_FINDINGS_PARAMS.includes('partner_id'))
  assert.ok(M7_UNSUPPORTED_FILTERS.some((f) => f.key === 'partner_id'))
})

// ── clasificación de errores ─────────────────────────────────────────────────
test('404 => unavailable (estado esperado hoy)', () => {
  assert.equal(classifyM7Error({ status: 404 }).state, 'unavailable')
})
test('403 => forbidden; 401 => unauthorized; 422 => malformed_contract', () => {
  assert.equal(classifyM7Error({ status: 403 }).state, 'forbidden')
  assert.equal(classifyM7Error({ status: 401 }).state, 'unauthorized')
  assert.equal(classifyM7Error({ status: 422 }).state, 'malformed_contract')
})

// ── GET-only + run_id/scope_key viajan al backend ────────────────────────────
test('fetchM7Findings manda TODOS los filtros al backend (server-side)', async () => {
  let seen = null
  const apiImpl = async (method, path) => {
    assert.equal(method, 'GET')
    seen = path
    return { schema_version: 'kold.os.m7.api/1', items: [], total: 0, page: 1,
      pages: 1, page_size: 25, rejected_params: [] }
  }
  const r = await fetchM7Findings({ verdict: 'riesgo', run_id: 'abc', scope_key: 'sk' }, { apiImpl })
  assert.equal(r.state, 'ok')
  assert.match(seen, /verdict=riesgo/)
  assert.match(seen, /run_id=abc/)
  assert.match(seen, /scope_key=sk/)
})

test('fetchM7Runs pasa run_id al backend (selección real, no latest)', async () => {
  let seen = null
  const apiImpl = async (_m, path) => {
    seen = path
    return { schema_version: 'kold.os.m7.api/1', items: [], rejected_params: [] }
  }
  await fetchM7Runs({ run_id: 'xyz' }, { apiImpl })
  assert.match(seen, /run_id=xyz/)
})

test('fetchM7Latest mapea 404 a unavailable', async () => {
  const apiImpl = async () => { const e = new Error('nf'); e.status = 404; throw e }
  const r = await fetchM7Latest({ apiImpl })
  assert.equal(r.state, 'unavailable')
})
