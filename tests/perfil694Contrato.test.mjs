import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  CATALOG,
  CONTRACT_VERSION,
  capabilityAllowed,
  capabilityDeny,
  emptyCatalog,
  publishedScope,
  validateContract,
} from '../src/lib/capabilityContract.js'
import {
  getAuthorizationJobKeys,
  getEffectiveJobKeys,
} from '../src/lib/roleContext.js'
import {
  isLiquidationNavigationVisible,
  isTraspasoMpNavigationVisible,
} from '../src/lib/navModel.js'
import {
  adminRouteAllows,
  navItemsForRoles,
} from '../src/modules/admin/adminRouteAccess.js'
import {
  applyCapabilities,
  BACKEND_CAPS,
} from '../src/modules/admin/adminService.js'
import {
  nextAdminCompanyId,
  sessionUntouchedByAdminCompany,
} from '../src/modules/admin/adminLocalCompany.js'
import { isGerentePilotReadOnly } from '../src/modules/admin/gerentePilotCaps.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const MARISOL = {
  employee_id: 694,
  role: 'almacenista_entregas',
  additional_job_keys: ['auxiliar_admin', 'comprador', 'operador_torres'],
  company_id: 34,
  warehouse_id: 94,
  plaza_id: 'GUADALAJARA',
  employee_has_user: false,
  odoo_employee_token: 'token-694',
}

const GDL_SCOPES = {
  company_ids: [34],
  plaza_ids: [12],
  warehouse_ids: [94],
  analytic_ids: [12],
}

function denied(code, mode = null) {
  return {
    allowed: false,
    mode,
    scopes: { company_ids: [], plaza_ids: [], warehouse_ids: [], analytic_ids: [] },
    limit: null,
    currency: null,
    deny: { code, reason: code },
  }
}

function allowed(mode, scopes = GDL_SCOPES) {
  return {
    allowed: true,
    mode,
    scopes,
    limit: null,
    currency: null,
    deny: null,
  }
}

function marisolCatalog(overrides = {}) {
  const catalog = {
    'materials.issue.iguala': denied('not_granted'),
    'delivery.transfer.gdl': allowed('confirm'),
    'delivery.return.gdl': allowed('capture'),
    'liquidation.read.gdl': allowed('read'),
    'liquidation.print.gdl': allowed('read'),
    'liquidation.receive_cash.gdl': denied('phase_not_enabled', 'capture'),
    'liquidation.validate.gdl': denied('phase_not_enabled', 'confirm'),
    'liquidation.authorize_discrepancy.gdl': denied('not_granted', 'approve'),
    'buyer.read': denied('not_granted'),
    'buyer.capture': denied('phase_not_enabled', 'capture'),
    'buyer.approve': denied('phase_not_enabled', 'approve'),
    'buyer.confirm': denied('phase_not_enabled', 'confirm'),
    'pos.read': allowed('read'),
    'pos.operate': denied('phase_not_enabled', 'capture'),
    'attendance.read': denied('phase_not_enabled', 'read'),
    'attendance.capture': denied('phase_not_enabled', 'capture'),
    'payroll.csc.read': denied('phase_not_enabled', 'read'),
    'payroll.csc.capture': denied('phase_not_enabled', 'capture'),
    ...overrides,
  }
  return catalog
}

function marisolContract(overrides = {}) {
  return {
    contract_version: CONTRACT_VERSION,
    effective_job_keys: [
      'almacenista_entregas',
      'auxiliar_admin',
      'comprador',
      'operador_torres',
    ],
    published_scope: {
      company_id: 34,
      company_label: 'GLACIEM',
      plaza_id: 12,
      plaza_label: 'GUADALAJARA',
      warehouse_id: 94,
      warehouse_label: 'CEDIS GDL',
      analytic_id: 12,
      from_actor: false,
    },
    capabilities: marisolCatalog(),
    requisitionApproval: false,
    ...overrides,
  }
}

function decision(route, session, capabilities) {
  const keys = getAuthorizationJobKeys(session)
  const menu = navItemsForRoles(keys, capabilities).some((item) => item.route === route)
  const deep = adminRouteAllows(route, keys, { session, capabilities })
  return { menu, deep }
}

test('1. ficha 694 resuelve los cuatro job keys efectivos', () => {
  assert.deepEqual(getEffectiveJobKeys(MARISOL), [
    'almacenista_entregas',
    'auxiliar_admin',
    'comprador',
    'operador_torres',
  ])
})

test('2. GDL permitido solo segun capacidades publicadas', () => {
  const contract = marisolContract()
  const parsed = validateContract(contract)
  assert.equal(parsed.ok, true)
  assert.equal(capabilityAllowed(contract, 'delivery.transfer.gdl'), true)
  assert.equal(capabilityAllowed(contract, 'delivery.return.gdl'), true)
  assert.equal(capabilityAllowed(contract, 'pos.read'), true)
  assert.equal(capabilityAllowed(contract, 'liquidation.read.gdl'), true)
  const scope = publishedScope(contract)
  assert.equal(scope.plaza_label, 'GUADALAJARA')
  assert.equal(capabilityAllowed(contract, 'materials.issue.iguala'), false)
})

