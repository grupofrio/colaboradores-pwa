import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CATALOG,
  CONTRACT_VERSION,
  emptyCatalog,
  publishedScope,
  validateContract,
} from '../src/lib/capabilityContract.js'

const GDL_SCOPES = {
  company_ids: [34],
  plaza_ids: [12],
  warehouse_ids: [94],
  analytic_ids: [12],
}

function allowed(mode = 'confirm') {
  return {
    allowed: true,
    mode,
    scopes: { ...GDL_SCOPES },
    limit: null,
    currency: null,
    deny: null,
  }
}

function denied(code = 'not_granted') {
  return {
    allowed: false,
    mode: null,
    scopes: { company_ids: [], plaza_ids: [], warehouse_ids: [], analytic_ids: [] },
    limit: null,
    currency: null,
    deny: { code, reason: code },
  }
}

function validContract(overrides = {}) {
  const capabilities = Object.fromEntries(CATALOG.map((name) => [name, denied()]))
  capabilities['delivery.transfer.gdl'] = allowed()
  return {
    contract_version: CONTRACT_VERSION,
    effective_job_keys: ['almacenista_entregas'],
    published_scope: { company_id: 34, warehouse_id: 94 },
    capabilities,
    ...overrides,
  }
}

test('validateContract acepta un contrato v2 completo', () => {
  assert.equal(validateContract(validContract()).ok, true)
})

test('allowed debe ser booleano exacto', () => {
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = { ...allowed(), allowed: 'true' }
  assert.equal(validateContract(contract).ok, false)
  contract.capabilities['delivery.transfer.gdl'] = { ...allowed(), allowed: 1 }
  assert.equal(validateContract(contract).ok, false)
})

test('mode debe pertenecer al vocabulario cerrado', () => {
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = { ...allowed(), mode: 'write' }
  assert.equal(validateContract(contract).ok, false)
})

test('allowed:true con scopes vacios o incompletos se rechaza', () => {
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = {
    ...allowed(),
    scopes: { company_ids: [], plaza_ids: [], warehouse_ids: [], analytic_ids: [] },
  }
  assert.equal(validateContract(contract).ok, false)
  contract.capabilities['delivery.transfer.gdl'] = {
    ...allowed(),
    scopes: { company_ids: [34], plaza_ids: [12], warehouse_ids: [], analytic_ids: [] },
  }
  assert.equal(validateContract(contract).ok, false)
})

test('arrays con strings, 0 o duplicados se rechazan', () => {
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = {
    ...allowed(),
    scopes: { ...GDL_SCOPES, company_ids: [34, '34'] },
  }
  assert.equal(validateContract(contract).ok, false)
  contract.capabilities['delivery.transfer.gdl'] = {
    ...allowed(),
    scopes: { ...GDL_SCOPES, warehouse_ids: [0] },
  }
  assert.equal(validateContract(contract).ok, false)
  contract.capabilities['delivery.transfer.gdl'] = {
    ...allowed(),
    scopes: { ...GDL_SCOPES, warehouse_ids: [94, 94] },
  }
  assert.equal(validateContract(contract).ok, false)
})

test('catalogo incompleto se rechaza', () => {
  const contract = validContract()
  contract.capabilities = { 'delivery.transfer.gdl': allowed() }
  assert.equal(validateContract(contract).ok, false)
})

test('entrada permitida no lleva deny; denegada no concede por truthy', () => {
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = {
    ...allowed(),
    deny: { code: 'not_granted', reason: 'x' },
  }
  assert.equal(validateContract(contract).ok, false)
  const proto = Object.create({ 'pos.read': { allowed: true } })
  proto.contract_version = CONTRACT_VERSION
  proto.capabilities = emptyCatalog()
  assert.equal(validateContract(proto).ok, true)
  assert.equal(validateContract(proto).contract.capabilities['pos.read'].allowed, false)
})

test('objetos con prototipo o propiedades heredadas no conceden scope', () => {
  const inheritedScopes = Object.create({
    company_ids: [34],
    plaza_ids: [12],
    warehouse_ids: [94],
    analytic_ids: [12],
  })
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = { ...allowed(), scopes: inheritedScopes }
  assert.equal(validateContract(contract).ok, false)

  const inheritedContract = Object.create({
    contract_version: CONTRACT_VERSION,
    capabilities: validContract().capabilities,
  })
  assert.equal(validateContract(inheritedContract).ok, false)
})

test('limite sin moneda se rechaza; published_scope solo si el contrato valida', () => {
  const contract = validContract()
  contract.capabilities['delivery.transfer.gdl'] = { ...allowed(), limit: 100, currency: null }
  assert.equal(validateContract(contract).ok, false)
  assert.equal(publishedScope({ contract_version: '1.0', published_scope: { company_id: 34, warehouse_id: 94 } }), null)
  assert.ok(publishedScope(validContract()))
})
