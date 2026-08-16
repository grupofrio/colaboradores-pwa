// Copiloto comercial de la Supervisora. Reutiliza la forma visual del
// Copiloto Gerencial (chips + chat + tarjetas) pero NO monta facturación,
// producción, inventario ni gastos. Writes: cero. Allowlist: server-side.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../../../App'
import { getTypo } from '../../../../tokens'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { logScreenError } from '../../../shared/logScreenError'
import {
  getSupervisorCopilotCapabilities,
  postSupervisorCopilotChat,
} from './copilotSupervisorApi'

const C = TOKENS.colors

const FALLBACK_CHIPS = [
  { label: '¿Qué me falta preparar para mañana?', capability: 'get_tomorrow_readiness', message: '¿Qué me falta preparar para mañana?' },
  { label: 'Ventas vs meta', capability: 'get_sales_vs_target', message: '¿Cómo vamos vs la meta?' },
  { label: 'Clientes perdidos', capability: 'get_lost_customers', message: '¿Qué clientes dejaron de comprar?' },
  { label: 'Rutas abiertas', capability: 'get_route_backlog', message: '¿Hay rutas atrasadas o abiertas?' },
]

const STATUS_COLOR = {
  green: C.success,
  yellow: C.warning,
  red: C.error,
  unavailable: C.textMuted,
}

function statusGlyph(status) {
  if (status === 'green') return '🟢'
  if (status === 'yellow') return '🟡'
  if (status === 'red') return '🔴'
  return '⬜'
}

export default function ScreenCopilotoSupervisor() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 390)
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
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    let alive = true
    getSupervisorCopilotCapabilities()
      .then((data) => {
        if (!alive) return
        if (data?.branch?.name) setBranchName(data.branch.name)
        if (Array.isArray(data?.quick_questions) && data.quick_questions.length) {
          setChips(data.quick_questions)
        }
      })
      .catch((err) => {
        logScreenError('ScreenCopilotoSupervisor', 'capabilities', err)
        if (!alive) return
        if (err.code === 'FEATURE_DISABLED') setDisabled(err.message)
        else setError(err.message || 'No pude cargar el copiloto.')
      })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending])

  async function send({ message, capability }) {
    const text = String(message || '').trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    setRetryPayload({ message: text, capability })
    setMessages((prev) => [...prev, { role: 'user', body: text }])
    setDraft('')
    try {
      const data = await postSupervisorCopilotChat({
        message: text,
        conversation_id: conversationId,
        capability,
      })
      setConversationId(data.conversation_id || conversationId)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        body: data.answer || '',
        cards: data.cards || [],
        actions: data.suggested_actions || [],
      }])
    } catch (err) {
      logScreenError('ScreenCopilotoSupervisor', 'chat', err)
      setError(err.message || 'No pude completar la consulta.')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send({ message: draft })
    }
  }

  return (
    <div data-testid="supervisor-copiloto" style={{ display: 'flex', flexDirection: 'column', minHeight: '70dvh' }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ ...typo.title, color: C.text, margin: 0 }}>Copiloto comercial</h1>
        {branchName ? (
          <p style={{ ...typo.caption, color: C.blue3, margin: '4px 0 0' }}>{branchName}</p>
        ) : null}
        <p style={{ ...typo.caption, color: C.textMuted, margin: '4px 0 0' }}>
          Solo consulta. No publica ni cambia rutas.
        </p>
      </header>

      {disabled ? (
        <div role="status" style={{
          padding: 16, borderRadius: TOKENS.radius.md, background: C.surface, border: `1px solid ${C.border}`,
          color: C.textSoft,
        }}>{disabled}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {chips.map((chip) => (
              <button
                key={chip.capability + chip.label}
                type="button"
                data-testid={`copilot-chip-${chip.capability}`}
                disabled={sending}
                onClick={() => send({ message: chip.message, capability: chip.capability })}
                style={{
                  minHeight: 44, padding: '8px 12px', borderRadius: TOKENS.radius.pill,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div ref={listRef} style={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
            paddingBottom: 12, minHeight: 180,
          }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                background: msg.role === 'user' ? C.surfaceStrong : C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: TOKENS.radius.md,
                padding: '10px 12px',
              }}>
                <p style={{ margin: 0, color: C.text, fontSize: 14, whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                {(msg.cards || []).map((card) => (
                  <div key={card.id} data-testid={`copilot-card-${card.id}`} style={{
                    marginTop: 8, padding: 10, borderRadius: TOKENS.radius.md,
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: STATUS_COLOR[card.status] || C.text }}>
                      {statusGlyph(card.status)} {card.title}
                    </div>
                    {card.subtitle ? (
                      <div style={{ fontSize: 13, color: C.textSoft, marginTop: 4 }}>{card.subtitle}</div>
                    ) : null}
                    {(card.actions || []).map((action) => action.href ? (
                      <button
                        key={action.label}
                        type="button"
                        data-testid="copilot-cta-manana"
                        onClick={() => navigate(action.href || '/equipo/rutas/planear')}
                        style={{
                          marginTop: 8, minHeight: 44, padding: '8px 12px',
                          background: C.blue3, color: '#fff', fontWeight: 700,
                          borderRadius: TOKENS.radius.md, cursor: 'pointer',
                        }}
                      >
                        {action.label}
                      </button>
                    ) : null)}
                  </div>
                ))}
              </div>
            ))}
            {sending ? (
              <div style={{ color: C.textMuted, fontSize: 13 }}>Consultando Odoo…</div>
            ) : null}
          </div>

          {error ? (
            <div role="alert" style={{ color: C.error, fontSize: 13, marginBottom: 8 }}>
              {error}
              {retryPayload ? (
                <button type="button" onClick={() => send(retryPayload)} style={{
                  marginLeft: 8, minHeight: 44, color: C.blue3, fontWeight: 700,
                }}>Reintentar</button>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              rows={2}
              value={draft}
              disabled={sending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Pregunta por mañana, ventas o clientes…"
              aria-label="Mensaje para el Copiloto comercial"
              style={{
                flex: 1, minHeight: 44, maxHeight: 120, resize: 'none',
                padding: '10px 12px', borderRadius: TOKENS.radius.md,
                background: C.surface, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 14,
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => send({ message: draft })}
              aria-label="Enviar"
              style={{
                width: 44, height: 44, borderRadius: TOKENS.radius.md, flexShrink: 0,
                background: C.blue3, color: '#fff', fontWeight: 700,
                opacity: sending || !draft.trim() ? 0.4 : 1, cursor: 'pointer',
              }}
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
