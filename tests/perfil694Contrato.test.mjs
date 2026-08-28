import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CATALOG,
  CAPABILITY_SURFACES,
  CONTRACT_VERSION,
  capabilityAllowed,
  capabilityDeny,
  emptyCatalog,
  publishedScope,
  publishedScopeSurface,
  validateContract,
} from '../src/lib/capabilityContract.js'
import {
  getAuthorizationJobKeys,
  getEffectiveJobKeys,
} from '../src/lib/roleContext.js'
import {
  getModuleRouteDecisionForSession,
  getModuleEntryDecisionForSession,
  getHomeModulesForSession,
  isEntregasNavigationVisible,
  isEntregasPlaceholderVisible,
  isLiquidationNavigationVisible,
  isPosNavigationVisible,
  isTraspasoMpNavigationVisible,
} from '../src/lib/navModel.js'
import {
  adminRouteAllows,
  navItemsForRoles,
} from '../src/modules/admin/adminRouteAccess.js'
import {
  applyCapabilities,
  BACKEND_CAPS,
  getOdooServiceState,
  invalidateCashShiftCapabilities,
  syncCapabilitiesIdentity,
} from '../src/modules/admin/adminService.js'
import { ODOO_UNAVAILABLE_MESSAGE, unavailableMetric } from '../src/lib/odooAvailability.js'
import {
  adminCompaniesFromPublishedScope,
  nextAdminCompanyId,
  sessionUntouchedByAdminCompany,
  syncAdminCompanyForIdentity,
} from '../src/modules/admin/adminLocalCompany.js'
import { isGerentePilotReadOnly } from '../src/modules/admin/gerentePilotCaps.js'
import { voicePlazaHintFromWarehouse, voicePlazaHintNeverAuthorizes } from '../src/lib/voicePlazaMetadata.js'
import { getModuleById } from '../src/modules/registry.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const srcRoot = fileURLToPath(new URL('../src', import.meta.url))

const MARISOL = {
  employee_id: 694,
  role: 'almacenista_entregas',
  additional_job_keys: ['auxiliar_admin', 'comprador', 'operador_torres'],
  company_id: 34,
  warehouse_id: 94,
  plaza_id: 'GUADALAJARA',
  employee_has_user: false,
  odoo_employee_token: 'token-694',
  session_token: 'h.p.s',
}

const OTHER = {
  employee_id: 738,
  role: 'auxiliar_admin',
  additional_job_keys: [],
  company_id: 1,
  warehouse_id: 89,
  plaza_id: 'IGUALA',
  odoo_employee_token: 'token-738',
  session_token: 'h.p.s',
}

const IGUALA_ENTREGAS = {
  employee_id: 24,
  role: 'almacenista_entregas',
  additional_job_keys: [],
  company_id: 1,
  warehouse_id: 89,
  plaza_id: 'IGUALA',
  odoo_employee_token: 'token-igu-entregas',
  session_token: 'h.p.s',
}

const IGUALA_NO_JOB = {
  employee_id: 23,
  role: 'almacenista_pt',
  additional_job_keys: [],
  company_id: 1,
  warehouse_id: 89,
  plaza_id: 'IGUALA',
  odoo_employee_token: 'token-igu-pt',
  session_token: 'h.p.s',
}

const GDL_SCOPES = {
  company_ids: [34],
  plaza_ids: [12],
  warehouse_ids: [94],
  analytic_ids: [12],
}

const IGU_SCOPES = {
  company_ids: [1],
  plaza_ids: [8],
  warehouse_ids: [89],
  analytic_ids: [8],
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
  return {
    'materials.issue.iguala': denied('not_granted'),
    'delivery.transfer': allowed('confirm'),
    'delivery.return': allowed('capture'),
    'delivery.transfer.gdl': allowed('confirm'),
    'delivery.return.gdl': allowed('capture'),
    'delivery.transfer.iguala': denied('cross_plaza'),
    'delivery.return.iguala': denied('cross_plaza'),
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
      city_code: 'GDL',
      from_actor: false,
    },
    capabilities: marisolCatalog(),
    requisitionApproval: false,
    ...overrides,
  }
}

