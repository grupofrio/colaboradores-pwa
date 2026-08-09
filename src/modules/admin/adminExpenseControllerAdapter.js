// Controller contract adapter for ordinary Admin expenses.  Identity remains
// entirely server-derived from the mobile token; this module never carries an
// employee id across the browser boundary.
export function buildAdminExpenseControllerPayload(payload = {}) {
  const { employee_id, employeeId, ...controllerPayload } = payload || {}
  return controllerPayload
}

export function normalizeTodayExpensesControllerResponse(response) {
  const envelope = response?.result !== undefined ? response.result : response
  const data = envelope?.data ?? envelope
  if (Array.isArray(data)) return data
  return Array.isArray(data?.expenses) ? data.expenses : []
}
