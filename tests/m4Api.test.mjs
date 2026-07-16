// KOLD OS · M4 — cliente API: rutas, estados de error, wiring directo, cero persistencia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  KOLD_OS_M4_LATEST_PATH, KOLD_OS_M4_FINDINGS_PATH, KOLD_OS_M4_RUNS_PATH,
  KOLD_OS_M4_FINDINGS_PARAMS, isKoldOsM4Path, filterKoldOsM4Params,
} from '../src/lib/koldOsM4Route.js'
import {
  fetchM4Latest, fetchM4Findings, fetchM4Runs, classifyM4Error, withTimeout,
  M4_MAX_PAYLOAD_CHARS,
} from '../src/modules/ventas/m4/m4Api.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const apiSrc = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
const moduleFiles = [
  '../src/modules/ventas/m4/m4Api.js', '../src/modules/ventas/m4/contract.js',
  '../src/modules/ventas/m4/exporters.js', '../src/modules/ventas/m4/filters.js',
  '../src/modules/ventas/m4/access.js', '../src/modules/ventas/ScreenVentasM4.jsx',
].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n')

const err = (status, code) => { const e = new Error(code || 'x'); e.status = status; if (code) e.code = code; return e }

test('rutas M4: paths exactos + allowlist sin PII + filtro fail-safe', () => {
  assert.equal(isKoldOsM4Path(KOLD_OS_M4_LATEST_PATH), true)
  assert.equal(isKoldOsM4Path(KOLD_OS_M4_FINDINGS_PATH), true)
  assert.equal(isKoldOsM4Path(KOLD_OS_M4_RUNS_PATH), true)
  assert.equal(isKoldOsM4Path('/pwa-kold-os/m4/otra'), false)
  assert.equal(isKoldOsM4Path('/pwa-kold-os/m2/latest'), false)
  for (const banned of ['employee_id', 'customer_name', 'phone', 'email', 'vat', 'rfc', 'address']) {
    assert.ok(!KOLD_OS_M4_FINDINGS_PARAMS.includes(banned), `${banned} JAMÁS en la allowlist`)
  }
  const filtered = filterKoldOsM4Params({ category: 'recurrencia', employee_id: '7', domain: 'x', page: 2 })
  assert.deepEqual(filtered, { category: 'recurrencia', page: 2 })
})

// Detector de deriva entre repos. La allowlist del frontend debe ser el espejo
// EXACTO de core.FINDINGS_FILTER_PARAMS (gf_kold_os_m4). Los dos modos de
// fallar son silenciosos y opuestos:
//   · parámetro de más → el backend lo mete en `rejected_params` y devuelve la
//     lista SIN filtrar: la UI muestra "Incumplimiento" y lista anomalías.
//   · parámetro de menos → se descarta antes de salir: el selector no hace nada.
// Ninguno lanza un error, por eso se fija aquí.
test('allowlist /findings: espejo exacto del backend gf_kold_os_m4 (PR #205)', () => {
  // Espejo literal de core.FINDINGS_FILTER_PARAMS. Del lado backend hay un test
  // gemelo (tests/test_kold_os_m4_filter_docs.py) que fija la misma lista contra
  // el código y contra los docs. Un test no puede cruzar repos: por eso se fija
  // en los dos, y el PR body de cada uno declara el mismo contrato.
  const BACKEND_FINDINGS_FILTER_PARAMS = [
    'run_id',
    'category', 'rule_code', 'classification', 'verdict', 'severity',
    'lifecycle_status', 'responsible_area',
    'granularity', 'entity_type', 'date_from', 'date_to',
    'search', 'page', 'page_size',
  ]
  assert.equal(KOLD_OS_M4_FINDINGS_PARAMS.length, 15)
  assert.deepEqual(
    [...KOLD_OS_M4_FINDINGS_PARAMS].sort(),
    [...BACKEND_FINDINGS_FILTER_PARAMS].sort(),
    'la allowlist derivó del contrato del backend',
  )
  // El contrato epistémico DEBE poder filtrarse: es la razón de ser de M4.
  for (const key of ['verdict', 'classification', 'responsible_area']) {
    assert.ok(KOLD_OS_M4_FINDINGS_PARAMS.includes(key), `${key} debe llegar al backend`)
  }
  // Dimensiones que el contrato v1 NO tiene: pedirlas sería afirmar de más.
  // company_id/branch_id: capabilities las declara false ⇒ ningún hallazgo las
  // porta ⇒ filtrar por ellas daría vacío siempre (peor que no ofrecerlas).
  for (const banned of ['route_id', 'plan_id', 'vehicle_id', 'stop_id',
    'channel', 'customer_segment', 'product_id', 'company_id', 'branch_id']) {
    assert.ok(!KOLD_OS_M4_FINDINGS_PARAMS.includes(banned), `${banned} no existe en el contrato v1`)
  }
})

