// Selector de compañía: estado local del módulo Admin.
// Nunca reescribe session.company_id ni gf_session.

export function nextAdminCompanyId(availableCompanies, currentId, nextId) {
  const num = Number(nextId)
  if (!Array.isArray(availableCompanies) || !availableCompanies.some((company) => company.id === num)) {
    return currentId
  }
  return num
}

export function sessionUntouchedByAdminCompany(session) {
  return session
}
