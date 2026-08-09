import { useCallback, useEffect, useState } from 'react'
import { TOKENS } from '../../../tokens'
import {
  getCompressorStatus,
  registerCompressorOil,
  toggleCompressor,
} from '../plantEnergyAPI'
import { logScreenError } from '../logScreenError'
import { formatRelative, oilAlertTone, stateLabel } from './compressorStatus'

// Mapeo tono -> color. `compressorStatus` es puro (tonos semanticos) para que
// las reglas se puedan probar sin cargar el tema.
const TONE_COLORS = {
  on: TOKENS.colors.success,
  off: TOKENS.colors.textMuted,
  unknown: TOKENS.colors.warning,
  error: TOKENS.colors.error,
  warning: TOKENS.colors.warning,
}

function toneColor(tone) {
  return TONE_COLORS[tone] || TOKENS.colors.textMuted
}

// Seccion "Compresores" — vive en DOS lugares:
//   (a) el hub de Supervision,
//   (b) el turno del operador de barra (ScreenMiTurno) con turno abierto.
//
// Decision de direccion: QUIEN APAGA, REGISTRA. De noche apaga el operador.
//
// Todo lo que se pinta viene del backend (`/api/production/compressor/status`),
// incluido `can_write`: esta pantalla NO decide permisos. El guard real esta
// en Odoo; aqui solo se evita ofrecer un boton que va a rebotar.

const OIL_LEVELS = [
  { key: 'bajo', label: 'Bajo' },
  { key: 'mitad', label: 'Mitad' },
  { key: 'alto', label: 'Alto' },
]

export default function CompresoresSection({ shiftId, typo, screenName = 'CompresoresSection' }) {
  const [rows, setRows] = useState([])
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pendingToggle, setPendingToggle] = useState(null) // machine_id en confirmacion
  const [busyMachineId, setBusyMachineId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [oilModal, setOilModal] = useState(null) // {machine, logType}

  const load = useCallback(async () => {
    if (!shiftId) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      const data = await getCompressorStatus(shiftId)
      setRows(data?.compressors || [])
      setCanWrite(!!data?.can_write)
    } catch (e) {
      logScreenError(screenName, 'getCompressorStatus', e)
      setLoadError(e.message || 'No se pudo leer el estado de los compresores')
    } finally {
      setLoading(false)
    }
  }, [shiftId, screenName])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!msg) return undefined
    const t = setTimeout(() => setMsg(null), msg.type === 'error' ? 6000 : 3000)
    return () => clearTimeout(t)
  }, [msg])

  async function commitToggle(row, action) {
    setBusyMachineId(row.machine_id)
    setPendingToggle(null)
    try {
      const data = await toggleCompressor({ shiftId, machineId: row.machine_id, action })
      if (data?.compressors) setRows(data.compressors)
      setMsg({ type: 'success', text: `${row.name}: ${action === 'on' ? 'encendido' : 'apagado'} registrado` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'No se pudo registrar el evento' })
      await load()
    } finally {
      setBusyMachineId(null)
    }
  }

  async function submitOil({ machine, logType, oilLevel, liters, photo, note }) {
    setBusyMachineId(machine.machine_id)
    try {
      const photoBase64 = await readFileAsDataUrl(photo)
      const data = await registerCompressorOil({
        shiftId,
        machineId: machine.machine_id,
        logType,
        oilLevel,
        liters,
        photoBase64,
        note,
      })
      if (data?.compressors) setRows(data.compressors)
      setOilModal(null)
      setMsg({
        type: 'success',
        text: logType === 'level' ? 'Nivel de aceite registrado' : 'Relleno registrado',
      })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'No se pudo registrar el aceite' })
    } finally {
      setBusyMachineId(null)
    }
  }

  if (!shiftId) return null

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <p style={{ ...typo.overline, color: TOKENS.colors.textLow, margin: 0 }}>COMPRESORES</p>
        <button onClick={load} aria-label="Refrescar compresores" style={{
          marginLeft: 'auto', width: 26, height: 26, borderRadius: TOKENS.radius.sm,
          background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
          </svg>
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 10, padding: '9px 12px', borderRadius: TOKENS.radius.md,
          background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <span style={{ ...typo.caption, color: msg.type === 'success' ? TOKENS.colors.success : TOKENS.colors.error }}>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>Cargando compresores...</p>
      ) : loadError ? (
        <div style={{ padding: 12, borderRadius: TOKENS.radius.md, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span style={{ ...typo.caption, color: TOKENS.colors.error }}>{loadError}</span>
        </div>
      ) : rows.length === 0 ? (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>
          Sin compresores configurados en esta planta.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row) => (
            <CompressorCard
              key={row.machine_id}
              row={row}
              typo={typo}
              canWrite={canWrite}
              busy={busyMachineId === row.machine_id}
              pendingToggle={pendingToggle === row.machine_id}
              onRequestToggle={() => setPendingToggle(row.machine_id)}
              onCancelToggle={() => setPendingToggle(null)}
              onConfirmToggle={(action) => commitToggle(row, action)}
              onOil={(logType) => setOilModal({ machine: row, logType })}
            />
          ))}
        </div>
      )}

      {!loading && !canWrite && rows.length > 0 && (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 8, fontStyle: 'italic' }}>
          Solo lectura: tu turno no permite registrar eventos de compresor.
        </p>
      )}

      {oilModal && (
        <OilModal
          machine={oilModal.machine}
          logType={oilModal.logType}
          typo={typo}
          busy={busyMachineId === oilModal.machine.machine_id}
          onCancel={() => setOilModal(null)}
          onSubmit={submitOil}
        />
      )}
    </div>
  )
}

