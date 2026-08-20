import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { getTypo } from '../../tokens'
import { BRAND_TOKENS as TOKENS } from '../../theme/brandTokens'
import {
  confirmCopilotInvoice,
  downloadBase64File,
  getCopilotCapabilities,
  getCopilotInvoiceDocument,
  postCopilotChat,
  resendCopilotInvoiceEmail,
} from './copilotApi'
import { logScreenError } from '../shared/logScreenError'

const FALLBACK_CHIPS = [
  { label: '¿Cómo vamos hoy?', capability: 'get_sales_vs_target', message: '¿Cómo vamos hoy?' },
  { label: 'Ventas vs meta', capability: 'get_sales_vs_target', message: 'Ventas vs meta' },
  { label: 'Producción', capability: 'get_production_vs_target', message: '¿Cómo vamos en producción?' },
  { label: 'Clientes perdidos', capability: 'get_lost_customers', message: '¿Qué clientes dejaron de comprar?' },
  { label: 'Inventarios', capability: 'get_inventory_health', message: '¿Cómo están los almacenes?' },
  { label: 'Gastos', capability: 'get_expenses_summary', message: '¿Cuáles fueron los gastos?' },
  { label: 'Rutas pendientes', capability: 'get_route_backlog', message: '¿Hay rutas atrasadas o abiertas?' },
  { label: '¿Qué debo atender?', capability: 'get_branch_priorities', message: '¿Qué tengo que atender hoy?' },
]

const STATUS_COLOR = {
  green: TOKENS.colors.success,
  yellow: TOKENS.colors.warning,
  red: TOKENS.colors.error,
  unavailable: TOKENS.colors.textMuted,
}

function statusGlyph(status) {
  if (status === 'green') return '🟢'
  if (status === 'yellow') return '🟡'
  if (status === 'red') return '🔴'
  return '⬜'
}

function formatValue(card) {
  if (card?.value == null || card?.value === '') return '—'
  if (card.unit === 'MXN') {
    const n = Number(card.value)
    if (Number.isNaN(n)) return String(card.value)
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
  }
  if (card.pct != null) return `${card.value} · ${card.pct}%`
  return String(card.value)
}