function otherContract() {
  return {
    contract_version: CONTRACT_VERSION,
    effective_job_keys: ['auxiliar_admin'],
    published_scope: {
      company_id: 1,
      company_label: 'IGUALA',
      plaza_id: 8,
      plaza_label: 'IGUALA',
      warehouse_id: 89,
      warehouse_label: 'CEDIS IGU',
      analytic_id: 8,
      city_code: 'IGU',
      from_actor: false,
    },
    capabilities: marisolCatalog({
      'delivery.transfer': allowed('confirm', IGU_SCOPES),
      'delivery.return': allowed('capture', IGU_SCOPES),
      'delivery.transfer.gdl': denied('cross_plaza'),
      'delivery.return.gdl': denied('cross_plaza'),
      'delivery.transfer.iguala': allowed('confirm', IGU_SCOPES),
      'delivery.return.iguala': allowed('capture', IGU_SCOPES),
      'liquidation.read.gdl': denied('cross_plaza'),
      'liquidation.print.gdl': denied('cross_plaza'),
      'pos.read': allowed('read', IGU_SCOPES),
      'materials.issue.iguala': allowed('confirm', IGU_SCOPES),
    }),
    requisitionApproval: false,
  }
}

function igualaEntregasContract() {
  return {
    contract_version: CONTRACT_VERSION,
    effective_job_keys: ['almacenista_entregas'],
    published_scope: {
      company_id: 1,
      company_label: 'IGUALA',
      plaza_id: 8,
      plaza_label: 'IGUALA',
      warehouse_id: 89,
      warehouse_label: 'CEDIS IGU',
      analytic_id: 8,
      city_code: 'IGU',
      from_actor: true,
    },
    capabilities: marisolCatalog({
      'delivery.transfer': allowed('confirm', IGU_SCOPES),
      'delivery.return': allowed('capture', IGU_SCOPES),
      'delivery.transfer.gdl': denied('cross_plaza'),
      'delivery.return.gdl': denied('cross_plaza'),
      'delivery.transfer.iguala': allowed('confirm', IGU_SCOPES),
      'delivery.return.iguala': allowed('capture', IGU_SCOPES),
      'liquidation.read.gdl': denied('cross_plaza'),
      'liquidation.print.gdl': denied('cross_plaza'),
      'pos.read': denied('not_granted'),
      'materials.issue.iguala': denied('not_granted'),
    }),
    requisitionApproval: false,
  }
}

function igualaNoJobContract() {
  return {
    ...igualaEntregasContract(),
    effective_job_keys: ['almacenista_pt'],
    capabilities: marisolCatalog({
      'delivery.transfer': denied('not_granted'),
      'delivery.return': denied('not_granted'),
      'delivery.transfer.gdl': denied('cross_plaza'),
      'delivery.return.gdl': denied('cross_plaza'),
      'delivery.transfer.iguala': denied('not_granted'),
      'delivery.return.iguala': denied('not_granted'),
      'liquidation.read.gdl': denied('not_granted'),
      'liquidation.print.gdl': denied('not_granted'),
      'pos.read': denied('not_granted'),
      'materials.issue.iguala': denied('not_granted'),
    }),
  }
}

function decision(route, session, capabilities) {
  const keys = getAuthorizationJobKeys(session)
  const menu = navItemsForRoles(keys, capabilities).some((item) => item.route === route)
  const deep = adminRouteAllows(route, keys, { session, capabilities })
  return { menu, deep }
}