// ─── Card por compresor ──────────────────────────────────────────────────────

function CompressorCard({
  row, typo, canWrite, busy, pendingToggle, onRequestToggle, onCancelToggle,
  onConfirmToggle, onOil,
}) {
  const state = stateLabel(row.state)
  const stateColor = toneColor(state.tone)
  const nextAction = row.state === 'on' ? 'off' : 'on'
  const nextLabel = nextAction === 'on' ? 'Encender' : 'Apagar'
  const oilAlert = oilAlertTone(row.oil?.alert)
  const oilColor = oilAlert ? toneColor(oilAlert.tone) : null

  return (
    <div style={{
      padding: 14, borderRadius: TOKENS.radius.lg,
      background: TOKENS.glass.panel,
      border: `1px solid ${row.state === 'on' ? 'rgba(34,197,94,0.28)' : TOKENS.colors.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...typo.body, color: TOKENS.colors.text, margin: 0, fontWeight: 700 }}>{row.name}</p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>
            {row.line_name || 'Sin linea'}
          </p>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: TOKENS.radius.pill, fontSize: 11, fontWeight: 700,
          background: `${stateColor}18`, color: stateColor, border: `1px solid ${stateColor}38`,
          whiteSpace: 'nowrap',
        }}>{state.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Mini
          label="DESDE"
          value={row.state_since ? formatRelative(row.state_since) : 'Sin registro'}
        />
        <Mini
          label="HORAS DEL TURNO"
          value={row.hours_this_shift === null || row.hours_this_shift === undefined
            ? 'Sin bitacora'
            : `${Number(row.hours_this_shift).toFixed(1)} h`}
        />
      </div>

      {canWrite && (
        pendingToggle ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onConfirmToggle(nextAction)}
              disabled={busy}
              style={{
                flex: 2, padding: '16px', borderRadius: TOKENS.radius.lg,
                background: nextAction === 'on'
                  ? 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)'
                  : 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
                color: 'white', fontSize: 16, fontWeight: 800, letterSpacing: '0.02em',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Registrando...' : `Confirmar ${nextLabel.toLowerCase()}`}
            </button>
            <button
              onClick={onCancelToggle}
              disabled={busy}
              style={{
                flex: 1, padding: '16px', borderRadius: TOKENS.radius.lg,
                background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                color: TOKENS.colors.textMuted, fontSize: 14, fontWeight: 600,
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={onRequestToggle}
            disabled={busy}
            style={{
              padding: '18px', borderRadius: TOKENS.radius.lg,
              background: nextAction === 'on' ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)',
              border: `1px solid ${nextAction === 'on' ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)'}`,
              color: nextAction === 'on' ? '#4ade80' : '#f87171',
              fontSize: 17, fontWeight: 800, letterSpacing: '0.02em',
            }}
          >
            {nextLabel}
          </button>
        )
      )}

      <div style={{
        padding: '10px 12px', borderRadius: TOKENS.radius.md,
        background: oilColor ? `${oilColor}10` : TOKENS.glass.panelSoft,
        border: `1px solid ${oilColor ? `${oilColor}33` : TOKENS.colors.border}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...typo.caption, color: TOKENS.colors.textMuted, fontWeight: 700 }}>ACEITE</span>
          <span style={{ ...typo.caption, color: TOKENS.colors.textSoft, flex: 1 }}>
            {row.oil?.last_level
              ? `${capitalize(row.oil.last_level)} · ${formatRelative(row.oil.last_level_at)}`
              : 'Sin lectura registrada'}
          </span>
        </div>
        {oilColor && (
          <span style={{ ...typo.caption, color: oilColor, fontWeight: 700 }}>
            &#x26A0; {row.oil.message}
          </span>
        )}
        {row.oil?.last_refill_at && (
          <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>
            Ultimo relleno: {Number(row.oil.last_refill_liters || 0).toFixed(1)} L · {formatRelative(row.oil.last_refill_at)}
          </span>
        )}
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onOil('level')}
              disabled={busy}
              style={secondaryButtonStyle}
            >
              Registrar nivel
            </button>
            <button
              onClick={() => onOil('refill')}
              disabled={busy}
              style={secondaryButtonStyle}
            >
              Registrar relleno
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const secondaryButtonStyle = {
  flex: 1, padding: '10px', borderRadius: TOKENS.radius.pill,
  background: 'rgba(20,184,166,0.14)', border: '1px solid rgba(20,184,166,0.3)',
  color: '#7dd3fc', fontSize: 12, fontWeight: 700,
}

function Mini({ label, value }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: TOKENS.radius.sm,
      background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, color: TOKENS.colors.textMuted, margin: 0, letterSpacing: '0.1em' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: TOKENS.colors.text, margin: '2px 0 0' }}>{value}</p>
    </div>
  )
}

// ─── Modal de aceite ─────────────────────────────────────────────────────────

function OilModal({ machine, logType, typo, busy, onCancel, onSubmit }) {
  const [oilLevel, setOilLevel] = useState('mitad')
  const [liters, setLiters] = useState('')
  const [photo, setPhoto] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const isLevel = logType === 'level'
  const title = isLevel ? 'Nivel de mirilla' : 'Relleno de aceite'

  function handleSubmit() {
    if (!photo) { setError('Foto obligatoria'); return }
    if (!isLevel) {
      const value = Number(liters)
      if (!Number.isFinite(value) || value <= 0) { setError('Captura los litros (mayor a 0)'); return }
    }
    setError('')
    onSubmit({
      machine,
      logType,
      oilLevel: isLevel ? oilLevel : undefined,
      liters: isLevel ? undefined : Number(liters),
      photo,
      note: note || undefined,
    })
  }

  return (
    <div
      onClick={busy ? undefined : onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,10,20,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          background: TOKENS.colors.bg1, border: `1px solid ${TOKENS.colors.border}`,
          padding: 20, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '88dvh', overflowY: 'auto',
        }}
      >
        <div>
          <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0 }}>{title}</p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>{machine.name}</p>
        </div>

        {isLevel ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {OIL_LEVELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setOilLevel(key)}
                style={{
                  flex: 1, padding: '14px 8px', borderRadius: TOKENS.radius.md,
                  background: oilLevel === key ? 'rgba(43,143,224,0.20)' : TOKENS.glass.panelSoft,
                  border: `1px solid ${oilLevel === key ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
                  color: oilLevel === key ? TOKENS.colors.blue2 : TOKENS.colors.textSoft,
                  fontSize: 14, fontWeight: 700,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
              Litros agregados <span style={{ color: TOKENS.colors.error }}>*</span>
            </label>
            <input
              type="number" step="0.1" min="0" inputMode="decimal"
              value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="0.0"
              style={{
                width: '100%', padding: '12px', borderRadius: TOKENS.radius.sm,
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${TOKENS.colors.border}`,
                color: 'white', fontSize: 14, fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        <div>
          <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
            Foto <span style={{ color: TOKENS.colors.error }}>*</span>
          </label>
          <input
            type="file" accept="image/*" capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            style={{ width: '100%', color: TOKENS.colors.textMuted, fontSize: 13 }}
          />
        </div>

        <div>
          <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>Nota</label>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            style={{
              width: '100%', padding: '10px', borderRadius: TOKENS.radius.sm,
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${TOKENS.colors.border}`,
              color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </div>

        {error && (
          <span style={{ ...typo.caption, color: TOKENS.colors.error }}>{error}</span>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel} disabled={busy}
            style={{
              flex: 1, padding: '14px', borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
              color: TOKENS.colors.textMuted, fontSize: 14, fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit} disabled={busy}
            style={{
              flex: 2, padding: '14px', borderRadius: TOKENS.radius.md,
              background: 'linear-gradient(135deg, #15499B 0%, #2B8FE0 100%)',
              color: 'white', fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function capitalize(value) {
  const text = String(value || '')
  return text.charAt(0).toUpperCase() + text.slice(1)
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
