// ─── Gerente V2 · pestaña Controles (contenedor) ─────────────────────────────
// Panel de detección read-only: tarjetas por regla → drill a la lista de items.
// Filtro Hoy/Semana/Mes. Estados honestos delegados a las vistas puras.
import { useCallback, useEffect, useState } from 'react'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../../theme/brandTokens'
import { getControls, getControlDetail } from '../../api'
import ControlsView from '../controles/ControlsView'
import ControlDetailView from '../controles/ControlDetailView'

export default function ControlesGerenteTab() {
  const [period, setPeriod] = useState('today')
  const [state, setState] = useState({ status: 'loading', rules: [], scope: null, error: '' })
  const [openRule, setOpenRule] = useState(null)
  const [detail, setDetail] = useState({ status: 'idle', items: [] })

  const load = useCallback(async (p) => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const res = await getControls(p)
      if (!res.ok) { setState({ status: 'error', rules: [], scope: null, error: res.error }); return }
      setState({ status: 'live', rules: res.rules, scope: res.scope, error: '' })
    } catch (e) {
      setState({ status: 'error', rules: [], scope: null, error: e?.message || 'No se pudieron cargar los controles.' })
    }
  }, [])

  useEffect(() => { load(period) }, [load, period])

  const openDetail = useCallback(async (ruleKey) => {
    setOpenRule(ruleKey)
    setDetail({ status: 'loading', items: [] })
    try {
      const res = await getControlDetail(ruleKey, period)
      setDetail({ status: res.ok ? 'live' : 'error', items: res.items, error: res.error })
    } catch (e) {
      setDetail({ status: 'error', items: [], error: e?.message || 'No se pudo cargar el detalle.' })
    }
  }, [period])

  // Drill abierto
  if (openRule) {
    if (detail.status === 'loading') return <StateScreen title="Cargando detalle…" tokens={BRAND_TOKENS} />
    return (
      <ControlDetailView
        ruleKey={openRule}
        items={detail.items}
        onBack={() => { setOpenRule(null); setDetail({ status: 'idle', items: [] }) }}
      />
    )
  }

  if (state.status === 'loading') {
    return <StateScreen title="Cargando controles…" tokens={BRAND_TOKENS} />
  }
  if (state.status === 'error') {
    return <StateScreen title="No se pudieron cargar los controles" detail={state.error} tone="error"
      actionLabel="Reintentar" onAction={() => load(period)} tokens={BRAND_TOKENS} />
  }

  return (
    <ControlsView
      rules={state.rules}
      period={period}
      scope={state.scope}
      onChangePeriod={setPeriod}
      onOpenRule={openDetail}
      onRefresh={() => load(period)}
    />
  )
}
