import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { ErrorState, EmptyState, Loader } from '../../components/Loader'
import SessionErrorState from '../../components/SessionErrorState'
import { softWarehouse } from '../../lib/sessionGuards'
import { TOKENS } from '../../tokens'
import { getNightTodaySales } from './api'
import {
  getPosSaleStateLabel,
  normalizeNightPosSalesResponse,
} from './nightPosSales'
import { buildPosTicketPath, NIGHT_POS_FLOW } from './posFlow'

const mexicoTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const STATE_TONES = Object.freeze({
  sale: {
    color: TOKENS.colors.success,
    background: TOKENS.colors.successSoft,
    border: `${TOKENS.colors.success}55`,
  },
  done: {
    color: TOKENS.colors.blue3,
    background: TOKENS.colors.blueGlow,
    border: TOKENS.colors.borderBlue,
  },
  cancel: {
    color: TOKENS.colors.error,
    background: TOKENS.colors.errorSoft,
    border: `${TOKENS.colors.error}55`,
  },
})

const UNKNOWN_STATE_TONE = Object.freeze({
  color: TOKENS.colors.textMuted,
  background: TOKENS.colors.surface,
  border: TOKENS.colors.border,
})

// Odoo serializa estos valores como UTC sin sufijo. Fijar UTC antes de aplicar
// America/Mexico_City evita depender de la zona horaria del dispositivo.
// eslint-disable-next-line react-refresh/only-export-components
export function formatNightPosSaleTime(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Hora no disponible'
  const text = value.trim()
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text)
  const normalized = hasExplicitZone
    ? text
    : `${text.replace(' ', 'T')}Z`
  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) return 'Hora no disponible'
  return mexicoTimeFormatter.format(parsed)
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0)
}

function stateTone(state) {
  return STATE_TONES[state] || UNKNOWN_STATE_TONE
}

function SaleRow({ sale, onOpen }) {
  const ticketPath = buildPosTicketPath(NIGHT_POS_FLOW, sale.order_id)
  const folio = sale.name || `Venta #${sale.order_id}`
  const customer = sale.partner_name || 'Cliente no disponible'
  const label = getPosSaleStateLabel(sale.state)
  const tone = stateTone(sale.state)

  return (
    <button
      type="button"
      data-sale-order-id={ticketPath ? sale.order_id : undefined}
      disabled={!ticketPath}
      aria-label={ticketPath ? `Ver ticket ${folio}` : `Venta ${folio} sin ticket disponible`}
      onClick={() => {
        if (ticketPath) onOpen(ticketPath)
      }}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 14,
        padding: 16,
        borderRadius: TOKENS.radius.lg,
        border: `1px solid ${TOKENS.colors.border}`,
        background: TOKENS.glass.panel,
        color: TOKENS.colors.text,
        textAlign: 'left',
        cursor: ticketPath ? 'pointer' : 'not-allowed',
        opacity: ticketPath ? 1 : 0.55,
        boxShadow: TOKENS.shadow.soft,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16, lineHeight: 1.25 }}>{folio}</strong>
          <span style={{
            padding: '4px 8px',
            borderRadius: TOKENS.radius.pill,
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            {label}
          </span>
        </span>
        <span style={{
          display: 'block',
          marginTop: 7,
          color: TOKENS.colors.textSoft,
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {customer}
        </span>
        <span style={{ display: 'block', marginTop: 5, color: TOKENS.colors.textMuted, fontSize: 12 }}>
          {formatNightPosSaleTime(sale.date_order)}
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'center' }}>
        <strong style={{ color: TOKENS.colors.text, fontSize: 17, whiteSpace: 'nowrap' }}>
          {formatMoney(sale.amount_total)}
        </strong>
        <span aria-hidden="true" style={{ color: TOKENS.colors.blue3, fontSize: 22 }}>
          ›
        </span>
      </span>
    </button>
  )
}

