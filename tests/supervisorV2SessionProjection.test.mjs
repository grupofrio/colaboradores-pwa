import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import { readUtf8Lf } from './helpers/readUtf8Lf.mjs'

import { buildSupervisorV2SessionProjection } from '../src/modules/supervisor-ventas/v2/sessionProjection.js'

test('login projection: exact true/true is preserved', () => {
  assert.deepEqual(buildSupervisorV2SessionProjection({
    capabilities: { supervisorV2: true, supervisorCopilot: true },
    branch: { supervisor_v2_enabled: true },
  }), {
    capabilities: { supervisorV2: true, supervisorCopilot: true },
    branch: { supervisor_v2_enabled: true },
  })
})

test('login projection: malformed values fail closed', () => {
  for (const raw of [
    null, {},
    { capabilities: { supervisorV2: 1 }, branch: { supervisor_v2_enabled: 'true' } },
    { capabilities: [], branch: [] },
  ]) {
    const projected = buildSupervisorV2SessionProjection(raw)
    assert.equal(projected.capabilities.supervisorV2, false)
    assert.equal(projected.branch.supervisor_v2_enabled, false)
  }
})

test('login projection: inherited top-level containers fail closed', () => {
  const result = Object.create({
    capabilities: { supervisorV2: true, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: true },
  })

  assert.deepEqual(buildSupervisorV2SessionProjection(result), {
    capabilities: { supervisorV2: false, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('login projection: inherited flags fail closed', () => {
  assert.deepEqual(buildSupervisorV2SessionProjection({
    capabilities: Object.create({ supervisorV2: true }),
    branch: Object.create({ supervisor_v2_enabled: true }),
  }), {
    capabilities: { supervisorV2: false, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('login projection: arrays with true expando flags fail closed', () => {
  const capabilities = []
  capabilities.supervisorV2 = true
  const branch = []
  branch.supervisor_v2_enabled = true

  assert.deepEqual(buildSupervisorV2SessionProjection({ capabilities, branch }), {
    capabilities: { supervisorV2: false, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: false },
  })
})

test('login projection: null-prototype records preserve own true flags', () => {
  const result = Object.create(null)
  result.capabilities = Object.create(null)
  result.capabilities.supervisorV2 = true
  result.branch = Object.create(null)
  result.branch.supervisor_v2_enabled = true

  assert.deepEqual(buildSupervisorV2SessionProjection(result), {
    capabilities: { supervisorV2: true, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: true },
  })
})

test('login projection: partial shapes preserve only the exact boolean present', () => {
  assert.deepEqual(buildSupervisorV2SessionProjection({
    capabilities: { supervisorV2: true, supervisorCopilot: false },
  }), {
    capabilities: { supervisorV2: true, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: false },
  })
  assert.deepEqual(buildSupervisorV2SessionProjection({
    branch: { supervisor_v2_enabled: true },
  }), {
    capabilities: { supervisorV2: false, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: true },
  })
})

test('login projection: each call returns fresh nested objects', () => {
  const input = {
    capabilities: { supervisorV2: true, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: true },
  }
  const first = buildSupervisorV2SessionProjection(input)
  const second = buildSupervisorV2SessionProjection(input)

  assert.notStrictEqual(first.capabilities, second.capabilities)
  assert.notStrictEqual(first.branch, second.branch)
})

test('login projection: projection does not mutate input', () => {
  const input = {
    capabilities: { supervisorV2: true, untouched: 'capabilities' },
    branch: { supervisor_v2_enabled: true, untouched: 'branch' },
    untouched: 'result',
  }
  const before = structuredClone(input)

  buildSupervisorV2SessionProjection(input)

  assert.deepEqual(input, before)
})

test('login projection: merging an OFF projection overwrites a prior ON projection', () => {
  const on = buildSupervisorV2SessionProjection({
    capabilities: { supervisorV2: true, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: true },
  })
  const off = buildSupervisorV2SessionProjection({})
  const rebuiltSession = { ...on, ...off }
  assert.deepEqual(rebuiltSession, {
    capabilities: { supervisorV2: false, supervisorCopilot: false },
    branch: { supervisor_v2_enabled: false },
  })
})

const screenLoginSource = readUtf8Lf(fileURLToPath(
  new URL('../src/screens/ScreenLogin.jsx', import.meta.url),
))

function replaceExactlyOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, `mutation target must occur exactly once: ${before}`)
  return source.replace(before, after)
}

function walkFunctionScope(functionNode, visitor) {
  const functionTypes = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ObjectMethod',
    'ClassMethod',
  ])

  function walk(node, isRoot = false) {
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (!node || typeof node !== 'object') return
    if (!isRoot && functionTypes.has(node.type)) return

    if (typeof node.type === 'string') visitor(node)
    for (const [key, value] of Object.entries(node)) {
      if (['comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue
      walk(value)
    }
  }

  walk(functionNode, true)
}

function isProjectionSpread(property) {
  const call = property?.type === 'SpreadElement' ? property.argument : null
  return call?.type === 'CallExpression'
    && call.callee?.type === 'Identifier'
    && call.callee.name === 'buildSupervisorV2SessionProjection'
    && call.arguments.length === 1
    && call.arguments[0]?.type === 'Identifier'
    && call.arguments[0].name === 'result'
}

function isNamedProperty(property, name) {
  return property?.type === 'ObjectProperty'
    && !property.computed
    && (
      (property.key?.type === 'Identifier' && property.key.name === name)
      || (property.key?.type === 'StringLiteral' && property.key.value === name)
    )
}

function assertScreenLoginSupervisorV2Wiring(src) {
  const ast = parse(src, {
    sourceType: 'module',
    plugins: ['jsx'],
  })

  const projectionImports = ast.program.body.filter((node) => (
    node.type === 'ImportDeclaration'
    && node.source.value === '../modules/supervisor-ventas/v2/sessionProjection.js'
  ))
  assert.equal(projectionImports.length, 1, 'expected exactly one projection import declaration')

  const projectionSpecifiers = projectionImports[0].specifiers.filter((specifier) => (
    specifier.type === 'ImportSpecifier'
    && specifier.imported?.type === 'Identifier'
    && specifier.imported.name === 'buildSupervisorV2SessionProjection'
    && specifier.local?.type === 'Identifier'
    && specifier.local.name === 'buildSupervisorV2SessionProjection'
  ))
  assert.equal(projectionImports[0].specifiers.length, 1, 'projection import must have exactly one specifier')
  assert.equal(projectionSpecifiers.length, 1, 'projection import must use the exact imported and local names')

  const sessionBuilders = ast.program.body.filter((node) => (
    node.type === 'FunctionDeclaration'
    && node.id?.name === 'buildSessionFromOdoo'
  ))
  assert.equal(sessionBuilders.length, 1, 'expected exactly one buildSessionFromOdoo function declaration')

  const functionNodes = []
  walkFunctionScope(sessionBuilders[0], (node) => functionNodes.push(node))

  const fallbackDeclarators = functionNodes.filter((node) => (
    node.type === 'VariableDeclarator'
    && node.id?.type === 'Identifier'
    && node.id.name === 'fallbackPayload'
  ))
  assert.equal(fallbackDeclarators.length, 1, 'expected exactly one fallbackPayload declarator in buildSessionFromOdoo')
  assert.equal(fallbackDeclarators[0].init?.type, 'ObjectExpression', 'fallbackPayload must be an object expression')

  const fallbackProperties = fallbackDeclarators[0].init.properties
  assert.ok(isProjectionSpread(fallbackProperties[0]), 'projection call must be the first fallbackPayload property')
  assert.equal(fallbackProperties.filter(isProjectionSpread).length, 1, 'expected exactly one projection spread')

  const sourceProperties = fallbackProperties
    .map((property, index) => ({ property, index }))
    .filter(({ property }) => isNamedProperty(property, 'source'))
  assert.equal(sourceProperties.length, 1, 'expected exactly one fallbackPayload source property')
  assert.equal(sourceProperties[0].property.value?.type, 'StringLiteral', 'fallbackPayload source must be a string literal')
  assert.equal(sourceProperties[0].property.value.value, 'odoo', 'fallbackPayload source must be "odoo"')
  assert.ok(sourceProperties[0].index > 0, 'fallbackPayload source must appear after the projection spread')

  const normalizeCalls = functionNodes.filter((node) => (
    node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'normalizeSessionRoleContext'
  ))
  assert.equal(normalizeCalls.length, 1, 'expected exactly one normalizeSessionRoleContext call in buildSessionFromOdoo')
  assert.equal(normalizeCalls[0].arguments.length, 1, 'normalizeSessionRoleContext must receive exactly one argument')
  assert.equal(normalizeCalls[0].arguments[0]?.type, 'ObjectExpression', 'normalizeSessionRoleContext argument must be an object')

  const finalSessionProperties = normalizeCalls[0].arguments[0].properties
  const finalSpreadNames = finalSessionProperties
    .filter((property) => property.type === 'SpreadElement' && property.argument?.type === 'Identifier')
    .map((property) => property.argument.name)
  assert.equal(finalSpreadNames.filter((name) => name === 'decoded').length, 1, 'expected exactly one decoded spread')
  assert.equal(finalSpreadNames.filter((name) => name === 'fallbackPayload').length, 1, 'expected exactly one fallbackPayload spread')
  assert.ok(
    finalSpreadNames.indexOf('decoded') < finalSpreadNames.indexOf('fallbackPayload'),
    'decoded must be spread before fallbackPayload',
  )
}

test('ScreenLogin has the required Supervisor V2 session wiring', () => {
  assertScreenLoginSupervisorV2Wiring(screenLoginSource)
})

test('ScreenLogin wiring rejects the projection import converted to a comment', () => {
  const withoutExecutableImport = replaceExactlyOnce(
    screenLoginSource,
    "import { buildSupervisorV2SessionProjection } from '../modules/supervisor-ventas/v2/sessionProjection.js'",
    "// import { buildSupervisorV2SessionProjection } from '../modules/supervisor-ventas/v2/sessionProjection.js'",
  )

  assert.throws(() => assertScreenLoginSupervisorV2Wiring(withoutExecutableImport))
})

test('ScreenLogin wiring rejects the projection spread converted to a comment', () => {
  const withoutExecutableSpread = replaceExactlyOnce(
    screenLoginSource,
    '    ...buildSupervisorV2SessionProjection(result),',
    '    // ...buildSupervisorV2SessionProjection(result)',
  )

  assert.throws(() => assertScreenLoginSupervisorV2Wiring(withoutExecutableSpread))
})

test('ScreenLogin wiring rejects the projection spread after source', () => {
  const projectionAfterSource = replaceExactlyOnce(
    screenLoginSource,
    `  const fallbackPayload = {
    ...buildSupervisorV2SessionProjection(result),
    source: "odoo",`,
    `  const fallbackPayload = {
    source: "odoo",
    ...buildSupervisorV2SessionProjection(result),`,
  )

  assert.throws(() => assertScreenLoginSupervisorV2Wiring(projectionAfterSource))
})

test('ScreenLogin wiring rejects fallbackPayload before decoded in the final session', () => {
  const fallbackBeforeDecoded = replaceExactlyOnce(
    screenLoginSource,
    `  return normalizeSessionRoleContext({
    ...decoded,
    ...fallbackPayload,`,
    `  return normalizeSessionRoleContext({
    ...fallbackPayload,
    ...decoded,`,
  )

  assert.throws(() => assertScreenLoginSupervisorV2Wiring(fallbackBeforeDecoded))
})
