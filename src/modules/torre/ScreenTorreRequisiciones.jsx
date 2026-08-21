// ─── ScreenTorreRequisiciones — Operador Torre · Lista de validaciones ────────
// Muestra las requisiciones en borrador creadas por el gerente/admin que
// necesitan ser completadas y confirmadas por el Operador Torre.
//
// Flujo:
//   1. Gerente crea requisición (PWA Admin → draft purchase.order)
//   2. Operador Torre ve la lista aquí
//   3. Toca una → ScreenTorreDetail → completa precio y plaza → confirma
//
// Req 1, 2 del sprint 2026-04-24.
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { getTorreRequisitions } from '../admin/api'
import { TOKENS as DARK_TOKENS } from '../../tokens'
import { BRAND_TOKENS as BRAND_TOKENS_LIGHT } from '../../theme/brandTokens'
import { isBrandLightSession } from '../../theme/useBrandPalette'
import { getEffectiveJobKeys } from '../../lib/roleContext'

const TOKENS_LIGHT = BRAND_TOKENS_LIGHT

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const fmtDate = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: '2-digit',
    })
  } catch {
    return d
  }
}

const getStateMap = (TOKENS) => ({
  draft:    { label: 'Borrador', color: TOKENS.colors.textMuted },
  sent:     { label: 'Enviado',  color: TOKENS.colors.blue },
  purchase: { label: 'Confirmado', color: TOKENS.colors.success },
  done:     { label: 'Completo',   color: TOKENS.colors.success },
  cancel:   { label: 'Cancelado',  color: TOKENS.colors.error },
})

const getApprovalMap = (TOKENS) => ({
  none:     null,
  pending:  { label: 'Aprobación pendiente', color: TOKENS.colors.warning },
  approved: { label: 'Aprobado',             color: TOKENS.colors.success },
  rejected: { label: 'Rechazado',            color: TOKENS.colors.error },
})

// ─── Componentes ─────────────────────────────────────────────────────────────

function StateBadge({ state, approval, tokens = DARK_TOKENS }) {
  const stateMap = getStateMap(tokens)
  const approvalMap = getApprovalMap(tokens)
  const s = stateMap[state] || { label: state, color: tokens.colors.textMuted }
  const a = approval && approval !== 'none' ? approvalMap[approval] : null
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 7px',
        borderRadius: 999, background: `${s.color}18`,
        border: `1px solid ${s.color}35`, color: s.color,
      }}>
        {s.label}
      </span>
      {a && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px',
          borderRadius: 999, background: `${a.color}18`,
          border: `1px solid ${a.color}35`, color: a.color,
        }}>
          {a.label}
        </span>
      )}
    </div>
  )
}

function RequisicionCard({ req, onClick, tokens = DARK_TOKENS }) {
  const TOKENS = tokens
  const title = (req.origin || req.name || '').replace(/^PWA-Admin:\s*/i, '').trim() || req.name
  return (
    <button
      onClick={() => onClick(req.id)}
      style={{
        width: '100%', textAlign: 'left', background: TOKENS.colors.surfaceSoft,
        border: `1px solid ${TOKENS.colors.border}`, borderRadius: TOKENS.radius.lg,
        padding: '14px 16px', cursor: 'pointer', display: 'flex',
        flexDirection: 'column', gap: 8, transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${TOKENS.colors.blue}14`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = TOKENS.colors.surfaceSoft)}
    >
      {/* Fila superior: folio + fecha */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TOKENS.colors.text }}>
            {req.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: TOKENS.colors.textMuted }}>
            {title}
          </p>
        </div>
        <span style={{ fontSize: 11, color: TOKENS.colors.textMuted, whiteSpace: 'nowrap' }}>
          {fmtDate(req.date_order)}
        </span>
      </div>

      {/* Empresa */}
      {req.company_name && (
        <p style={{ margin: 0, fontSize: 11, color: TOKENS.colors.blue3, fontWeight: 600 }}>
          {req.company_name}
        </p>
      )}

      {/* Fila inferior: monto + estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <StateBadge state={req.state} approval={req.approval_state} tokens={TOKENS} />
        <span style={{ fontSize: 13, fontWeight: 700, color: TOKENS.colors.textSoft }}>
          {req.amount_total ? fmt(req.amount_total) : '—'}
        </span>
      </div>
    </button>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ScreenTorreRequisiciones() {
  const { session } = useSession()
  const navigate = useNavigate()
  const isLightSurface = getEffectiveJobKeys(session).includes('operador_torres') || isBrandLightSession(session)
  const TOKENS = isLightSurface ? TOKENS_LIGHT : DARK_TOKENS

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getTorreRequisitions()
      const list = res?.data?.requisitions ?? res?.data ?? (Array.isArray(res) ? res : [])
      setItems(Array.isArray(list) ? list : [])
    } catch (e) {
      setError(e?.message || 'Error al cargar requisiciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCard = (id) => navigate(`/torres/requisicion/${id}`)

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${TOKENS.colors.border}`,
        background: TOKENS.colors.surfaceSoft,
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, color: TOKENS.colors.textMuted, fontSize: 20,
            display: 'flex', alignItems: 'center',
          }}
          aria-label="Volver"
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TOKENS.colors.text }}>
            Validar Requisiciones
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: TOKENS.colors.textMuted }}>
            Torre de Control · Órdenes de compra pendientes
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            background: `${TOKENS.colors.blue}18`, border: `1px solid ${TOKENS.colors.blue}30`,
            borderRadius: 8, padding: '6px 12px', cursor: loading ? 'not-allowed' : 'pointer',
            color: TOKENS.colors.blue3, fontSize: 12, fontWeight: 600,
          }}
        >
          {loading ? '...' : 'Actualizar'}
        </button>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '16px 16px 32px', maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {/* Error */}
        {error && !loading && (
          <div style={{
            background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}40`,
            borderRadius: TOKENS.radius.lg, padding: '12px 16px', marginBottom: 16,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: TOKENS.colors.error }}>{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: 90, borderRadius: TOKENS.radius.lg,
                background: TOKENS.colors.surfaceSoft,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {/* Lista */}
        {!loading && !error && (
          <>
            {items.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                color: TOKENS.colors.textMuted,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  Sin requisiciones pendientes
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                  El gerente aún no ha creado ninguna solicitud de compra.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: TOKENS.colors.textMuted, fontWeight: 600 }}>
                  {items.length} requisición{items.length !== 1 ? 'es' : ''} pendiente{items.length !== 1 ? 's' : ''}
                </p>
                {items.map((req) => (
                  <RequisicionCard key={req.id} req={req} onClick={handleCard} tokens={TOKENS} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
