// Canonical PWA capability contract v2. Fail-closed parser.
// The server is the only authority. This module never invents IDs or grants.

export const CONTRACT_VERSION = '2.0'

export const CATALOG = Object.freeze([
  'materials.issue.iguala',
  'delivery.transfer.gdl',
  'delivery.return.gdl',
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
  if (payload.contract_version !== CONTRACT_VERSION) {
    return { ok: false, contract: null }
  }
  const caps = payload.capabilities
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) {
    return { ok: false, contract: null }
  }
  for (const name of CATALOG) {
    const entry = Object.getOwnPropertyDescriptor(caps, name)?.value
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, contract: null }
    }
    if (entry.allowed === true) {
      if (!MODES.has(entry.mode)) return { ok: false, contract: null }
    } else if (!entry.deny || typeof entry.deny !== 'object' || !entry.deny.code) {
      return { ok: false, contract: null }
    }
  }
  return { ok: true, contract: payload }
}

export function ownCatalogEntry(capabilities, key) {
  const catalog = capabilities?.capabilities
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return null
  const descriptor = Object.getOwnPropertyDescriptor(catalog, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null
  const entry = descriptor.value
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  return entry
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
  const scope = capabilities?.published_scope
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null
  const companyId = Number(scope.company_id || 0)
  const warehouseId = Number(scope.warehouse_id || 0)
  if (!companyId || !warehouseId) return null
  return {
    company_id: companyId,
    company_label: String(scope.company_label || '').trim(),
    plaza_id: Number(scope.plaza_id || 0) || null,
    plaza_label: String(scope.plaza_label || '').trim(),
    warehouse_id: warehouseId,
    warehouse_label: String(scope.warehouse_label || '').trim(),
    analytic_id: Number(scope.analytic_id || 0) || null,
    from_actor: scope.from_actor === true,
  }
}

export function failClosedDecision(reason = 'invalid_contract') {
  return { allowed: false, deny: { code: reason, reason: 'Fail-closed.' } }
}
