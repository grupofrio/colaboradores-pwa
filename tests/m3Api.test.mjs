import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  fetchM3Latest, fetchM3Findings, fetchM3Runs, classifyM3Error, withTimeout,
  normalizeM3FindingsRequest, M3_MAX_PAYLOAD_CHARS,
} from '../src/modules/ejecucion/m3/m3Api.js'
import {
  KOLD_OS_M3_LATEST_PATH, KOLD_OS_M3_FINDINGS_PATH, KOLD_OS_M3_RUNS_PATH,
  KOLD_OS_M3_FINDINGS_PARAMS, filterKoldOsM3Params, isKoldOsM3Path,
} from '../src/lib/koldOsM3Route.js'
import { M3_API_LATEST_FIXTURE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'
import * as m3ApiModule from '../src/modules/ejecucion/m3/m3Api.js'

const apiError = (status, code) => { const e = new Error(code); e.status = status; e.code = code; return e }
const RUN_ID = M3_API_LATEST_FIXTURE.run.run_id
const OTHER_RUN_ID = 'b'.repeat(64)
const latestForRun = (runId) => {
  const latest = JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE))
  latest.run.run_id = runId
  return latest
}
const okFindings = {
  ok: true, schema_version: 'kold.os.m3.api/1', run_id: RUN_ID, total: 0, page: 1, pages: 1,
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
  assert.ok(KOLD_OS_M3_FINDINGS_PARAMS.includes('verdict'))
  assert.ok(KOLD_OS_M3_FINDINGS_PARAMS.includes('classification'))
  assert.ok(!KOLD_OS_M3_FINDINGS_PARAMS.includes('status'), 'status técnico NO es filtro epistémico')
  assert.ok(!KOLD_OS_M3_FINDINGS_PARAMS.includes('employee_id'), 'employee_id NO autorizado')
  assert.deepEqual(
    filterKoldOsM3Params({
      category: 'cierre', verdict: 'riesgo', classification: 'caveated',
      status: 'RED', employee_id: '7', domain: 'x', branch_id: '29',
    }),
    { category: 'cierre', branch_id: '29', verdict: 'riesgo', classification: 'caveated' },
  )
})

test('fetchM3Latest: envelope válido => ok (números reales presentes)', async () => {
  const raw = JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE))
  raw.future_extension = { harmless: 'not part of contract' }
  raw.findings[0].future_finding_field = 'not part of contract'
  const result = await fetchM3Latest({ apiImpl: async () => raw })
  assert.equal(result.state, 'ok')
  assert.equal(result.payload.summary.definitive_incident_rule_count, 6)
  assert.equal(result.payload.kpis.plans_started_overdue_open, 171)
  assert.equal(result.payload.kpis.visit_compliance.value_pct, 58.78)
  assert.equal(result.payload.future_extension, undefined)
  assert.equal(result.payload.findings[0].future_finding_field, undefined)
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
    {
      run_id: RUN_ID, category: 'cierre', branch_id: 29, page: 2, employee_id: 7, search: 'caja',
      verdict: 'anomalia', classification: 'exploratory', status: 'RED',
    },
    { latestPayload: latestForRun(RUN_ID), apiImpl: async (_m, path) => {
      seenPath = path
      return {
        ...okFindings,
        applied_filters: {
          run_id: RUN_ID, category: 'cierre', branch_id: 29, search: 'caja',
          verdict: 'anomalia', classification: 'exploratory',
        },
      }
    } },
  )
  assert.equal(result.state, 'ok')
  const query = new URLSearchParams(seenPath.split('?')[1])
  assert.equal(query.get('category'), 'cierre')
  assert.equal(query.get('branch_id'), '29')
  assert.equal(query.get('verdict'), 'anomalia')
  assert.equal(query.get('classification'), 'exploratory')
  assert.equal(query.get('status'), null, 'status técnico jamás viaja como filtro')
  assert.equal(query.get('employee_id'), null, 'employee_id jamás viaja')
  assert.equal((await fetchM3Findings({}, { apiImpl: async () => ({ ok: true }) })).state, 'invalid_request')
})

test('findings queda fijado al run de latest y valida filtros/paginacion exactos', async () => {
  const params = {
    run_id: RUN_ID, page: 9, page_size: 25,
    verdict: 'anomalia', classification: 'exploratory', search: 'caja',
  }
  let seenPath = ''
  const payload = {
    ...okFindings,
    run_id: RUN_ID,
    total: 0,
    page: 1,
    pages: 1,
    page_size: 25,
    applied_filters: {
      run_id: RUN_ID, verdict: 'anomalia', classification: 'exploratory', search: 'caja',
    },
  }
  const result = await fetchM3Findings(params, {
    latestPayload: latestForRun(RUN_ID),
    apiImpl: async (_method, path) => { seenPath = path; return payload },
  })

  assert.equal(result.state, 'ok', JSON.stringify(result.errors))
  assert.equal(new URLSearchParams(seenPath.split('?')[1]).get('run_id'), RUN_ID)
  assert.equal(result.payload.page, 1, 'acepta clamp documentado de page 9 a la ultima pagina')

  for (const mutation of [
    { run_id: OTHER_RUN_ID },
    { page_size: 10 },
    { applied_filters: { ...payload.applied_filters, verdict: 'riesgo' } },
    { rejected_params: ['search'] },
  ]) {
    const invalid = await fetchM3Findings(params, {
      latestPayload: latestForRun(RUN_ID),
      apiImpl: async () => ({ ...payload, ...mutation }),
    })
    assert.equal(invalid.state, mutation.rejected_params ? 'invalid_request' : 'invalid', JSON.stringify(mutation))
  }
})

