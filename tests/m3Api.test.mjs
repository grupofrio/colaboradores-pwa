import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { fetchM3Latest, fetchM3Findings, fetchM3Runs, classifyM3Error, withTimeout, M3_MAX_PAYLOAD_CHARS } from '../src/modules/ejecucion/m3/m3Api.js'
import {
  KOLD_OS_M3_LATEST_PATH, KOLD_OS_M3_FINDINGS_PATH, KOLD_OS_M3_RUNS_PATH,
  KOLD_OS_M3_FINDINGS_PARAMS, filterKoldOsM3Params, isKoldOsM3Path,
} from '../src/lib/koldOsM3Route.js'
import { M3_API_LATEST_FIXTURE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'

const apiError = (status, code) => { const e = new Error(code); e.status = status; e.code = code; return e }
const okFindings = {
  ok: true, schema_version: 'kold.os.m3.api/1', run_id: 'r', total: 1, page: 1, pages: 1,
  page_size: 25, items: [], applied_scope: { level: 'global' }, applied_filters: {},
  rejected_params: [], read_only: true,
}

test('rutas M3: paths exactos y allowlist SIN employee_id (privacidad)', () => {
  assert.equal(KOLD_OS_M3_LATEST_PATH, '/pwa-kold-os/m3/latest')
  assert.equal(KOLD_OS_M3_FINDINGS_PATH, '/pwa-kold-os/m3/findings')
  assert.equal(KOLD_OS_M3_RUNS_PATH, '/pwa-kold-os/m3/runs')
  assert.ok(isKoldOsM3Path(KOLD_OS_M3_RUNS_PATH))
  assert.ok(!isKoldOsM3Path('/pwa-kold-os/m3/routes/5'), 'routes/<id> NO existe en v1')
  assert.ok(KOLD_OS_M3_FINDINGS_PARAMS.includes('granularity'))
  assert.ok(KOLD_OS_M3_FINDINGS_PARAMS.includes('branch_id'))
  assert.ok(!KOLD_OS_M3_FINDINGS_PARAMS.includes('employee_id'), 'employee_id NO autorizado')
  assert.deepEqual(
    filterKoldOsM3Params({ category: 'cierre', employee_id: '7', domain: 'x', branch_id: '29' }),
    { category: 'cierre', branch_id: '29' },
  )
})

test('fetchM3Latest: envelope válido => ok (números reales presentes)', async () => {
  const result = await fetchM3Latest({ apiImpl: async () => JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE)) })
  assert.equal(result.state, 'ok')
  assert.equal(result.payload.summary.definitive_incident_rule_count, 6)
  assert.equal(result.payload.kpis.plans_started_overdue_open, 171)
  assert.equal(result.payload.kpis.visit_compliance.value_pct, 58.78)
})

test('fetchM3Latest: 401/403/404/409/503/500/timeout => estados mapeados', async () => {
  assert.equal((await fetchM3Latest({ apiImpl: async () => { throw apiError(401, 'invalid_session') } })).state, 'session_expired')
  assert.equal((await fetchM3Latest({ apiImpl: async () => { throw apiError(403, 'forbidden') } })).state, 'forbidden')
  assert.equal((await fetchM3Latest({ apiImpl: async () => { throw apiError(404, 'no_run_available') } })).state, 'unavailable')
  assert.equal((await fetchM3Latest({ apiImpl: async () => { throw apiError(409, 'schema_mismatch') } })).state, 'schema_mismatch')
  assert.equal((await fetchM3Latest({ apiImpl: async () => { throw apiError(503, 'feature_disabled') } })).state, 'disabled')
  const server = await fetchM3Latest({ apiImpl: async () => { throw apiError(500, 'internal_error') } })
  assert.equal(server.state, 'error')
  assert.equal(server.retryable, true)
  const timeout = await fetchM3Latest({ apiImpl: () => new Promise(() => {}), timeoutMs: 20 })
  assert.equal(timeout.state, 'error')
  assert.deepEqual(timeout.errors, ['timeout'])
})

test('fetchM3Latest: schema futura => schema_mismatch · corrupto => invalid · gigante => límite', async () => {
  const future = { ...JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE)), schema_version: 'kold.os.m3.api/9' }
  assert.equal((await fetchM3Latest({ apiImpl: async () => future })).state, 'schema_mismatch')
  assert.equal((await fetchM3Latest({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m3.api/1' }) })).state, 'invalid')
  const huge = JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE))
  huge.padding = 'x'.repeat(M3_MAX_PAYLOAD_CHARS)
  const result = await fetchM3Latest({ apiImpl: async () => huge })
  assert.equal(result.state, 'error')
  assert.deepEqual(result.errors, ['payload_too_large'])
})

test('fetchM3Findings: solo params del contrato viajan; respuesta validada', async () => {
  let seenPath = ''
  const result = await fetchM3Findings(
    { category: 'cierre', branch_id: 29, page: 2, employee_id: 7, search: 'caja' },
    { apiImpl: async (_m, path) => { seenPath = path; return { ...okFindings } } },
  )
  assert.equal(result.state, 'ok')
  const query = new URLSearchParams(seenPath.split('?')[1])
  assert.equal(query.get('category'), 'cierre')
  assert.equal(query.get('branch_id'), '29')
  assert.equal(query.get('employee_id'), null, 'employee_id jamás viaja')
  assert.equal((await fetchM3Findings({}, { apiImpl: async () => ({ ok: true }) })).state, 'invalid')
})

test('fetchM3Runs: lista válida ok; malformada invalid; 404 unavailable', async () => {
  const ok = await fetchM3Runs({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m3.api/1', runs: [{ run_id: 'a' }] }) })
  assert.equal(ok.state, 'ok')
  assert.equal(ok.payload.runs.length, 1)
  assert.equal((await fetchM3Runs({ apiImpl: async () => ({ ok: true, runs: 'x' }) })).state, 'invalid')
  assert.equal((await fetchM3Runs({ apiImpl: async () => { throw apiError(404, 'no_run_available') } })).state, 'unavailable')
})

test('classifyM3Error + withTimeout: mapa completo y timer limpio', async () => {
  assert.equal(classifyM3Error(apiError(503, 'feature_disabled')).state, 'disabled')
  assert.equal(classifyM3Error({ code: 'no_session' }).state, 'session_expired')
  assert.equal(classifyM3Error({}).state, 'error')
  assert.equal(await withTimeout(Promise.resolve(7), 1000), 7)
  await assert.rejects(() => withTimeout(new Promise(() => {}), 10), (e) => e.code === 'timeout')
})

// ── api.js: handler directo canónico (text-scan del cableado real) ──────────
test('api.js: directKoldOsM3 registrado, GET-only, sin fallback n8n', () => {
  const src = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
  assert.match(src, /async function directKoldOsM3\(method, path\)/)
  assert.match(src, /directKoldOsM3,/)
  const block = src.slice(src.indexOf('async function directKoldOsM3'), src.indexOf('async function directKoldOsM3') + 800)
  assert.match(block, /isKoldOsM3Path\(cleanPath\)/)
  assert.match(block, /method !== 'GET'/)
  assert.match(block, /method_not_allowed/)
  assert.match(block, /odooHttp\('GET', cleanPath, filterKoldOsM3Params\(query\)\)/)
})

test('cero persistencia de evidencia en cliente y pantalla M3', () => {
  for (const rel of ['../src/modules/ejecucion/m3/m3Api.js', '../src/modules/ejecucion/ScreenEjecucionM3.jsx']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    assert.ok(!/localStorage|sessionStorage|indexedDB|caches\./i.test(src), `${rel} sin persistencia`)
  }
})
