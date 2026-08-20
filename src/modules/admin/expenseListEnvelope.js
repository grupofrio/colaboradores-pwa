/**
 * Canonical unwrap for expense list envelopes from gf_pwa_admin.
 *
 * Backend shapes (after transport):
 *   { ok, data: { expenses: [...], count, total_amount, ... } }
 *   { expenses: [...], count, ... }          // already unwrapped data
 *   [ ... ]                                  // legacy bare array
 *
 * Distinguishes loading/unavailable/empty/error — never collapses errors to [].
 */

export function unwrapExpenseListEnvelope(res) {
  if (res == null) {
    return { status: 'unavailable', items: [], meta: {}, reason: 'null_payload' }
  }
  if (typeof res !== 'object') {
    return { status: 'unavailable', items: [], meta: {}, reason: 'invalid_payload' }
  }

  if (Object.prototype.hasOwnProperty.call(res, 'ok') && res.ok === false) {
    return {
      status: 'error',
      items: [],
      meta: {},
      reason: res.message || res.code || 'backend_error',
      message: res.message || 'Error al cargar gastos',
    }
  }

  const data = (Object.prototype.hasOwnProperty.call(res, 'ok') && 'data' in res)
    ? res.data
    : res

  if (Array.isArray(data)) {
    return {
      status: data.length ? 'ok' : 'empty',
      items: data,
      meta: { count: data.length },
    }
  }

  if (!data || typeof data !== 'object') {
    return { status: 'unavailable', items: [], meta: {}, reason: 'missing_data' }
  }

  const items = Array.isArray(data.expenses)
    ? data.expenses
    : (Array.isArray(data.items) ? data.items : null)

  if (items == null) {
    return {
      status: 'unavailable',
      items: [],
      meta: data,
      reason: 'expenses_key_missing',
    }
  }

  const count = Number.isFinite(Number(data.count)) ? Number(data.count) : items.length
  return {
    status: items.length === 0 ? 'empty' : 'ok',
    items,
    meta: {
      count,
      total_amount: data.total_amount,
      company_id: data.company_id,
      date: data.date,
      date_from: data.date_from,
      date_to: data.date_to,
    },
  }
}

/** Client-side reserved fields that expense-create / fuel-expense-create reject. */
export const EXPENSE_CREATE_CLIENT_RESERVED_FIELDS = Object.freeze([
  'payment_mode',
  'paymentMode',
  'payment_method',
  'paymentMethod',
  'payment_reference',
  'paymentReference',
  'employee_id',
  'employeeId',
  'account_id',
  'accountId',
  'analytic_account_id',
  'analytic_distribution',
  'journal_id',
  'tax_ids',
  'currency_id',
  'unit_amount',
  'price_unit',
])

export function stripExpenseCreateReservedFields(payload = {}) {
  const clean = { ...(payload || {}) }
  for (const key of EXPENSE_CREATE_CLIENT_RESERVED_FIELDS) {
    delete clean[key]
  }
  return clean
}
