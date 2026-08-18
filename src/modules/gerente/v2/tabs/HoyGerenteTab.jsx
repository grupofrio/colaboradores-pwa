// ─── Gerente V2 · pestaña Hoy (contenedor) ───────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../../theme/brandTokens'
import { getGerenteToday, getControls } from '../../api'
import HoyGerenteView from '../hoy/HoyGerenteView'

export default function HoyGerenteTab() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', data: null, scope: null, error: '' })
  // Contador de controles del día: fetch SECUNDARIO y fail-soft. Si falla, no
  // hay banner — nunca bloquea ni ensucia la pestaña Hoy.
  const [controlsCount, setControlsCount] = useState(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const res = await getGerenteToday()
      if (!res.ok) {
        setState({ status: 'error', data: null, scope: null, error: res.error })
        return
      }
      setState({ status: 'live', data: res.data, scope: res.scope, error: '' })
    } catch (e) {
      setState({ status: 'error', data: null, scope: null, error: e?.message || 'No se pudo cargar el día.' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let alive = true
    getControls('today')
      .then((res) => {
        if (!alive || !res.ok) return
        const n = res.rules.reduce((acc, r) => acc + (r.available !== false ? Number(r.count || 0) : 0), 0)
        setControlsCount(n)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (state.status === 'loading') {
    return <StateScreen title="Cargando el día…" tokens={BRAND_TOKENS} />
  }
  if (state.status === 'error') {
    return <StateScreen title="No se pudo cargar el día" detail={state.error} tone="error"
      actionLabel="Reintentar" onAction={load} tokens={BRAND_TOKENS} />
  }
  return (
    <HoyGerenteView
      data={state.data}
      scope={state.scope}
      onRefresh={load}
      controlsCount={controlsCount}
      onOpenControls={() => navigate('/gerente/controles')}
    />
  )
}
