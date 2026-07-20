// ─── Supervisor V2 · ClientesTab (contenedor) ────────────────────────────────
// Une el día operativo (planes del día, fuente compartida useOperationalDay) con
// el drill-down de route-stops por ruta, los CONCATENA y los segmenta con
// segmentCustomers(). Delega el render a la vista PURA ClientesView.
//
// Honestidad de carga:
//   · las paradas se piden por plan con Promise.allSettled ⇒ si algunas rutas
//     fallan, seguimos con las que sí respondieron y DECLARAMOS "datos parciales";
//   · en DEMO (dev/preview) las paradas vienen del módulo virtual sintético;
//   · 0 paradas ⇒ estado honesto (vacío o "no se pudo cargar"), nunca una lista
//     fantasma.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import DayStateGate from '../dayStateGate'
import ClientesView from '../clientes/ClientesView'
import { useOperationalDay } from '../useOperationalDay'
import { loadRouteStops } from '../dataSources'
import { segmentCustomers } from '../presentation.js'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

const planIdsOf = (dayControl) => {
  const routes = Array.isArray(dayControl?.routes) ? dayControl.routes : []
  return routes
    .map((r) => Number(r?.plan_id))
    .filter((id) => Number.isFinite(id) && id > 0)
}

// DEMO: paradas sintéticas del módulo virtual (aliaseado a stub en prod ⇒ fuera
// del bundle). routeStops viene keyed por plan_id; se APLANA a una sola lista.
async function loadDemoStops() {
  try {
    const mod = await import('virtual:supervisor-v2-demo')
    const demo = mod?.demoAvailable && typeof mod.loadSupervisorV2Demo === 'function'
      ? await mod.loadSupervisorV2Demo()
      : null
    const byPlan = demo?.routeStops && typeof demo.routeStops === 'object' ? demo.routeStops : {}
    const flat = Object.values(byPlan).reduce((acc, arr) => (Array.isArray(arr) ? acc.concat(arr) : acc), [])
    return { stops: flat, failures: 0 }
  } catch {
    return { stops: [], failures: 0 }
  }
}

// LIVE: una petición route-stops por plan; carga parcial tolerada. loadRouteStops
// ya captura sus errores (resuelve {ok:false}); contamos como fallo todo lo que
// no sea {ok:true}.
async function loadLiveStops(planIds) {
  if (planIds.length === 0) return { stops: [], failures: 0 }
  const results = await Promise.allSettled(planIds.map((id) => loadRouteStops(id)))
  const stops = []
  let failures = 0
  for (const res of results) {
    if (res.status === 'fulfilled' && res.value?.ok) {
      for (const st of res.value.stops || []) stops.push(st)
    } else {
      failures += 1
    }
  }
  return { stops, failures }
}

export default function ClientesTab() {
  const navigate = useNavigate()
  const day = useOperationalDay({ demoEnabled: DEMO })
  const [activeSegment, setActiveSegment] = useState('pendientes')
  const [stopsState, setStopsState] = useState({ status: 'idle', stops: [], failures: 0 })

  const dayStatus = day.status
  const daySource = day.source
  const dayControl = day.dayControl

  useEffect(() => {
    let cancelled = false
    // Solo cargamos paradas cuando el día está live/demo. En loading/error/
    // date_not_allowed NO se piden paradas (evita falso vacío y respeta la fecha).
    if (dayStatus !== 'live' && dayStatus !== 'demo') { setStopsState({ status: dayStatus === 'loading' ? 'loading' : 'idle', stops: [], failures: 0 }); return undefined }

    setStopsState((s) => ({ ...s, status: 'loading' }))
    ;(async () => {
      const out = daySource === 'demo'
        ? await loadDemoStops()
        : await loadLiveStops(planIdsOf(dayControl))
      if (!cancelled) setStopsState({ status: 'ready', stops: out.stops, failures: out.failures })
    })()
    return () => { cancelled = true }
  }, [dayStatus, daySource, dayControl])

  const segments = useMemo(() => segmentCustomers(stopsState.stops), [stopsState.stops])
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(segments).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    [segments],
  )

  // onOpenCustomer: aún NO hay pantalla de detalle de cliente V2. Dejamos el hook
  // listo con un deep-link por query param (?cid=…) a la propia superficie; la
  // fase de edición/detalle irá por un controller protegido (#220), no aquí.
  const onOpenCustomer = (customerId) => {
    if (customerId == null) return
    navigate(`/equipo/clientes?cid=${encodeURIComponent(customerId)}`)
  }

  if (dayStatus !== 'live' && dayStatus !== 'demo') {
    return <DayStateGate day={day} loadingTitle="Cargando el día operativo…" />
  }
  if (stopsState.status === 'loading' || stopsState.status === 'idle') {
    return <StateScreen title="Cargando clientes de las rutas…" detail="Agregando las paradas de cada ruta del día." tone="neutral" />
  }

  const { stops, failures } = stopsState
  if (stops.length === 0) {
    if (failures > 0) {
      return <StateScreen title="No se pudieron cargar los clientes" detail="Las paradas de las rutas del día no respondieron. Ninguna ruta entregó datos." tone="error" actionLabel="Reintentar" onAction={day.reload} />
    }
    return <StateScreen title="Sin clientes en las rutas de hoy" detail="No hay paradas registradas en las rutas del día operativo." tone="neutral" />
  }

  return (
    <>
      {failures > 0 && (
        <div data-testid="v2-clientes-partial" role="note" style={{
          fontSize: 12, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.10)',
          border: '1px solid rgba(245,158,11,0.30)', borderRadius: 18, padding: '9px 12px', marginBottom: 13,
        }}>
          ⚠ Datos parciales: {failures} ruta{failures === 1 ? '' : 's'} no entregó sus paradas. Los conteos por segmento excluyen esas rutas.
        </div>
      )}
      <ClientesView
        segments={segments}
        activeSegment={activeSegment}
        onSelectSegment={setActiveSegment}
        source={daySource || 'live'}
        onOpenCustomer={onOpenCustomer}
        counts={counts}
      />
    </>
  )
}