test('fetchM3Findings: acepta page_size 9999 normalizado a 100, rechaza otro valor', async () => {
  const params = { run_id: RUN_ID, page: 9999, page_size: 9999 }
  const payload = {
    ...okFindings,
    total: M3_API_LATEST_FIXTURE.findings.length, page: 1, pages: 1, page_size: 100,
    items: JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE.findings)),
    applied_filters: { run_id: RUN_ID },
  }
  const valid = await fetchM3Findings(params, {
    latestPayload: latestForRun(RUN_ID),
    apiImpl: async () => payload,
  })
  assert.equal(valid.state, 'ok', JSON.stringify(valid.errors))

  const invalid = await fetchM3Findings(params, {
    latestPayload: latestForRun(RUN_ID),
    apiImpl: async () => ({ ...payload, page_size: 9999 }),
  })
  assert.equal(invalid.state, 'invalid')
})

test('normalizacion numerica replica int decimal seguro de Python', () => {
  const accepted = [
    ['1', 1], ['+7', 7], ['-4', -4], ['0', 0], ['0007', 7], [12, 12],
  ]
  for (const [raw, expected] of accepted) {
    const result = normalizeM3FindingsRequest({ run_id: RUN_ID, page: raw })
    assert.equal(result.ok, true, String(raw))
    assert.equal(result.params.page, expected)
  }
  for (const raw of ['1.0', '1e2', '0x10', '9007199254740992', '+', '--1', '1_000', 1.5]) {
    const result = normalizeM3FindingsRequest({ run_id: RUN_ID, page: raw })
    assert.equal(result.ok, false, String(raw))
    assert.deepEqual(result.rejected_params, ['page'])
  }
})

test('normalizacion signed conserva clamp/default del backend', async () => {
  for (const [page, pageSize] of [['-9', '+9999'], ['+1', '-2']]) {
    let seenPath = ''
    const expectedSize = Number(pageSize) > 0 ? 100 : 25
    const response = {
      ...okFindings, applied_filters: { run_id: RUN_ID }, page: 1, page_size: expectedSize,
    }
    const result = await fetchM3Findings({ run_id: RUN_ID, page, page_size: pageSize }, {
      latestPayload: latestForRun(RUN_ID),
      apiImpl: async (_method, path) => { seenPath = path; return response },
    })
    assert.equal(result.state, 'ok', JSON.stringify(result.errors))
    const query = new URLSearchParams(seenPath.split('?')[1])
    assert.equal(query.get('page'), String(Number(page)))
    assert.equal(query.get('page_size'), String(Number(pageSize)))
  }
})

test('busqueda mayor a 120 caracteres falla cerrada antes de consultar Odoo', async () => {
  let calls = 0
  const result = await fetchM3Findings({ run_id: RUN_ID, search: 'x'.repeat(121) }, {
    apiImpl: async () => { calls += 1; return okFindings },
  })
  assert.equal(result.state, 'invalid_request')
  assert.deepEqual(result.rejected_params, ['search'])
  assert.equal(calls, 0)

  assert.deepEqual(normalizeM3FindingsRequest({ run_id: ` ${RUN_ID} `, search: ' caja ' }), {
    ok: true,
    params: { run_id: RUN_ID, search: 'caja' },
    rejected_params: [],
  })
  assert.deepEqual(normalizeM3FindingsRequest({ run_id: 'run-libre' }), {
    ok: false,
    params: {},
    rejected_params: ['run_id'],
  })

  const missingRun = await fetchM3Findings({ page: 1 }, {
    apiImpl: async () => { calls += 1; return okFindings },
  })
  assert.equal(missingRun.state, 'invalid_request')
  assert.deepEqual(missingRun.rejected_params, ['run_id'])
  assert.equal(calls, 0)
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

test('última petición gana aunque una respuesta anterior resuelva después', async () => {
  assert.equal(typeof m3ApiModule.createLatestRequestGate, 'function')
  const gate = m3ApiModule.createLatestRequestGate()
  const applied = []
  const deferred = () => {
    let resolve
    const promise = new Promise((done) => { resolve = done })
    return { promise, resolve }
  }
  const older = deferred()
  const newer = deferred()
  const run = async (pending) => {
    const requestId = gate.begin()
    const value = await pending.promise
    if (gate.isLatest(requestId)) applied.push(value)
  }

  const olderRun = run(older)
  const newerRun = run(newer)
  newer.resolve('newer')
  await newerRun
  older.resolve('older')
  await olderRun

  assert.deepEqual(applied, ['newer'])
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
