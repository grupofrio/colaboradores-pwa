export function resolveSupervisorCustomerAnalyticUnitId({
  sessionAnalyticAccountId = 0,
  employeeAnalyticAccountId = 0,
  fallbackAnalyticUnitId = 0,
} = {}) {
  const sessionId = Number(sessionAnalyticAccountId || 0)
  if (sessionId > 0) return sessionId

  const employeeId = Number(employeeAnalyticAccountId || 0)
  if (employeeId > 0) return employeeId

  const fallbackId = Number(fallbackAnalyticUnitId || 0)
  return fallbackId > 0 ? fallbackId : 0
}

export function buildSupervisorCustomerDomains(analyticUnitId) {
  const ids = (Array.isArray(analyticUnitId) ? analyticUnitId : [analyticUnitId])
    .map((id) => Number(id || 0))
    .filter((id, index, list) => id > 0 && list.indexOf(id) === index)

  if (!ids.length) return [['id', '=', 0]]
  return [
    ['active', '=', true],
    ids.length > 1
      ? ['x_analytic_un_id', 'in', ids]
      : ['x_analytic_un_id', '=', ids[0]],
  ]
}
