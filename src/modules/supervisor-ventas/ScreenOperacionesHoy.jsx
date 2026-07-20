// ─── Supervisor · Home de operaciones del día ("Hoy") ────────────────────────
// Contenedor: orquesta la carga (runController), gestiona estados y delega el
// render a la vista PURA OperationsHomeView. Consume el contrato #220
// (day_control/1 + radar/1). Fuente de datos:
//   · PRODUCCIÓN / Vercel Preview → SOLO live del backend; si el endpoint no está
//     desplegado, estado de error honesto (jamás datos inventados).
//   · dev/test local → si live falla, degrada a fixtures SINTÉTICOS rotulados
//     (demo), gated por `demoAvailable` (stub en prod) + import.meta.env.DEV.
import { useEffect, useMemo, useRef, useState } from 'react'
import ScreenShell from '../entregas/components/ScreenShell'
import StateScreen from '../../components/kold/StateScreen'
import OperationsHomeView from './dayControl/OperationsHomeView'
import { runOperationsHome, RUN_STATUS } from './dayControl/runController'
import { getDayControl, getRadar } from './api'
// Módulo virtual: en prod resuelve al stub (demoAvailable=false, sin fixtures).
import { demoAvailable, loadDayControlDemo } from 'virtual:supervisor-daycontrol-demo'

export default function ScreenOperacionesHoy() {
  const [state, setState] = useState({ status: RUN_STATUS.LOADING })
  const [attempt, setAttempt] = useState(0)
  const nowMsRef = useRef(Date.now())

  const demoEnabled = useMemo(
    () => demoAvailable && import.meta.env?.DEV === true,
    [],
  )

  useEffect(() => {
    let cancelled = false
    setState({ status: RUN_STATUS.LOADING })
    nowMsRef.current = Date.now()
    runOperationsHome({
      fetchDayControl: () => getDayControl(),
      fetchRadar: () => getRadar(),
      loadDemo: loadDayControlDemo,
      demoEnabled,
    }).then((result) => {
      if (!cancelled) setState(result)
    }).catch((err) => {
      if (!cancelled) setState({ status: RUN_STATUS.ERROR, error: err?.message || 'Error inesperado.' })
    })
    return () => { cancelled = true }
  }, [demoEnabled, attempt])

  let body
  if (state.status === RUN_STATUS.LOADING) {
    body = <StateScreen title="Cargando el día operativo…" detail="Consultando venta, rutas y pendientes." tone="neutral" />
  } else if (state.status === RUN_STATUS.ERROR) {
    body = (
      <StateScreen
        title="No se pudo cargar el día operativo"
        detail={state.error || 'El servicio no respondió. Puedes reintentar en unos momentos.'}
        tone="error"
        actionLabel="Reintentar"
        onAction={() => setAttempt((n) => n + 1)}
      />
    )
  } else {
    body = (
      <OperationsHomeView
        dayControl={state.dayControl}
        radar={state.radar}
        radarError={state.radarError}
        source={state.source}
        provenance={state.provenance}
        nowMs={nowMsRef.current}
      />
    )
  }

  return <ScreenShell title="Hoy" backTo="/">{body}</ScreenShell>
}
