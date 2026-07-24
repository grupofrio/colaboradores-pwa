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
import { canonicalizeM4Latest, validateM4Latest } from '../src/modules/ventas/m4/contract.js'
import {
  evidenceJson, executiveSummaryText, findingsToCsv, M4_CSV_COLUMNS,
} from '../src/modules/ventas/m4/exporters.js'
import { createLatestRequestGate } from '../src/lib/latestRequestGate.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const apiSrc = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
const moduleFiles = [
  '../src/modules/ventas/m4/m4Api.js', '../src/modules/ventas/m4/contract.js',
  '../src/modules/ventas/m4/exporters.js', '../src/modules/ventas/m4/filters.js',
  '../src/modules/ventas/m4/access.js', '../src/modules/ventas/ScreenVentasM4.jsx',
  '../src/lib/latestRequestGate.js',
].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n')

const err = (status, code) => { const e = new Error(code || 'x'); e.status = status; if (code) e.code = code; return e }

const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

const latestRequestHarness = () => {
  const gate = createLatestRequestGate()
  let state = { phase: 'idle' }
  return {
    read: () => state,
    run: async (pending) => {
      const requestId = gate.begin()
      if (gate.isLatest(requestId)) state = { phase: 'loading' }
      const result = await pending.promise
      if (!gate.isLatest(requestId)) return
      state = result.state === 'ok'
        ? { phase: 'ok', items: result.items }
        : { phase: 'error', error: result.state }
    },
  }
}

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
  const raw = JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE))
  const result = await fetchM4Latest({ apiImpl: async () => raw })
  assert.equal(result.state, 'ok')
  assert.equal(result.payload.schema_version, 'kold.os.m4.api/1')
  assert.notEqual(result.payload, raw, 'la UI recibe un envelope canónico, no el objeto crudo')
  assert.notEqual(result.payload.kpis, raw.kpis)
})

test('corrected: API -> canonical -> revalidate -> JSON/text/CSV permanece exportable', async () => {
  const raw = JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE))
  const previous = new Date(Date.parse(raw.run.started_at) - 60_000).toISOString()
  raw.history = {
    runs_count: 2,
    previous_finished_at: previous,
    latest_finished_at: raw.run.finished_at,
  }
  raw.corrected = [{
    finding_key: raw.findings[0].finding_id,
    rule_code: raw.findings[0].rule_code,
    lifecycle_status: 'corrected',
    first_seen_at: previous,
    last_seen_at: previous,
    occurrence_count: 1,
  }]

  const fetched = await fetchM4Latest({ apiImpl: async () => raw })
  assert.equal(fetched.state, 'ok', fetched.errors?.join('\n'))
  const canonical = fetched.payload
  assert.equal(canonical.corrected[0].corrected_at, raw.run.finished_at)
  assert.equal(validateM4Latest(canonical).ok, true, 'canonical debe revalidar')
  assert.deepEqual(canonicalizeM4Latest(canonical), canonical, 'canonical debe ser idempotente')

  const json = JSON.parse(evidenceJson(canonical))
  assert.notEqual(json.envelope, null)
  assert.deepEqual(json.envelope.corrected, canonical.corrected)
  assert.doesNotMatch(executiveSummaryText(canonical), /EXPORT BLOQUEADO/)
  const csv = findingsToCsv(canonical.findings, canonical.rule_results, canonical.run)
  assert.notEqual(csv.trim(), M4_CSV_COLUMNS.join(','))
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
  const run = M4_API_LATEST_FIXTURE.run
  const page = {
    ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
    total: 0, page: 1, pages: 1, page_size: 10, items: [],
    applied_scope: { level: 'global' },
    applied_filters: { run_id: run.run_id, category: 'recurrencia', verdict: 'riesgo' },
    rejected_params: [], read_only: true,
  }
  await fetchM4Findings(
    { category: 'recurrencia', verdict: 'riesgo', employee_id: '7', junk: 'x', page: 2, page_size: 10 },
    {
      apiImpl: async (_m, path) => { seenPath = path; return page },
      ruleResults: M4_API_LATEST_FIXTURE.rule_results,
      run,
    },
  )
  assert.ok(seenPath.startsWith(KOLD_OS_M4_FINDINGS_PATH + '?'))
  assert.ok(seenPath.includes('category=recurrencia') && seenPath.includes('verdict=riesgo'))
  assert.ok(seenPath.includes(`run_id=${run.run_id}`), 'cada página queda fijada al latest validado')
  assert.ok(!seenPath.includes('employee_id') && !seenPath.includes('junk'))
})

test('fetchM4Findings impone el run_id del latest y rechaza snapshot distinto', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  let seenPath = ''
  const response = {
    ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
    total: 0, page: 1, pages: 1, page_size: 25, items: [],
    applied_scope: { level: 'global' }, applied_filters: { run_id: run.run_id },
    rejected_params: [], read_only: true,
  }
  const current = await fetchM4Findings({ run_id: 'snapshot-viejo', page: 1 }, {
    apiImpl: async (_method, path) => { seenPath = path; return response },
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })
  assert.equal(current.state, 'ok')
  assert.ok(seenPath.includes(`run_id=${run.run_id}`))
  assert.ok(!seenPath.includes('snapshot-viejo'))

  const mixed = await fetchM4Findings({}, {
    apiImpl: async () => ({ ...response, run_id: 'otro-snapshot' }),
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })
  assert.equal(mixed.state, 'invalid')
  assert.equal('payload' in mixed, false)
})

