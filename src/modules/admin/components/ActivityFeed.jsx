import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOKENS } from '../../../tokens'
import { useAdmin } from '../AdminContext'
import { getTodayExpenses, getTodayMpTransfers, getTodaySales } from '../api'
import { buildModuleActivityFeed, resolveActivityFeedScope } from '../activityFeedModel'

const POLL_MS = 30_000

function normalizeList(payload) {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.transfers)) return data.transfers
  return []
}

export default function ActivityFeed({ moduleId = 'hub', variant = 'sidebar' }) {
  const { warehouseId, companyId } = useAdmin()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState(null)
  const embedded = variant === 'embedded'

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const scope = resolveActivityFeedScope(moduleId)
        const [salesRaw, expensesRaw, transfersRaw] = await Promise.all([
          scope.sales ? getTodaySales({ warehouseId, companyId }).catch(() => []) : Promise.resolve([]),
          scope.expenses ? getTodayExpenses({ companyId, warehouseId }).catch(() => []) : Promise.resolve([]),
          scope.transfers ? getTodayMpTransfers({ companyId, warehouseId }).catch(() => []) : Promise.resolve([]),
        ])
        if (!alive) return
        setEvents(buildModuleActivityFeed(moduleId, {
          sales: normalizeList(salesRaw),
          expenses: normalizeList(expensesRaw),
          transfers: normalizeList(transfersRaw),
        }))
        setLastFetch(new Date())
      } catch {
        // silent - el feed es secundario
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [warehouseId, companyId, moduleId])

  const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const Container = embedded ? 'section' : 'aside'
  const containerStyle = embedded
    ? {
        marginTop: 0,
      }
    : {
        position: 'sticky',
        top: 0,
        height: '100dvh',
        padding: '20px 16px',
        overflowY: 'auto',
        background: TOKENS.glass.panelSoft,
        borderLeft: `1px solid ${TOKENS.colors.border}`,
      }

  return (
    <Container style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          color: TOKENS.colors.textLow, margin: 0,
        }}>
          ACTIVIDAD HOY
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: loading ? TOKENS.colors.warning : TOKENS.colors.success,
          }} />
          <span style={{ fontSize: 9, color: TOKENS.colors.textLow }}>
            {loading ? 'sync' : 'live'}
          </span>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
          <div style={{
            width: 22, height: 22, border: '2px solid rgba(255,255,255,0.12)',
            borderTop: '2px solid #2B8FE0', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : events.length === 0 ? (
        <div style={{
          padding: '20px 14px', borderRadius: TOKENS.radius.md, textAlign: 'center',
          background: TOKENS.colors.surfaceSoft, border: `1px dashed ${TOKENS.colors.border}`,
        }}>
          <p style={{ fontSize: 11, color: TOKENS.colors.textMuted, margin: 0 }}>
            Sin actividad aun
          </p>
        </div>
      ) : (
        <div style={{
          display: embedded ? 'grid' : 'flex',
          gridTemplateColumns: embedded ? 'repeat(auto-fit, minmax(260px, 1fr))' : undefined,
          flexDirection: embedded ? undefined : 'column',
          gap: 8,
        }}>
          {events.map((ev) => {
            const color = ev.type === 'sale'
              ? TOKENS.colors.success
              : ev.type === 'transfer'
                ? TOKENS.colors.blue3
                : TOKENS.colors.warning
            const canViewTicket = ev.type === 'sale' && ev.orderId
            return (
              <div key={ev.id} style={{
                padding: '10px 12px', borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.surface,
                border: `1px solid ${TOKENS.colors.border}`,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: color, marginTop: 6, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 600, color: TOKENS.colors.text,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.label}
                    </p>
                    {ev.meta && (
                      <p style={{
                        fontSize: 10, color: TOKENS.colors.textLow, margin: 0, marginTop: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ev.meta}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
                    {ev.valueLabel || `${ev.type === 'expense' ? '-' : ''}${fmt(ev.amount)}`}
                  </span>
                </div>
                {canViewTicket && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/ticket/${ev.orderId}`)}
                    style={{
                      alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: TOKENS.radius.sm,
                      background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                      color: TOKENS.colors.blue2, fontSize: 10, fontWeight: 600,
                      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Ver ticket
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lastFetch && (
        <p style={{
          fontSize: 9, color: TOKENS.colors.textLow, marginTop: 14, textAlign: 'center',
        }}>
          Actualizado {lastFetch.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </Container>
  )
}
