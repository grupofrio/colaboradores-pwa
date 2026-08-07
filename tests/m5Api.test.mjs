// KOLD OS · M5 — cliente API: rutas, estados de error, wiring directo, cero persistencia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  KOLD_OS_M5_LATEST_PATH, KOLD_OS_M5_FINDINGS_PATH, KOLD_OS_M5_RUNS_PATH,
  KOLD_OS_M5_FINDINGS_PARAMS, isKoldOsM5Path, filterKoldOsM5Params,
} from '../src/lib/koldOsM5Route.js'
import {
  fetchM5Latest, fetchM5Findings, fetchM5Runs, classifyM5Error, withTimeout,
  M5_MAX_PAYLOAD_CHARS,
} from '../src/modules/inventario/m5/m5Api.js'
import { M5_API_LATEST_FIXTURE } from '../src/modules/inventario/m5/fixtures/apiLatestFixture.js'

const apiSrc = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
const moduleFiles = [
  '../src/modules/inventario/m5/m5Api.js', '../src/modules/inventario/m5/contract.js',
  '../src/modules/inventario/m5/exporters.js', '../src/modules/inventario/m5/filters.js',
  '../src/modules/inventario/m5/access.js', '../src/modules/inventario/ScreenInventarioM5.jsx',
].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n')

const err = (status, code) => { const e = new Error(code || 'x'); e.status = status; if (code) e.code = code; return e }

test('rutas M5: paths exactos + allowlist sin PII + filtro fail-safe', () => {
  assert.equal(isKoldOsM5Path(KOLD_OS_M5_LATEST_PATH), true)
  assert.equal(isKoldOsM5Path(KOLD_OS_M5_FINDINGS_PATH), true)
  assert.equal(isKoldOsM5Path(KOLD_OS_M5_RUNS_PATH), true)
  assert.equal(isKoldOsM5Path('/pwa-kold-os/m5/otra'), false)
  assert.equal(isKoldOsM5Path('/pwa-kold-os/m2/latest'), false)
  for (const banned of ['employee_id', 'customer_name', 'phone', 'email', 'vat', 'rfc', 'address']) {
    assert.ok(!KOLD_OS_M5_FINDINGS_PARAMS.includes(banned), `${banned} JAMÁS en la allowlist`)
  }
  const filtered = filterKoldOsM5Params({ category: 'mermas_diferencias', employee_id: '7', domain: 'x', page: 2 })
  assert.deepEqual(filtered, { category: 'mermas_diferencias', page: 2 })
})

// Detector de deriva entre repos. La allowlist del frontend debe ser el espejo
// EXACTO de core.FINDINGS_FILTER_PARAMS (gf_kold_os_m5). Los dos modos de
// fallar son silenciosos y opuestos:
//   · parámetro de más → el backend lo mete en `rejected_params` y devuelve la
//     lista SIN filtrar: la UI muestra "Incumplimiento" y lista anomalías.
//   · parámetro de menos → se descarta antes de salir: el selector no hace nada.
// Ninguno lanza un error, por eso se fija aquí.
test('allowlist /findings: espejo exacto del backend gf_kold_os_m5 (PR #208)', () => {
  // Espejo literal de core.FINDINGS_FILTER_PARAMS. Del lado backend hay un test
  // gemelo (tests/test_kold_os_m5_filter_docs.py) que fija la misma lista contra
  // el código y contra los docs. Un test no puede cruzar repos: por eso se fija
  // en los dos, y el PR body de cada uno declara el mismo contrato.
  const BACKEND_FINDINGS_FILTER_PARAMS = [
    'run_id',
    'category', 'rule_code', 'classification', 'verdict', 'severity',
    'lifecycle_status', 'responsible_area',
    'granularity', 'entity_type', 'date_from', 'date_to',
    'search', 'page', 'page_size',
  ]
  assert.equal(KOLD_OS_M5_FINDINGS_PARAMS.length, 15)
  assert.deepEqual(
    [...KOLD_OS_M5_FINDINGS_PARAMS].sort(),
    [...BACKEND_FINDINGS_FILTER_PARAMS].sort(),
    'la allowlist derivó del contrato del backend',
  )
  // El contrato epistémico DEBE poder filtrarse: es la razón de ser de M5.
  for (const key of ['verdict', 'classification', 'responsible_area']) {
    assert.ok(KOLD_OS_M5_FINDINGS_PARAMS.includes(key), `${key} debe llegar al backend`)
  }
  // Dimensiones que el contrato v1 NO tiene: pedirlas sería afirmar de más.
  // company_id/branch_id: capabilities las declara false ⇒ ningún hallazgo las
  // porta ⇒ filtrar por ellas daría vacío siempre (peor que no ofrecerlas).
  for (const banned of ['route_id', 'plan_id', 'vehicle_id', 'stop_id',
    'channel', 'customer_segment', 'product_id', 'company_id', 'branch_id']) {
    assert.ok(!KOLD_OS_M5_FINDINGS_PARAMS.includes(banned), `${banned} no existe en el contrato v1`)
  }
})

// Los tres que el backend rechaza: si se colaran, el backend los mandaría a
// `rejected_params` y devolvería la lista SIN filtrar bajo un filtro aplicado.
test('channel / customer_segment / product_id JAMÁS se envían', () => {
  const sent = filterKoldOsM5Params({
    channel: 'mayoreo', customer_segment: 'dormido', product_id: '42',
    company_id: '1', branch_id: '29', route_id: '7',
    verdict: 'riesgo', responsible_area: 'Comercial', classification: 'caveated',
  })
  assert.deepEqual(sent, {
    verdict: 'riesgo', responsible_area: 'Comercial', classification: 'caveated',
  }, 'solo viajan los filtros que el backend sabe aplicar')
})

