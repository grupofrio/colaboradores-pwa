import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { fetchM2Latest, fetchM2Findings, classifyM2Error, withTimeout, M2_MAX_PAYLOAD_CHARS } from '../src/modules/planeacion/m2/m2Api.js'
import { KOLD_OS_M2_LATEST_PATH, KOLD_OS_M2_FINDINGS_PATH, KOLD_OS_M2_FINDINGS_PARAMS, filterKoldOsM2Params, isKoldOsM2Path } from '../src/lib/koldOsM2Route.js'
import { M2_API_LATEST_FIXTURE } from '../src/modules/planeacion/m2/fixtures/apiLatestFixture.js'

const apiError = (status, code) => { const e = new Error(code); e.status = status; e.code = code; return e }
const okFindings = {
  ok: true, schema_version: 'kold.os.m2.api/1', run_id: 'r', total: 1, page: 1, pages: 1,
  page_size: 25, items: [], applied_scope: { level: 'global' }, applied_filters: {},
  rejected_params: [], read_only: true,
}

// ── Ruta canónica ────────────────────────────────────────────────────────────
test('rutas M2: paths exactos, allowlist de params y filtro fail-safe', () => {
  assert.equal(KOLD_OS_M2_LATEST_PATH, '/pwa-kold-os/m2/latest')
  assert.equal(KOLD_OS_M2_FINDINGS_PATH, '/pwa-kold-os/m2/findings')
  assert.ok(isKoldOsM2Path(KOLD_OS_M2_LATEST_PATH) && isKoldOsM2Path(KOLD_OS_M2_FINDINGS_PATH))
  assert.ok(!isKoldOsM2Path('/pwa-kold-os/m2/otro'))
  assert.deepEqual(
    filterKoldOsM2Params({ category: 'solver', evil: 'x', employee_id: '7', page: '2', empty: '' }),
    { category: 'solver', page: '2' },
    'params fuera del contrato jamás viajan',
  )
  assert.ok(KOLD_OS_M2_FINDINGS_PARAMS.includes('lifecycle_status'))
  assert.ok(!KOLD_OS_M2_FINDINGS_PARAMS.includes('employee_id'))
  assert.ok(!KOLD_OS_M2_FINDINGS_PARAMS.includes('domain'))
})

// ── Estados del cliente (B1): 401/403/404/409/5xx/timeout/contrato ──────────
test('fetchM2Latest: envelope válido => ok con payload', async () => {
  const result = await fetchM2Latest({ apiImpl: async () => JSON.parse(JSON.stringify(M2_API_LATEST_FIXTURE)) })
  assert.equal(result.state, 'ok')
  assert.equal(result.payload.summary.total_incidences, 39004)
})

test('fetchM2Latest: 401 => session_expired · 403 => forbidden · 404 => unavailable', async () => {
  assert.equal((await fetchM2Latest({ apiImpl: async () => { throw apiError(401, 'invalid_session') } })).state, 'session_expired')
  assert.equal((await fetchM2Latest({ apiImpl: async () => { throw apiError(403, 'forbidden') } })).state, 'forbidden')
  assert.equal((await fetchM2Latest({ apiImpl: async () => { throw apiError(404, 'no_run_available') } })).state, 'unavailable')
})

test('fetchM2Latest: 503 => disabled · 409 => schema_mismatch · 500 => error retryable', async () => {
  assert.equal((await fetchM2Latest({ apiImpl: async () => { throw apiError(503, 'feature_disabled') } })).state, 'disabled')
  assert.equal((await fetchM2Latest({ apiImpl: async () => { throw apiError(409, 'schema_mismatch') } })).state, 'schema_mismatch')
  const server = await fetchM2Latest({ apiImpl: async () => { throw apiError(500, 'internal_error') } })
  assert.equal(server.state, 'error')
  assert.equal(server.retryable, true)
})

test('fetchM2Latest: timeout duro => error con code timeout', async () => {
  const never = () => new Promise(() => {})
  const result = await fetchM2Latest({ apiImpl: never, timeoutMs: 20 })
  assert.equal(result.state, 'error')
  assert.deepEqual(result.errors, ['timeout'])
})

