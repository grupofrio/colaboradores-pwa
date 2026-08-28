// Canonical PWA capability contract v2. Fail-closed parser.
// The server is the only authority. This module never invents IDs or grants.

export const CONTRACT_VERSION = '2.0'

export const CATALOG = Object.freeze([
  'materials.issue.iguala',
  'delivery.transfer',
  'delivery.return',
  'delivery.transfer.gdl',
  'delivery.return.gdl',
  'delivery.transfer.iguala',
  'delivery.return.iguala',
  'liquidation.read.gdl',
  'liquidation.print.gdl',
  'liquidation.receive_cash.gdl',
  'liquidation.validate.gdl',
  'liquidation.authorize_discrepancy.gdl',
  'buyer.read',
  'buyer.capture',
  'buyer.approve',
  'buyer.confirm',
  'pos.read',
  'pos.operate',
  'attendance.read',
  'attendance.capture',
  'payroll.csc.read',
  'payroll.csc.capture',
])

const MODES = new Set(['read', 'capture', 'approve', 'confirm', 'release'])
const SCOPE_LIST_KEYS = Object.freeze(['company_ids', 'plaza_ids', 'warehouse_ids', 'analytic_ids'])
export const PLAZA_REQUIRED_CAPABILITIES = Object.freeze(new Set([
  ...CATALOG.filter((name) => name.endsWith('.gdl') || name.endsWith('.iguala')),
  'delivery.transfer',
  'delivery.return',
  'pos.read',
  'buyer.read',
]))

export const CAPABILITY_SURFACES = Object.freeze({
  'liquidation.read.gdl': Object.freeze({
    route: '/admin/liquidaciones',
    endpoint: '/pwa-admin/liquidaciones/pending',
  }),
  'liquidation.print.gdl': Object.freeze({
    route: '/admin/liquidaciones',
    endpoint: '/pwa-admin/liquidaciones/detail',
  }),
  'liquidation.receive_cash.gdl': Object.freeze({
    route: '/admin/liquidaciones',
    endpoint: '/pwa-admin/liquidaciones/receive-cash',
  }),
  'liquidation.validate.gdl': Object.freeze({
    route: '/admin/liquidaciones',
    endpoint: '/pwa-admin/liquidaciones/validate',
  }),
  'liquidation.authorize_discrepancy.gdl': Object.freeze({
    route: '/admin/liquidaciones',
    endpoint: '/pwa-admin/liquidaciones/authorize-discrepancy',
  }),
  'pos.read': Object.freeze({
    route: '/admin/pos',
    endpoint: '/pwa-admin/pos-products',
  }),
  'pos.operate': Object.freeze({
    route: '/admin/pos',
    endpoint: '/pwa-admin/sale-create',
  }),
  'delivery.transfer': Object.freeze({
    route: '/entregas',
    endpoint: '/pwa-admin/dispatch-ticket',
  }),
  'delivery.return': Object.freeze({
    route: '/entregas/devoluciones',
    endpoint: '/pwa-admin/dispatch-ticket',
  }),
  'delivery.transfer.gdl': Object.freeze({
    route: '/entregas',
    endpoint: '/pwa-admin/dispatch-ticket',
  }),
  'delivery.return.gdl': Object.freeze({
    route: '/entregas/devoluciones',
    endpoint: '/pwa-admin/dispatch-ticket',
  }),
  'delivery.transfer.iguala': Object.freeze({
    route: '/entregas',
    endpoint: '/pwa-admin/dispatch-ticket',
  }),
  'delivery.return.iguala': Object.freeze({
    route: '/entregas/devoluciones',
    endpoint: '/pwa-admin/dispatch-ticket',
  }),
  'materials.issue.iguala': Object.freeze({
    route: '/admin/traspaso-materia-prima',
    endpoint: '/pwa-admin/traspaso-mp/iguala-stock',
  }),
  'buyer.confirm': Object.freeze({
    route: '/torre',
    endpoint: '/pwa-admin/torre/requisition-update',
  }),
})

function ownValue(object, key) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined
  return descriptor.value
}

function isExactBoolean(value) {
  return value === true || value === false
}

function isValidIdList(value) {
  if (!Array.isArray(value)) return false
  const seen = new Set()
  for (const item of value) {
    if (!Number.isInteger(item) || item <= 0) return false
    if (seen.has(item)) return false
    seen.add(item)
  }
  return true
}

function isValidScopes(scopes, { requireOperational = false, requirePlaza = false } = {}) {
  if (!scopes || typeof scopes !== 'object' || Array.isArray(scopes)) return false
  const keys = Object.keys(scopes)
  if (keys.length !== SCOPE_LIST_KEYS.length) return false
  for (const key of SCOPE_LIST_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(scopes, key)) return false
    if (!isValidIdList(ownValue(scopes, key))) return false
  }
  if (requireOperational) {
    const companies = ownValue(scopes, 'company_ids') || []
    const warehouses = ownValue(scopes, 'warehouse_ids') || []
    if (!companies.length || !warehouses.length) return false
    if (requirePlaza && !(ownValue(scopes, 'plaza_ids') || []).length) return false
  }
  return true
}

function isValidMode(mode) {
  return mode == null || MODES.has(mode)
}

