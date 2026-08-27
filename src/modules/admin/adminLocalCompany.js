// Selector de compañía: estado local del módulo Admin.
// Nunca reescribe session.company_id ni gf_session.
// Compañías: solo las publicadas por un contrato v2 validado.

export function adminCompaniesFromPublishedScope(published) {
  const companyId = Number(published?.company_id || 0)
  if (!Number.isInteger(companyId) || companyId <= 0) return []
  const name = String(published?.company_label || '').trim() || `ID ${companyId}`
  return [{ id: companyId, name }]
}

export function nextAdminCompanyId(availableCompanies, currentId, nextId) {
  const num = Number(nextId)
  if (!Array.isArray(availableCompanies) || !availableCompanies.some((company) => company.id === num)) {
    return currentId
  }
  return num
}

export function syncAdminCompanyForIdentity({
  previousIdentity,
  nextIdentity,
  published,
  currentCompanyId,
}) {
  const companies = adminCompaniesFromPublishedScope(published)
  if (previousIdentity !== nextIdentity) {
    return companies[0]?.id || null
  }
  if (companies.some((company) => company.id === currentCompanyId)) {
    return currentCompanyId
  }
  return companies[0]?.id || null
}

export function sessionUntouchedByAdminCompany(session) {
  return session
}
