// KOLD OS · M6 — cliente API: GET-only, sin n8n, estados de error, demo gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  KOLD_OS_M6_LATEST_PATH, KOLD_OS_M6_FINDINGS_PATH, KOLD_OS_M6_RUNS_PATH,
  KOLD_OS_M6_FINDINGS_PARAMS, isKoldOsM6Path, filterKoldOsM6Params,
} from '../src/lib/koldOsM6Route.js'
import {
  fetchM6Latest, fetchM6Findings, fetchM6Runs, classifyM6Error, withTimeout,
} from '../src/modules/caja-conciliacion/m6/m6Api.js'
import { isM6DemoAllowed } from '../src/modules/caja-conciliacion/m6/demoGate.js'
import { M6_API_LATEST_FIXTURE } from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('rutas M6: paths exactos del namespace /pwa-kold-os/m6', () => {
  assert.equal(KOLD_OS_M6_LATEST_PATH, '/pwa-kold-os/m6/latest')
  assert.equal(KOLD_OS_M6_FINDINGS_PATH, '/pwa-kold-os/m6/findings')
  assert.equal(KOLD_OS_M6_RUNS_PATH, '/pwa-kold-os/m6/runs')
  assert.ok(isKoldOsM6Path('/pwa-kold-os/m6/latest'))
  assert.ok(!isKoldOsM6Path('/pwa-kold-os/m5/latest'), 'no captura rutas de otro módulo')
  assert.ok(!isKoldOsM6Path('/pwa-kold-os/m2/latest'))
})

test('allowlist de filtros: espejo exacto del backend, sin dimensiones fantasma', () => {
  assert.equal(KOLD_OS_M6_FINDINGS_PARAMS.length, 15)
  for (const k of ['run_id', 'scope_key', 'category', 'rule_code', 'classification',
    'verdict', 'severity', 'lifecycle_status', 'responsible_area', 'entity_type',
    'search', 'date_from', 'date_to', 'page', 'page_size']) {
    assert.ok(KOLD_OS_M6_FINDINGS_PARAMS.includes(k), `falta ${k}`)
  }
  // v1 es AGREGADO: los hallazgos NO portan estas dimensiones.
  for (const banned of ['company_id', 'branch_id', 'currency_id', 'journal_id',
    'aging_bucket', 'partner_id', 'employee_id', 'domain']) {
    assert.ok(!KOLD_OS_M6_FINDINGS_PARAMS.includes(banned), `${banned} no debe viajar`)
  }
})

test('filterKoldOsM6Params jamás deja pasar params fuera del contrato', () => {
  const out = filterKoldOsM6Params({
    category: 'pagos', employee_id: '7', domain: 'x', partner_id: '9', page: 2,
  })
  assert.deepEqual(out, { category: 'pagos', page: 2 })
})

test('filterKoldOsM6Params acepta URLSearchParams y descarta vacíos', () => {
  const q = new URLSearchParams('category=pagos&verdict=&search=caja')
  assert.deepEqual(filterKoldOsM6Params(q), { category: 'pagos', search: 'caja' })
})

// ── GET-only: cero writes ───────────────────────────────────────────────────
test('api.js: el handler M6 es GET-only y PROHÍBE el fallback n8n', () => {
  const api = read('../src/lib/api.js')
  const i = api.indexOf('async function directKoldOsM6')
  assert.ok(i > 0, 'existe el handler directo')
  const block = api.slice(i, i + 700)
  assert.ok(block.includes("if (method !== 'GET')"), 'rechaza verbos != GET')
  assert.ok(block.includes("status: 405"), 'responde 405')
  assert.ok(block.includes('NO_DIRECT'), 'no captura rutas ajenas')
  assert.ok(api.includes('directKoldOsM6,'), 'está registrado en directHandlers')
  // PROHIBIDO n8n para estas rutas. Se prohíbe el USO, no la palabra: el
  // comentario la nombra a propósito para declarar la prohibición (igual que el
  // handler de M2 en main).
  assert.ok(block.includes('odooHttp'), 'va directo a Odoo')
  const code = block.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.ok(!/n8n/i.test(code), 'n8n en el CODIGO del handler (no en un comentario)')
})

test('el cliente M6 no tiene métodos de escritura ni usa n8n', () => {
  const client = read('../src/modules/caja-conciliacion/m6/m6Api.js')
  for (const verb of ["'POST'", "'PUT'", "'PATCH'", "'DELETE'"]) {
    assert.ok(!client.includes(verb), `el cliente no puede usar ${verb}`)
  }
  // Se prohíbe el USO de n8n, no la palabra: el archivo la nombra en el
  // comentario que declara su prohibición — igual que el handler de M2 en main.
  const code = client.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')
  assert.ok(!/n8n/i.test(code), 'n8n en el CÓDIGO del cliente (no en un comentario)')
  assert.ok(!/webhook/i.test(code), 'sin webhooks')
})

test('el cliente no persiste evidencia en el navegador', () => {
  const client = read('../src/modules/caja-conciliacion/m6/m6Api.js')
  const screen = read('../src/modules/caja-conciliacion/ScreenCajaConciliacionM6.jsx')
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'caches.open']) {
    assert.ok(!client.includes(api), `${api} en el cliente`)
    assert.ok(!screen.includes(api), `${api} en la pantalla`)
  }
})

