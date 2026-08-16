// Copiloto comercial de la Supervisora — Odoo dedicado. PROHIBIDO n8n,
// Copiloto Gerencial y facturación.

export const SUPERVISOR_COPILOT_CHAT = '/pwa-supv/copilot/chat'
export const SUPERVISOR_COPILOT_HISTORY = '/pwa-supv/copilot/history'
export const SUPERVISOR_COPILOT_CAPABILITIES = '/pwa-supv/copilot/capabilities'

const PATHS = Object.freeze([
  SUPERVISOR_COPILOT_CHAT,
  SUPERVISOR_COPILOT_HISTORY,
  SUPERVISOR_COPILOT_CAPABILITIES,
])

export function isSupervisorCopilotPath(cleanPath) {
  return PATHS.includes(cleanPath)
}

export function filterSupervisorCopilotParams(query) {
  const out = {}
  const conversationId = query?.get ? query.get('conversation_id') : query?.conversation_id
  if (conversationId) out.conversation_id = conversationId
  return out
}

export function buildSupervisorCopilotChatBody({ message, conversation_id, capability, request_id } = {}) {
  const body = { message: String(message || '').slice(0, 2000) }
  if (conversation_id) body.conversation_id = conversation_id
  if (capability) body.capability = capability
  if (request_id) body.request_id = request_id
  return body
}
