import { api } from '../../lib/api.js'

const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'company_id', 'operating_company_id', 'operating_plaza_id',
  'employee_id', 'warehouse_id', 'actor_id', 'operating_actor_id',
  'approval_state', 'approver_id', 'approved_by_id', 'self_approval_bypass',
  'buyer_self_approval_enabled', 'requested_by_employee_id',
])

function requireScope(scope) {
  const companyId = Number(scope?.operating_company_id || 0)
  const plazaId = Number(scope?.operating_plaza_id || 0)
  if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(plazaId) || plazaId <= 0) {
    throw new Error('Selecciona un alcance autorizado.')
  }
  return { operating_company_id: companyId, operating_plaza_id: plazaId }
}

function businessFields(data = {}) {
  const clean = {}
  for (const [key, value] of Object.entries(data || {})) {
    if (!FORBIDDEN_AUTHORITY_FIELDS.has(key) && value !== undefined) clean[key] = value
  }
  return clean
}

export function createMultiCompanyRequisition(scope, data = {}) {
  return { ...requireScope(scope), ...businessFields(data) }
}

export function submitMultiCompanyRequisition(scope, data = {}) {
  return api('POST', '/pwa-admin/requisition-create', createMultiCompanyRequisition(scope, data))
}

export function getMultiCompanyRequisitions(scope) {
  const selected = requireScope(scope)
  return api('GET', `/pwa-admin/requisitions?operating_company_id=${encodeURIComponent(selected.operating_company_id)}&operating_plaza_id=${encodeURIComponent(selected.operating_plaza_id)}`)
}
