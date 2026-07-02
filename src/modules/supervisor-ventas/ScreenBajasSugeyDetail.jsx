import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PhotoCapture from '../../components/PhotoCapture'
import { ErrorState, Loader } from '../../components/Loader'
import { TOKENS, getTypo } from '../../tokens'
import { ScreenShell, EmptyState } from '../entregas/components'
import {
  SUGEY_VERIFICATION_RESULTS,
  buildSugeyVerificationPayload,
  normalizeDeactivationRequest,
  validateSugeyVerificationForm,
} from './customerDeactivationState'
import {
  getCustomerDeactivationDetail,
  verifyCustomerDeactivationAsSugey,
} from './customerDeactivationService'

export default function ScreenBajasSugeyDetail() {
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
    result: '',
    comment: '',
    photoBase64: '',
    latitude: null,
    longitude: null,
    accuracy: null,
  })

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => { load() }, [requestId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRequest(normalizeDeactivationRequest(await getCustomerDeactivationDetail(requestId)))
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  function captureGps() {
    setFormError('')
    if (!navigator.geolocation?.getCurrentPosition) {
      setFormError('GPS no disponible en este dispositivo.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }))
      },
      () => setFormError('No se pudo obtener GPS. Revisa permisos de ubicacion.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  async function submit(event) {
    event.preventDefault()
    const validation = validateSugeyVerificationForm(form)
    if (validation) {
      setFormError(validation)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = buildSugeyVerificationPayload({
        ...form,
        verifiedAt: new Date().toISOString(),
      })
      if (!payload.photo_base64) {
        setFormError('La foto es obligatoria.')
        return
      }
      await verifyCustomerDeactivationAsSugey(requestId, payload)
      navigate('/equipo/bajas/sugey')
    } catch (e) {
      setFormError(e?.message || 'No se pudo guardar la verificacion')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas/sugey">
        <Loader label="Cargando solicitud" />
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas/sugey">
        <ErrorState message={error} onRetry={load} />
      </ScreenShell>
    )
  }

  if (!request) {
    return (
      <ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas/sugey">
        <EmptyState icon="📋" title="Solicitud no encontrada" subtitle="La solicitud ya no esta disponible" typo={typo} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="Verificacion Sugey" backTo="/equipo/bajas/sugey">
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
          <img src={request.request_photo_url} alt="Evidencia inicial" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: TOKENS.radius.md, marginTop: 10 }} />
        )}
      </section>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Resultado</span>
          <select
            value={form.result}
            onChange={(event) => setForm((current) => ({ ...current, result: event.target.value }))}
            style={inputStyle}
          >
            <option value="">Selecciona resultado</option>
            {Object.values(SUGEY_VERIFICATION_RESULTS).map((result) => (
              <option key={result.value} value={result.value}>{result.label}</option>
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

        <PhotoCapture
          value={form.photoBase64}
          onChange={(value) => setForm((current) => ({ ...current, photoBase64: value || '' }))}
          label="Foto de verificacion"
          required
          maxSizeKB={4096}
          disabled={saving}
        />

        <button type="button" onClick={captureGps} disabled={saving} style={secondaryButtonStyle}>
          {form.latitude && form.longitude ? `GPS capturado (${Math.round(form.accuracy || 0)}m)` : 'Capturar GPS'}
        </button>

        {formError && (
          <p style={{ ...typo.caption, margin: 0, color: TOKENS.colors.error }}>{formError}</p>
        )}

        <button type="submit" disabled={saving} style={primaryButtonStyle}>
          {saving ? 'Guardando...' : 'Guardar verificacion'}
        </button>
      </form>
    </ScreenShell>
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

const secondaryButtonStyle = {
  padding: '11px 14px',
  borderRadius: TOKENS.radius.md,
  border: `1px solid ${TOKENS.colors.border}`,
  background: TOKENS.glass.panel,
  color: TOKENS.colors.text,
  cursor: 'pointer',
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
