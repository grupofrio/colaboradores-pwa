// ─── Supervisor V2 · RutasTab (contenedor) ───────────────────────────────────
// Lista de rutas + detalle por ?plan= con drill-down de paradas (route-stops).
// Corrige el bug legacy: el detalle usa el plan_id de la PROPIA ruta, no un
// ?route_id externo. Fuente del día = hook compartido; paradas = loadRouteStops.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import DayStateGate from '../dayStateGate'
import RutasView from '../rutas/RutasView'
import RutaDetalle from '../rutas/RutaDetalle'
import { useOperationalDay } from '../useOperationalDay'
import { loadRouteStops, sourceVersion, PHASE } from '../dataSources'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

async function loadDemoStops(planId) {
  try {
    const mod = await import('virtual:supervisor-v2-demo')
    if (mod?.demoAvailable) {
      const demo = await mod.loadSupervisorV2Demo()
      const stops = demo?.routeStops?.[planId] || demo?.routeStops?.[String(planId)] || []
      return { phase: PHASE.OK, stops }
    }
  } catch { /* stub en prod */ }
  return null
}

export default function RutasTab() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const planId = Number(params.get('plan') || 0)
  const day = useOperationalDay({ demoEnabled: DEMO })
  const [stops, setStops] = useState({ status: 'idle', stops: null, error: null, phase: null })
  const reqIdRef = useRef(0)
  const dayVersion = sourceVersion(day.dayControl, day.scopeKey)

  useEffect(() => {
    // §6: request-id monotónico ⇒ una respuesta vieja NUNCA pisa la nueva; el
    // efecto se re-dispara al cambiar plan o versión de fuente (fecha/branch/
    // generated_at). Cambiar de plan/fecha limpia los datos previos.
    if (!planId) { setStops({ status: 'idle', stops: null, error: null, phase: null }); return undefined }
    const myId = ++reqIdRef.current
    setStops({ status: 'loading', stops: null, error: null, phase: null })
    ;(async () => {
      let res = await loadRouteStops(planId)
      if (res.phase !== PHASE.OK && res.phase !== PHASE.EMPTY && day.source === 'demo') {
        const demo = await loadDemoStops(planId)
        if (demo) res = demo
      }
      if (myId !== reqIdRef.current) return // respuesta obsoleta ⇒ ignorar
      const okPhase = res.phase === PHASE.OK || res.phase === PHASE.EMPTY
      setStops({ status: 'done', stops: okPhase ? res.stops : (res.stops || null), error: okPhase ? null : (res.error || 'Paradas no disponibles.'), phase: res.phase })
    })()
    return () => { reqIdRef.current += 1 } // unmount/cambio ⇒ invalida en curso
  }, [planId, day.source, dayVersion])

  if (day.status !== 'live' && day.status !== 'demo') return <DayStateGate day={day} loadingTitle="Cargando rutas…" />

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