// Todo filtro que la pantalla ofrece tiene que sobrevivir el viaje al backend.
// Un selector que se ve pero no viaja es peor que no tener el selector.
test('los filtros de la pantalla sobreviven filterKoldOsM5Params', async () => {
  const { M5_DEFAULT_FILTERS } = await import('../src/modules/inventario/m5/filters.js')
  const sent = Object.fromEntries(Object.keys(M5_DEFAULT_FILTERS).map((k) => [k, 'x']))
  const survived = filterKoldOsM5Params(sent)
  for (const key of Object.keys(M5_DEFAULT_FILTERS)) {
    assert.ok(key in survived, `el filtro ${key} de la UI se descarta antes de salir`)
  }
})

test('fetchM5Latest: envelope válido => ok con payload', async () => {
  const result = await fetchM5Latest({ apiImpl: async () => JSON.parse(JSON.stringify(M5_API_LATEST_FIXTURE)) })
  assert.equal(result.state, 'ok')
  assert.equal(result.payload.schema_version, 'kold.os.m5.api/1')
})

test('errores clasificados: 401/403/404/409/503/500/timeout', async () => {
  const cases = [
    [err(401), 'session_expired'], [err(403), 'forbidden'], [err(404), 'unavailable'],
    [err(409), 'schema_mismatch'], [err(503), 'disabled'], [err(500), 'error'],
  ]
  for (const [e, state] of cases) {
    const result = await fetchM5Latest({ apiImpl: async () => { throw e } })
    assert.equal(result.state, state, `status ${e.status}`)
  }
  const slow = await fetchM5Latest({ apiImpl: () => new Promise(() => {}), timeoutMs: 20 })
  assert.equal(slow.state, 'error')
  assert.ok(slow.errors.includes('timeout'))
})

test('schema futura => schema_mismatch; payload corrupto => invalid', async () => {
  const futura = await fetchM5Latest({ apiImpl: async () => ({ ...JSON.parse(JSON.stringify(M5_API_LATEST_FIXTURE)), schema_version: 'kold.os.m5.api/9' }) })
  assert.equal(futura.state, 'schema_mismatch')
  const corrupto = await fetchM5Latest({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m5.api/1' }) })
  assert.equal(corrupto.state, 'invalid')
})

test('payload gigante => error controlado (payload_too_large)', async () => {
  const huge = { ...JSON.parse(JSON.stringify(M5_API_LATEST_FIXTURE)), pad: 'x'.repeat(M5_MAX_PAYLOAD_CHARS) }
  const result = await fetchM5Latest({ apiImpl: async () => huge })
  assert.equal(result.state, 'error')
  assert.ok(result.errors.includes('payload_too_large'))
})

test('fetchM5Findings arma query SOLO con params del contrato', async () => {
  let seenPath = ''
  const page = { ok: true, schema_version: 'kold.os.m5.api/1', total: 0, page: 1, pages: 1, page_size: 10, items: [], rejected_params: [] }
  await fetchM5Findings(
    { category: 'mermas_diferencias', verdict: 'riesgo', employee_id: '7', junk: 'x', page: 2, page_size: 10 },
    { apiImpl: async (_m, path) => { seenPath = path; return page } },
  )
  assert.ok(seenPath.startsWith(KOLD_OS_M5_FINDINGS_PATH + '?'))
  assert.ok(seenPath.includes('category=mermas_diferencias') && seenPath.includes('verdict=riesgo'))
  assert.ok(!seenPath.includes('employee_id') && !seenPath.includes('junk'))
})

test('fetchM5Runs: forma mínima válida => ok; malformada => invalid', async () => {
  const ok = await fetchM5Runs({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m5.api/1', runs: [] }) })
  assert.equal(ok.state, 'ok')
  const bad = await fetchM5Runs({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m5.api/1' }) })
  assert.equal(bad.state, 'invalid')
})

test('classifyM5Error: mapa completo + withTimeout limpia el timer', async () => {
  assert.equal(classifyM5Error(err(503)).state, 'disabled')
  assert.equal(classifyM5Error({ code: 'feature_disabled' }).state, 'disabled')
  assert.equal(classifyM5Error({ code: 'no_session' }).state, 'session_expired')
  assert.equal(classifyM5Error({ code: 'timeout' }).state, 'error')
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7)
})

test('api.js: directKoldOsM5 registrado, GET-only 405, sin fallback n8n', () => {
  assert.match(apiSrc, /async function directKoldOsM5\(method, path\)/)
  assert.match(apiSrc, /isKoldOsM5Path\(cleanPath\)/)
  const block = apiSrc.slice(apiSrc.indexOf('async function directKoldOsM5'),
    apiSrc.indexOf('async function directKoldOsM5') + 700)
  assert.match(block, /method !== 'GET'/)
  assert.match(block, /405/)
  assert.match(block, /filterKoldOsM5Params\(query\)/)
  // registrado en directHandlers sin desplazar M2/M3/M4.
  assert.match(apiSrc, /directKoldOsM2,\s*\n\s*directKoldOsM3,\s*\n\s*directKoldOsM4,\s*\n\s*directKoldOsM5,/)
})

test('cero persistencia local: sin localStorage/IndexedDB/caches en el módulo M5', () => {
  for (const banned of ['localStorage', 'sessionStorage', 'indexedDB', 'caches.open']) {
    assert.ok(!moduleFiles.includes(banned), `${banned} prohibido en el módulo M5`)
  }
})

test('cero writes: el módulo M5 no emite verbos de escritura', () => {
  for (const banned of ["'POST'", "'PUT'", "'DELETE'", "'PATCH'", 'execute_kw', 'xmlrpc']) {
    assert.ok(!moduleFiles.includes(banned), `${banned} prohibido en el módulo M5`)
  }
})
