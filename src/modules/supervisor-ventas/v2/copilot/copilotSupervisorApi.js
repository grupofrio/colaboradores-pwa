import { api } from '../../../../lib/api'
import { buildSupervisorCopilotChatBody } from '../../../../lib/supervisorCopilotRoute.js'

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

export function getSupervisorCopilotCapabilities() {
  return api('GET', '/pwa-supv/copilot/capabilities').then(unwrap)
}

export function getSupervisorCopilotHistory(conversationId) {
  const q = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ''
  return api('GET', `/pwa-supv/copilot/history${q}`).then(unwrap)
}

export function postSupervisorCopilotChat({ message, conversation_id, capability }) {
  return api('POST', '/pwa-supv/copilot/chat', buildSupervisorCopilotChatBody({
    message,
    conversation_id,
    capability,
  })).then(unwrap)
}