// Los tres que el backend rechaza: si se colaran, el backend los mandaría a
// `rejected_params` y devolvería la lista SIN filtrar bajo un filtro aplicado.
test('channel / customer_segment / product_id JAMÁS se envían', () => {
  const sent = filterKoldOsM4Params({
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
test('los filtros de la pantalla sobreviven filterKoldOsM4Params', async () => {
  const { M4_DEFAULT_FILTERS } = await import('../src/modules/ventas/m4/filters.js')
  const sent = Object.fromEntries(Object.keys(M4_DEFAULT_FILTERS).map((k) => [k, 'x']))
  const survived = filterKoldOsM4Params(sent)
  for (const key of Object.keys(M4_DEFAULT_FILTERS)) {
    assert.ok(key in survived, `el filtro ${key} de la UI se descarta antes de salir`)
  }
})

test('fetchM4Latest: envelope válido => ok con payload', async () => {
  const result = await fetchM4Latest({ apiImpl: async () => JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE)) })
  assert.equal(result.state, 'ok')
  assert.equal(result.payload.schema_version, 'kold.os.m4.api/1')
})

test('errores clasificados: 401/403/404/409/503/500/timeout', async () => {
  const cases = [
    [err(401), 'session_expired'], [err(403), 'forbidden'], [err(404), 'unavailable'],
    [err(409), 'schema_mismatch'], [err(503), 'disabled'], [err(500), 'error'],
  ]
  for (const [e, state] of cases) {
    const result = await fetchM4Latest({ apiImpl: async () => { throw e } })
    assert.equal(result.state, state, `status ${e.status}`)
  }
  const slow = await fetchM4Latest({ apiImpl: () => new Promise(() => {}), timeoutMs: 20 })
  assert.equal(slow.state, 'error')
  assert.ok(slow.errors.includes('timeout'))
})

test('schema futura => schema_mismatch; payload corrupto => invalid', async () => {
  const futura = await fetchM4Latest({ apiImpl: async () => ({ ...JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE)), schema_version: 'kold.os.m4.api/9' }) })
  assert.equal(futura.state, 'schema_mismatch')
  const corrupto = await fetchM4Latest({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m4.api/1' }) })
  assert.equal(corrupto.state, 'invalid')
})

test('payload gigante => error controlado (payload_too_large)', async () => {
  const huge = { ...JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE)), pad: 'x'.repeat(M4_MAX_PAYLOAD_CHARS) }
  const result = await fetchM4Latest({ apiImpl: async () => huge })
  assert.equal(result.state, 'error')
  assert.ok(result.errors.includes('payload_too_large'))
})

test('fetchM4Findings arma query SOLO con params del contrato', async () => {
  let seenPath = ''
  const page = { ok: true, schema_version: 'kold.os.m4.api/1', total: 0, page: 1, pages: 1, page_size: 10, items: [], rejected_params: [] }
  await fetchM4Findings(
    { category: 'recurrencia', verdict: 'riesgo', employee_id: '7', junk: 'x', page: 2, page_size: 10 },
    { apiImpl: async (_m, path) => { seenPath = path; return page } },
  )
  assert.ok(seenPath.startsWith(KOLD_OS_M4_FINDINGS_PATH + '?'))
  assert.ok(seenPath.includes('category=recurrencia') && seenPath.includes('verdict=riesgo'))
  assert.ok(!seenPath.includes('employee_id') && !seenPath.includes('junk'))
})

test('fetchM4Runs: forma mínima válida => ok; malformada => invalid', async () => {
  const ok = await fetchM4Runs({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m4.api/1', runs: [] }) })
  assert.equal(ok.state, 'ok')
  const bad = await fetchM4Runs({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m4.api/1' }) })
  assert.equal(bad.state, 'invalid')
})

test('classifyM4Error: mapa completo + withTimeout limpia el timer', async () => {
  assert.equal(classifyM4Error(err(503)).state, 'disabled')
  assert.equal(classifyM4Error({ code: 'feature_disabled' }).state, 'disabled')
  assert.equal(classifyM4Error({ code: 'no_session' }).state, 'session_expired')
  assert.equal(classifyM4Error({ code: 'timeout' }).state, 'error')
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7)
})

test('api.js: directKoldOsM4 registrado, GET-only 405, sin fallback n8n', () => {
  assert.match(apiSrc, /async function directKoldOsM4\(method, path\)/)
  assert.match(apiSrc, /isKoldOsM4Path\(cleanPath\)/)
  const block = apiSrc.slice(apiSrc.indexOf('async function directKoldOsM4'),
    apiSrc.indexOf('async function directKoldOsM4') + 700)
  assert.match(block, /method !== 'GET'/)
  assert.match(block, /405/)
  assert.match(block, /filterKoldOsM4Params\(query\)/)
  // registrado en directHandlers junto a M2 y M3, sin reemplazar ninguno.
  assert.match(apiSrc, /directKoldOsM2,\s*\n\s*directKoldOsM3,\s*\n\s*directKoldOsM4,/)
})

test('cero persistencia local: sin localStorage/IndexedDB/caches en el módulo M4', () => {
  for (const banned of ['localStorage', 'sessionStorage', 'indexedDB', 'caches.open']) {
    assert.ok(!moduleFiles.includes(banned), `${banned} prohibido en el módulo M4`)
  }
})

test('cero writes: el módulo M4 no emite verbos de escritura', () => {
  for (const banned of ["'POST'", "'PUT'", "'DELETE'", "'PATCH'", 'execute_kw', 'xmlrpc']) {
    assert.ok(!moduleFiles.includes(banned), `${banned} prohibido en el módulo M4`)
  }
})
