import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSession } from '../../App'
import { softWarehouse } from '../../lib/sessionGuards'
import { getTypo } from '../../tokens'
import SessionErrorState from '../../components/SessionErrorState'
import { isBrandLightSession } from '../../theme/useBrandPalette'
import { getVanLoadHistory } from './entregasService'
import { buildVanLoadHistorySummary, groupVanLoadHistoryByVan, mexicoTodayDateKey } from './vanLoadHistory'
import { ScreenShell, EmptyState } from './components'
import { AdminProvider } from '../admin/AdminContext'
import AdminShell from '../admin/components/AdminShell'
import { getHistorialCargasTheme } from './historialCargasTheme.js'

function Spinner({ tokens }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
      <div style={{
        width: 32,
        height: 32,
        border: `2px solid ${tokens.colors.spinnerTrack}`,
        borderTop: `2px solid ${tokens.colors.blue2}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function formatDateLabel(value) {
  if (!value) return ''
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return new Date(`${year}-${month}-${day}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function SummaryTile({ label, value, typo, tokens }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: tokens.radius.md,
      background: tokens.colors.surfaceSoft,
      border: `1px solid ${tokens.colors.border}`,
      minWidth: 0,
    }}>
      <p style={{ ...typo.caption, color: tokens.colors.textMuted, margin: 0 }}>{label}</p>
      <p style={{ ...typo.h2, color: tokens.colors.text, margin: '4px 0 0' }}>{value}</p>
    </div>
  )
}

function LoadStateBadge({ item, tokens }) {
  const done = item.state === 'done'
  const refill = item.loadKind === 'refill'
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{
        padding: '3px 8px',
        borderRadius: tokens.radius.pill,
        fontSize: 11,
        fontWeight: 700,
        color: refill ? tokens.colors.warning : tokens.colors.blue2,
        background: refill ? tokens.colors.warningSoft : tokens.colors.chipInfoBg,
        border: `1px solid ${refill ? `${tokens.colors.warning}3d` : `${tokens.colors.blue}3d`}`,
      }}>
        {item.loadKindLabel}
      </span>
      <span style={{
        padding: '3px 8px',
        borderRadius: tokens.radius.pill,
        fontSize: 11,
        fontWeight: 700,
        color: done ? tokens.colors.success : tokens.colors.textMuted,
        background: done ? tokens.colors.successSoft : tokens.colors.surface,
        border: `1px solid ${done ? `${tokens.colors.success}40` : tokens.colors.border}`,
      }}>
        {item.stateLabel}
      </span>
    </div>
  )
}

