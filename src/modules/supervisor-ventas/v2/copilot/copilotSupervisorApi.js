import { api } from '../../../../lib/api'
import { buildSupervisorCopilotChatBody } from '../../../../lib/supervisorCopilotRoute.js'
import { unwrapSupervisorCopilotPayload } from './copilotSupervisorModel.js'

export {
  SUPERVISOR_COPILOT_HREF_ALLOWLIST,
  isAllowedSupervisorCopilotHref,
  unwrapSupervisorCopilotPayload,
  supervisorCopilotEnabledFromLivePayload,
  resolveSupervisorCopilotTabVisible,
} from './copilotSupervisorModel.js'

export function getSupervisorCopilotCapabilities() {
  return api('GET', '/pwa-supv/copilot/capabilities').then(unwrapSupervisorCopilotPayload)
}

export function getSupervisorCopilotHistory(conversationId) {
  const q = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ''
  return api('GET', `/pwa-supv/copilot/history${q}`).then(unwrapSupervisorCopilotPayload)
}

export function postSupervisorCopilotChat({ message, conversation_id, capability }) {
  return api('POST', '/pwa-supv/copilot/chat', buildSupervisorCopilotChatBody({
    message,
    conversation_id,
    capability,
  })).then(unwrapSupervisorCopilotPayload)
}
