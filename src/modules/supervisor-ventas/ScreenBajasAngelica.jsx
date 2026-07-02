import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorState, Loader } from '../../components/Loader'
import { TOKENS, getTypo } from '../../tokens'
import { ScreenShell, EmptyState } from '../entregas/components'
import { normalizeDeactivationRequest } from './customerDeactivationState'
import { getAngelicaDeactivationQueue } from './customerDeactivationService'

export default function ScreenBajasAngelica() {
  const navigate = useNavigate()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [route, setRoute] = useState('')
  const [reason, setReason] = useState('')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => { load() }, [])

  async function load(filters = { route, reason }) {
    setLoading(true)
    setError('')
    try {
      const payload = await getAngelicaDeactivationQueue({ limit: 50, offset: 0, ...filters })
      const rows = Array.isArray(payload?.rows) ? payload.rows : (Array.isArray(payload) ? payload : payload?.requests || [])
      setRequests(rows.map(normalizeDeactivationRequest))
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la cola de Angelica')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters(event) {
    event.preventDefault()
    load({ route, reason })
  }

  return (
    <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas">
      <form onSubmit={applyFilters} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 8 }}>
        <FilterInput label="Ruta" value={route} onChange={setRoute} />
        <FilterInput label="Motivo" value={reason} onChange={setReason} />
        <button type="submit" style={filterButtonStyle}>Filtrar</button>
      </form>

      {loading ? (
        <Loader label="Cargando vistos buenos" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : requests.length === 0 ? (
        <EmptyState icon="📋" title="Sin pendientes" subtitle="No hay bajas pendientes para Angelica" typo={typo} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {requests.map((request) => (
            <button
              key={request.id}
              onClick={() => navigate(`/equipo/bajas/angelica/${request.id}`)}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: TOKENS.radius.lg,
                background: TOKENS.glass.panel,
                border: `1px solid ${TOKENS.colors.border}`,
                color: TOKENS.colors.text,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...typo.body, margin: 0, fontWeight: 700, color: TOKENS.colors.text }}>
                    {request.partner_name || `Cliente ${request.partner_id || request.id}`}
                  </p>
                  <p style={{ ...typo.caption, margin: '4px 0 0', color: TOKENS.colors.textMuted }}>
                    {request.route_name || 'Sin ruta'} · {request.sugey_result || 'Sin resultado Sugey'}
                  </p>
                </div>
                <span style={{ ...typo.caption, color: TOKENS.colors.blue2, fontWeight: 700 }}>
                  Revisar
                </span>
              </div>
              <p style={{ ...typo.caption, margin: '8px 0 0', color: TOKENS.colors.textSoft }}>
                {request.reason_label || request.reason || 'Motivo sin especificar'}
                {(request.request_photo_url || request.sugey_photo_url) ? ' · Con evidencia' : ''}
                {request.age_hours ? ` · ${request.age_hours}h` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </ScreenShell>
  )
}

function FilterInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: TOKENS.colors.textLow, textTransform: 'uppercase' }}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minWidth: 0,
          padding: '9px 10px',
          borderRadius: TOKENS.radius.md,
          border: `1px solid ${TOKENS.colors.border}`,
          background: TOKENS.colors.surface,
          color: TOKENS.colors.text,
        }}
      />
    </label>
  )
}

const filterButtonStyle = {
  alignSelf: 'end',
  padding: '9px 12px',
  borderRadius: TOKENS.radius.md,
  border: `1px solid ${TOKENS.colors.border}`,
  background: TOKENS.glass.panel,
  color: TOKENS.colors.text,
  cursor: 'pointer',
}