function NightPosSalesView({ items, loading, error, onBack, onRetry, onOpen }) {
  return (
    <div style={{
      minHeight: '100dvh',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      color: TOKENS.colors.text,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font-family: 'DM Sans', sans-serif; }
        button:focus-visible { outline: 3px solid ${TOKENS.colors.blue3}; outline-offset: 3px; }
        @media (max-width: 560px) {
          .night-pos-sales-main { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>

      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px clamp(16px, 4vw, 32px)',
        borderBottom: `1px solid ${TOKENS.colors.border}`,
        background: 'rgba(3,8,17,0.90)',
        backdropFilter: 'blur(12px)',
      }}>
        <button
          type="button"
          aria-label="Volver al POS nocturno"
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: TOKENS.radius.md,
            border: `1px solid ${TOKENS.colors.border}`,
            background: TOKENS.colors.surface,
            color: TOKENS.colors.textSoft,
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: TOKENS.colors.textLow, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em' }}>
            POS NOCTURNO
          </p>
          <h1 style={{ margin: '3px 0 0', color: TOKENS.colors.text, fontSize: 21, lineHeight: 1.15 }}>
            Ventas de hoy
          </h1>
        </div>
      </header>

      <main className="night-pos-sales-main" style={{ width: '100%', maxWidth: 840, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 40px' }}>
        {loading ? (
          <div aria-live="polite">
            <Loader label="Cargando ventas de hoy…" />
          </div>
        ) : error ? (
          <div role="alert">
            <ErrorState
              title="No se pudieron cargar las ventas de hoy"
              message="Revisa tu conexión e inténtalo de nuevo."
              onRetry={onRetry}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No hay ventas registradas hoy"
            subtitle="Las ventas del turno nocturno aparecerán aquí."
          />
        ) : (
          <section aria-labelledby="night-pos-sales-list-title">
            <div style={{ marginBottom: 14 }}>
              <p id="night-pos-sales-list-title" style={{ margin: 0, color: TOKENS.colors.textLow, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em' }}>
                VENTAS DE HOY
              </p>
              <p style={{ margin: '5px 0 0', color: TOKENS.colors.textMuted, fontSize: 13 }}>
                {items.length} venta{items.length === 1 ? '' : 's'} en este turno
              </p>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map((sale) => (
                <SaleRow key={sale.order_id} sale={sale} onOpen={onOpen} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default function ScreenNightPosSales({
  loadSales = getNightTodaySales,
  navigateOverride,
}) {
  const sessionContext = useSession()
  const session = sessionContext?.session
  const routerNavigate = useNavigate()
  const navigate = typeof navigateOverride === 'function' ? navigateOverride : routerNavigate
  const warehouseId = softWarehouse(session)
  const companyId = Number(session?.company_id || 0) || null
  const requestSequence = useRef(0)
  const [retryKey, setRetryKey] = useState(0)
  const [state, setState] = useState({ loading: true, error: false, items: [] })

  useEffect(() => {
    if (!warehouseId || !companyId) return undefined

    const requestId = ++requestSequence.current
    let active = true
    setState({ loading: true, error: false, items: [] })

    Promise.resolve(loadSales({ warehouseId, companyId }))
      .then((response) => {
        if (!active || requestId !== requestSequence.current) return
        setState({
          loading: false,
          error: false,
          items: normalizeNightPosSalesResponse(response),
        })
      })
      .catch(() => {
        if (!active || requestId !== requestSequence.current) return
        setState({ loading: false, error: true, items: [] })
      })

    return () => {
      active = false
    }
  }, [warehouseId, companyId, loadSales, retryKey])

  const handleBack = useCallback(() => {
    navigate(NIGHT_POS_FLOW.posRoute)
  }, [navigate])

  const handleOpen = useCallback((path) => {
    if (path) navigate(path)
  }, [navigate])

  if (!warehouseId) {
    return <SessionErrorState error={{ missing: 'warehouse_id' }} backTo={NIGHT_POS_FLOW.posRoute} />
  }
  if (!companyId) {
    return <SessionErrorState error={{ missing: 'company_id' }} backTo={NIGHT_POS_FLOW.posRoute} />
  }

  return (
    <NightPosSalesView
      items={state.items}
      loading={state.loading}
      error={state.error}
      onBack={handleBack}
      onRetry={() => setRetryKey((key) => key + 1)}
      onOpen={handleOpen}
    />
  )
}
