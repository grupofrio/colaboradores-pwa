import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'

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

const WRITER_SET = new Set(WRITER_BINDINGS)
const HTTP_WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete'])

function parseModule(source) {
  return parse(source, { sourceType: 'module', plugins: ['jsx'] })
}

function walkAst(node, visitor) {
  if (Array.isArray(node)) {
    for (const child of node) walkAst(child, visitor)
    return
  }
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'string') visitor(node)

  for (const [key, value] of Object.entries(node)) {
    if (['comments', 'leadingComments', 'trailingComments', 'innerComments', 'loc'].includes(key)) continue
    walkAst(value, visitor)
  }
}

function importedName(specifier) {
  if (specifier.type !== 'ImportSpecifier') return null
  return specifier.imported.type === 'Identifier'
    ? specifier.imported.name
    : specifier.imported.value
}

function isWriterCapableSource(source) {
  return /(?:^|[/_.-])(?:api|service)(?:[/_.-]|$)/i.test(source)
    || /(?:api|service|client)(?:\.[cm]?[jt]sx?)?$/i.test(source)
}

function memberPropertyName(callee) {
  if (!callee?.computed && callee?.property?.type === 'Identifier') return callee.property.name
  return callee?.computed && callee?.property?.type === 'StringLiteral' ? callee.property.value : null
}

function isDynamicImport(node) {
  return (node?.type === 'CallExpression' || node?.type === 'OptionalCallExpression')
    && node.callee?.type === 'Import'
}

function dynamicImportSource(node) {
  return isDynamicImport(node) && node.arguments[0]?.type === 'StringLiteral'
    ? node.arguments[0].value
    : null
}

function forbiddenMemberCall(callee) {
  if (callee?.type !== 'MemberExpression' && callee?.type !== 'OptionalMemberExpression') return null
  const property = memberPropertyName(callee)
  const objectName = callee.object?.type === 'Identifier' ? callee.object.name : null
  if (objectName === 'window' && property === 'fetch') return 'window.fetch'
  if (objectName && /(?:api|client)$/i.test(objectName) && (HTTP_WRITE_METHODS.has(property) || WRITER_SET.has(property))) {
    return `${objectName}.${property}`
  }
  if (isDynamicImport(callee.object) && WRITER_SET.has(property)) return `import().${property}`
  return null
}

function jsxName(name) {
  return name?.type === 'JSXIdentifier' ? name.name : null
}

function getJsxAttribute(openingElement, name) {
  return openingElement.attributes.find((attribute) => (
    attribute.type === 'JSXAttribute' && jsxName(attribute.name) === name
  ))
}

function jsxStringAttribute(openingElement, name) {
  const attribute = getJsxAttribute(openingElement, name)
  return attribute?.value?.type === 'StringLiteral' ? attribute.value.value : null
}

function containsJsxElement(node, name) {
  let found = false
  walkAst(node, (candidate) => {
    if (candidate.type === 'JSXElement' && jsxName(candidate.openingElement.name) === name) found = true
  })
  return found
}

function replaceExactlyOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, `mutation target must occur exactly once: ${before}`)
  return source.replace(before, after)
}

function assertAuditedRouteStructure(app) {
  const ast = parseModule(app)
  const routeNodes = []
  walkAst(ast, (node) => {
    if (node.type === 'JSXElement' && jsxName(node.openingElement.name) === 'Route') routeNodes.push(node)
  })

  for (const [route, component] of Object.entries(ROUTES)) {
    const matchingRoutes = routeNodes.filter((node) => jsxStringAttribute(node.openingElement, 'path') === route)
    assert.equal(matchingRoutes.length, 1, `${route} debe tener exactamente una Route`)

    const elementAttribute = getJsxAttribute(matchingRoutes[0].openingElement, 'element')
    const roleRoute = elementAttribute?.value?.type === 'JSXExpressionContainer'
      ? elementAttribute.value.expression
      : null
    assert.equal(roleRoute?.type, 'JSXElement', `${route} debe declarar su element JSX`)
    assert.equal(jsxName(roleRoute?.openingElement?.name), 'ModuleRoleRoute', `${route} debe usar ModuleRoleRoute`)
    assert.equal(jsxStringAttribute(roleRoute.openingElement, 'moduleId'), 'supervisor_ventas', `${route} debe conservar supervisor_ventas`)
    assert.equal(containsJsxElement(roleRoute, 'V2ExcludedRoute'), false, `${route} no puede excluirse de V2`)

    const directComponents = roleRoute.children.filter((child) => child.type === 'JSXElement')
    assert.equal(directComponents.length, 1, `${route} debe exponer un único componente directo`)
    assert.equal(jsxName(directComponents[0].openingElement.name), component, `${route} debe exponer ${component} directamente`)
  }
}