function walkJs(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkJs(path))
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(path)
  }
  return out
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
  assert.equal(capabilityAllowed(contract, 'pos.operate'), false)
  assert.equal(capabilityDeny(contract, 'pos.operate').code, 'phase_not_enabled')
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
  assert.equal(publishedScopeSurface(BACKEND_CAPS).state, 'unavailable')

  const ambiguous = marisolContract({
    published_scope: null,
    capabilities: marisolCatalog(
      Object.fromEntries(CATALOG.map((name) => [name, denied('scope_ambiguous')])),
    ),
  })
  assert.equal(validateContract(ambiguous).ok, true)
  assert.equal(capabilityAllowed(ambiguous, 'delivery.transfer.gdl'), false)
  assert.equal(capabilityDeny(ambiguous, 'pos.read').code, 'scope_ambiguous')
  assert.equal(isLiquidationNavigationVisible(getEffectiveJobKeys(MARISOL), ambiguous), false)
})

test('6. cada modulo: true y false, UI = deep link = endpoint', () => {
  const on = marisolContract()
  const cases = [
    {
      key: 'liquidation.read.gdl',
      route: '/admin/liquidaciones',
      menu: (caps) => isLiquidationNavigationVisible(getAuthorizationJobKeys(MARISOL), caps),
    },
    {
      key: 'pos.read',
      route: '/admin/pos',
      menu: (caps) => isPosNavigationVisible(caps),
    },
    {
      key: 'materials.issue.iguala',
      route: '/admin/traspaso-materia-prima',
      menu: (caps) => isTraspasoMpNavigationVisible(caps),
    },
  ]

  for (const item of cases) {
    const surface = CAPABILITY_SURFACES[item.key]
    assert.equal(surface.route, item.route, item.key)
    assert.ok(surface.endpoint.startsWith('/pwa-admin/'), item.key)

    const allowedCaps = marisolContract({
      capabilities: marisolCatalog({
        [item.key]: allowed(item.key === 'materials.issue.iguala' ? 'confirm' : 'read'),
      }),
    })
    const deniedCaps = marisolContract({
      capabilities: marisolCatalog({ [item.key]: denied('not_granted') }),
    })

    const open = decision(item.route, MARISOL, allowedCaps)
    const closed = decision(item.route, MARISOL, deniedCaps)
    assert.equal(item.menu(allowedCaps), true, `${item.key} menu true`)
    assert.equal(item.menu(deniedCaps), false, `${item.key} menu false`)
    assert.equal(open.menu, true, `${item.key} nav true`)
    assert.equal(open.deep, true, `${item.key} deep true`)
    assert.equal(closed.menu, false, `${item.key} nav false`)
    assert.equal(closed.deep, false, `${item.key} deep false`)
    assert.equal(capabilityAllowed(allowedCaps, item.key), true)
    assert.equal(capabilityAllowed(deniedCaps, item.key), false)
  }

  const entregasOn = marisolContract()
  const entregasOff = marisolContract({
    capabilities: marisolCatalog({
      'delivery.transfer': denied('not_granted'),
      'delivery.transfer.gdl': denied('not_granted'),
      'delivery.transfer.iguala': denied('cross_plaza'),
    }),
  })
  assert.equal(isEntregasNavigationVisible(entregasOn), true)
  assert.equal(isEntregasNavigationVisible(entregasOff), false)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, entregasOn), 'allow')
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, entregasOff), 'home')
  assert.equal(CAPABILITY_SURFACES['delivery.transfer'].endpoint, '/pwa-admin/dispatch-ticket')
  assert.equal(CAPABILITY_SURFACES['delivery.return'].endpoint, '/pwa-admin/dispatch-ticket')
  assert.equal(CAPABILITY_SURFACES['delivery.transfer.gdl'].endpoint, '/pwa-admin/dispatch-ticket')
  assert.equal(CAPABILITY_SURFACES['delivery.return.gdl'].endpoint, '/pwa-admin/dispatch-ticket')
  assert.equal(CAPABILITY_SURFACES['delivery.transfer.iguala'].endpoint, '/pwa-admin/dispatch-ticket')
  assert.equal(CAPABILITY_SURFACES['delivery.return.iguala'].endpoint, '/pwa-admin/dispatch-ticket')
  assert.equal(CAPABILITY_SURFACES['liquidation.receive_cash.gdl'].endpoint, '/pwa-admin/liquidaciones/receive-cash')
  assert.equal(capabilityAllowed(on, 'liquidation.receive_cash.gdl'), false)
  assert.equal(capabilityAllowed(on, 'pos.operate'), false)
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