test('3. Gerente, Direccion, Iguala, Talento y plazas ajenas denegados', () => {
  const contract = marisolContract()
  assert.equal(getAuthorizationJobKeys(MARISOL).includes('gerente_sucursal'), false)
  assert.equal(getAuthorizationJobKeys(MARISOL).includes('direccion_general'), false)
  assert.equal(capabilityAllowed(contract, 'materials.issue.iguala'), false)
  assert.equal(capabilityDeny(contract, 'materials.issue.iguala').code, 'not_granted')
  const deniedPlazas = ['Iguala', 'Direccion', 'Talento', 'Morelia']
  for (const label of deniedPlazas) {
    assert.notEqual(String(label).toUpperCase(), 'GUADALAJARA')
    assert.equal(publishedScope(contract).plaza_label.includes(label), false)
  }
  assert.equal(adminRouteAllows('/admin/gastos/aprobar', getEffectiveJobKeys(MARISOL), {
    session: MARISOL,
    capabilities: contract,
  }), false)
})

test('4. liquidation.authorize_discrepancy.gdl denegada', () => {
  const contract = marisolContract()
  assert.equal(capabilityAllowed(contract, 'liquidation.authorize_discrepancy.gdl'), false)
  assert.ok(capabilityDeny(contract, 'liquidation.authorize_discrepancy.gdl').code)
})

test('5. sin token, token vacio, contrato invalido o scope ambiguo: fail-closed', () => {
  assert.equal(validateContract(null).ok, false)
  assert.equal(validateContract({}).ok, false)
  assert.equal(validateContract({ contract_version: '1.0' }).ok, false)
  const empty = emptyCatalog('invalid_contract')
  assert.equal(empty['delivery.transfer.gdl'].allowed, false)
  assert.equal(capabilityAllowed({ capabilities: empty }, 'delivery.transfer.gdl'), false)

  applyCapabilities({}, { ...MARISOL, odoo_employee_token: '' })
  assert.equal(BACKEND_CAPS.contract_version, '')
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
  assert.equal(publishedScope(BACKEND_CAPS), null)

  const ambiguous = marisolContract({
    published_scope: null,
    capabilities: marisolCatalog({
      'delivery.transfer.gdl': denied('scope_ambiguous'),
      'liquidation.read.gdl': denied('scope_ambiguous'),
      'pos.read': denied('scope_ambiguous'),
    }),
  })
  assert.equal(validateContract(ambiguous).ok, true)
  assert.equal(capabilityAllowed(ambiguous, 'delivery.transfer.gdl'), false)
  assert.equal(capabilityDeny(ambiguous, 'pos.read').code, 'scope_ambiguous')
  assert.equal(isLiquidationNavigationVisible(getEffectiveJobKeys(MARISOL), ambiguous), false)
})

test('6. menu y deep link producen la misma decision', () => {
  const allowedCaps = marisolContract()
  const deniedCaps = marisolContract({
    capabilities: marisolCatalog({
      'liquidation.read.gdl': denied('not_granted'),
      'materials.issue.iguala': denied('not_granted'),
    }),
  })
  for (const route of ['/admin/liquidaciones', '/admin/traspaso-materia-prima', '/admin/pos']) {
    const open = decision(route, MARISOL, allowedCaps)
    assert.equal(open.menu, open.deep, `${route} allowed menu≠deep`)
    const closed = decision(route, MARISOL, deniedCaps)
    assert.equal(closed.menu, closed.deep, `${route} denied menu≠deep`)
  }
  const liqOn = decision('/admin/liquidaciones', MARISOL, allowedCaps)
  const liqOff = decision('/admin/liquidaciones', MARISOL, deniedCaps)
  assert.equal(liqOn.menu, true)
  assert.equal(liqOff.menu, false)
  assert.equal(
    isTraspasoMpNavigationVisible(deniedCaps),
    adminRouteAllows('/admin/traspaso-materia-prima', getAuthorizationJobKeys(MARISOL), {
      session: MARISOL,
      capabilities: deniedCaps,
    }),
  )
})