test('fetchM4Findings falla cerrado y no entrega items con granularidad o PII inválidas', async () => {
  const item = JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE.findings[0]))
  item.granularity = 'customer'
  item.entity_id = 99
  item.entity_reference = 'cliente@example.com'
  const payload = {
    ok: true, schema_version: 'kold.os.m4.api/1',
    total: 1, page: 1, pages: 1, page_size: 25,
    items: [item], rejected_params: [],
  }
  const result = await fetchM4Findings({}, {
    apiImpl: async () => payload,
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run: M4_API_LATEST_FIXTURE.run,
  })
  assert.equal(result.state, 'invalid')
  assert.equal('payload' in result, false, 'un payload inválido nunca llega a la pantalla')
})

test('fetchM4Findings exige catálogo de /latest para cualquier item no vacío', async () => {
  const payload = {
    ok: true, schema_version: 'kold.os.m4.api/1', run_id: M4_API_LATEST_FIXTURE.run.run_id,
    total: 1, page: 1, pages: 1, page_size: 25,
    items: [JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE.findings[0]))],
    applied_scope: { level: 'global' },
    applied_filters: { run_id: M4_API_LATEST_FIXTURE.run.run_id },
    rejected_params: [], read_only: true,
  }
  const withoutCatalog = await fetchM4Findings({}, { apiImpl: async () => payload })
  assert.equal(withoutCatalog.state, 'invalid')
  const withCatalog = await fetchM4Findings({}, {
    apiImpl: async () => payload,
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run: M4_API_LATEST_FIXTURE.run,
  })
  assert.equal(withCatalog.state, 'ok', withCatalog.errors?.join('\n'))
})

test('/findings exige respuesta idéntica al contexto normalizado de la solicitud', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  const request = {
    page: 1, page_size: 10, verdict: ' riesgo ', classification: 'caveated', search: ' M4-A ',
  }
  const expectedFilters = {
    run_id: run.run_id, verdict: 'riesgo', classification: 'caveated', search: 'M4-A',
  }
  const base = {
    ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
    total: 0, page: 1, pages: 1, page_size: 10, items: [],
    applied_scope: { level: 'global' }, applied_filters: expectedFilters,
    rejected_params: [], read_only: true,
  }
  const invoke = (response) => fetchM4Findings(request, {
    apiImpl: async () => response,
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })

  assert.equal((await invoke(base)).state, 'ok')

  const mismatches = [
    ['page', { ...base, page: 2 }],
    ['page_size', { ...base, page_size: 25 }],
    ['run_id', { ...base, run_id: 'f'.repeat(64) }],
    ['filtro omitido', { ...base, applied_filters: { ...expectedFilters, verdict: undefined } }],
    ['filtro extra', { ...base, applied_filters: { ...expectedFilters, severity: 'high' } }],
    ['filtro distinto', { ...base, applied_filters: { ...expectedFilters, verdict: 'cumple' } }],
  ]
  for (const [label, response] of mismatches) {
    if (response.applied_filters?.verdict === undefined) delete response.applied_filters.verdict
    const result = await invoke(response)
    assert.equal(result.state, 'invalid', `aceptó ${label} que no fue solicitado`)
  }
})

test('/findings acepta cambios válidos de filtros y page_size conservando el snapshot', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  for (const scenario of [
    { params: { page: 1, page_size: 10, verdict: 'riesgo' }, total: 0, pages: 1, items: [] },
    {
      params: { page: 1, page_size: 50, classification: 'exploratory', responsible_area: 'Comercial' },
      total: 0, pages: 1, items: [],
    },
    {
      params: { page: 2, page_size: 1 }, total: 2, pages: 2,
      items: [JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE.findings[0]))],
    },
  ]) {
    const { params } = scenario
    const appliedFilters = { run_id: run.run_id }
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'page' && key !== 'page_size') appliedFilters[key] = value
    }
    const result = await fetchM4Findings(params, {
      apiImpl: async () => ({
        ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
        total: scenario.total, page: params.page, pages: scenario.pages,
        page_size: params.page_size, items: scenario.items,
        applied_scope: { level: 'global' }, applied_filters: appliedFilters,
        rejected_params: [], read_only: true,
      }),
      ruleResults: M4_API_LATEST_FIXTURE.rule_results,
      run,
    })
    assert.equal(result.state, 'ok', result.errors?.join('\n'))
  }
})

