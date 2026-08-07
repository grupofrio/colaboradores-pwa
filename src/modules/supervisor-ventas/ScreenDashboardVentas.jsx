import { useEffect, useMemo, useState } from 'react'
import { getTypo } from '../../tokens'
// Tema CLARO (rebranding tanda 3): misma forma que TOKENS, paleta institucional.
// Estas pantallas solo se montan bajo rutas moduleId="supervisor_ventas"; el
// invariante lo verifica tests/brandTokensScope.test.mjs.
import { BRAND_TOKENS as TOKENS } from '../../theme/brandTokens'
import { ScreenShell, EmptyState } from '../entregas/components'
import { apiGet, getSession } from '../../lib/api.js'
import { getDayOverview } from './supvService'
import { buildSupervisorDashboardFallback } from './dashboardVentasState.js'

export default function ScreenDashboardVentas() {
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [loading, setLoading] = useState(true)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [error, setError] = useState('')
  const [embedUrl, setEmbedUrl] = useState(null)
  const [overview, setOverview] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setIframeLoading(true)
      setError('')

      try {
        const session = getSession()
        const jobKey = session.job_key || 'SUPERVISOR_VENTAS'

        const [overviewRes, embedRes] = await Promise.allSettled([
          getDayOverview(),
          apiGet(`/pwa-metabase-token?job_key=${encodeURIComponent(jobKey)}`),
        ])

        if (cancelled) return

        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value)
        } else {
          setOverview(null)
        }

        if (embedRes.status === 'fulfilled' && embedRes.value?.success && embedRes.value?.embed_url) {
          setEmbedUrl(embedRes.value.embed_url)
        } else {
          setEmbedUrl(null)
          setIframeLoading(false)
        }

        if (overviewRes.status !== 'fulfilled' && embedRes.status !== 'fulfilled') {
          setError('No se pudo cargar el dashboard')
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'No se pudo cargar el dashboard')
          setEmbedUrl(null)
          setOverview(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey])

  const refreshBtn = (
    <button
      onClick={() => setRefreshKey((value) => value + 1)}
      style={{
        width: 38, height: 38, borderRadius: TOKENS.radius.md,
        background: TOKENS.colors.surface,
        border: `1px solid ${TOKENS.colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TOKENS.colors.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    </button>
  )

  if (loading) {
    return (
      <ScreenShell tokens={TOKENS} title="Dashboard Ventas" backTo="/equipo" rightAction={refreshBtn}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{
            width: 32, height: 32,
            border: `2px solid ${TOKENS.colors.border}`,
            borderTop: `2px solid ${TOKENS.colors.blue2}`,
            borderRadius: '50%',
            animation: 'entregasShellSpin 0.8s linear infinite',
          }} />
        </div>
      </ScreenShell>
    )
  }

  if (error && !overview && !embedUrl) {
    return (
      <ScreenShell tokens={TOKENS} title="Dashboard Ventas" backTo="/equipo" rightAction={refreshBtn}>
        <EmptyState tokens={TOKENS} icon="!" title="Dashboard no disponible" subtitle={error} typo={typo} />
      </ScreenShell>
    )
  }

  const fallback = buildSupervisorDashboardFallback(overview || {})

  return (
    <ScreenShell tokens={TOKENS} title="Dashboard Ventas" backTo="/equipo" rightAction={refreshBtn}>
      <div style={{
        padding: '18px 16px', borderRadius: TOKENS.radius.xl,
        background: TOKENS.glass.hero,
        border: `1px solid ${TOKENS.colors.borderBlue}`,
        marginTop: 4,
      }}>
        <p style={{ ...typo.overline, color: TOKENS.colors.blue3, margin: 0, marginBottom: 6 }}>
          RESUMEN OPERATIVO
        </p>
        <p style={{ fontSize: 28, fontWeight: 700, color: TOKENS.colors.text, margin: 0, letterSpacing: '-0.04em' }}>
          {fallback.hero.value}
        </p>
        <p style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0, marginTop: 4 }}>
          {fallback.hero.label}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        {fallback.cards.map((card) => (
          <MetricCard key={card.label} typo={typo} label={card.label} value={card.value} />
        ))}
      </div>

      <div style={{
        marginTop: 12,
        padding: '12px 14px',
        borderRadius: TOKENS.radius.lg,
        background: TOKENS.glass.panel,
        border: `1px solid ${TOKENS.colors.border}`,
      }}>
        <p style={{ ...typo.overline, color: TOKENS.colors.textMuted, margin: 0, marginBottom: 10 }}>
          DESEMPEÑO DEL EQUIPO
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {fallback.breakdown.map((item) => (
            <BreakdownPill key={item.label} typo={typo} label={item.label} value={item.value} />
          ))}
        </div>
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 10 }}>
          {fallback.footer}
        </p>
      </div>

      <div style={{
        marginTop: 14,
        borderRadius: TOKENS.radius.xl,
        border: `1px solid ${TOKENS.colors.borderBlue}`,
        // Marco simulado de navegador alrededor del embed de Metabase. El
        // CONTENIDO del iframe es externo y no se toca (igual que el brief);
        // el marco sí sigue el tema.
        background: TOKENS.colors.surface,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 340,
      }}>
        <div style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          borderBottom: `1px solid ${TOKENS.colors.border}`,
          background: TOKENS.colors.surfaceStrong,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ef4444', '#f59e0b', '#22c55e'].map((color) => (
              <div key={color} style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.6 }} />
            ))}
          </div>
          <span style={{ fontSize: 9, color: TOKENS.colors.textMuted, letterSpacing: '0.04em' }}>
            dashboard.grupofrio.mx · Supervisor ventas
          </span>
        </div>

        {embedUrl ? (
          <>
            {iframeLoading && (
              <div style={{
                position: 'absolute',
                inset: '36px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: TOKENS.colors.surface,
                zIndex: 1,
              }}>
                <div style={{
                  width: 32, height: 32,
                  border: `2px solid ${TOKENS.colors.border}`,
                  borderTop: `2px solid ${TOKENS.colors.blue2}`,
                  borderRadius: '50%',
                  animation: 'entregasShellSpin 0.8s linear infinite',
                }} />
              </div>
            )}
            <iframe
              src={embedUrl}
              onLoad={() => setIframeLoading(false)}
              style={{
                width: '100%',
                minHeight: 360,
                height: 'calc(100dvh - 380px)',
                border: 'none',
                display: 'block',
              }}
              title="Dashboard Ventas"
              allow="fullscreen"
            />
          </>
        ) : (
          <div style={{ padding: '18px 16px 20px' }}>
            <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0 }}>
              Dashboard live no disponible
            </p>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 8 }}>
              Mostrando resumen nativo del día mientras se configura o recupera el embed de Metabase.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
              <InlineStat typo={typo} label="Rutas activas" value={String(Number(overview?.with_route || 0))} />
              <InlineStat typo={typo} label="Sin salir" value={String(Number(overview?.not_departed || 0))} />
              <InlineStat typo={typo} label="Liquidadas" value={String(Number(overview?.liquidated || 0))} />
              <InlineStat typo={typo} label="Pend. liquidar" value={String(Number(overview?.pending_liquidation || 0))} />
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 24 }} />
    </ScreenShell>
  )
}

function MetricCard({ typo, label, value }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: TOKENS.radius.lg,
      background: TOKENS.glass.panel,
      border: `1px solid ${TOKENS.colors.border}`,
    }}>
      <p style={{ ...typo.overline, color: TOKENS.colors.textMuted, margin: 0, marginBottom: 6, fontSize: 9 }}>
        {label.toUpperCase()}
      </p>
      <p style={{ fontSize: 20, fontWeight: 700, color: TOKENS.colors.text, margin: 0, letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  )
}

function BreakdownPill({ typo, label, value }) {
  return (
    <div style={{
      padding: '10px 8px',
      borderRadius: TOKENS.radius.md,
      background: TOKENS.colors.surfaceSoft,
      border: `1px solid ${TOKENS.colors.border}`,
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 18, fontWeight: 700, color: TOKENS.colors.text, margin: 0 }}>{value}</p>
      <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2 }}>{label}</p>
    </div>
  )
}

function InlineStat({ typo, label, value }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: TOKENS.radius.md,
      background: TOKENS.colors.surfaceSoft,
      border: `1px solid ${TOKENS.colors.border}`,
    }}>
      <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: TOKENS.colors.blue3, margin: 0, marginTop: 4 }}>
        {value}
      </p>
    </div>
  )
}
