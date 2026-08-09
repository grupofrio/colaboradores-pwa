import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS, getTypo } from '../../tokens'
import { getActiveShift } from './api'
import { resolveSupervisionWarehouseId } from './shiftContext'
import { createEnergyPeriodReading, getEnergySummary } from '../shared/plantEnergyAPI'
import { ENERGY_PERIODS, validatePeriodForm } from './energyPeriods'
import VoiceInputButton from '../shared/voice/VoiceInputButton'
import { sendVoiceFeedback } from '../shared/voice/voiceFeedback'
import { logScreenError } from '../shared/logScreenError'

// Energia — 3 registros del medidor (base / intermedia / punta).
//
// El operador captura el DISPLAY del medidor. El multiplicador (x1200 en
// Iguala) y el consumo por periodo los calcula Odoo: esta pantalla no
// multiplica ni suma nada para decidir; solo pinta lo que el backend devuelve.
//
// Turnos viejos (una sola lectura) se muestran como "total (sin desglose)".

const EMPTY_FORM = { base: '', intermedia: '', punta: '', photo: null }

export default function ScreenEnergia() {
  const { session } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [sw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const backTo = location.state?.backTo || '/supervision'
  const supervisionWarehouseId = resolveSupervisionWarehouseId(session)

  const [shift, setShift] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [formStart, setFormStart] = useState(EMPTY_FORM)
  const [formEnd, setFormEnd] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({ start: {}, end: {} })
  const [voiceContext, setVoiceContext] = useState({ start: null, end: null })
  const [voiceNote, setVoiceNote] = useState({ start: '', end: '' })

  // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline preexistente: efecto run-once on mount; refactor (useCallback) en PR aparte
  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!msg) return undefined
    const duration = msg.type === 'error' ? 6000 : 3500
    const t = setTimeout(() => setMsg(null), duration)
    return () => clearTimeout(t)
  }, [msg])

  async function loadData() {
    setLoading(true)
    try {
      const s = await getActiveShift(supervisionWarehouseId)
      setShift(s)
      if (s?.id) {
        const data = await getEnergySummary(s.id).catch((e) => {
          logScreenError('ScreenEnergia', 'getEnergySummary', e)
          return null
        })
        setSummary(data)
      } else {
        setSummary(null)
      }
    } catch (e) {
      logScreenError('ScreenEnergia', 'loadData', e)
    } finally {
      setLoading(false)
    }
  }

  const startReading = summary?.start || null
  const endReading = summary?.end || null
  const isLegacy = summary?.mode === 'single'

  async function handleSubmit(type) {
    const form = type === 'start' ? formStart : formEnd
    const previous = type === 'end' ? startReading : null
    const validation = validatePeriodForm(form, previous)
    setErrors((prev) => ({ ...prev, [type]: validation.errors }))
    if (!validation.ok) {
      setMsg({ type: 'error', text: validation.firstError })
      return
    }

    setSubmitting(true)
    try {
      const photoBase64 = await readFileAsDataUrl(form.photo)
      const data = await createEnergyPeriodReading({
        shift_id: shift.id,
        reading_type: type,
        kwh_base: Number(form.base),
        kwh_intermedia: Number(form.intermedia),
        kwh_punta: Number(form.punta),
        photo_base64: photoBase64,
      })
      if (data?.summary) setSummary(data.summary)

      const context = voiceContext[type]
      if (context?.trace_id) {
        sendVoiceFeedback({
          trace_id: context.trace_id,
          ai_output: context.ai_output || {},
          final_output: {
            kwh_base: Number(form.base),
            kwh_intermedia: Number(form.intermedia),
            kwh_punta: Number(form.punta),
          },
          metadata: {
            context_id: 'form_energy_reading',
            plaza_id: session?.plaza_id || null,
            user_id: session?.employee_id || null,
          },
        })
      }

      setMsg({ type: 'success', text: `Lectura de ${type === 'start' ? 'inicio' : 'fin'} registrada` })
      if (type === 'start') setFormStart(EMPTY_FORM)
      else setFormEnd(EMPTY_FORM)
      setVoiceContext((prev) => ({ ...prev, [type]: null }))
      setVoiceNote((prev) => ({ ...prev, [type]: '' }))
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Error al registrar lectura' })
    } finally {
      setSubmitting(false)
    }
  }

  function updateField(type, field, value) {
    const setter = type === 'start' ? setFormStart : setFormEnd
    setter((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[type]?.[field]) return prev
      return { ...prev, [type]: { ...prev[type], [field]: '' } }
    })
  }

  function handleVoiceResult(type, envelope) {
    const d = envelope?.data || {}
    const captured = []
    ENERGY_PERIODS.forEach(({ key, voiceKey }) => {
      const value = d[voiceKey]
      if (typeof value === 'number' && Number.isFinite(value)) {
        updateField(type, key, String(value))
        captured.push(key)
      }
    })
    setVoiceContext((prev) => ({ ...prev, [type]: { trace_id: envelope?.trace_id, ai_output: d } }))

    const bits = []
    const confirmationText = envelope?.meta?.confirmation_text
    const transcript = envelope?.meta?.transcript
    if (confirmationText) bits.push(confirmationText)
    else if (transcript) bits.push(`"${transcript}"`)
    const missing = ENERGY_PERIODS.filter(p => !captured.includes(p.key)).map(p => p.label)
    if (missing.length > 0 && missing.length < ENERGY_PERIODS.length) {
      bits.push(`falta capturar ${missing.join(' y ')} a mano`)
    }
    setVoiceNote((prev) => ({
      ...prev,
      [type]: bits.length ? `IA: ${bits.join(' · ')}` : 'IA proceso la voz — revisa y confirma',
    }))
  }

  function handleVoiceError(type, error_code, text) {
    setMsg({ type: 'error', text: `${error_code}: ${text}` })
    setVoiceNote((prev) => ({ ...prev, [type]: '' }))
  }

  const voiceMetadata = useMemo(() => ({
    plaza_id: session?.plaza_id || null,
    user_id: session?.employee_id || null,
    canal: 'pwa_colaboradores',
    shift_id: shift?.id || null,
  }), [session?.plaza_id, session?.employee_id, shift?.id])

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 16 }}>
          <button onClick={() => navigate(backTo)} aria-label="Volver" style={{
            width: 38, height: 38, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <span style={{ ...typo.title, color: TOKENS.colors.textSoft }}>Energia</span>
            {summary?.meter?.serial && (
              <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>
                Medidor {summary.meter.serial} · x{formatNumber(summary.meter.multiplier, 0)}
              </p>
            )}
          </div>
        </div>

        {msg && (
          <div style={{
            marginBottom: 12, padding: '10px 14px', borderRadius: TOKENS.radius.md,
            background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <span style={{ ...typo.caption, color: msg.type === 'success' ? TOKENS.colors.success : TOKENS.colors.error }}>{msg.text}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.12)', borderTop: '2px solid #2B8FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : !shift ? (
          <div style={{ marginTop: 40, padding: 24, borderRadius: TOKENS.radius.xl, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x26A0;&#xFE0F;</div>
            <p style={{ ...typo.title, color: TOKENS.colors.warning }}>Sin turno activo</p>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 6 }}>Abre un turno para poder registrar lecturas.</p>
            <button onClick={() => navigate('/supervision/turno')} style={{
              marginTop: 14, padding: '10px 20px', borderRadius: TOKENS.radius.sm,
              background: 'linear-gradient(135deg, #15499B 0%, #2B8FE0 100%)',
              color: 'white', fontSize: 13, fontWeight: 600,
            }}>Ir a Control de Turno</button>
          </div>
        ) : (
          <>
            <ConsumptionPanel summary={summary} typo={typo} />

            {!summary?.meter_configured && (
              <Notice
                tone="warning"
                typo={typo}
                text="Sin medidor configurado en la planta: el consumo se reporta sin multiplicador."
              />
            )}

            <ReadingCard
              title="Lectura Inicio"
              type="start"
              reading={startReading}
              legacy={isLegacy}
              form={formStart}
              errors={errors.start}
              disabledReason={null}
              submitting={submitting}
              typo={typo}
              voiceMetadata={voiceMetadata}
              voiceNote={voiceNote.start}
              onChange={updateField}
              onSubmit={handleSubmit}
              onVoiceResult={handleVoiceResult}
              onVoiceError={handleVoiceError}
            />

            <ReadingCard
              title="Lectura Fin"
              type="end"
              reading={endReading}
              legacy={isLegacy}
              form={formEnd}
              errors={errors.end}
              disabledReason={!startReading ? 'Registra la lectura de inicio primero' : null}
              submitting={submitting}
              typo={typo}
              voiceMetadata={voiceMetadata}
              voiceNote={voiceNote.end}
              onChange={updateField}
              onSubmit={handleSubmit}
              onVoiceResult={handleVoiceResult}
              onVoiceError={handleVoiceError}
            />
          </>
        )}
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

// ─── Panel de consumo (100% backend) ─────────────────────────────────────────

function ConsumptionPanel({ summary, typo }) {
  if (!summary) return null
  const hasTotal = summary.total_kwh !== null && summary.total_kwh !== undefined

  if (!hasTotal) {
    return (
      <Notice
        tone="info"
        typo={typo}
        text={summary.message || 'Faltan lecturas del turno.'}
      />
    )
  }

  return (
    <div style={{
      marginBottom: 16, padding: 20, borderRadius: TOKENS.radius.xl,
      background: TOKENS.glass.hero, border: `1px solid ${TOKENS.colors.borderBlue}`,
      boxShadow: `${TOKENS.shadow.md}, ${TOKENS.shadow.inset}`,
    }}>
      <p style={{ ...typo.overline, color: TOKENS.colors.textLow, marginBottom: 6, textAlign: 'center' }}>
        CONSUMO DEL TURNO
      </p>
      <p style={{ fontSize: 34, fontWeight: 700, color: TOKENS.colors.blue2, margin: 0, letterSpacing: '-0.02em', textAlign: 'center' }}>
        {formatNumber(summary.total_kwh, 0)}
      </p>
      <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 4, textAlign: 'center' }}>kWh</p>

      {summary.mode === 'single' ? (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>
          Total (sin desglose por periodo) — turno capturado con lectura unica
        </p>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(summary.periods || []).map((p) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: TOKENS.radius.sm,
              background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
            }}>
              <span style={{ ...typo.caption, color: TOKENS.colors.textSoft, fontWeight: 700, flex: 1 }}>{p.label}</span>
              <span style={{ ...typo.caption, color: TOKENS.colors.blue2, fontWeight: 700 }}>
                {formatNumber(p.kwh, 0)} kWh
              </span>
              <span style={{ ...typo.caption, color: p.cost === null ? TOKENS.colors.textMuted : TOKENS.colors.success, fontWeight: 700, minWidth: 78, textAlign: 'right' }}>
                {p.cost === null || p.cost === undefined ? 'sin tarifa' : formatMoney(p.cost)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: `1px solid ${TOKENS.colors.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>Valorizado</span>
        <span style={{
          ...typo.caption, fontWeight: 700,
          color: summary.total_cost === null || summary.total_cost === undefined
            ? TOKENS.colors.textMuted : TOKENS.colors.success,
        }}>
          {summary.total_cost === null || summary.total_cost === undefined
            ? 'Sin tarifa configurada'
            : formatMoney(summary.total_cost)}
        </span>
      </div>
    </div>
  )
}

// ─── Card de lectura ─────────────────────────────────────────────────────────

function ReadingCard({
  title, type, reading, legacy, form, errors, disabledReason, submitting, typo,
  voiceMetadata, voiceNote, onChange, onSubmit, onVoiceResult, onVoiceError,
}) {
  const registered = !!reading
  return (
    <div style={{
      padding: 16, borderRadius: TOKENS.radius.xl, marginBottom: 12,
      background: registered ? 'rgba(34,197,94,0.04)' : TOKENS.glass.panel,
      border: `1px solid ${registered ? 'rgba(34,197,94,0.15)' : TOKENS.colors.border}`,
      boxShadow: TOKENS.shadow.soft,
      opacity: !registered && disabledReason ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0 }}>{title}</p>
        {registered && (
          <div style={{ padding: '4px 10px', borderRadius: TOKENS.radius.pill, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.colors.success }}>REGISTRADA</span>
          </div>
        )}
      </div>

      {registered ? (
        <div>
          {legacy || reading.capture_mode !== 'periods' ? (
            <>
              <p style={{ fontSize: 26, fontWeight: 700, color: TOKENS.colors.blue2, margin: 0 }}>
                {formatNumber(reading.kwh_value, 1)}
                <span style={{ fontSize: 13, fontWeight: 400, color: TOKENS.colors.textMuted }}> kWh (display)</span>
              </p>
              <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                Total (sin desglose)
              </p>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {ENERGY_PERIODS.map(({ key, label }) => (
                <div key={key} style={{
                  padding: '8px 6px', borderRadius: TOKENS.radius.sm,
                  background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: TOKENS.colors.textMuted, margin: 0, letterSpacing: '0.1em' }}>
                    {label.toUpperCase()}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: TOKENS.colors.text, margin: '2px 0 0' }}>
                    {formatNumber(reading[`kwh_${key}`], 1)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 8 }}>
            {[reading.timestamp, reading.employee_name].filter(Boolean).join(' · ')}
            {reading.has_photo ? ' · con foto' : ''}
          </p>
        </div>
      ) : disabledReason ? (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, textAlign: 'center', padding: '8px 0' }}>
          {disabledReason}
        </p>
      ) : (
        <div>
          {ENERGY_PERIODS.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                kWh {label} <span style={{ color: TOKENS.colors.error }}>*</span>
              </label>
              <input
                type="number" step="0.1" min="0" inputMode="decimal"
                value={form[key]}
                onChange={e => onChange(type, key, e.target.value)}
                placeholder="0.0"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: TOKENS.radius.sm,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${errors?.[key] ? TOKENS.colors.error : TOKENS.colors.border}`,
                  color: 'white', fontSize: 13, fontFamily: 'inherit',
                }}
              />
              {errors?.[key] && (
                <p style={{ ...typo.caption, color: TOKENS.colors.error, margin: '4px 0 0' }}>{errors[key]}</p>
              )}
            </div>
          ))}

          <div style={{ margin: '12px 0' }}>
            <VoiceInputButton
              context_id="form_energy_reading"
              metadata={voiceMetadata}
              onResult={(envelope) => onVoiceResult(type, envelope)}
              onError={(code, text) => onVoiceError(type, code, text)}
              disabled={submitting}
              label="Manten presionado y dicta las 3 lecturas"
            />
            {voiceNote && (
              <p style={{ ...typo.caption, color: TOKENS.colors.blue2, margin: '6px 0 0' }}>{voiceNote}</p>
            )}
          </div>

          <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
            Foto del medidor <span style={{ color: TOKENS.colors.error }}>*</span>
          </label>
          <input
            type="file" accept="image/*" capture="environment"
            onChange={e => onChange(type, 'photo', e.target.files?.[0] || null)}
            style={{ width: '100%', padding: '8px 0', color: TOKENS.colors.textMuted, fontSize: 13, marginBottom: 4 }}
          />
          {errors?.photo && (
            <p style={{ ...typo.caption, color: TOKENS.colors.error, margin: '0 0 8px' }}>{errors.photo}</p>
          )}

          <button
            onClick={() => onSubmit(type)}
            disabled={submitting}
            style={{
              marginTop: 8, width: '100%', padding: '12px', borderRadius: TOKENS.radius.sm,
              fontSize: 13, fontWeight: 600, color: 'white',
              background: 'linear-gradient(135deg, #15499B 0%, #2B8FE0 100%)',
              border: '1px solid transparent',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Registrando...' : `Registrar ${type === 'start' ? 'Inicio' : 'Fin'}`}
          </button>
        </div>
      )}
    </div>
  )
}

function Notice({ tone, text, typo }) {
  const color = tone === 'warning' ? TOKENS.colors.warning : TOKENS.colors.textMuted
  return (
    <div style={{
      marginBottom: 12, padding: '10px 14px', borderRadius: TOKENS.radius.md,
      background: `${color}12`, border: `1px solid ${color}33`,
    }}>
      <span style={{ ...typo.caption, color }}>{text}</span>
    </div>
  )
}

// ─── helpers de presentacion ─────────────────────────────────────────────────

function formatNumber(value, decimals) {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer la foto'))
    reader.readAsDataURL(file)
  })
}