test('8. Liquidaciones: capacidad falsa oculta, verdadera muestra, mutaciones cerradas', () => {
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
  assert.equal(capabilityAllowed(on, 'liquidation.authorize_discrepancy.gdl'), false)
  assert.equal(CAPABILITY_SURFACES['liquidation.validate.gdl'].endpoint, '/pwa-admin/liquidaciones/validate')
})

test('9. selector local de Admin no modifica la sesion global ni Entregas', () => {
  const session = { ...MARISOL }
  const frozen = JSON.stringify(session)
  const companies = adminCompaniesFromPublishedScope({ company_id: 34, company_label: 'GLACIEM' })
  assert.equal(companies.length, 1)
  assert.equal(nextAdminCompanyId(companies, 34, 35), 34)
  assert.equal(JSON.stringify(sessionUntouchedByAdminCompany(session)), frozen)
  assert.equal(session.company_id, 34)
  assert.equal(session.warehouse_id, 94)

  const adminCtx = src('../src/modules/admin/AdminContext.jsx')
  assert.doesNotMatch(adminCtx, /updateSession\(\{\s*company_id/)
  assert.doesNotMatch(adminCtx, /getCompaniesForSucursal/)
  assert.doesNotMatch(adminCtx, /softWarehouse/)
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

test('no quedan fuentes divergentes ni IDs fijos de plaza en autorizacion', () => {
  assert.equal(existsSync(fileURLToPath(new URL('../src/lib/effectiveRoles.js', import.meta.url))), false)
  const roleContext = src('../src/lib/roleContext.js')
  assert.match(roleContext, /export function getEffectiveJobKeys/)
  assert.match(roleContext, /export function getAuthorizationJobKeys/)
  assert.doesNotMatch(roleContext, /PLAZA_BY_WAREHOUSE/)
  const api = src('../src/lib/api.js')
  const updateBlock = api.slice(
    api.indexOf("/pwa-admin/torre/requisition-update"),
    api.indexOf("/pwa-admin/torre/requisition-confirm"),
  )
  assert.match(updateBlock, /odooHttp\('POST', '\/pwa-admin\/torre\/requisition-update'/)
  assert.doesNotMatch(updateBlock, /odooJson\('\/pwa-admin\/torre\/requisition-update'/)
  assert.doesNotMatch(updateBlock, /createUpdate/)
  assert.doesNotMatch(updateBlock, /sudo:\s*1/)
  assert.doesNotMatch(updateBlock, /employee_id/)
  assert.doesNotMatch(updateBlock, /company_id/)

  const authFiles = walkJs(srcRoot).filter((path) => !path.endsWith('voicePlazaMetadata.js'))
  for (const path of authFiles) {
    const text = readFileSync(path, 'utf8')
    assert.equal(text.includes('PLAZA_BY_WAREHOUSE'), false, path)
    assert.doesNotMatch(text, /94:\s*'GUADALAJARA'/, path)
    assert.doesNotMatch(text, /76:\s*'IGUALA'/, path)
    assert.doesNotMatch(text, /89:\s*'IGUALA'/, path)
  }
  assert.equal(voicePlazaHintFromWarehouse(94), 'GUADALAJARA')
  assert.equal(voicePlazaHintNeverAuthorizes(), true)
  assert.equal(isEntregasNavigationVisible({ warehouse_id: 94 }), false)
  assert.equal(isPosNavigationVisible({ warehouse_id: 94, pos: true }), false)
})

test('Entregas Iguala y GDL respetan la plaza publicada y fallan cerrados', () => {
  invalidateCashShiftCapabilities()
  const igu = igualaEntregasContract()
  const gdl = marisolContract()
  const noJob = igualaNoJobContract()
  const entregas = getModuleById('almacen_entregas')

  assert.equal(validateContract(igu).ok, true)
  assert.equal(capabilityAllowed(igu, 'delivery.transfer.iguala'), true)
  assert.equal(capabilityAllowed(igu, 'delivery.transfer.gdl'), false)
  assert.equal(isEntregasNavigationVisible(igu), true)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', IGUALA_ENTREGAS, undefined, igu), 'allow')
  assert.equal(getModuleEntryDecisionForSession(entregas, IGUALA_ENTREGAS, undefined, igu).type, 'direct')

  assert.equal(capabilityAllowed(gdl, 'delivery.transfer.gdl'), true)
  assert.equal(capabilityAllowed(gdl, 'delivery.transfer.iguala'), false)
  assert.equal(isEntregasNavigationVisible(gdl), true)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, gdl), 'allow')

  assert.equal(isEntregasNavigationVisible(noJob), false)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', IGUALA_NO_JOB, undefined, noJob), 'home')
  assert.equal(getModuleEntryDecisionForSession(entregas, IGUALA_NO_JOB, undefined, noJob).type, 'denied')

  assert.equal(capabilityAllowed(gdl, 'delivery.transfer.iguala'), false)
  assert.equal(capabilityAllowed(igu, 'delivery.transfer.gdl'), false)
  assert.equal(getModuleRouteDecisionForSession(
    'almacen_entregas',
    { ...MARISOL, warehouse_id: 89, plaza_id: 'IGUALA' },
    undefined,
    gdl,
  ), 'allow')
  assert.equal(getModuleRouteDecisionForSession(
    'almacen_entregas',
    { ...IGUALA_ENTREGAS, warehouse_id: 94, plaza_id: 'GUADALAJARA' },
    undefined,
    igu,
  ), 'allow')

  assert.equal(isEntregasNavigationVisible(null), false)
  assert.equal(isEntregasNavigationVisible({}), false)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, {}), 'home')
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, undefined), 'home')
})

