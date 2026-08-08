// ─── Gerente V2 · pestaña Hoy (contenedor) ───────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../../theme/brandTokens'
import { getGerenteToday } from '../../api'
import HoyGerenteView from '../hoy/HoyGerenteView'

export default function HoyGerenteTab() {
  const [state, setState] = useState({ status: 'loading', data: null, scope: null, error: '' })

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

  if (state.status === 'loading') {
    return <StateScreen title="Cargando el día…" tokens={BRAND_TOKENS} />
  }
  if (state.status === 'error') {
    return <StateScreen title="No se pudo cargar el día" detail={state.error} tone="error"
      actionLabel="Reintentar" onAction={load} tokens={BRAND_TOKENS} />
  }
  return <HoyGerenteView data={state.data} scope={state.scope} onRefresh={load} />
}
