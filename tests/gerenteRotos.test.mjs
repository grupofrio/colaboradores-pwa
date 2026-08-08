// Bloque 4 — "rotos" del rol gerente.
// Cubre lo que la auditoría de dirección marcó como dato inventado o campo
// mal mapeado. La regla que se prueba una y otra vez aquí es la misma:
// **null ≠ 0**. Un «—» significa "no hay dato"; un 0 significa "medimos cero".
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { api } from '../src/lib/api.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null },
    setItem(key, value) { store[key] = String(value) },
    removeItem(key) { delete store[key] },
    clear() { store = {} },
  }
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload) },
    async json() { return payload },
  }
}

/** Mock de fetch que registra las llamadas y responde por path. */
function mockOdoo(byPath) {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    // api.js llama con base relativa `/odoo-api`; se normaliza para poder
    // enrutar el mock por el path lógico del controlador.
    const path = String(url)
      .replace(/^https?:\/\/[^/]+/, '')
      .replace(/^\/odoo-api/, '')
      .split('?')[0]
    let body = null
    try { body = options.body ? JSON.parse(options.body) : null } catch { body = options.body }
    calls.push({ path, body })
    const handler = byPath[path]
    if (!handler) return jsonResponse({ result: { response: [] } })
    return jsonResponse({ result: typeof handler === 'function' ? handler(body) : handler })
  }
  return calls
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    employee_id: 718,
    company_id: 34,
    sucursal: 'IGU34',
  }))
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

// ── Los cuatro endpoints ahora son de servidor ──────────────────────────────
// Ya no se arma ninguna consulta ORM aquí. Lo que se prueba es (a) que se llama
// al endpoint token-only correcto, (b) que el envelope V2 se traduce bien y
// (c) que un rechazo del backend NO degrada al camino viejo con sudo.

const V2 = {
  alerts: '/gf/salesops/gerente/v2/alerts',
  kpi: '/gf/salesops/gerente/v2/kpi-summary',
  forecasts: '/gf/salesops/gerente/v2/forecasts-locked',
  unlock: '/gf/salesops/gerente/v2/forecast-unlock',
}

const okEnvelope = (data, meta = {}) => ({ status: 'ok', code: 'OK', data, meta })
const errEnvelope = (code, msg) => ({ status: 'error', code, user_message: msg, data: {}, meta: {} })

test('kpi-summary llama al endpoint token-only, no al ORM del cliente', async () => {
  const calls = mockOdoo({
    [V2.kpi]: okEnvelope(
      { has_data: true, sales_today: 4210, forecast: 5000, available: 125, date_kpi: '2026-08-05' },
      { scope: { branch_name: '[IGU34] Iguala Glaciem', source: 'employee_token' } },
    ),
  })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  assert.equal(kpi.success, true)
  assert.equal(kpi.sales_today, 4210)
  assert.equal(kpi.date_kpi, '2026-08-05')
  assert.equal(kpi.sucursal, '[IGU34] Iguala Glaciem')
  // Lo crítico: cero lecturas ORM compuestas desde el navegador.
  assert.equal(calls.filter(c => c.path === '/get_records_sorted').length, 0)
  assert.equal(calls[0].path, V2.kpi)
})

test('el cliente NO manda company_id ni analytic_account_id', async () => {
  const calls = mockOdoo({ [V2.kpi]: okEnvelope({ has_data: false, sales_today: null }) })
  await api('GET', '/pwa-gerente/kpi-summary')

  const sent = JSON.stringify(calls[0].body || {})
  assert.ok(!sent.includes('company_id'), 'el alcance lo deriva el servidor del token')
  assert.ok(!sent.includes('analytic_account_id'))
})

test('kpi-summary preserva null (sin dato) y no lo convierte en cero', async () => {
  mockOdoo({ [V2.kpi]: okEnvelope({ has_data: false, sales_today: null, forecast: null, available: null, date_kpi: null }) })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  assert.equal(kpi.has_data, false)
  assert.equal(kpi.sales_today, null, 'sin snapshot no es "vendimos 0"')
  assert.equal(kpi.forecast, null)
})

test('kpi-summary conserva un cero REAL medido', async () => {
  mockOdoo({ [V2.kpi]: okEnvelope({ has_data: true, sales_today: 0, forecast: 120, available: 0, date_kpi: '2026-08-05' }) })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  assert.equal(kpi.sales_today, 0, 'un cero medido debe seguir siendo 0')
  assert.equal(kpi.forecast, 120)
})

test('FEATURE_DISABLED NO degrada al camino viejo con sudo', async () => {
  const calls = mockOdoo({ [V2.kpi]: errEnvelope('FEATURE_DISABLED', 'Función apagada.') })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  assert.equal(kpi.success, false)
  assert.equal(kpi.code, 'FEATURE_DISABLED')
  // Degradar a la lectura con sudo sería reabrir justo el agujero que se cierra.
  assert.equal(calls.filter(c => c.path === '/get_records_sorted').length, 0)
})

test('alerts y forecasts-locked traducen el envelope y sus rechazos', async () => {
  mockOdoo({
    [V2.alerts]: okEnvelope({ items: [{ id: 1, event_type: 'sync', sucursal: 'IGU34' }], count: 1 }),
    [V2.forecasts]: okEnvelope({
      items: [{ id: 77, sucursal: 'IGU34', created_by: 'Aida Ramirez', line_count: 4 }],
    }),
  })

  const alerts = await api('GET', '/pwa-gerente/alerts')
  assert.equal(alerts.success, true)
  assert.equal(alerts.items.length, 1)

  const fcs = await api('GET', '/pwa-gerente/forecasts-locked')
  assert.equal(fcs.items[0].sucursal, 'IGU34')
  assert.equal(fcs.items[0].created_by, 'Aida Ramirez')
  assert.equal(fcs.items[0].line_count, 4)
})