function isCompletePublishedScope(published) {
  if (!published || typeof published !== 'object' || Array.isArray(published)) return false
  for (const key of ['company_id', 'warehouse_id', 'plaza_id', 'analytic_id']) {
    const value = ownValue(published, key)
    if (!Number.isInteger(value) || value <= 0) return false
  }
  const city = ownValue(published, 'city_code')
  return typeof city === 'string' && Boolean(city.trim())
}

function isValidLimitCurrency(entry) {
  const limit = ownValue(entry, 'limit')
  const currency = ownValue(entry, 'currency')
  if (limit == null) return currency == null
  if (typeof limit === 'boolean') return false
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return false
  return typeof currency === 'string' && Boolean(currency.trim())
}

export function emptyCatalog(code = 'invalid_contract') {
  return Object.fromEntries(CATALOG.map((name) => [name, {
    allowed: false,
    mode: null,
    scopes: { company_ids: [], plaza_ids: [], warehouse_ids: [], analytic_ids: [] },
    limit: null,
    currency: null,
    deny: { code, reason: 'Contrato de capacidades inválido o ausente.' },
  }]))
}

export function validateContract(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, contract: null }
  }
  if (ownValue(payload, 'contract_version') !== CONTRACT_VERSION) {
    return { ok: false, contract: null }
  }
  const caps = ownValue(payload, 'capabilities')
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) {
    return { ok: false, contract: null }
  }
  for (const name of CATALOG) {
    const entry = ownValue(caps, name)
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, contract: null }
    }
    const allowed = ownValue(entry, 'allowed')
    if (!isExactBoolean(allowed)) return { ok: false, contract: null }
    if (!isValidLimitCurrency(entry)) return { ok: false, contract: null }
    if (allowed === true) {
      if (ownValue(entry, 'deny') != null) return { ok: false, contract: null }
      if (!MODES.has(ownValue(entry, 'mode'))) return { ok: false, contract: null }
      if (!isValidScopes(ownValue(entry, 'scopes'), {
        requireOperational: true,
        requirePlaza: PLAZA_REQUIRED_CAPABILITIES.has(name),
      })) {
        return { ok: false, contract: null }
      }
    } else {
      const deny = ownValue(entry, 'deny')
      if (!deny || typeof deny !== 'object' || Array.isArray(deny) || !ownValue(deny, 'code')) {
        return { ok: false, contract: null }
      }
      if (!isValidMode(ownValue(entry, 'mode'))) return { ok: false, contract: null }
      if (!isValidScopes(ownValue(entry, 'scopes'), { requireOperational: false })) {
        return { ok: false, contract: null }
      }
      const scopes = ownValue(entry, 'scopes') || {}
      if (SCOPE_LIST_KEYS.some((key) => (ownValue(scopes, key) || []).length)) {
        return { ok: false, contract: null }
      }
    }
  }
  const published = ownValue(payload, 'published_scope')
  const anyAllowed = CATALOG.some((name) => ownValue(ownValue(caps, name), 'allowed') === true)
  if (published == null) {
    if (anyAllowed) return { ok: false, contract: null }
    return { ok: true, contract: payload }
  }
  if (!isCompletePublishedScope(published)) return { ok: false, contract: null }
  return { ok: true, contract: payload }
}

export function ownCatalogEntry(capabilities, key) {
  const parsed = validateContract(capabilities)
  if (!parsed.ok) return null
  return ownValue(parsed.contract.capabilities, key) || null
}

export function capabilityAllowed(capabilities, key) {
  return ownCatalogEntry(capabilities, key)?.allowed === true
}

export function capabilityDeny(capabilities, key) {
  const entry = ownCatalogEntry(capabilities, key)
  if (!entry) return { code: 'invalid_contract', reason: 'Contrato ausente.' }
  if (entry.allowed === true) return null
  return entry.deny || { code: 'not_granted', reason: 'Capacidad no concedida.' }
}

export function publishedScope(capabilities) {
  const parsed = validateContract(capabilities)
  if (!parsed.ok) return null
  const scope = ownValue(parsed.contract, 'published_scope')
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null
  const companyId = ownValue(scope, 'company_id')
  const warehouseId = ownValue(scope, 'warehouse_id')
  if (!Number.isInteger(companyId) || companyId <= 0) return null
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) return null
  const plazaId = ownValue(scope, 'plaza_id')
  const analyticId = ownValue(scope, 'analytic_id')
  return {
    company_id: companyId,
    company_label: String(ownValue(scope, 'company_label') || '').trim(),
    plaza_id: Number.isInteger(plazaId) && plazaId > 0 ? plazaId : null,
    plaza_label: String(ownValue(scope, 'plaza_label') || '').trim(),
    warehouse_id: warehouseId,
    warehouse_label: String(ownValue(scope, 'warehouse_label') || '').trim(),
    analytic_id: Number.isInteger(analyticId) && analyticId > 0 ? analyticId : null,
    city_code: String(ownValue(scope, 'city_code') || '').trim().toUpperCase(),
    from_actor: ownValue(scope, 'from_actor') === true,
  }
}

export function failClosedDecision(reason = 'invalid_contract') {
  return { allowed: false, deny: { code: reason, reason: 'Fail-closed.' } }
}

export function publishedScopeSurface(payload) {
  if (!payload || ownValue(payload, 'capabilities') == null) {
    return { state: 'loading', scope: null }
  }
  const scope = publishedScope(payload)
  if (!scope) return { state: 'unavailable', scope: null }
  return { state: 'ready', scope }
}