export default function ScreenCopilotoGerencial() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [branchName, setBranchName] = useState(session?.sucursal || session?.branch_name || '')
  const [chips, setChips] = useState(FALLBACK_CHIPS)
  const [disabled, setDisabled] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [retryPayload, setRetryPayload] = useState(null)
  const [llmReady, setLlmReady] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const confirmLock = useRef(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    let alive = true
    getCopilotCapabilities()
      .then((data) => {
        if (!alive) return
        if (data?.branch?.name) setBranchName(data.branch.name)
        if (Array.isArray(data?.quick_questions) && data.quick_questions.length) {
          setChips(data.quick_questions)
        }
        if (data?.llm) setLlmReady(Boolean(data.llm.ready))
      })
      .catch((err) => {
        logScreenError('ScreenCopilotoGerencial', 'capabilities', err)
        if (err?.code === 'FEATURE_DISABLED') {
          setDisabled(err.message)
        } else if (err?.code === 'FORBIDDEN') {
          setDisabled('Esta función es solo para Gerente de Sucursal.')
        } else {
          setError(err.message || 'No pude cargar el copiloto.')
        }
      })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending])

  async function send({ message, capability }) {
    const text = String(message || '').trim()
    if (!text || sending || disabled) return
    setSending(true)
    setError('')
    setRetryPayload({ message: text, capability })
    setMessages((prev) => [...prev, { role: 'user', body: text }])
    setDraft('')
    try {
      const data = await postCopilotChat({
        message: text,
        conversation_id: conversationId,
        capability,
      })
      setConversationId(data.conversation_id || conversationId)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        body: data.answer || '',
        cards: data.cards || [],
        alerts: data.alerts || [],
      }])
      setRetryPayload(null)
    } catch (err) {
      logScreenError('ScreenCopilotoGerencial', 'chat', err)
      if (err?.code === 'FEATURE_DISABLED') {
        setDisabled(err.message)
      } else {
        setError(err.message || 'No pude completar la consulta. Los datos de Odoo no fueron modificados.')
      }
    } finally {
      setSending(false)
    }
  }

  async function confirmInvoice(card) {
    const token = card?.confirmation?.token
    if (!token || confirming || confirmLock.current) return
    confirmLock.current = true
    setConfirming(true)
    setError('')
    try {
      const data = await confirmCopilotInvoice({ confirmation_token: token })
      setMessages((prev) => [...prev, {
        role: 'assistant',
        body: data.user_message || data.answer || 'Factura procesada.',
        cards: [{
          id: `invoice-result-${data.invoice_request_id || Date.now()}`,
          kind: 'invoice_result',
          title: data.invoice_name || 'Factura',
          value: data.total,
          unit: 'MXN',
          status: data.cfdi_ok ? 'green' : 'red',
          subtitle: data.cfdi_uuid ? `UUID ${data.cfdi_uuid}` : (data.status || ''),
          invoice: {
            name: data.invoice_name,
            uuid: data.cfdi_uuid,
            email_ok: data.email_ok,
            email_to: data.email_to,
            invoice_request_id: data.invoice_request_id,
            cfdi_ok: data.cfdi_ok,
          },
        }],
      }])
    } catch (err) {
      logScreenError('ScreenCopilotoGerencial', 'invoice-confirm', err)
      setError(err.message || 'No pude confirmar la factura. No reintentaré el timbrado automáticamente.')
    } finally {
      setConfirming(false)
    }
  }

  async function downloadInvoice(invoiceRequestId, kind) {
    try {
      const doc = await getCopilotInvoiceDocument(invoiceRequestId, kind)
      downloadBase64File(doc)
    } catch (err) {
      logScreenError('ScreenCopilotoGerencial', 'invoice-download', err)
      setError(err.message || 'No pude descargar el archivo.')
    }
  }

  async function resendEmail(invoiceRequestId) {
    try {
      const data = await resendCopilotInvoiceEmail({ invoice_request_id: invoiceRequestId })
      setMessages((prev) => [...prev, {
        role: 'assistant',
        body: data.user_message || 'Reintento de correo enviado.',
        cards: [],
      }])
    } catch (err) {
      logScreenError('ScreenCopilotoGerencial', 'invoice-resend', err)
      setError(err.message || 'No pude reenviar el correo. El CFDI no se modifica.')
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send({ message: draft })
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        textarea { font-family: inherit; }
        button { border: none; background: none; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', padding: '0 16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 8 }}>
          <button type="button" aria-label="Volver" onClick={() => navigate('/gerente')} style={{
            width: 44, height: 44, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(15,42,61,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0 }}>Copiloto Gerencial</p>
            {branchName ? (
              <p style={{ ...typo.caption, color: TOKENS.colors.blue3, margin: 0, marginTop: 2 }}>{branchName}</p>
            ) : null}
            {llmReady === false ? (
              <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2 }}>
                Respuestas con datos de Odoo. La IA no está activa.
              </p>
            ) : null}
          </div>
        </div>

        {disabled ? (
          <div style={{
            marginTop: 24, padding: 16, borderRadius: TOKENS.radius.lg,
            background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
          }}>
            <p style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0 }}>{disabled}</p>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 8 }}>
              La PWA sigue operativa. Los datos de Odoo no se modifican.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={sending}
                  onClick={() => send({ message: chip.message, capability: chip.capability })}
                  style={{
                    flexShrink: 0, minHeight: 44, padding: '8px 14px', borderRadius: TOKENS.radius.pill,
                    background: TOKENS.colors.blueGlow, border: `1px solid ${TOKENS.colors.borderBlue}`,
                    color: TOKENS.colors.blue3, fontSize: 12, fontWeight: 700,
                    opacity: sending ? 0.5 : 1,
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
              {messages.length === 0 && (
                <p style={{ ...typo.body, color: TOKENS.colors.textMuted, margin: '24px 0' }}>
                  Pregunta en lenguaje natural. Las cifras salen de Odoo, de tu sucursal.
                </p>
              )}
              {messages.map((msg, idx) => (
                <div key={`${msg.role}-${idx}`} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'stretch',
                  maxWidth: msg.role === 'user' ? '85%' : '100%',
                  padding: 12, borderRadius: TOKENS.radius.lg,
                  background: msg.role === 'user' ? TOKENS.colors.surfaceStrong : TOKENS.glass.panel,
                  border: `1px solid ${msg.role === 'user' ? TOKENS.colors.borderBlue : TOKENS.colors.border}`,
                }}>
                  <p style={{ ...typo.body, color: TOKENS.colors.text, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                  {Array.isArray(msg.cards) && msg.cards.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: msg.cards.some((c) => c.kind === 'invoice_preview' || c.kind === 'invoice_result') ? '1fr' : '1fr 1fr',
                      gap: 8,
                      marginTop: 12,
                    }}>
                      {msg.cards.map((card) => (
                        <div key={card.id} style={{
                          padding: 10, borderRadius: TOKENS.radius.md,
                          background: TOKENS.glass.panelSoft,
                          border: `1px solid ${STATUS_COLOR[card.status] || TOKENS.colors.border}55`,
                        }}>
                          <p style={{ ...typo.overline, color: TOKENS.colors.textLow, margin: 0 }}>
                            {statusGlyph(card.status)} {card.title}
                          </p>
                          <p style={{ ...typo.title, color: STATUS_COLOR[card.status] || TOKENS.colors.text, margin: '6px 0 0' }}>
                            {formatValue(card)}
                          </p>
                          {card.subtitle ? (
                            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '4px 0 0' }}>{card.subtitle}</p>
                          ) : null}
                          {Array.isArray(card.fields) && card.fields.filter((f) => f.value).map((field) => (
                            <p key={field.label} style={{ ...typo.caption, color: TOKENS.colors.textSoft, margin: '4px 0 0' }}>
                              {field.label}: {field.value}
                            </p>
                          ))}
                          {Array.isArray(card.blocking_reasons) && card.blocking_reasons.map((reason) => (
                            <p key={reason} style={{ ...typo.caption, color: TOKENS.colors.error, margin: '4px 0 0' }}>{reason}</p>
                          ))}
                          {Array.isArray(card.items) && card.items.slice(0, 5).map((item) => (
                            <p key={item.label} style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '4px 0 0' }}>
                              {item.label}{item.value != null && item.value !== '' ? `: ${item.value}` : ''}
                            </p>
                          ))}
                          {card.kind === 'invoice_preview' && card.confirmation?.token ? (
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                              <button type="button" disabled={confirming} onClick={() => confirmInvoice(card)} style={{
                                minHeight: 44, flex: 1, borderRadius: TOKENS.radius.md,
                                background: TOKENS.colors.ctaGradient, color: '#fff', fontWeight: 700, fontSize: 13,
                                opacity: confirming ? 0.5 : 1,
                              }}>
                                {confirming ? 'Timbrando…' : 'Confirmar factura'}
                              </button>
                            </div>
                          ) : null}
                          {card.kind === 'invoice_result' && card.invoice?.invoice_request_id && card.invoice?.cfdi_ok ? (
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => downloadInvoice(card.invoice.invoice_request_id, 'pdf')} style={{
                                minHeight: 44, padding: '0 12px', borderRadius: TOKENS.radius.md,
                                background: TOKENS.colors.blueGlow, color: TOKENS.colors.blue3, fontWeight: 700, fontSize: 13,
                              }}>
                                Descargar PDF
                              </button>
                              <button type="button" onClick={() => downloadInvoice(card.invoice.invoice_request_id, 'xml')} style={{
                                minHeight: 44, padding: '0 12px', borderRadius: TOKENS.radius.md,
                                background: TOKENS.colors.blueGlow, color: TOKENS.colors.blue3, fontWeight: 700, fontSize: 13,
                              }}>
                                Descargar XML
                              </button>
                              {card.invoice.email_ok === false ? (
                                <button type="button" onClick={() => resendEmail(card.invoice.invoice_request_id)} style={{
                                  minHeight: 44, padding: '0 12px', color: TOKENS.colors.blue3, fontWeight: 700, fontSize: 13,
                                }}>
                                  Reintentar envío
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {card.invoice?.email_to ? (
                            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '6px 0 0' }}>
                              Correo: {card.invoice.email_ok ? 'enviado' : 'pendiente'} — {card.invoice.email_to}
                            </p>
                          ) : null}
                          {Array.isArray(card.actions) && card.actions.map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              disabled={sending}
                              onClick={() => send({ message: action.message, capability: action.capability })}
                              style={{
                                marginTop: 8, minHeight: 44, width: '100%', borderRadius: TOKENS.radius.md,
                                background: TOKENS.colors.blueGlow, color: TOKENS.colors.blue3, fontWeight: 700, fontSize: 13,
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TOKENS.colors.textMuted }}>
                  <div style={{ width: 18, height: 18, border: `2px solid ${TOKENS.colors.spinnerTrack}`, borderTop: `2px solid ${TOKENS.colors.blue2}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={typo.caption}>Consultando Odoo…</span>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                marginBottom: 8, padding: 12, borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}44`,
              }}>
                <p style={{ ...typo.caption, color: TOKENS.colors.error, margin: 0 }}>{error}</p>
                {retryPayload && (
                  <button type="button" onClick={() => send(retryPayload)} style={{
                    marginTop: 8, minHeight: 44, color: TOKENS.colors.blue3, fontWeight: 700, fontSize: 13,
                  }}>
                    Reintentar
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 8 }}>
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                disabled={sending}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escribe tu pregunta…"
                aria-label="Mensaje para el Copiloto Gerencial"
                style={{
                  flex: 1, minHeight: 44, maxHeight: 120, resize: 'none',
                  padding: '10px 12px', borderRadius: TOKENS.radius.md,
                  background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                  color: TOKENS.colors.text, fontSize: 14,
                }}
              />
              <button
                type="button"
                disabled={sending || !draft.trim()}
                onClick={() => send({ message: draft })}
                aria-label="Enviar"
                style={{
                  width: 44, height: 44, borderRadius: TOKENS.radius.md, flexShrink: 0,
                  background: TOKENS.colors.ctaGradient,
                  opacity: sending || !draft.trim() ? 0.4 : 1,
                  color: '#fff', fontWeight: 700,
                }}
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