// ── estados de error ────────────────────────────────────────────────────────
test('errores clasificados: 401/403/404/405/409/422/503/timeout', () => {
  assert.equal(classifyM6Error({ status: 401 }).state, 'unauthorized')
  assert.equal(classifyM6Error({ status: 403 }).state, 'forbidden')
  assert.equal(classifyM6Error({ status: 404 }).state, 'unavailable')
  assert.equal(classifyM6Error({ status: 405 }).state, 'error')
  assert.equal(classifyM6Error({ status: 405 }).code, 'method_not_allowed')
  assert.equal(classifyM6Error({ status: 409 }).state, 'schema_mismatch')
  assert.equal(classifyM6Error({ status: 422 }).state, 'malformed')
  assert.equal(classifyM6Error({ status: 503 }).state, 'flag_off')
  assert.equal(classifyM6Error({ code: 'timeout' }).state, 'error')
  assert.equal(classifyM6Error({ code: 'payload_too_large' }).state, 'malformed')
  assert.equal(classifyM6Error({ status: 500 }).state, 'error')
})

test('SIN BACKEND (404) => unavailable: el estado esperado HOY', () => {
  // El backend M6 no está desplegado: éste es el camino real en producción.
  const err = { status: 404, code: 'not_found' }
  assert.equal(classifyM6Error(err).state, 'unavailable')
})

test('fetchM6Latest: envelope válido => ok', async () => {
  const r = await fetchM6Latest({ apiImpl: async () => M6_API_LATEST_FIXTURE })
  assert.equal(r.state, 'ok')
  assert.equal(r.payload.schema_version, 'kold.os.m6.api/1')
})

test('fetchM6Latest: 404 del backend ausente => unavailable', async () => {
  const r = await fetchM6Latest({ apiImpl: async () => { const e = new Error('x'); e.status = 404; throw e } })
  assert.equal(r.state, 'unavailable')
})

test('fetchM6Latest: schema futura => schema_mismatch (no se renderiza)', async () => {
  const bad = { ...M6_API_LATEST_FIXTURE, schema_version: 'kold.os.m6.api/99' }
  const r = await fetchM6Latest({ apiImpl: async () => bad })
  assert.equal(r.state, 'schema_mismatch')
})

test('fetchM6Latest: payload corrupto => malformed', async () => {
  const r = await fetchM6Latest({ apiImpl: async () => ({ schema_version: 'kold.os.m6.api/1' }) })
  assert.equal(r.state, 'malformed')
})

test('fetchM6Findings manda TODOS los filtros al backend (server-side)', async () => {
  let seen = ''
  await fetchM6Findings(
    { category: 'pagos', verdict: 'riesgo', severity: 'high', classification: 'caveated',
      lifecycle_status: 'new', employee_id: '7', junk: 'x', page: 2, page_size: 10 },
    { apiImpl: async (_m, path) => { seen = path; return { schema_version: 'kold.os.m6.api/1',
      items: [], total: 0, page: 1, pages: 1, page_size: 10, rejected_params: [] } } },
  )
  for (const expected of ['category=pagos', 'verdict=riesgo', 'severity=high',
    'classification=caveated', 'lifecycle_status=new', 'page=2', 'page_size=10']) {
    assert.ok(seen.includes(expected), `no viajó: ${expected}`)
  }
  assert.ok(!seen.includes('employee_id'), 'employee_id jamás viaja')
  assert.ok(!seen.includes('junk'), 'un param fuera del contrato no viaja')
})

test('fetchM6Runs pide el historial del scope', async () => {
  let seen = ''
  await fetchM6Runs({ scope_key: 'abc' }, {
    apiImpl: async (_m, path) => { seen = path; return { schema_version: 'kold.os.m6.api/1',
      scope_key: 'a'.repeat(64), runs: [], runs_count: 0 } },
  })
  assert.ok(seen.includes('scope_key=abc'))
})

test('withTimeout corta una promesa colgada', async () => {
  const hung = new Promise(() => {})
  await assert.rejects(() => withTimeout(hung, 10), (e) => e.code === 'timeout')
})

// ── DEMO GATE ───────────────────────────────────────────────────────────────
test('demo: permitido en DEV', () => {
  assert.equal(isM6DemoAllowed({ DEV: true }), true)
})

test('demo: permitido en Preview SOLO con VITE_ENABLE_M6_DEMO=true', () => {
  assert.equal(isM6DemoAllowed({ DEV: false, VITE_ENABLE_M6_DEMO: 'true' }), true)
  assert.equal(isM6DemoAllowed({ DEV: false, VITE_ENABLE_M6_DEMO: 'false' }), false)
  assert.equal(isM6DemoAllowed({ DEV: false, VITE_ENABLE_M6_DEMO: '1' }), false,
    'sólo el string "true" habilita; nada de coerción laxa')
})

test('demo: PRODUCCIÓN lo ignora SIEMPRE', () => {
  // Producción no define VITE_ENABLE_M6_DEMO. Esto importa MÁS en M6: sin backend
  // desplegado, el fixture es la única fuente — si el gate fallara, producción
  // mostraría un demo como si fuera su estado financiero.
  assert.equal(isM6DemoAllowed({ DEV: false }), false)
  assert.equal(isM6DemoAllowed({ DEV: false, PROD: true }), false)
  assert.equal(isM6DemoAllowed({}), false)
  assert.equal(isM6DemoAllowed(null), false)
  assert.equal(isM6DemoAllowed(undefined), false)
})