function assertAuditedReadConsumerImports(file, source) {
  const modules = AUDITED_IMPORTS[file]
  const ast = parseModule(source)
  const imports = ast.program.body.filter((node) => node.type === 'ImportDeclaration')

  for (const [specifier, allowed] of Object.entries(modules)) {
    const declarations = imports.filter((node) => node.source.value === specifier)
    assert.equal(declarations.length, 1, `${file} ${specifier} debe tener una sola declaración import`)

    const declaration = declarations[0]
    assert.equal(declaration.specifiers.length, allowed.length, `${file} ${specifier} no permite imports adicionales`)
    const actual = declaration.specifiers.map((binding) => {
      assert.equal(binding.type, 'ImportSpecifier', `${file} ${specifier} exige imports nombrados`)
      const imported = importedName(binding)
      assert.equal(binding.local?.name, imported, `${file} ${specifier} no permite aliases`)
      return imported
    }).sort()
    assert.deepEqual(actual, [...allowed].sort(), `${file} ${specifier}`)
  }

  for (const declaration of imports) {
    for (const binding of declaration.specifiers) {
      assert.equal(WRITER_SET.has(importedName(binding)), false, `${file} no debe importar writers de ${declaration.source.value}`)
      assert.equal(WRITER_SET.has(binding.local?.name), false, `${file} no debe aliasar writers de ${declaration.source.value}`)
      assert.equal(
        isWriterCapableSource(declaration.source.value) && (
          binding.type === 'ImportDefaultSpecifier' || binding.type === 'ImportNamespaceSpecifier'
        ),
        false,
        `${file} no debe importar default/namespace de ${declaration.source.value}`,
      )
    }
  }

  walkAst(ast, (node) => {
    if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') return
    const importedSource = dynamicImportSource(node)
    assert.equal(
      importedSource !== null && isWriterCapableSource(importedSource),
      false,
      `${file} no debe cargar dinámicamente ${importedSource}`,
    )

    if (node.callee?.type === 'Identifier') {
      assert.equal(
        WRITER_SET.has(node.callee.name) || node.callee.name === 'api' || node.callee.name === 'fetch',
        false,
        `${file} no debe ejecutar ${node.callee.name}()`,
      )
    }

    const memberWriter = forbiddenMemberCall(node.callee)
    assert.equal(memberWriter, null, `${file} no debe ejecutar ${memberWriter}()`)
  })
}

test('las siete rutas secundarias conservan role gate y componentes auditados', () => {
  assertAuditedRouteStructure(src('App.jsx'))
})

test('cada superficie conserva exactamente sus imports de lectura auditados', () => {
  for (const file of Object.keys(AUDITED_IMPORTS)) {
    assertAuditedReadConsumerImports(file, src(file))
  }
})

test('la auditoría rechaza una importación default adicional del servicio auditado', () => {
  const file = 'modules/supervisor-ventas/ScreenDashboardVentas.jsx'
  const withExtraDefaultImport = replaceExactlyOnce(
    src(file),
    "import { apiGet, getSession } from '../../lib/api.js'",
    "import { apiGet, getSession } from '../../lib/api.js'\nimport apiClient from '../../lib/api.js'",
  )

  assert.throws(() => assertAuditedReadConsumerImports(file, withExtraDefaultImport))

  const withAliasedWriterImport = replaceExactlyOnce(
    src(file),
    "import { apiGet, getSession } from '../../lib/api.js'",
    "import { apiGet, getSession, apiPost as sendDashboard } from '../../lib/api.js'",
  )

  assert.throws(() => assertAuditedReadConsumerImports(file, withAliasedWriterImport))
})

test('la auditoría rechaza una ruta secundaria envuelta en V2ExcludedRoute', () => {
  const withExcludedDashboard = replaceExactlyOnce(
    src('App.jsx'),
    '<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenDashboardVentas /></ModuleRoleRoute>',
    '<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenDashboardVentas />} /></ModuleRoleRoute>',
  )

  assert.throws(() => assertAuditedRouteStructure(withExcludedDashboard))
})

test('la auditoría rechaza llamadas de escritura ejecutables, no comentarios ni strings', () => {
  const file = 'modules/supervisor-ventas/ScreenDashboardVentas.jsx'
  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\napiPost()`))
  assert.doesNotThrow(() => assertAuditedReadConsumerImports(file, `${src(file)}\n// apiPost()\nconst label = 'apiPost()'`))
})

test('la auditoría cierra writers importados y writes por miembro fuera de los módulos auditados', () => {
  const file = 'modules/supervisor-ventas/ScreenDashboardVentas.jsx'
  const withWriterFromOtherService = replaceExactlyOnce(
    src(file),
    "import { apiGet, getSession } from '../../lib/api.js'",
    "import { apiGet, getSession } from '../../lib/api.js'\nimport { apiPost as writeDashboard } from '../otro-servicio'",
  )

  assert.throws(() => assertAuditedReadConsumerImports(file, `${withWriterFromOtherService}\nwriteDashboard()`))
  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\nwindow.fetch('/escritura')`))
  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\napiClient.post('/escritura')`))
  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\nclient.apiPost('/escritura')`))
  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\nclient['apiPost']('/escritura')`))
  assert.doesNotThrow(() => assertAuditedReadConsumerImports(file, `${src(file)}\napiClient.get('/lectura')`))

  const withDefaultApiImport = replaceExactlyOnce(
    src(file),
    "import { apiGet, getSession } from '../../lib/api.js'",
    "import { apiGet, getSession } from '../../lib/api.js'\nimport apiClient from '../otro-api'",
  )
  assert.throws(() => assertAuditedReadConsumerImports(file, withDefaultApiImport))

  const withNamespaceServiceImport = replaceExactlyOnce(
    src(file),
    "import { apiGet, getSession } from '../../lib/api.js'",
    "import { apiGet, getSession } from '../../lib/api.js'\nimport * as serviceClient from '../otro-service'",
  )
  assert.throws(() => assertAuditedReadConsumerImports(file, withNamespaceServiceImport))

  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\nimport('../otro-api')`))
  assert.throws(() => assertAuditedReadConsumerImports(file, `${src(file)}\nimport('../otro-componente').apiPost('/escritura')`))
  assert.doesNotThrow(() => assertAuditedReadConsumerImports(file, `${src(file)}\nimport('../componentes/lectura')`))
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
