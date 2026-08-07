// ─── Supervisor V2 · PendientesTab (contenedor) ──────────────────────────────
// Dos fuentes, dos autoridades, en un orden deliberado:
//
//   1. BACKLOG M1 (`/pwa-tower/m1-backlog`) — acomodado de lo accionable a lo
//      informativo. Es lo que se puede empujar hoy, así que va ARRIBA.
//   2. PENDIENTES DEL DÍA (day-control, derivePendientes) — las excepciones
//      vivas de la jornada. Se CONSERVAN: son la vista diaria que el rezago
//      histórico no debe ahogar, y quitarlas sería perder una señal en vivo.
//
// La entrada a M1 vive AQUÍ, no en un menú global: `closure_backlog_available`
// no existe en ningún repo (verificado), así que el flag encendido no abría
// ninguna puerta por sí solo — M1 solo era alcanzable por /torre/backlog, que
// no tiene menú. Esta pestaña es esa puerta, y solo para supervisor_ventas.
//
// SOLO LECTURA: `supervisor_writes_enabled` = false; ningún control escribe.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DayStateGate from '../dayStateGate'
import PendientesView from '../pendientes/PendientesView'
import M1BacklogSection from '../pendientes/M1BacklogSection'
import { useM1Backlog } from '../pendientes/useM1Backlog'
import { useOperationalDay } from '../useOperationalDay'
import { derivePendientes } from '../presentation.js'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../../theme/brandTokens'
import { Loader } from '../../../../components/Loader'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

// Cada estado del contrato M1 se nombra por lo que significa para quien lo lee.
// Ninguno pinta una tabla en ceros ni un JSON crudo.
const M1_STATE_COPY = {
  feature_disabled: {
    title: 'El backlog de cierres no está disponible',
    detail: 'La función está apagada del lado del servidor. No es un problema de tu sesión.',
    tone: 'warning',
  },
  no_branch_scope: {
    title: 'Tu usuario no tiene una sucursal asignada',
    detail: 'Sin sucursal no se puede acotar el backlog. Repórtalo para que te la asignen.',
    tone: 'warning',
  },
  forbidden: {
    title: 'Este backlog no es para tu puesto',
    detail: 'Tu sesión es válida, pero esta información está reservada a otros puestos.',
    tone: 'warning',
  },
  session_expired: {
    title: 'Tu sesión venció',
    detail: 'Vuelve a entrar con tu PIN y tu código.',
    tone: 'warning',
  },
  error: {
    title: 'No pudimos cargar el backlog de cierres',
    detail: 'Puede ser la conexión o que el servicio esté fuera un momento. Los pendientes del día siguen abajo.',
    tone: 'error',
  },
}

function M1Block({ m1, onOpenRoute }) {
  if (m1.status === 'loading') return <Loader label="Cargando backlog de cierres…" tokens={BRAND_TOKENS} />
  if (m1.status === 'ok') return <M1BacklogSection accommodation={m1.accommodation} onOpenRoute={onOpenRoute} />
  if (m1.status === 'empty') {
    return (
      <StateScreen
        tokens={BRAND_TOKENS}
        testid="m1-empty"
        title="Sin rutas abiertas en tu sucursal"
        detail="No hay backlog de cierres pendiente en este momento."
        tone="neutral"
      />
    )
  }
  const copy = M1_STATE_COPY[m1.status]
  if (!copy) return null
  return (
    <StateScreen
      tokens={BRAND_TOKENS}
      testid={`m1-state-${m1.status}`}
      title={copy.title}
      detail={copy.detail}
      tone={copy.tone}
      actionLabel={m1.error?.retryable ? 'Reintentar' : null}
      onAction={m1.error?.retryable ? m1.reload : null}
    />
  )
}

export default function PendientesTab() {
  const navigate = useNavigate()
  const [filterType, setFilterType] = useState(null) // null = todos
  const day = useOperationalDay({ demoEnabled: DEMO })
  const m1 = useM1Backlog()

  const openRoute = (routeId) => navigate(`/equipo/rutas?plan=${routeId}`)

  // El día operativo gatea SOLO su propio bloque: si day-control no está, el
  // backlog M1 igual se muestra (son fuentes y contratos independientes).
  const dayReady = day.status === 'live' || day.status === 'demo'

  return (
    <>
      <M1Block m1={m1} onOpenRoute={openRoute} />

      {dayReady ? (
        <PendientesView
          items={derivePendientes(day.dayControl)}
          source={day.source}
          nowMs={day.nowMs}
          filterType={filterType}
          onSelectFilter={setFilterType}
          onOpenRoute={openRoute}
        />
      ) : (
        <DayStateGate day={day} loadingTitle="Cargando pendientes del día…" />
      )}
    </>
  )
}