function HistoryView({ backTo, isAdmin = false, shell = true }) {
  const { session } = useSession()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 390)
  const typo = useMemo(() => getTypo(sw), [sw])
  const isLightSurface = !isAdmin && (['almacenista_entregas', 'favy_cedis'].includes(session?.role) || isBrandLightSession(session))
  const tokens = useMemo(() => getHistorialCargasTheme({ isAdmin, isLightSurface }), [isAdmin, isLightSurface])
  const [date, setDate] = useState(mexicoTodayDateKey())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const warehouseId = softWarehouse(session)
  const summary = useMemo(() => buildVanLoadHistorySummary(items), [items])
  const groups = useMemo(() => groupVanLoadHistoryByVan(items), [items])

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const loadData = useCallback(async () => {
    if (!warehouseId || !date) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const history = await getVanLoadHistory({ warehouseId, date })
      setItems(history)
    } catch (e) {
      if (e.message !== 'no_session') setError('No se pudo cargar el historial de cargas.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [warehouseId, date])

  useEffect(() => { loadData() }, [loadData])

  if (!warehouseId) {
    return (
      <SessionErrorState
        error={{ missing: 'warehouse_id', userMessage: 'Tu usuario no tiene almacén asignado.' }}
        backTo={backTo}
      />
    )
  }

  const content = (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input { color-scheme: ${(isAdmin || isLightSurface) ? 'light' : 'dark'}; }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: sw >= 720 ? '1fr auto auto' : '1fr',
        gap: 10,
        alignItems: 'end',
        marginBottom: 14,
      }}>
        <div>
          <p style={{ ...typo.overline, color: tokens.colors.textLow, margin: '0 0 6px' }}>
            DIA DE REGISTRO
          </p>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '10px 12px',
              borderRadius: tokens.radius.md,
              background: tokens.colors.surface,
              border: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.text,
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => setDate(mexicoTodayDateKey())}
          style={{
            minHeight: 44,
            padding: '0 14px',
            borderRadius: tokens.radius.md,
            background: tokens.colors.surfaceSoft,
            border: `1px solid ${tokens.colors.border}`,
            color: tokens.colors.textSoft,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Hoy
        </button>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            minHeight: 44,
            padding: '0 16px',
            borderRadius: tokens.radius.md,
            background: tokens.colors.ctaGradient,
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            opacity: loading ? 0.65 : 1,
          }}
        >
          Actualizar
        </button>
      </div>

      <p style={{ ...typo.body, color: tokens.colors.textSoft, margin: '0 0 14px', textTransform: 'capitalize' }}>
        {formatDateLabel(date)}
      </p>

      {error && (
        <div style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: tokens.radius.md,
          background: tokens.colors.errorSoft,
          border: `1px solid ${tokens.colors.error}38`,
          color: tokens.colors.error,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: sw >= 720 ? 'repeat(3, 1fr)' : 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}>
          <SummaryTile label="Movimientos" value={summary.totalLoads} typo={typo} tokens={tokens} />
          <SummaryTile label="Camionetas" value={summary.totalVans} typo={typo} tokens={tokens} />
          <SummaryTile label="Piezas" value={summary.totalQty} typo={typo} tokens={tokens} />
        </div>
      )}

      {loading ? (
        <Spinner tokens={tokens} />
      ) : groups.length === 0 ? (
        <EmptyState icon="🚚" title="Sin cargas registradas ese día" subtitle={isAdmin ? 'El admin verá aquí lo registrado por almacén de entregas.' : 'Cuando registres cargas o recargas aparecerán aquí.'} tokens={tokens} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map((group) => (
            <section key={group.key} style={{
              borderRadius: tokens.radius.xl,
              background: tokens.glass.panel,
              border: `1px solid ${tokens.colors.border}`,
              boxShadow: tokens.shadow.soft,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: 14,
                borderBottom: `1px solid ${tokens.colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...typo.h2, color: tokens.colors.text, margin: 0, fontSize: 15 }}>
                    {group.label}
                  </p>
                  <p style={{ ...typo.caption, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                    {group.totalLoads} movimiento{group.totalLoads !== 1 ? 's' : ''} · {group.totalQty} piezas
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.items.map((item, index) => (
                  <div key={item.id || index} style={{
                    padding: 14,
                    borderBottom: index < group.items.length - 1 ? `1px solid ${tokens.colors.border}` : 'none',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                      marginBottom: 10,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ ...typo.title, color: tokens.colors.text, margin: 0 }}>
                          {item.time || '--:--'} {item.name ? `· ${item.name}` : ''}
                        </p>
                        <p style={{ ...typo.caption, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                          {item.mobileLocationName || 'Unidad sin ubicación'}
                          {item.registeredByName ? ` · Registro: ${item.registeredByName}` : ''}
                        </p>
                      </div>
                      <LoadStateBadge item={item} tokens={tokens} />
                    </div>

                    <div style={{
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.colors.border}`,
                      overflow: 'hidden',
                    }}>
                      {item.lines.map((line, lineIndex) => (
                        <div key={`${item.id}-${line.productId}-${lineIndex}`} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '9px 11px',
                          background: lineIndex % 2 === 0 ? tokens.colors.surfaceSoft : 'transparent',
                          borderBottom: lineIndex < item.lines.length - 1 ? `1px solid ${tokens.colors.border}` : 'none',
                        }}>
                          <span style={{ ...typo.caption, color: tokens.colors.textSoft, fontWeight: 600 }}>
                            {line.productName}
                          </span>
                          <span style={{ ...typo.caption, color: tokens.colors.blue2, fontWeight: 800 }}>
                            {line.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )

  if (!shell) return content
  return (
    <ScreenShell title="Historial de cargas" backTo={backTo} tokens={tokens}>
      {content}
    </ScreenShell>
  )
}

export default function ScreenHistorialCargas() {
  const location = useLocation()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const isAdmin = location.pathname.startsWith('/admin')

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (isAdmin && sw >= 1024) {
    return (
      <AdminProvider>
        <AdminShell activeBlock="historial-cargas" title="Historial de cargas" hideActivityFeed>
          <HistoryView backTo="/admin" isAdmin shell={false} />
        </AdminShell>
      </AdminProvider>
    )
  }

  return <HistoryView backTo={isAdmin ? '/admin' : '/entregas'} isAdmin={isAdmin} />
}