test('738 → 694 y 694 → otra ficha no dejan remanentes en BACKEND_CAPS', () => {
  applyCapabilities(otherContract(), OTHER)
  assert.equal(BACKEND_CAPS.published_scope.warehouse_id, 89)
  assert.equal(BACKEND_CAPS.published_scope.company_id, 1)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'materials.issue.iguala'), true)

  applyCapabilities(marisolContract(), MARISOL)
  assert.equal(BACKEND_CAPS.published_scope.warehouse_id, 94)
  assert.equal(BACKEND_CAPS.published_scope.company_id, 34)
  assert.equal(BACKEND_CAPS.published_scope.plaza_label, 'GUADALAJARA')
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'materials.issue.iguala'), false)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), true)
  assert.equal(BACKEND_CAPS.effective_job_keys[0], 'almacenista_entregas')

  applyCapabilities(otherContract(), OTHER)
  assert.equal(BACKEND_CAPS.published_scope.warehouse_id, 89)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), true)
  assert.notEqual(BACKEND_CAPS.published_scope.company_id, 34)

  invalidateCashShiftCapabilities()
  assert.equal(BACKEND_CAPS.published_scope, null)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
})

test('cambio de identidad cierra el singleton antes del fetch de la ficha nueva', () => {
  const entregas = getModuleById('almacen_entregas')
  applyCapabilities(otherContract(), OTHER)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'materials.issue.iguala'), true)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), true)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
  assert.equal(isEntregasNavigationVisible(BACKEND_CAPS), true)

  const closedKey = syncCapabilitiesIdentity('738:token-a', '694:token-b')
  assert.equal(closedKey, '694:token-b')
  assert.equal(BACKEND_CAPS.published_scope, null)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'materials.issue.iguala'), false)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), false)
  assert.equal(isEntregasNavigationVisible(BACKEND_CAPS), false)
  assert.equal(
    getModuleEntryDecisionForSession(entregas, MARISOL, undefined, BACKEND_CAPS).type,
    'denied',
  )
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, BACKEND_CAPS), 'home')
  assert.equal(isEntregasPlaceholderVisible(MARISOL, BACKEND_CAPS), true)

  applyCapabilities(marisolContract(), MARISOL)
  assert.equal(
    getModuleEntryDecisionForSession(entregas, MARISOL, undefined, BACKEND_CAPS).type,
    'direct',
  )
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), true)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), false)

  syncCapabilitiesIdentity('694:token-b', '738:token-c')
  assert.equal(
    getModuleEntryDecisionForSession(entregas, OTHER, undefined, BACKEND_CAPS).type,
    'denied',
  )
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), false)
  assert.equal(isEntregasNavigationVisible(BACKEND_CAPS), false)

  const app = src('../src/App.jsx')
  assert.match(app, /syncCapabilitiesIdentity\(capsIdentityRef\.current, identityKey\)/)
  assert.match(app, /syncCapabilitiesIdentity\(/)
  const home = src('../src/screens/ScreenHome.jsx')
  assert.match(home, /getModuleEntryDecisionForSession\(mod, session, undefined, BACKEND_CAPS\)/)
})

