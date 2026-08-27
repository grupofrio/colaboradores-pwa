import { ROLE_LABELS } from '../lib/roleContext.js'

const SIN_DATO = 'Sin dato'

function labeledPair(id, label, fallback) {
  const normalizedId = Number(id || 0) || 0
  const normalizedLabel = String(label || '').trim() || fallback
  return [normalizedId, normalizedLabel]
}

export function buildProfileEmployeeFromSession(session = {}) {
  const employeeId = Number(session?.employee_id || session?.employee?.id || 0) || 0
  if (!employeeId) return null

  const name = String(session?.name || session?.employee?.name || 'Empleado').trim() || 'Empleado'
  const role = String(session?.role || '').trim()
  const jobTitle = String(
    session?.job_title
    || session?.employee?.job_title
    || ROLE_LABELS[role]
    || 'Grupo Frio'
  ).trim() || 'Grupo Frio'
  const companyId = Number(session?.company_id || 0) || 0
  const companyLabel = String(session?.company || session?.employee?.company_name || 'Grupo Frio').trim() || 'Grupo Frio'

  return {
    id: employeeId,
    name,
    job_id: labeledPair(0, jobTitle, 'Grupo Frio'),
    department_id: labeledPair(0, '', SIN_DATO),
    work_location_id: labeledPair(0, '', SIN_DATO),
    company_id: labeledPair(companyId, companyLabel, 'Grupo Frio'),
    mobile_phone: '',
    image_128: null,
    date_start: null,
    remaining_leaves: 0,
    partner_id: labeledPair(0, name, 'Empleado'),
  }
}

function hasApiProfileData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return (Number(data.id || 0) || 0) > 0 || String(data.name || '').trim().length > 0
}

export function resolveProfileEmployeeData({ session = {}, response, mapApiEmployee }) {
  if (response?.success && hasApiProfileData(response.data) && typeof mapApiEmployee === 'function') {
    return mapApiEmployee(response.data)
  }
  return buildProfileEmployeeFromSession(session)
}
