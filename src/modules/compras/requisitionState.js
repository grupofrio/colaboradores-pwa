// La edición de Compras existe exclusivamente durante la requisición pendiente
// y abierta. La aprobación es una frontera: aunque el PO siga en draft hasta
// confirmar, ningún control de edición vuelve a habilitarse.
export function getBuyerRequisitionUiState(detail = {}, action = '') {
  const approvalState = String(detail?.approval_state || '').trim()
  const purchaseState = String(detail?.state || '').trim()
  const openPurchase = purchaseState === 'draft' || purchaseState === 'sent'
  const approvedLocally = action === 'approved'
  const confirmedLocally = action === 'confirmed'
  const editable = approvalState === 'pending'
    && openPurchase
    && !approvedLocally
    && !confirmedLocally
  const approved = approvalState === 'approved' || approvedLocally

  return {
    editable,
    approved,
    canConfirm: approved && openPurchase && !editable && !confirmedLocally,
  }
}

// Una respuesta rechazada nunca cambia la captura, ni simula una transición
// exitosa. La pantalla consume este snapshot en cada catch para conservar las
// líneas pendientes y evitar habilitar confirmación por error.
export function retainBuyerWorkflowAfterFailure({ lineState = {}, action = '', detail = null } = {}, error) {
  return {
    lineState,
    action,
    detail,
    error: String(error?.message || error || 'Odoo rechazó la operación de Compras.'),
  }
}
