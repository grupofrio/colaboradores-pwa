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
  isEntregasNavigationVisible,
  isLiquidationNavigationVisible,
  isPosNavigationVisible,
  isTraspasoMpNavigationVisible,
} from '../src/lib/navModel.js'
import { adminRouteAllows } from '../src/modules/admin/adminRouteAccess.js'

const fixture = (name) => JSON.parse(readFileSync(
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
  'utf8',
))

const GDL = fixture('capability_contract_v2_gdl.json')
const IGU = fixture('capability_contract_v2_iguala.json')
const GDL_SESSION = {
  employee_id: 694,
  role: 'almacenista_entregas',
  additional_job_keys: ['auxiliar_admin', 'comprador', 'operador_torres'],
}
const IGU_SESSION = {
  employee_id: 1,
  role: 'almacenista_entregas',
  additional_job_keys: [],
}

test('fixture GDL del productor es compatible y abre POS, Liquidaciones y Entregas', () => {
  assert.equal(validateContract(GDL).ok, true)
  for (const name of CATALOG) {
    assert.equal(typeof GDL.capabilities[name]?.allowed, 'boolean', name)
  }
  assert.equal(GDL.published_scope.company_id, 34)
  assert.equal(GDL.published_scope.warehouse_id, 94)
  assert.equal(GDL.published_scope.city_code, 'GDL')
  assert.equal(capabilityAllowed(GDL, 'pos.read'), true)
  assert.equal(capabilityAllowed(GDL, 'pos.operate'), false)
  assert.equal(isPosNavigationVisible(GDL), true)
  assert.equal(isLiquidationNavigationVisible(GDL_SESSION.additional_job_keys, GDL), true)
  assert.equal(isEntregasNavigationVisible(GDL), true)
  assert.equal(isTraspasoMpNavigationVisible(GDL), false)
  assert.equal(capabilityAllowed(GDL, 'delivery.transfer.iguala'), false)
  assert.equal(capabilityAllowed(GDL, 'delivery.return.iguala'), false)
  assert.equal(adminRouteAllows('/admin/pos', ['auxiliar_admin'], {
    session: GDL_SESSION,
    capabilities: GDL,
  }), true)
  assert.equal(adminRouteAllows('/admin/liquidaciones', ['auxiliar_admin'], {
    session: GDL_SESSION,
    capabilities: GDL,
  }), true)
})

test('fixture Iguala abre Entregas, niega alias GDL y no amplía POS sin admin', () => {
  assert.equal(validateContract(IGU).ok, true)
  assert.equal(isEntregasNavigationVisible(IGU), true)
  assert.equal(capabilityAllowed(IGU, 'delivery.transfer.iguala'), true)
  assert.equal(capabilityAllowed(IGU, 'delivery.transfer.gdl'), false)
  assert.equal(capabilityAllowed(IGU, 'pos.read'), false)
  assert.equal(isPosNavigationVisible(IGU), false)
  assert.equal(isLiquidationNavigationVisible(['almacenista_entregas'], IGU), false)
  assert.equal(adminRouteAllows('/admin/pos', ['almacenista_entregas'], {
    session: IGU_SESSION,
    capabilities: IGU,
  }), false)
  assert.equal(adminRouteAllows('/admin/liquidaciones', ['almacenista_entregas'], {
    session: IGU_SESSION,
    capabilities: IGU,
  }), false)
})

test('ampliar CATALOG exige actualizar el consumidor: el fixture GDL cubre el catálogo actual', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/lib/capabilityContract.js', import.meta.url)), 'utf8')
  assert.match(src, /Keep in lockstep with gf_pwa_admin CATALOG/)
  for (const name of CATALOG) {
    assert.ok(Object.prototype.hasOwnProperty.call(GDL.capabilities, name), name)
    assert.ok(Object.prototype.hasOwnProperty.call(IGU.capabilities, name), name)
  }
})
