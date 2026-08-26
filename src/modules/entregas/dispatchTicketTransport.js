// Normalización del despacho documental. El transporte RPC vive en lib/api.js
// porque odooHttp/odooJson no se exportan; este módulo es el único lugar con
// la forma de dominio (folio, ticket, envelope ok/success).

export function folioFromFindTicketPath(path) {
  const query = new URLSearchParams(String(path || '').split('?')[1] || '')
  return String(query.get('folio') || '').trim()
}

export function normalizeFindTicketResult(result) {
  if (!result?.ok) return null
  const row = result.data || result
  if (!row?.id) return null
  const lines = row.order_line || row.order_lines || row.lines || []
  return {
    ...row,
    customer: row.customer || row.partner_id?.[1] || '',
    total: Number(row.total || row.amount_total || 0),
    lines,
    order_lines: lines,
  }
}

export function normalizePendingTicketsResult(result) {
  const tickets = result?.data?.tickets || result?.tickets
  if (!Array.isArray(tickets)) return []
  return tickets.map((row) => ({
    id: row.id,
    name: row.name,
    customer: row.customer || row.partner_id?.[1] || '',
    total: Number(row.total || row.amount_total || 0),
    state: row.state || 'sale',
    date_order: row.date_order || null,
    warehouse_id: row.warehouse_id || 0,
  }))
}

export function normalizeDispatchTicketResult(result) {
  const env = result?.result && typeof result.result === 'object' ? result.result : result
  if (env?.ok === true || env?.success === true) {
    return { success: true, ok: true, ...(env.data || env) }
  }
  return {
    success: false,
    ok: false,
    error: env?.message || env?.error || 'Backend rechazó el despacho',
  }
}
