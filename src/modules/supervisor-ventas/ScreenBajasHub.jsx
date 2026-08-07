import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { ErrorState, Loader } from '../../components/Loader'
import { TOKENS, getTypo } from '../../tokens'
import { ScreenShell, EmptyState } from '../entregas/components'
import {
  DEFAULT_DEACTIVATION_JOB_CONFIG,
  canAccessAngelicaDeactivation,
  canAccessSugeyDeactivation,
} from './customerDeactivationState'
import { getCustomerDeactivationSummary } from './customerDeactivationService'

export default function ScreenBajasHub() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canAccessSugey = canAccessSugeyDeactivation(session, DEFAULT_DEACTIVATION_JOB_CONFIG)
  const canAccessAngelica = canAccessAngelicaDeactivation(session, DEFAULT_DEACTIVATION_JOB_CONFIG)
  const hasDeactivationAccess = canAccessSugey || canAccessAngelica

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSummary(await getCustomerDeactivationSummary())
    } catch (e) {
      setError(e?.message || 'No se pudo cargar bajas controladas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasDeactivationAccess) load()
    else setLoading(false)
  }, [hasDeactivationAccess, load])

  const counts = normalizeSummary(summary)

  return (
    <ScreenShell title="Bajas controladas" backTo="/equipo">
      {!hasDeactivationAccess ? (
        <EmptyState
          icon="🔒"
          title="Sin acceso"
          subtitle="No tienes una asignacion de puesto habilitada para bajas controladas."
          typo={typo}
        />
      ) : loading ? (
        <Loader label="Cargando bajas controladas" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <SummaryCard label="Sugey" value={counts.pending_sugey} color="#14b8a6" typo={typo} />
            <SummaryCard label="Angelica" value={counts.pending_angelica} color={TOKENS.colors.blue2} typo={typo} />
            <SummaryCard label="Segunda visita" value={counts.second_visit_required} color={TOKENS.colors.warning} typo={typo} />
            <SummaryCard label="Recuperacion" value={counts.commercial_recovery} color="#a78bfa" typo={typo} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            {canAccessSugey && (
              <ActionCard
                title="Verificacion Sugey"
                subtitle={`${counts.pending_sugey} pendiente${counts.pending_sugey === 1 ? '' : 's'} de revisita`}
                color="#14b8a6"
                onClick={() => navigate('/equipo/bajas/sugey')}
                typo={typo}
              />
            )}
            {canAccessAngelica && (
              <ActionCard
                title="Visto bueno Angelica"
                subtitle={`${counts.pending_angelica} pendiente${counts.pending_angelica === 1 ? '' : 's'} de decision`}
                color={TOKENS.colors.blue2}
                onClick={() => navigate('/equipo/bajas/angelica')}
                typo={typo}
              />
            )}
          </div>
        </>
      )}
    </ScreenShell>
  )
}

function normalizeSummary(summary = {}) {
  const source = summary?.summary && typeof summary.summary === 'object' ? summary.summary : summary
  return {
    pending_sugey: Number(source?.pending_sugey || 0),
    pending_angelica: Number(source?.pending_angelica || 0),
    second_visit_required: Number(source?.second_visit_required || 0),
    commercial_recovery: Number(source?.commercial_recovery || 0),
  }
}

function SummaryCard({ label, value, color, typo }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: TOKENS.radius.lg,
      background: TOKENS.glass.panel,
      border: `1px solid ${TOKENS.colors.border}`,
    }}>
      <p style={{ ...typo.overline, color: TOKENS.colors.textMuted, margin: 0, marginBottom: 6 }}>
        {label.toUpperCase()}
      </p>
      <p style={{ fontSize: 24, fontWeight: 800, color, margin: 0 }}>
        {value}
      </p>
    </div>
  )
}

function ActionCard({ title, subtitle, color, onClick, typo }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: TOKENS.radius.lg,
        background: TOKENS.glass.panel,
        border: `1px solid ${TOKENS.colors.border}`,
        color: TOKENS.colors.text,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: 38,
        height: 38,
        borderRadius: TOKENS.radius.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}18`,
        border: `1px solid ${color}35`,
        color,
        flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...typo.body, display: 'block', color: TOKENS.colors.text, fontWeight: 700 }}>
          {title}
        </span>
        <span style={{ ...typo.caption, display: 'block', color: TOKENS.colors.textMuted, marginTop: 2 }}>
          {subtitle}
        </span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
