// Bloque 4 — "rotos" del rol gerente.
// Cubre lo que la auditoría de dirección marcó como dato inventado o campo
// mal mapeado. La regla que se prueba una y otra vez aquí es la misma:
// **null ≠ 0**. Un «—» significa "no hay dato"; un 0 significa "medimos cero".
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

// ── kpi-summary: null ≠ 0 ───────────────────────────────────────────────────

test('kpi-summary sin snapshot devuelve null, no cero', async () => {
  mockOdoo({ '/get_records_sorted': { response: [] } })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  assert.equal(kpi.has_data, false)
  assert.equal(kpi.sales_today, null, 'sin snapshot no es "vendimos 0"')
  assert.equal(kpi.forecast, null)
  assert.equal(kpi.available, null)
  assert.equal(kpi.date_kpi, null)
})

test('kpi-summary conserva un cero REAL medido', async () => {
  mockOdoo({
    '/get_records_sorted': {
      response: [{
        id: 1,
        date_kpi: '2026-08-05',
        sales_qty: 0,
        forecast_qty: 120,
        pt_available_qty: 0,
        en_available_qty: 0,
        vans_available_qty: 0,
        analytic_account_id: [34, 'IGU34'],
      }],
    },
  })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  assert.equal(kpi.has_data, true)
  assert.equal(kpi.sales_today, 0, 'un cero medido debe seguir siendo 0')
  assert.equal(kpi.forecast, 120)
  assert.equal(kpi.available, 0)
})

test('kpi-summary expone la fecha real del snapshot para poder rotularlo', async () => {
  mockOdoo({
    '/get_records_sorted': {
      response: [{
        id: 9, date_kpi: '2026-08-05', sales_qty: 4210, forecast_qty: 5000,
        pt_available_qty: 100, en_available_qty: 20, vans_available_qty: 5,
        analytic_account_id: [34, 'IGU34'],
      }],
    },
  })

  const kpi = await api('GET', '/pwa-gerente/kpi-summary')

  // El handler pide el ÚLTIMO snapshot DEL MES, que casi nunca es hoy: la UI
  // necesita la fecha para no rotular como "hoy" el dato del día 5.
  assert.equal(kpi.date_kpi, '2026-08-05')
  assert.equal(kpi.sucursal, 'IGU34')
})

// ── forecasts-locked: campos reales ─────────────────────────────────────────

test('forecasts-locked aplana los campos que la pantalla realmente lee', async () => {
  mockOdoo({
    '/get_records_sorted': {
      response: [{
        id: 77,
        name: 'Forecast IGU34',
        analytic_account_id: [34, 'IGU34'],
        company_id: [34, 'Grupo Frio Iguala'],
        date_target: '2026-08-08',
        state: 'confirmed',
        created_by_employee_id: [718, 'Aida Ramirez'],
        confirmed_by_employee_id: [102, 'Hector Tapia'],
        confirmed_at: '2026-08-06 14:03:00',
        line_ids: [1, 2, 3, 4],
      }],
    },
  })

  const [fc] = await api('GET', '/pwa-gerente/forecasts-locked')

  // Antes la pantalla leía sucursal/created_by/line_count y el handler nunca
  // los devolvía: tres de las cuatro columnas del detalle pintaban "-".
  assert.equal(fc.sucursal, 'IGU34')
  assert.equal(fc.created_by, 'Aida Ramirez')
  assert.equal(fc.confirmed_by, 'Hector Tapia')
  assert.equal(fc.line_count, 4)
  assert.equal(fc.empresa, 'Grupo Frio Iguala')
  // Los many2one crudos siguen ahí para consumidores existentes.
  assert.deepEqual(fc.analytic_account_id, [34, 'IGU34'])
})

// ── forecast-unlock: ni revienta ni escribe sin alcance ─────────────────────

test('forecast-unlock ya no revienta con ReferenceError y NO escribe sin alcance', async () => {
  const calls = mockOdoo({})

  const res = await api('POST', '/pwa-gerente/forecast-unlock', { forecast_id: 77 })

  assert.equal(res.success, false)
  assert.equal(res.code, 'forecast_unlock_unavailable')
  assert.ok(res.message, 'debe explicar por qué no se pudo')
  // Lo crítico: cero escrituras. El handler viejo llamaba action_reset_to_draft
  // con sudo y sin comprobar que el forecast fuera de la sucursal del gerente.
  assert.equal(
    calls.filter(c => c.path === '/api/create_update').length,
    0,
    'no debe ejecutarse ninguna escritura hasta que exista el endpoint con alcance',
  )
})

test('forecast-unlock sin id responde el código de validación, no un crash', async () => {
  mockOdoo({})
  const res = await api('POST', '/pwa-gerente/forecast-unlock', {})
  assert.equal(res.success, false)
  assert.equal(res.code, 'forecast_id_required')
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

test('la lista de gastos desenvuelve el envelope y reporta el error', () => {
  const code = src('../src/modules/shared/GastosScreenBase.jsx')
  assert.doesNotMatch(code, /Array\.isArray\(data\) \? data : \[\]/, 'Array.isArray sobre el envelope siempre daba falso')
  assert.match(code, /function unwrapExpenses/)
  assert.match(code, /setListError/, 'un 401 no puede verse igual que "sin gastos hoy"')
})

test('el bloque muerto de aprobación de requisiciones ya no existe', () => {
  const code = src('../src/modules/admin/forms/AdminRequisicionForm.jsx')
  // approveRequisition/rejectRequisition se usaban sin importar detrás de
  // `{false && …}`: cualquier render del bloque habría reventado.
  assert.doesNotMatch(code, /approveRequisition|rejectRequisition/)
  assert.doesNotMatch(code, /\{false && \(/)
})
