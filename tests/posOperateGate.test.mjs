import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  CATALOG,
  capabilityAllowed,
  validateContract,
} from '../src/lib/capabilityContract.js'
import {
  isPosNavigationVisible,
} from '../src/lib/navModel.js'
import { adminRouteAllows } from '../src/modules/admin/adminRouteAccess.js'
import {
  ADMIN_POS_FLOW,
  ADMIN_POS_CONSULT_ONLY_COPY,
  DAY_POS_FLOW,
  NIGHT_POS_FLOW,
  assertCanonicalPosOperateAllowed,
  canMutateCanonicalPos,
  emptyPosCustomer,
  posClientIdentityKey,
  requiresCanonicalPosOperate,
} from '../src/modules/admin/posFlow.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const fixture = (name) => JSON.parse(readFileSync(
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
  'utf8',
))

const GDL = fixture('capability_contract_v2_gdl.json')
const GDL_SESSION = {
  employee_id: 694,
  role: 'almacenista_entregas',
  additional_job_keys: ['auxiliar_admin', 'comprador', 'operador_torres'],
}

const readyGate = {
  capsReady: true,
  scopeState: 'ready',
  identityMatches: true,
  odooUnavailable: false,
}

function withOperateAllowed(contract) {
  const next = structuredClone(contract)
  next.capabilities['pos.operate'] = {
    allowed: true,
    mode: 'capture',
    scopes: structuredClone(contract.capabilities['pos.read'].scopes),
    limit: null,
    currency: null,
    deny: null,
  }
  return next
}

function confirmPayGuardSlice(source) {
  const start = source.indexOf('async function confirmPay()')
  const call = source.indexOf('createSaleOrder(', start)
  assert.ok(start >= 0, 'confirmPay missing')
  assert.ok(call > start, 'createSaleOrder missing after confirmPay')
  return source.slice(start, call)
}

test('canonical admin POS requires pos.operate; day and night do not', () => {
  assert.equal(requiresCanonicalPosOperate(ADMIN_POS_FLOW), true)
  assert.equal(requiresCanonicalPosOperate(DAY_POS_FLOW), false)
  assert.equal(requiresCanonicalPosOperate(NIGHT_POS_FLOW), false)
  assert.equal(requiresCanonicalPosOperate(null), true)
  assert.equal(requiresCanonicalPosOperate({}), true)
})

test('pos.read without pos.operate keeps POS visible and writable controls closed', () => {
  assert.equal(validateContract(GDL).ok, true)
  assert.equal(capabilityAllowed(GDL, 'pos.read'), true)
  assert.equal(capabilityAllowed(GDL, 'pos.operate'), false)
  assert.equal(isPosNavigationVisible(GDL), true)
  assert.equal(adminRouteAllows('/admin/pos', ['auxiliar_admin'], {
    session: GDL_SESSION,
    capabilities: GDL,
  }), true)
  assert.equal(canMutateCanonicalPos({
    flow: ADMIN_POS_FLOW,
    contract: GDL,
    ...readyGate,
  }), false)
  assert.throws(
    () => assertCanonicalPosOperateAllowed({
      flow: ADMIN_POS_FLOW,
      contract: GDL,
      ...readyGate,
    }),
    { code: 'pos_operate_denied' },
  )
})

test('synthetic valid pos.operate enables mutation only after loading finishes', () => {
  const operated = withOperateAllowed(GDL)
  assert.equal(validateContract(operated).ok, true)
  assert.equal(capabilityAllowed(operated, 'pos.operate'), true)
  assert.equal(canMutateCanonicalPos({
    flow: ADMIN_POS_FLOW,
    contract: operated,
    capsReady: false,
    scopeState: 'loading',
    identityMatches: true,
  }), false)
  assert.equal(canMutateCanonicalPos({
    flow: ADMIN_POS_FLOW,
    contract: operated,
    capsReady: true,
    scopeState: 'loading',
    identityMatches: true,
  }), false)
  assert.equal(canMutateCanonicalPos({
    flow: ADMIN_POS_FLOW,
    contract: operated,
    ...readyGate,
  }), true)
})