test('7. gerente_sucursal adicional no evade el clamp ni concede permisos', () => {
  const withGerente = {
    ...MARISOL,
    additional_job_keys: [...MARISOL.additional_job_keys, 'gerente_sucursal'],
  }
  assert.deepEqual(getEffectiveJobKeys(withGerente).slice(0, 4), [
    'almacenista_entregas',
    'auxiliar_admin',
    'comprador',
    'operador_torres',
  ])
  assert.ok(getEffectiveJobKeys(withGerente).includes('gerente_sucursal'))
  assert.equal(getAuthorizationJobKeys(withGerente).includes('gerente_sucursal'), false)
  assert.equal(isGerentePilotReadOnly(withGerente, { gerenteWritesEnabled: false }), false)
  const contract = marisolContract({
    effective_job_keys: getEffectiveJobKeys(withGerente),
    capabilities: marisolCatalog({
      'liquidation.authorize_discrepancy.gdl': denied('additional_job_does_not_grant', 'approve'),
    }),
    requisitionApproval: false,
  })
  applyCapabilities(contract, withGerente)
  assert.equal(BACKEND_CAPS.requisitionApproval, false)
  assert.equal(capabilityAllowed(contract, 'liquidation.authorize_discrepancy.gdl'), false)
  assert.equal(capabilityDeny(contract, 'liquidation.authorize_discrepancy.gdl').code, 'additional_job_does_not_grant')
  assert.equal(adminRouteAllows('/admin/gastos/aprobar', getEffectiveJobKeys(withGerente), {
    session: withGerente,
    capabilities: { ...contract, gerenteWritesEnabled: true },
  }), false)
})

test('8. Liquidaciones: capacidad falsa oculta, verdadera muestra, sin fijar oculto permanente', () => {
  const off = marisolContract({
    capabilities: marisolCatalog({ 'liquidation.read.gdl': denied('not_granted') }),
  })
  const on = marisolContract()
  assert.equal(isLiquidationNavigationVisible(getAuthorizationJobKeys(MARISOL), off), false)
  assert.equal(isLiquidationNavigationVisible(getAuthorizationJobKeys(MARISOL), on), true)
  const offDecision = decision('/admin/liquidaciones', MARISOL, off)
  const onDecision = decision('/admin/liquidaciones', MARISOL, on)
  assert.equal(offDecision.menu, false)
  assert.equal(onDecision.menu, true)
  assert.equal(onDecision.deep, true)
  assert.equal(capabilityAllowed(on, 'liquidation.receive_cash.gdl'), false)
  assert.equal(capabilityAllowed(on, 'liquidation.validate.gdl'), false)
})

test('9. selector local de Admin no modifica la sesion global ni Entregas', () => {
  const session = { ...MARISOL }
  const frozen = JSON.stringify(session)
  const companies = [
    { id: 34, name: 'GLACIEM' },
    { id: 35, name: 'Fabricación' },
    { id: 36, name: 'Vía Ágil' },
  ]
  const next = nextAdminCompanyId(companies, 34, 35)
  assert.equal(next, 35)
  assert.equal(JSON.stringify(sessionUntouchedByAdminCompany(session)), frozen)
  assert.equal(session.company_id, 34)
  assert.equal(session.warehouse_id, 94)

  const adminCtx = src('../src/modules/admin/AdminContext.jsx')
  assert.doesNotMatch(adminCtx, /updateSession\(\{\s*company_id/)
  assert.match(adminCtx, /nextAdminCompanyId/)
  const selector = src('../src/modules/admin/components/CompanySelector.jsx')
  assert.match(selector, /estado del módulo Admin/)
  assert.doesNotMatch(selector, /session\.company_id → localStorage/)
})

test('contrato invalido y catalogo incompleto se rechazan', () => {
  assert.equal(validateContract({
    contract_version: CONTRACT_VERSION,
    capabilities: { 'delivery.transfer.gdl': allowed('confirm') },
  }).ok, false)
  for (const name of CATALOG) {
    assert.equal(typeof emptyCatalog()[name].allowed, 'boolean')
    assert.equal(emptyCatalog()[name].allowed, false)
  }
})

test('no quedan fuentes divergentes de effectiveRoles.js', () => {
  assert.equal(existsSync(fileURLToPath(new URL('../src/lib/effectiveRoles.js', import.meta.url))), false)
  const roleContext = src('../src/lib/roleContext.js')
  assert.match(roleContext, /export function getEffectiveJobKeys/)
  assert.match(roleContext, /export function getAuthorizationJobKeys/)
  const api = src('../src/lib/api.js')
  const updateBlock = api.slice(
    api.indexOf("/pwa-admin/torre/requisition-update"),
    api.indexOf("/pwa-admin/torre/requisition-confirm"),
  )
  assert.match(updateBlock, /odooJson\('\/pwa-admin\/torre\/requisition-update'/)
  assert.doesNotMatch(updateBlock, /createUpdate/)
  assert.doesNotMatch(updateBlock, /sudo:\s*1/)
  assert.doesNotMatch(updateBlock, /employee_id/)
  assert.doesNotMatch(updateBlock, /company_id/)
  const contractSrc = src('../src/lib/capabilityContract.js')
  assert.doesNotMatch(contractSrc, /warehouse_id === 76/)
  assert.doesNotMatch(contractSrc, /warehouse_id === 89/)
  assert.doesNotMatch(contractSrc, /warehouse_id === 94/)
})