test('un rechazo deja lista vacía Y motivo — no "no hay alertas"', async () => {
  mockOdoo({ [V2.alerts]: errEnvelope('UNAUTHORIZED', 'Token requerido.') })

  const alerts = await api('GET', '/pwa-gerente/alerts')

  assert.equal(alerts.success, false)
  assert.equal(alerts.code, 'UNAUTHORIZED')
  assert.deepEqual(alerts.items, [])
})

test('forecast-unlock va al endpoint con alcance y no escribe por su cuenta', async () => {
  const calls = mockOdoo({ [V2.unlock]: okEnvelope({ forecast_id: 77, state: 'draft' }) })

  const res = await api('POST', '/pwa-gerente/forecast-unlock', { forecast_id: 77 })

  assert.equal(res.success, true)
  assert.equal(calls[0].path, V2.unlock)
  // El `action_reset_to_draft` con sudo desde el cliente ya no existe.
  assert.equal(calls.filter(c => c.path === '/api/create_update').length, 0)
})

test('forecast-unlock rechazado por alcance se reporta, no se silencia', async () => {
  mockOdoo({ [V2.unlock]: errEnvelope('NOT_FOUND', 'No encontré ese forecast en tu sucursal.') })

  const res = await api('POST', '/pwa-gerente/forecast-unlock', { forecast_id: 999 })

  assert.equal(res.success, false)
  assert.equal(res.code, 'NOT_FOUND')
})

test('forecast-unlock sin id ni siquiera sale a la red', async () => {
  const calls = mockOdoo({})
  const res = await api('POST', '/pwa-gerente/forecast-unlock', {})
  assert.equal(res.success, false)
  assert.equal(res.code, 'forecast_id_required')
  assert.equal(calls.length, 0)
})

// ── Contratos de código (lo que no se puede ejercitar sin DOM) ──────────────

test('directGerente recibe `body` en su firma', () => {
  const code = src('../src/lib/api.js')
  assert.match(
    code,
    /async function directGerente\(method, path, body\)/,
    'routeDirect invoca handler(method, path, body); omitir el 3er parámetro dejaba `body` como variable libre',
  )
})

test('el hub admin ya no inventa ceros ni disfraza ventas de caja', () => {
  const code = src('../src/modules/admin/adminService.js')

  assert.doesNotMatch(code, /caja:\s*\{\s*count:\s*sales\.length/, '"Caja del día" era un alias literal de ventas del día')
  assert.doesNotMatch(code, /liquidaciones:\s*\{\s*count:\s*0/, 'liquidaciones venía con 0 fijo')
  assert.doesNotMatch(code, /alertas:\s*\{\s*count:\s*0\s*\}/, 'alertas venía con 0 fijo')

  // Cada KPI declara si tiene fuente cableada.
  for (const key of ['caja', 'liquidaciones', 'alertas', 'materiaPrima']) {
    assert.match(
      code,
      new RegExp(`${key}:\\s*\\{[^}]*available:\\s*false`),
      `${key} debe declararse sin fuente en lugar de reportar 0`,
    )
  }
  assert.match(code, /requisiciones:\s*\{\s*available:\s*requisitionCount !== null/, 'requisiciones sí se cableó')
})

test('el hub admin distingue cargando / sin dato / cero', () => {
  const code = src('../src/modules/admin/components/HubV2.jsx')
  assert.match(code, /loading \? '···'/, 'cargando no debe verse igual que sin dato')
  assert.match(code, /«—» = sin fuente de datos cableada/, 'debe explicarse el guion al usuario')
})

test('la tarjeta del hub gerente rotula la fecha del dato', () => {
  const code = src('../src/modules/gerente/ScreenGerente.jsx')
  assert.doesNotMatch(code, /label="Venta Hoy"/, 'el dato es el último snapshot del mes, no "hoy"')
  assert.match(code, /kpiDateLabel/, 'la tarjeta debe mostrar la fecha real del snapshot')
  assert.match(code, /const fmtKpi = \(v\) => \(v === null \|\| v === undefined/, 'null se pinta «—», no 0')
})

test('el formulario degradado de gastos ya no existe', () => {
  // `GastosScreenBase` era la versión que veía el gerente y cualquiera en móvil:
  // sin analítica, sin almacén, sin adjunto, y con la lista siempre vacía porque
  // hacía `Array.isArray()` sobre el envelope. Se eliminó junto con la
  // bifurcación por ancho de pantalla.
  assert.equal(
    existsSync(fileURLToPath(new URL('../src/modules/shared/GastosScreenBase.jsx', import.meta.url))),
    false,
  )
  const admin = src('../src/modules/admin/ScreenGastos.jsx')
  const gerente = src('../src/modules/gerente/ScreenGastos.jsx')
  assert.doesNotMatch(admin, /window\.innerWidth\s*<\s*1024/, 'sin bifurcación por ancho')
  assert.match(admin, /AdminGastosForm/)
  assert.match(gerente, /from '\.\.\/admin\/ScreenGastos'/, 'el gerente usa el MISMO formulario')
})

test('el bloque muerto de aprobación de requisiciones ya no existe', () => {
  const code = src('../src/modules/admin/forms/AdminRequisicionForm.jsx')
  // approveRequisition/rejectRequisition se usaban sin importar detrás de
  // `{false && …}`: cualquier render del bloque habría reventado.
  assert.doesNotMatch(code, /approveRequisition|rejectRequisition/)
  assert.doesNotMatch(code, /\{false && \(/)
})