test('identity change, late contract, 401/403/503 and invalid contract close writes', () => {
  const operated = withOperateAllowed(GDL)
  const closedCases = [
    { identityMatches: false },
    { capsReady: false, scopeState: 'ready' },
    { scopeState: 'unavailable' },
    { odooUnavailable: true },
    { httpStatus: 401 },
    { httpStatus: 403 },
    { httpStatus: 503 },
    { httpStatus: 502 },
    { httpStatus: 504 },
    { contract: { contract_version: '2.0' } },
    { contract: null },
  ]
  for (const extra of closedCases) {
    assert.equal(canMutateCanonicalPos({
      flow: ADMIN_POS_FLOW,
      contract: operated,
      ...readyGate,
      ...extra,
    }), false, extra)
  }
})

test('day and night flows stay independent of the canonical operate catalog', () => {
  assert.equal(canMutateCanonicalPos({
    flow: DAY_POS_FLOW,
    contract: GDL,
    capsReady: false,
    scopeState: 'loading',
    identityMatches: false,
  }), true)
  assert.equal(canMutateCanonicalPos({
    flow: NIGHT_POS_FLOW,
    contract: GDL,
    capsReady: false,
    identityMatches: false,
    httpStatus: 503,
  }), true)
})

test('CATALOG still lists pos.operate as a distinct key from pos.read', () => {
  assert.ok(CATALOG.includes('pos.read'))
  assert.ok(CATALOG.includes('pos.operate'))
  assert.notEqual(CATALOG.indexOf('pos.read'), CATALOG.indexOf('pos.operate'))
})

test('AdminPosForm and ScreenPOS guard pos.operate immediately before createSaleOrder', () => {
  const form = confirmPayGuardSlice(src('../src/modules/admin/forms/AdminPosForm.jsx'))
  const mobile = confirmPayGuardSlice(src('../src/modules/admin/ScreenPOS.jsx'))
  for (const slice of [form, mobile]) {
    assert.match(slice, /assertCanonicalPosOperateAllowed\(/)
    assert.match(slice, /canMutateCanonicalPos\(|canOperatePos/)
    assert.ok(
      slice.indexOf('assertCanonicalPosOperateAllowed(')
      < slice.length,
    )
  }
  const nav = src('../src/lib/navModel.js')
  assert.match(nav, /capabilityAllowed\(capabilities, 'pos.read'\)/)
  assert.doesNotMatch(nav, /capabilityAllowed\(capabilities, 'pos.operate'\)/)
})

test('AdminPosForm and ScreenPOS do not send client pricelist_id on sale-create', () => {
  const form = src('../src/modules/admin/forms/AdminPosForm.jsx')
  const mobile = src('../src/modules/admin/ScreenPOS.jsx')
  for (const slice of [form, mobile]) {
    assert.match(slice, /createSaleOrder\(\{/)
    assert.doesNotMatch(slice, /pricelist_id:\s*pricelist/)
  }
})

test('remount and identity change do not invent pos.operate', () => {
  const operated = withOperateAllowed(GDL)
  assert.equal(canMutateCanonicalPos({
    flow: ADMIN_POS_FLOW,
    contract: operated,
    capsReady: true,
    scopeState: 'ready',
    identityMatches: false,
  }), false)
  assert.deepEqual(emptyPosCustomer(ADMIN_POS_FLOW).name, '')
  assert.notEqual(
    posClientIdentityKey({
      flow: ADMIN_POS_FLOW,
      sessionIdentity: '738',
      warehouseId: 89,
    }),
    posClientIdentityKey({
      flow: ADMIN_POS_FLOW,
      sessionIdentity: '694',
      warehouseId: 94,
    }),
  )
})

test('admin POS consult-only copy is shown when operate is closed', () => {
  assert.match(ADMIN_POS_CONSULT_ONLY_COPY, /solo para consulta/i)
  assert.match(ADMIN_POS_CONSULT_ONLY_COPY, /no están habilitados/i)
  assert.doesNotMatch(ADMIN_POS_CONSULT_ONLY_COPY, /POS funcionando/)
  const form = src('../src/modules/admin/forms/AdminPosForm.jsx')
  const mobile = src('../src/modules/admin/ScreenPOS.jsx')
  for (const slice of [form, mobile]) {
    assert.match(slice, /ADMIN_POS_CONSULT_ONLY_COPY/)
    assert.doesNotMatch(slice, /El cobro no está habilitado\. Puedes consultar el catálogo\./)
  }
})
