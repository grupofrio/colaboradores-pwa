function firstSignedPickingId(value) {
  const list = Array.isArray(value) ? value : []
  for (const raw of list) {
    const id = Number(raw || 0)
    if (Number.isInteger(id) && id !== 0) return id
  }
  return null
}

export function resolveCreatedPtTransferState({
  result,
  pendingTransfers = [],
  destinationName = 'CIGU/Existencias',
} = {}) {
  const transfer = result && typeof result === 'object' ? result : {}
  const pendingCount = Array.isArray(pendingTransfers) ? pendingTransfers.length : 0
  const transferRef = String(transfer.transfer_ref || '').trim()
  const transferState = String(transfer.transfer_state || '').trim().toLowerCase()
  const signedPickingId = firstSignedPickingId(transfer.en_picking_ids)
  const derivedPendingId = Number(transfer.transfer_id || 0) > 0
    ? -Number(transfer.transfer_id)
    : null
  const directBackendId = Number(transfer.picking_id || transfer.id || 0) || null
  const backendId = signedPickingId ?? directBackendId ?? derivedPendingId ?? null

  const publishedPending = Boolean(
    pendingCount > 0
    || transferRef
    || backendId
    || ['pending', 'processing', 'ready', 'created'].includes(transferState)
  )

  return {
    backendId,
    transferRef,
    publishedPending,
    syncState: publishedPending ? 'backend_pending' : 'local_pending_only',
    warningMessage: publishedPending
      ? ''
      : 'Odoo no publico aun un pendiente visible para Entregas. La PWA dejara la cantidad apartada como pendiente local de validacion.',
    successMessage: publishedPending
      ? `Pendiente generado${transferRef ? `: ${transferRef}` : ''} -> ${destinationName}`
      : `Reserva local creada: pendientes por validar en ${destinationName}`,
  }
}
