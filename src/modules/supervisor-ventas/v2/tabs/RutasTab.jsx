// ─── Supervisor V2 · RutasTab (contenedor) ───────────────────────────────────
// Lista de rutas + detalle por ?plan= con drill-down de paradas (route-stops).
// Corrige el bug legacy: el detalle usa el plan_id de la PROPIA ruta, no un
// ?route_id externo. Fuente del día = hook compartido; paradas = loadRouteStops.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import RutasView from '../rutas/RutasView'
import RutaDetalle from '../rutas/RutaDetalle'
import { useOperationalDay } from '../useOperationalDay'
import { loadRouteStops } from '../dataSources'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

async function loadDemoStops(planId) {
  try {
    const mod = await import('virtual:supervisor-v2-demo')
    if (mod?.demoAvailable) {
      const demo = await mod.loadSupervisorV2Demo()
      const stops = demo?.routeStops?.[planId] || demo?.routeStops?.[String(planId)] || []
      return { ok: true, stops }
    }
  } catch { /* stub en prod */ }
  return null
}

export default function RutasTab() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const planId = Number(params.get('plan') || 0)
  const day = useOperationalDay({ demoEnabled: DEMO })
  const [stops, setStops] = useState({ status: 'idle', stops: null, error: null })

  useEffect(() => {
    let cancelled = false
    if (!planId) { setStops({ status: 'idle', stops: null, error: null }); return }
    setStops({ status: 'loading', stops: null, error: null })
    ;(async () => {
      let res = await loadRouteStops(planId)
      if ((!res.ok || res.stops.length === 0) && day.source === 'demo') {
        const demo = await loadDemoStops(planId)
        if (demo) res = demo
      }
      if (!cancelled) setStops({ status: 'done', stops: res.ok ? res.stops : null, error: res.ok ? null : res.error })
    })()
    return () => { cancelled = true }
  }, [planId, day.source])

  if (day.status === 'loading') return <StateScreen title="Cargando rutas…" tone="neutral" />
  if (day.status === 'error') return <StateScreen title="No se pudieron cargar las rutas" detail={day.error} tone="error" actionLabel="Reintentar" onAction={day.reload} />

  if (planId) {
    const route = (day.dayControl?.routes || []).find((r) => Number(r.plan_id) === planId) || null
    if (!route) return <StateScreen title="Ruta no encontrada" detail="El plan indicado no está en la jornada actual." tone="warning" actionLabel="Volver a rutas" onAction={() => navigate('/equipo/rutas')} />
    return (
      <RutaDetalle
        route={route}
        capabilities={day.dayControl?.capabilities || {}}
        stops={stops.stops}
        stopsError={stops.error}
        source={day.source}
        onBack={() => navigate('/equipo/rutas')}
      />
    )
  }

  return <RutasView dayControl={day.dayControl} source={day.source} onOpenRoute={(pid) => setParams({ plan: String(pid) })} />
}
