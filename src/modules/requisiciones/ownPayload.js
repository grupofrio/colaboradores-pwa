// El cliente no determina identidad, estado ni ningún alcance operativo.
export const ownRequisitionActions = ['create', 'cancel']
const CANCELLABLE_STATES = new Set(['draft', 'sent'])

// La lista estándar usa purchase_order_id; `id` sólo conserva compatibilidad
// con una respuesta histórica. Ningún control debe asumir que son iguales.
export function recordPurchaseOrderId(record = {}) {
  return record?.purchase_order_id ?? record?.id ?? null
}

export function isOwnRequisitionCancellable(record = {}) {
  return Boolean(recordPurchaseOrderId(record))
    && record?.can_cancel !== false
    && CANCELLABLE_STATES.has(record?.state)
}

export function buildOwnRequisitionPayload({ name, notes, lines } = {}) {
  const payload = {
    name: String(name || '').trim(),
    lines: Array.isArray(lines)
      ? lines.map((line) => ({
        product_id: Number(line?.product_id || 0),
        quantity: Number(line?.quantity || line?.qty || 0),
      }))
      : [],
  }
  const cleanNotes = String(notes || '').trim()
  if (cleanNotes) payload.notes = cleanNotes
  return payload
}
