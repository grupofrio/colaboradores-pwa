import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorState, Loader } from '../../components/Loader'
import { TOKENS, getTypo } from '../../tokens'
import { ScreenShell, EmptyState } from '../entregas/components'
import {
  ANGELICA_DECISIONS,
  buildAngelicaDecisionPayload,
  normalizeDeactivationRequest,
  validateAngelicaDecisionForm,
} from './customerDeactivationState'
import {
  decideCustomerDeactivationAsAngelica,
  getCustomerDeactivationDetail,
} from './customerDeactivationService'

export default function ScreenBajasAngelicaDetail() {
  const navigate = useNavigate()
  const { requestId } = useParams()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    decision: '',
    comment: '',
  })

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequest(normalizeDeactivationRequest(await getCustomerDeactivationDetail(requestId)))
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la solicitud')
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => { load() }, [load])

  async function submit(event) {
    event.preventDefault()
    const validation = validateAngelicaDecisionForm(form)
    if (validation) {
      setFormError(validation)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = buildAngelicaDecisionPayload({
        ...form,
        decidedAt: new Date().toISOString(),
      })
      await decideCustomerDeactivationAsAngelica(requestId, payload)
      navigate('/equipo/bajas/angelica')
    } catch (e) {
      setFormError(e?.message || 'No se pudo guardar el visto bueno')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas/angelica">
        <Loader label="Cargando solicitud" />
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas/angelica">
        <ErrorState message={error} onRetry={load} />
      </ScreenShell>
    )
  }

  if (!request) {
    return (
      <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas/angelica">
        <EmptyState icon="📋" title="Solicitud no encontrada" subtitle="La solicitud ya no esta disponible" typo={typo} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="Visto bueno Angelica" backTo="/equipo/bajas/angelica">
      <EvidenceSection title="Evidencia del chofer" request={request} typo={typo} />
      <section style={{ marginTop: 12, padding: 14, borderRadius: TOKENS.radius.lg, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}` }}>
        <p style={{ ...typo.body, margin: 0, color: TOKENS.colors.text, fontWeight: 800 }}>
          Verificacion Sugey
        </p>
        <p style={{ ...typo.caption, margin: '6px 0 0', color: TOKENS.colors.textSoft }}>
          Resultado: {request.sugey_result || 'Sin resultado'}
        </p>
        {request.sugey_comment && (
          <p style={{ ...typo.caption, margin: '8px 0 0', color: TOKENS.colors.textSoft }}>
            {request.sugey_comment}
          </p>
        )}
        {request.sugey_photo_url && (
          <img src={request.sugey_photo_url} alt="Evidencia Sugey" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: TOKENS.radius.md, marginTop: 10 }} />
        )}
      </section>

      {request.timeline.length > 0 && (
        <section style={{ marginTop: 12, padding: 14, borderRadius: TOKENS.radius.lg, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}` }}>
          <p style={{ ...typo.body, margin: 0, color: TOKENS.colors.text, fontWeight: 800 }}>Bitacora</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {request.timeline.map((item, index) => (
              <p key={`${item.date || index}-${item.state || ''}`} style={{ ...typo.caption, margin: 0, color: TOKENS.colors.textSoft }}>
                {item.date || item.create_date || ''} · {item.state || item.label || ''} {item.comment || ''}
              </p>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Decision</span>
          <select
            value={form.decision}
            onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}
            style={inputStyle}
          >
            <option value="">Selecciona decision</option>
            {Object.values(ANGELICA_DECISIONS).map((decision) => (
              <option key={decision.value} value={decision.value}>{decision.label}</option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Comentario</span>
          <textarea
            value={form.comment}
            onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        {formError && (
          <p style={{ ...typo.caption, margin: 0, color: TOKENS.colors.error }}>{formError}</p>
        )}

        <button type="submit" disabled={saving} style={primaryButtonStyle}>
          {saving ? 'Guardando...' : 'Guardar visto bueno'}
        </button>
      </form>
    </ScreenShell>
  )
}

function EvidenceSection({ request, typo }) {
  return (
    <section style={{ marginTop: 8, padding: 14, borderRadius: TOKENS.radius.lg, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}` }}>
      <p style={{ ...typo.body, margin: 0, color: TOKENS.colors.text, fontWeight: 800 }}>
        {request.partner_name || `Cliente ${request.partner_id || request.id}`}
      </p>
      <p style={{ ...typo.caption, margin: '5px 0 0', color: TOKENS.colors.textMuted }}>
        {request.route_name || 'Sin ruta'} · {request.driver_name || 'Sin chofer'}
      </p>
      <p style={{ ...typo.caption, margin: '8px 0 0', color: TOKENS.colors.textSoft }}>
        Motivo: {request.reason_label || request.reason || 'Sin motivo'}
      </p>
      <p style={{ ...typo.caption, margin: '4px 0 0', color: TOKENS.colors.textSoft }}>
        Estado: {request.state || 'Sin estado'}
      </p>
      {request.request_contact_person && (
        <p style={{ ...typo.caption, margin: '4px 0 0', color: TOKENS.colors.textSoft }}>
          Contacto consultado: {request.request_contact_person}
        </p>
      )}
      {request.request_comment && (
        <p style={{ ...typo.caption, margin: '8px 0 0', color: TOKENS.colors.textSoft }}>
          {request.request_comment}
        </p>
      )}
      {request.request_photo_url && (
        <img src={request.request_photo_url} alt="Evidencia chofer" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: TOKENS.radius.md, marginTop: 10 }} />
      )}
    </section>
  )
}

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: TOKENS.colors.textLow,
  textTransform: 'uppercase',
}

const inputStyle = {
  padding: '11px 12px',
  borderRadius: TOKENS.radius.md,
  border: `1px solid ${TOKENS.colors.border}`,
  background: TOKENS.colors.surface,
  color: TOKENS.colors.text,
}

const primaryButtonStyle = {
  padding: '13px 14px',
  borderRadius: TOKENS.radius.md,
  border: 'none',
  background: 'linear-gradient(90deg,#15499B,#2B8FE0)',
  color: 'white',
  fontWeight: 800,
  cursor: 'pointer',
}
