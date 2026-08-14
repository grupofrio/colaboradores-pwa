import { api } from '../../lib/api.js'
import { buildOwnRequisitionPayload } from './ownPayload.js'

// Esta superficie nunca decide identidad ni alcance. El backend deriva ambos
// desde la sesión autenticada y rechaza cualquier intento del cliente.
export { buildOwnRequisitionPayload, ownRequisitionActions } from './ownPayload.js'

// Odoo puede responder HTTP 200 con `{ok:false,message}`. Esa respuesta es
// un rechazo operativo, no un éxito de la interfaz.
export function unwrapOwnRequisitionResponse(response) {
  const envelope = response?.result !== undefined ? response.result : response
  if (envelope?.ok === false) {
    throw new Error(envelope.message || envelope.error || 'Odoo rechazó la operación de requisiciones.')
  }
  return envelope
}

function ownRequisitionApi(method, path, payload) {
  return api(method, path, payload).then(unwrapOwnRequisitionResponse)
}

export function getOwnRequisitions() {
  return ownRequisitionApi('GET', '/pwa-admin/requisitions')
}

export function createOwnRequisition(values) {
  return ownRequisitionApi('POST', '/pwa-admin/requisition-create', buildOwnRequisitionPayload(values))
}

export function cancelOwnRequisition(id) {
  return ownRequisitionApi('POST', '/pwa-admin/requisition-cancel', { id: Number(id) })
}