test('almacenista_entregas no abre Entregas por rol si el contrato no está listo', () => {
  invalidateCashShiftCapabilities()
  const entregas = getModuleById('almacen_entregas')

  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), false)
  assert.equal(isEntregasNavigationVisible(BACKEND_CAPS), false)
  assert.equal(isEntregasPlaceholderVisible(MARISOL, BACKEND_CAPS), true)
  assert.equal(
    getModuleEntryDecisionForSession(entregas, MARISOL, undefined, BACKEND_CAPS).type,
    'denied',
  )
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, BACKEND_CAPS), 'home')
  assert.equal(
    getModuleEntryDecisionForSession(entregas, OTHER, undefined, BACKEND_CAPS).type,
    'denied',
  )
  const nav = src('../src/lib/navModel.js')
  assert.doesNotMatch(nav, /Fallback operacional/)
  assert.doesNotMatch(nav, /canAccessEntregasModule/)
  assert.match(nav, /delivery\.transfer\.iguala/)
  const home = src('../src/screens/ScreenHome.jsx')
  assert.match(home, /isEntregasPlaceholderVisible/)
})

test('selector Admin se resincroniza al cambiar identidad y no inventa multiempresa', () => {
  const published694 = publishedScope(marisolContract())
  const published738 = publishedScope(otherContract())
  const afterSwitch = syncAdminCompanyForIdentity({
    previousIdentity: '738',
    nextIdentity: '694',
    published: published694,
    currentCompanyId: 1,
  })
  assert.equal(afterSwitch, 34)
  const back = syncAdminCompanyForIdentity({
    previousIdentity: '694',
    nextIdentity: '738',
    published: published738,
    currentCompanyId: 34,
  })
  assert.equal(back, 1)
  assert.deepEqual(adminCompaniesFromPublishedScope(published694).map((row) => row.id), [34])
  assert.equal(adminCompaniesFromPublishedScope(null).length, 0)
})

