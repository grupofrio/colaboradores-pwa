// Copiloto Gerencial — rutas dedicadas a Odoo. PROHIBIDO fallback n8n.
// La sucursal NO viaja en query ni body: el backend la resuelve del token.

export const MANAGER_COPILOT_CHAT = '/pwa-gerente/copilot/chat'
export const MANAGER_COPILOT_HISTORY = '/pwa-gerente/copilot/history'
export const MANAGER_COPILOT_CAPABILITIES = '/pwa-gerente/copilot/capabilities'
export const MANAGER_COPILOT_INVOICE_CONFIRM = '/pwa-gerente/copilot/invoice/confirm'
export const MANAGER_COPILOT_INVOICE_RESEND = '/pwa-gerente/copilot/invoice/resend-email'
export const MANAGER_COPILOT_INVOICE_STATUS = '/pwa-gerente/copilot/invoice/status'
export const MANAGER_COPILOT_INVOICE_DOCUMENT = '/pwa-gerente/copilot/invoice/document'

const PATHS = Object.freeze([
  MANAGER_COPILOT_CHAT,
  MANAGER_COPILOT_HISTORY,
  MANAGER_COPILOT_CAPABILITIES,
  MANAGER_COPILOT_INVOICE_CONFIRM,
  MANAGER_COPILOT_INVOICE_RESEND,
  MANAGER_COPILOT_INVOICE_STATUS,
  MANAGER_COPILOT_INVOICE_DOCUMENT,
])

export function isManagerCopilotPath(cleanPath) {
  return PATHS.includes(cleanPath)
}

export function filterManagerCopilotParams(query) {
  const out = {}
  const conversationId = query?.get ? query.get('conversation_id') : query?.conversation_id
  const invoiceRequestId = query?.get ? query.get('invoice_request_id') : query?.invoice_request_id
  const kind = query?.get ? query.get('kind') : query?.kind
  if (conversationId) out.conversation_id = conversationId
  if (invoiceRequestId) out.invoice_request_id = invoiceRequestId
  if (kind) out.kind = kind
  return out
}

export function buildCopilotChatBody({ message, conversation_id, capability, request_id } = {}) {
  const body = { message: String(message || '').slice(0, 2000) }
  if (conversation_id) body.conversation_id = conversation_id
  if (capability) body.capability = capability
  if (request_id) body.request_id = request_id
  return body
}

export function buildCopilotInvoiceConfirmBody({ confirmation_token, request_id } = {}) {
  const body = { confirmation_token: String(confirmation_token || '') }
  if (request_id) body.request_id = request_id
  return body
}

export function buildCopilotInvoiceResendBody({ invoice_request_id } = {}) {
  return { invoice_request_id }
}
