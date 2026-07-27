import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

const ROUTES = {
  '/equipo/vendedor/:vendedorId': 'ScreenDetalleVendedor',
  '/equipo/sin-visitar': 'ScreenClientesSinVisitar',
  '/equipo/cierre': 'ScreenCierreOperativo',
  '/equipo/dashboard': 'ScreenDashboardVentas',
  '/equipo/metas': 'ScreenMetasVendedores',
  '/equipo/score-semanal': 'ScreenScoreSemanal',
  '/equipo/recuperacion': 'ScreenClientesRecuperacion',
}

const AUDITED_IMPORTS = {
  'modules/supervisor-ventas/ScreenDetalleVendedor.jsx': {
    './supvService': [
      'fmtMoney', 'fmtTime', 'getComplianceColor', 'getDayOverview',
      'getDepartureStatus', 'getLiquidationStatus', 'getRouteStops', 'getStatusColor',
    ],
  },
  'modules/supervisor-ventas/ScreenClientesSinVisitar.jsx': {
    './supvService': ['getDayOverview', 'getRouteStops'],
  },
  'modules/supervisor-ventas/ScreenCierreOperativo.jsx': {
    './supvService': [
      'fmtMoney', 'fmtTime', 'getComplianceColor', 'getDayOverview', 'getLiquidationStatus',
    ],
  },
  'modules/supervisor-ventas/ScreenDashboardVentas.jsx': {
    '../../lib/api.js': ['apiGet', 'getSession'],
    './supvService': ['getDayOverview'],
  },
  'modules/supervisor-ventas/ScreenMetasVendedores.jsx': {
    './api': ['getTeamTargets'],
  },
  'modules/supervisor-ventas/ScreenScoreSemanal.jsx': {
    './supvService': ['getComplianceColor', 'getWeeklyScore'],
  },
  'modules/supervisor-ventas/ScreenClientesRecuperacion.jsx': {
    '../admin/api': ['getInactiveCustomers', 'getRecoveryCustomers'],
  },
}

const WRITER_BINDINGS = [
  'createForecast', 'ensureDailyRoutePlan', 'updateSupervisorCustomer',
  'addCustomerToRoutePlan', 'saveRoutePlanDraft', 'removeCustomerFromRoutePlan',
  'publishRoutePlan', 'confirmForecast', 'cancelForecast', 'deleteForecast',
  'updateForecastLines', 'confirmRouteSuggestion',
  'apiPost', 'apiPut', 'apiDelete',
]

function importedNames(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"]`,
  ))
  if (!match) return []
  return match[1].split(',').map((name) => name.trim()).filter(Boolean).sort()
}

test('las siete rutas secundarias conservan role gate y componentes auditados', () => {
  const app = src('App.jsx')
  for (const [route, component] of Object.entries(ROUTES)) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`path="${escaped}"[^\\n]*ModuleRoleRoute moduleId="supervisor_ventas"[^\\n]*${component}`)
    assert.match(app, re, route)
  }
})

test('cada superficie conserva exactamente sus imports de lectura auditados', () => {
  for (const [file, modules] of Object.entries(AUDITED_IMPORTS)) {
    const source = src(file)
    for (const [specifier, allowed] of Object.entries(modules)) {
      assert.deepEqual(importedNames(source, specifier), [...allowed].sort(), `${file} ${specifier}`)
    }
    for (const writer of WRITER_BINDINGS) {
      assert.doesNotMatch(source, new RegExp(`\\b${writer}\\b`), `${file} no debe importar ${writer}`)
    }
    assert.doesNotMatch(source, /\bapi\s*\(/, `${file} no debe usar api() genérico`)
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file} no debe usar fetch directo`)
  }
})

test('Más enlaza únicamente las cuatro superficies secundarias aprobadas', () => {
  const source = src('modules/supervisor-ventas/v2/mas/MasView.jsx')
  const allowed = [
    '/equipo/metas', '/equipo/score-semanal',
    '/equipo/dashboard', '/equipo/recuperacion',
  ]
  for (const route of allowed) assert.ok(source.includes(`route: '${route}'`), route)
  for (const route of ['/equipo/tareas', '/equipo/notas', '/equipo/bajas', '/equipo/pronostico']) {
    assert.equal(source.includes(`route: '${route}'`), false, route)
  }
})