test('perfil v2 no usa work_location_id ni company_id heredados', () => {
  const profile = src('../src/screens/ScreenProfile.jsx')
  assert.match(profile, /publishedScopeSurface\(BACKEND_CAPS\)/)
  assert.doesNotMatch(profile, /employee\.work_location_id/)
  assert.doesNotMatch(profile, /employee\.company_id\[1\]/)
  assert.match(profile, /Cargando/)
  assert.match(profile, /No disponible/)
  assert.match(profile, /ODOO_UNAVAILABLE_MESSAGE/)
  assert.match(profile, /ODOO_INCOMPATIBLE_MESSAGE/)
  assert.match(profile, /resolveProfileEmployeeData/)
  assert.equal(publishedScopeSurface({ capabilities: null }).state, 'loading')
  assert.equal(publishedScopeSurface({ capabilities: emptyCatalog() }).state, 'unavailable')
  assert.equal(publishedScopeSurface(marisolContract()).state, 'ready')
})

test('Marisol/GDL: Home muestra Entregas y Admin abre POS y Liquidaciones', () => {
  invalidateCashShiftCapabilities()
  applyCapabilities(marisolContract(), MARISOL)
  const homeIds = getHomeModulesForSession(MARISOL).map((module) => module.id)
  assert.ok(homeIds.includes('almacen_entregas'))
  const roles = getAuthorizationJobKeys(MARISOL)
  assert.equal(isPosNavigationVisible(BACKEND_CAPS), true)
  assert.equal(isLiquidationNavigationVisible(roles, BACKEND_CAPS), true)
  assert.equal(adminRouteAllows('/admin/pos', roles, { session: MARISOL, capabilities: BACKEND_CAPS }), true)
  assert.equal(adminRouteAllows('/admin/liquidaciones', roles, { session: MARISOL, capabilities: BACKEND_CAPS }), true)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', MARISOL, undefined, BACKEND_CAPS), 'allow')
})

test('Iguala Entregas muestra tarjeta y ruta; contrato denegado las cierra', () => {
  invalidateCashShiftCapabilities()
  applyCapabilities(igualaEntregasContract(), IGUALA_ENTREGAS)
  const homeIds = getHomeModulesForSession(IGUALA_ENTREGAS).map((module) => module.id)
  assert.ok(homeIds.includes('almacen_entregas'))
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', IGUALA_ENTREGAS, undefined, BACKEND_CAPS), 'allow')

  applyCapabilities(igualaNoJobContract(), IGUALA_NO_JOB)
  assert.equal(getHomeModulesForSession(IGUALA_NO_JOB).some((module) => module.id === 'almacen_entregas'), false)
  assert.equal(getModuleRouteDecisionForSession('almacen_entregas', IGUALA_NO_JOB, undefined, BACKEND_CAPS), 'home')
  assert.equal(adminRouteAllows('/admin/pos', getAuthorizationJobKeys(IGUALA_NO_JOB), {
    session: IGUALA_NO_JOB,
    capabilities: BACKEND_CAPS,
  }), false)
})

test('menús y deep links se refrescan al recuperar el contrato sin heredar identidad', () => {
  invalidateCashShiftCapabilities()
  applyCapabilities(otherContract(), OTHER)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), true)
  syncCapabilitiesIdentity('738:token-a', '694:token-b')
  assert.equal(isEntregasNavigationVisible(BACKEND_CAPS), false)
  assert.equal(BACKEND_CAPS.published_scope, null)
  applyCapabilities(marisolContract(), MARISOL)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.gdl'), true)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), false)
  assert.ok(getHomeModulesForSession(MARISOL).some((module) => module.id === 'almacen_entregas'))
})

test('inventario CEDIS recarga cuando llega warehouse_id y no se congela en 0', () => {
  const inventario = src('../src/modules/entregas/ScreenInventarioEntregas.jsx')
  const operacion = src('../src/modules/entregas/ScreenOperacionDia.jsx')
  const carga = src('../src/modules/entregas/ScreenCargaUnidades.jsx')
  assert.match(inventario, /Stock físico CEDIS/)
  assert.match(inventario, /\/pwa-entregas\/live-inventory\?warehouse_id=\$\{warehouseId\}/)
  assert.match(inventario, /useEffect\(\(\) => \{ load\(\) \}, \[warehouseId\]\)/)
  assert.doesNotMatch(inventario, /useEffect\(\(\) => \{ load\(\) \}, \[\]\)/)
  assert.match(operacion, /Inventario PT/)
  assert.match(carga, /PRODUCTOS CON EXISTENCIA EN ORIGEN/)
})

