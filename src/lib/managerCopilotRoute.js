// Copiloto Gerencial — rutas dedicadas a Odoo. PROHIBIDO fallback n8n.
// La sucursal NO viaja en query ni body: el backend la resuelve del token.

export const MANAGER_COPILOT_CHAT = '/pwa-gerente/copilot/chat'
export const MANAGER_COPILOT_HISTORY = '/pwa-gerente/copilot/history'
export const MANAGER_COPILOT_CAPABILITIES = '/pwa-gerente/copilot/capabilities'

const PATHS = Object.freeze([
  MANAGER_COPILOT_CHAT,
  MANAGER_COPILOT_HISTORY,
  MANAGER_COPILOT_CAPABILITIES,
])

export function isManagerCopilotPath(cleanPath) {
  return PATHS.includes(cleanPath)
}

export function filterManagerCopilotParams(query) {
  const out = {}
  const conversationId = query?.get ? query.get('conversation_id') : query?.conversation_id
  if (conversationId) out.conversation_id = conversationId
  return out
}

export function buildCopilotChatBody({ message, conversation_id, capability, request_id } = {}) {
  const body = { message: String(message || '').slice(0, 2000) }
  if (conversation_id) body.conversation_id = conversation_id
  if (capability) body.capability = capability
  if (request_id) body.request_id = request_id
  return body
}
