import { api } from '../../lib/api'
import { buildCopilotChatBody } from '../../lib/managerCopilotRoute.js'

function unwrap(payload) {
  if (payload && payload.ok === false) {
    const err = new Error(payload.user_message || 'El copiloto no está disponible.')
    err.code = payload.error || 'ERROR'
    err.payload = payload
    throw err
  }
  if (payload && payload.ok === true && payload.data !== undefined) return payload.data
  return payload
}

export function getCopilotCapabilities() {
  return api('GET', '/pwa-gerente/copilot/capabilities').then(unwrap)
}

export function getCopilotHistory(conversationId) {
  const q = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ''
  return api('GET', `/pwa-gerente/copilot/history${q}`).then(unwrap)
}

export function postCopilotChat({ message, conversation_id, capability }) {
  return api('POST', '/pwa-gerente/copilot/chat', buildCopilotChatBody({
    message,
    conversation_id,
    capability,
  })).then(unwrap)
}
