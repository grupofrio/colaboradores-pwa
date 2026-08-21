import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AhoraView from './AhoraView.jsx'
import AyerView from './AyerView.jsx'
import { PULSE_HORIZONS, pulseFocusTarget } from './pulseModel.js'
import { PULSE_STATUS, usePulse } from './usePulse.js'
import './pulso.css'

function PulseState({ status, error, onRetry }) {
  if (status === PULSE_STATUS.LOADING) {
    return (
      <div className="pulse-state" role="status">
        <span className="pulse-spinner" aria-hidden />
        <h2>Cargando Pulso Comercial…</h2>
      </div>
    )
  }

  const copy = {
    [PULSE_STATUS.FEATURE_DISABLED]: {
      title: 'Pulso no está habilitado',
      message: 'La sucursal todavía no tiene disponible esta experiencia.',
    },
    [PULSE_STATUS.AUTH_ERROR]: {
      title: 'Sesión no disponible',
      message: 'Vuelve a iniciar sesión para consultar Pulso Comercial.',
    },
    [PULSE_STATUS.NETWORK_ERROR]: {
      title: 'Sin conexión',
      message: 'No pudimos actualizar Pulso Comercial.',
    },
    [PULSE_STATUS.UNAVAILABLE]: {
      title: 'Pulso no disponible',
      message: error || 'La información comercial no está disponible en este momento.',
    },
  }[status]

  if (!copy) return null
  return (
    <div className="pulse-state" role="status">
      <h2>{copy.title}</h2>
      <p>{copy.message}</p>
      {status === PULSE_STATUS.NETWORK_ERROR || status === PULSE_STATUS.UNAVAILABLE ? (
        <button className="pulse-secondary-button" type="button" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  )
}

export default function PulsoTab() {
  const navigate = useNavigate()
  const [horizon, setHorizon] = useState('ahora')
  const [focusTarget, setFocusTarget] = useState(null)
  const pulse = usePulse(horizon)

  const handleCta = useCallback((cta) => {
    const target = pulseFocusTarget(cta)
    if (target) {
      setHorizon('ayer')
      setFocusTarget({ ...target, requestKey: Date.now() })
      return
    }
    if (cta?.kind === 'navigation' && typeof cta.path === 'string') {
      navigate(cta.path)
    }
  }, [navigate])

  const usable = pulse.status === PULSE_STATUS.READY || pulse.status === PULSE_STATUS.PARTIAL

  return (
    <div className="pulse-page">
      <header className="pulse-hero">
        <p className="pulse-eyebrow">Supervisor de Ventas</p>
        <h1>Pulso Comercial</h1>
        <p>Lo que requiere atención y cómo cerró la operación.</p>
      </header>

      <div className="pulse-horizons" role="tablist" aria-label="Horizonte de Pulso Comercial">
        {PULSE_HORIZONS.map((item) => (
          <button
            className={horizon === item.key ? 'pulse-horizon pulse-horizon--active' : 'pulse-horizon'}
            type="button"
            role="tab"
            aria-selected={horizon === item.key}
            key={item.key}
            onClick={() => setHorizon(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {pulse.status === PULSE_STATUS.PARTIAL ? (
        <p className="pulse-partial" role="status">
          Vista parcial: algunas fuentes todavía no respondieron.
        </p>
      ) : null}

      {usable && horizon === 'ahora' ? <AhoraView data={pulse.data} onCta={handleCta} /> : null}
      {usable && horizon === 'ayer'
        ? <AyerView data={pulse.data} onCta={handleCta} focusTarget={focusTarget} />
        : null}
      {!usable ? <PulseState status={pulse.status} error={pulse.error} onRetry={pulse.reload} /> : null}
    </div>
  )
}
