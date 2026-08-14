import { api } from '../../lib/api'
import {
  buildCopilotChatBody,
  buildCopilotInvoiceConfirmBody,
  buildCopilotInvoiceResendBody,
} from '../../lib/managerCopilotRoute.js'

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

export function confirmCopilotInvoice({ confirmation_token, request_id }) {
  return api('POST', '/pwa-gerente/copilot/invoice/confirm', buildCopilotInvoiceConfirmBody({
    confirmation_token,
    request_id,
  })).then(unwrap)
}

export function resendCopilotInvoiceEmail({ invoice_request_id }) {
  return api('POST', '/pwa-gerente/copilot/invoice/resend-email', buildCopilotInvoiceResendBody({
    invoice_request_id,
  })).then(unwrap)
}

export function getCopilotInvoiceStatus(invoiceRequestId) {
  const q = `?invoice_request_id=${encodeURIComponent(invoiceRequestId)}`
  return api('GET', `/pwa-gerente/copilot/invoice/status${q}`).then(unwrap)
}

export function getCopilotInvoiceDocument(invoiceRequestId, kind) {
  const q = `?invoice_request_id=${encodeURIComponent(invoiceRequestId)}&kind=${encodeURIComponent(kind)}`
  return api('GET', `/pwa-gerente/copilot/invoice/document${q}`).then(unwrap)
}

export function downloadBase64File({ filename, mimetype, content_base64 }) {
  const binary = atob(content_base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimetype || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'factura'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