test('fetchM2Latest: schema futura => schema_mismatch · payload corrupto => invalid', async () => {
  const future = { ...JSON.parse(JSON.stringify(M2_API_LATEST_FIXTURE)), schema_version: 'kold.os.m2.api/9' }
  assert.equal((await fetchM2Latest({ apiImpl: async () => future })).state, 'schema_mismatch')
  assert.equal((await fetchM2Latest({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m2.api/1' }) })).state, 'invalid')
})

test('fetchM2Latest: payload gigante => error controlado (límite de tamaño)', async () => {
  const huge = JSON.parse(JSON.stringify(M2_API_LATEST_FIXTURE))
  huge.padding = 'x'.repeat(M2_MAX_PAYLOAD_CHARS)
  const result = await fetchM2Latest({ apiImpl: async () => huge })
  assert.equal(result.state, 'error')
  assert.deepEqual(result.errors, ['payload_too_large'])
})

test('fetchM2Findings: arma query solo con params del contrato y valida respuesta', async () => {
  let seenPath = ''
  const result = await fetchM2Findings(
    { category: 'solver', page: 2, page_size: 10, evil: 'x', search: 'carga' },
    { apiImpl: async (_method, path) => { seenPath = path; return { ...okFindings } } },
  )
  assert.equal(result.state, 'ok')
  const query = new URLSearchParams(seenPath.split('?')[1])
  assert.equal(query.get('category'), 'solver')
  assert.equal(query.get('page'), '2')
  assert.equal(query.get('search'), 'carga')
  assert.equal(query.get('evil'), null, 'param fuera del contrato no viaja')
})

test('fetchM2Findings: 404 run => unavailable · respuesta malformada => invalid', async () => {
  assert.equal((await fetchM2Findings({}, { apiImpl: async () => { throw apiError(404, 'run_not_found') } })).state, 'unavailable')
  assert.equal((await fetchM2Findings({}, { apiImpl: async () => ({ ok: true }) })).state, 'invalid')
})

test('classifyM2Error: mapa completo y explícito', () => {
  assert.equal(classifyM2Error(apiError(503, 'feature_disabled')).state, 'disabled')
  assert.equal(classifyM2Error(apiError(401, '')).state, 'session_expired')
  assert.equal(classifyM2Error({ code: 'no_session' }).state, 'session_expired')
  assert.equal(classifyM2Error(apiError(403, '')).state, 'forbidden')
  assert.equal(classifyM2Error(apiError(404, '')).state, 'unavailable')
  assert.equal(classifyM2Error(apiError(409, '')).state, 'schema_mismatch')
  assert.equal(classifyM2Error({ code: 'timeout' }).state, 'error')
  assert.equal(classifyM2Error({}).state, 'error')
})

test('withTimeout: resuelve antes del límite y limpia el timer', async () => {
  const value = await withTimeout(Promise.resolve(42), 1000)
  assert.equal(value, 42)
  await assert.rejects(() => withTimeout(new Promise(() => {}), 10), (e) => e.code === 'timeout')
})

// ── api.js: handler directo canónico (text-scan del cableado real) ──────────
test('api.js: directKoldOsM2 registrado, GET-only, sin fallback n8n', () => {
  const src = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
  assert.match(src, /async function directKoldOsM2\(method, path\)/)
  assert.match(src, /directKoldOsM2,/, 'registrado en directHandlers')
  const block = src.slice(src.indexOf('async function directKoldOsM2'), src.indexOf('async function directKoldOsM2') + 800)
  assert.match(block, /isKoldOsM2Path\(cleanPath\)/)
  assert.match(block, /method !== 'GET'/)
  assert.match(block, /method_not_allowed/)
  assert.match(block, /odooHttp\('GET', cleanPath, filterKoldOsM2Params\(query\)\)/)
})

// ── B1: cero persistencia de evidencia ───────────────────────────────────────
test('el cliente y la pantalla M2 no persisten evidencia (sin localStorage/IndexedDB/caches)', () => {
  for (const rel of ['../src/modules/planeacion/m2/m2Api.js', '../src/modules/planeacion/ScreenPlaneacionM2.jsx']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    assert.ok(!/localStorage|sessionStorage|indexedDB|caches\./i.test(src), `${rel} sin persistencia`)
  }
})