test('/findings acepta la página efectiva normalizada por Odoo y rechaza otra', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  const request = { page: 2, page_size: 25 }
  const base = {
    ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
    total: 0, page: 1, pages: 1, page_size: 25, items: [],
    applied_scope: { level: 'global' }, applied_filters: { run_id: run.run_id },
    rejected_params: [], read_only: true,
  }
  const invoke = (response) => fetchM4Findings(request, {
    apiImpl: async () => response,
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })

  const normalized = await invoke(base)
  assert.equal(normalized.state, 'ok', normalized.errors?.join('\n'))
  assert.equal(normalized.payload.page, 1)

  const incorrect = await invoke({ ...base, page: 2 })
  assert.equal(incorrect.state, 'invalid')
})

test('/findings acepta el page_size efectivo limitado por Odoo', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  const result = await fetchM4Findings({ page: 1, page_size: 9999 }, {
    apiImpl: async () => ({
      ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
      total: 0, page: 1, pages: 1, page_size: 100, items: [],
      applied_scope: { level: 'global' }, applied_filters: { run_id: run.run_id },
      rejected_params: [], read_only: true,
    }),
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })
  assert.equal(result.state, 'ok', result.errors?.join('\n'))
  assert.equal(result.payload.page_size, 100)
})

test('/findings replica los defaults de Odoo para página y tamaño no positivos', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  const result = await fetchM4Findings({ page: -4, page_size: 0 }, {
    apiImpl: async () => ({
      ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
      total: 0, page: 1, pages: 1, page_size: 25, items: [],
      applied_scope: { level: 'global' }, applied_filters: { run_id: run.run_id },
      rejected_params: [], read_only: true,
    }),
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })
  assert.equal(result.state, 'ok', result.errors?.join('\n'))
})

test('/findings rechaza enteros fuera del rango seguro antes de consultar Odoo', async () => {
  let calls = 0
  const result = await fetchM4Findings({ page: '9007199254740992' }, {
    apiImpl: async () => { calls += 1; return {} },
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run: M4_API_LATEST_FIXTURE.run,
  })
  assert.equal(result.state, 'invalid')
  assert.equal(calls, 0)
})

test('latest-request-wins: éxito viejo no sobrescribe error nuevo', async () => {
  const harness = latestRequestHarness()
  const older = deferred()
  const newer = deferred()
  const olderRun = harness.run(older)
  const newerRun = harness.run(newer)

  newer.resolve({ state: 'forbidden' })
  await newerRun
  assert.deepEqual(harness.read(), { phase: 'error', error: 'forbidden' })

  older.resolve({ state: 'ok', items: ['stale'] })
  await olderRun
  assert.deepEqual(harness.read(), { phase: 'error', error: 'forbidden' })
})

test('latest-request-wins: error viejo no sobrescribe datos nuevos', async () => {
  const harness = latestRequestHarness()
  const older = deferred()
  const newer = deferred()
  const olderRun = harness.run(older)
  const newerRun = harness.run(newer)

  newer.resolve({ state: 'ok', items: ['current'] })
  await newerRun
  assert.deepEqual(harness.read(), { phase: 'ok', items: ['current'] })

  older.resolve({ state: 'error' })
  await olderRun
  assert.deepEqual(harness.read(), { phase: 'ok', items: ['current'] })
})

test('latest-request-wins: éxito o error viejo no limpian loading de la nueva', async () => {
  for (const staleResult of [{ state: 'ok', items: ['stale'] }, { state: 'error' }]) {
    const harness = latestRequestHarness()
    const older = deferred()
    const newer = deferred()
    const olderRun = harness.run(older)
    const newerRun = harness.run(newer)

    older.resolve(staleResult)
    await olderRun
    assert.deepEqual(harness.read(), { phase: 'loading' })

    newer.resolve({ state: 'ok', items: ['current'] })
    await newerRun
    assert.deepEqual(harness.read(), { phase: 'ok', items: ['current'] })
  }
})

test('fetchM4Runs: contrato estricto => payload canónico; malformado => invalid', async () => {
  const source = {
    ok: true,
    schema_version: 'kold.os.m4.api/1',
    runs: [],
    applied_scope: { level: 'global' },
    read_only: true,
  }
  const ok = await fetchM4Runs({ apiImpl: async () => source })
  assert.equal(ok.state, 'ok')
  assert.notEqual(ok.payload, source)
  assert.notEqual(ok.payload.runs, source.runs)
  const bad = await fetchM4Runs({ apiImpl: async () => ({ ok: true, schema_version: 'kold.os.m4.api/1' }) })
  assert.equal(bad.state, 'invalid')
})

test('fetchM4Findings entrega página canónica, nunca el objeto crudo', async () => {
  const run = M4_API_LATEST_FIXTURE.run
  const source = {
    ok: true, schema_version: 'kold.os.m4.api/1', run_id: run.run_id,
    total: 0, page: 1, pages: 1, page_size: 25, items: [],
    applied_scope: { level: 'global' }, applied_filters: { run_id: run.run_id },
    rejected_params: [], read_only: true,
  }
  const result = await fetchM4Findings({}, {
    apiImpl: async () => source,
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run,
  })
  assert.equal(result.state, 'ok')
  assert.notEqual(result.payload, source)
  assert.notEqual(result.payload.items, source.items)
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