test('AdminProvider no apaga capsReady si el contrato v2 ya es válido', () => {
  const ctx = src('../src/modules/admin/AdminContext.jsx')
  assert.match(ctx, /useState\(\(\) => validateContract\(BACKEND_CAPS\)\.ok\)/)
  assert.match(ctx, /if \(!validateContract\(BACKEND_CAPS\)\.ok\) setCapsReady\(false\)/)
  assert.doesNotMatch(ctx, /let alive = true\s+setCapsReady\(false\)/)
})

test('superficie 503: banner, reintento y cero importes falsos', () => {
  const home = src('../src/screens/ScreenHome.jsx')
  const app = src('../src/App.jsx')
  const shell = src('../src/components/AppShell.jsx')
  const hub = src('../src/modules/admin/components/HubV2.jsx')
  const admin = src('../src/modules/admin/ScreenAdminPanel.jsx')
  const feed = src('../src/modules/admin/components/ActivityFeed.jsx')
  const svc = src('../src/modules/admin/adminService.js')
  assert.match(home, /capsRevision/)
  assert.match(app, /useCapabilitiesRevision/)
  assert.match(shell, /OdooUnavailableBanner/)
  assert.match(hub, /ODOO_UNAVAILABLE_MESSAGE/)
  assert.match(hub, /retryOdoo/)
  assert.match(admin, /getDashboardData/)
  assert.doesNotMatch(admin, /getTodaySales\(warehouseId\)\.catch/)
  assert.match(feed, /ODOO_UNAVAILABLE_MESSAGE/)
  assert.doesNotMatch(feed, /\.catch\(\(\) => \[\]\)/)
  assert.match(svc, /AUTO_RETRY_DELAYS_MS/)
  assert.match(svc, /isOdooUnavailablePayload/)
  assert.match(svc, /preserveCurrent/)
  assert.match(app, /admin-route-caps-loading/)
  const metric = unavailableMetric()
  assert.equal(metric.total, null)
  assert.equal(metric.available, false)
  assert.equal(ODOO_UNAVAILABLE_MESSAGE.includes('Odoo'), true)
  assert.equal(getOdooServiceState().status === 'unknown' || typeof getOdooServiceState().status === 'string', true)
})

test('contrato publicado GDL plaza 818 abre POS y Liquidaciones y no pide Iguala', () => {
  invalidateCashShiftCapabilities()
  const live = marisolContract({
    published_scope: {
      company_id: 34,
      company_label: 'SOLUCIONES EN PRODUCCION GLACIEM',
      plaza_id: 818,
      plaza_label: '[GDL] Guadalajara',
      warehouse_id: 94,
      warehouse_label: 'CEDIS Guadalajara',
      analytic_id: 818,
      city_code: 'GDL',
      from_actor: true,
    },
  })
  assert.equal(validateContract(live).ok, true)
  applyCapabilities(live, MARISOL)
  const roles = getAuthorizationJobKeys(MARISOL)
  assert.equal(isPosNavigationVisible(BACKEND_CAPS), true)
  assert.equal(isLiquidationNavigationVisible(roles, BACKEND_CAPS), true)
  assert.equal(adminRouteAllows('/admin/pos', roles, { session: MARISOL, capabilities: BACKEND_CAPS }), true)
  assert.equal(adminRouteAllows('/admin/liquidaciones', roles, { session: MARISOL, capabilities: BACKEND_CAPS }), true)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'delivery.transfer.iguala'), false)
  assert.equal(capabilityAllowed(BACKEND_CAPS, 'materials.issue.iguala'), false)
  assert.equal(isTraspasoMpNavigationVisible(BACKEND_CAPS), false)
})

