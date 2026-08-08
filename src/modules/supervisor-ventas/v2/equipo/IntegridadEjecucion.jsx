// ─── Supervisor V2 · Integridad de ejecución (contenedor) ────────────────────
// Responde "¿cuánto del trabajo reportado se puede VERIFICAR?" — no "¿quién lo
// hizo mal?". Aquí solo viven la carga y los estados; lo que se pinta está en la
// vista PURA `IntegridadView`, que sí se renderiza en los tests.
//
// El veredicto (tone/tone_word) y el ORDEN los emite el servidor; no se
// recalculan en el cliente: dos verdades sobre el mismo dato es peor que una.
import { useCallback, useEffect, useState } from 'react'

import { BRAND_TOKENS as T } from '../../../../theme/brandTokens'
import StateScreen from '../../../../components/kold/StateScreen'
import { logScreenError } from '../../../shared/logScreenError'
import { getExecutionIntegrity } from '../../api'
import IntegridadView from './IntegridadView'
import { unwrapIntegrity, unavailableReason, integrityRows, periodCaption } from './integridadModel'

const C = T.colors
const R = T.radius

const PERIODS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
]

const UNAVAILABLE_TEXT = {
  sin_fuente_de_paradas: 'Las visitas de esta sucursal aún no registran distancia de check-in ni duración, así que no hay nada que verificar todavía.',
}

export default function IntegridadEjecucion() {
  const [period, setPeriod] = useState('semana')
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(() => {
    let cancelled = false
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading' }))
    getExecutionIntegrity(period)
      .then((res) => {
        if (cancelled) return
        const d = unwrapIntegrity(res)
        if (!d) { setState({ status: 'error', data: null, error: String((res && res.code) || 'RESPUESTA_SIN_INTEGRIDAD') }); return }
        setState({ status: 'ready', data: d, error: null })
      })
      .catch((e) => {
        if (cancelled) return
        logScreenError('IntegridadEjecucion', 'getExecutionIntegrity', e)
        setState({ status: 'error', data: null, error: String((e && (e.code || e.message)) || e) })
      })
    return () => { cancelled = true }
  }, [period])

  useEffect(() => load(), [load])

  const shell = (children) => (
    <div data-testid="integridad-ejecucion" data-theme="brand-light" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>Integridad de ejecución</h1>
        <p style={{ fontSize: 12.5, color: C.textMuted, margin: '2px 0 0', lineHeight: 1.4 }}>
          Cuánto del trabajo reportado se puede verificar. Los dos porcentajes se leen juntos.
        </p>
      </div>
      <div role="group" aria-label="Periodo" style={{ display: 'flex', gap: 6 }}>
        {PERIODS.map((p) => {
          const on = p.key === period
          return (
            <button key={p.key} type="button" data-testid="ie-period" data-active={on ? '1' : undefined}
              aria-pressed={on} onClick={() => setPeriod(p.key)}
              style={{
                minHeight: 32, padding: '0 13px', borderRadius: R.pill, cursor: 'pointer',
                fontSize: 12, fontWeight: 800,
                border: `1px solid ${on ? C.blue : C.border}`,
                background: on ? C.blue : C.surface, color: on ? '#fff' : C.textSoft,
              }}>{p.label}</button>
          )
        })}
      </div>
      {children}
    </div>
  )

  if (state.status === 'loading') {
    return shell(<div style={{ fontSize: 13, color: C.textMuted }}>Cargando la integridad…</div>)
  }
  if (state.status === 'error') {
    return shell(
      <StateScreen tokens={T} tone="error" testid="ie-error"
        title="No se pudo cargar la integridad" detail={`El servidor respondió ${state.error}.`}
        actionLabel="Reintentar" onAction={load} />,
    )
  }

  const { data } = state
  // El backend puede declarar que NO puede responder. Se dice el motivo: una
  // lista vacía se leería como "todo en orden", que es lo contrario del hecho.
  const reason = unavailableReason(data)
  if (reason) {
    return shell(
      <StateScreen tokens={T} testid="ie-no-disponible"
        title="Todavía no se puede verificar"
        detail={UNAVAILABLE_TEXT[reason] || `El servidor no puede calcularlo (${reason}).`} />,
    )
  }

  if (integrityRows(data).length === 0) {
    const periodo = periodCaption(data)
    return shell(
      <StateScreen tokens={T} testid="ie-vacio"
        title="Sin visitas terminadas en el periodo"
        detail={`${periodo ? periodo + '. ' : ''}Cuando haya visitas terminadas aparecerá aquí quién deja rastro verificable y quién no.`} />,
    )
  }

  return shell(<IntegridadView payload={data} />)
}
