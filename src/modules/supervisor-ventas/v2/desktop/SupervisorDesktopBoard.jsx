// ─── Tablero de ESCRITORIO (rutas + operaciones) para supervisión de ventas ──
// La ruta efectiva une las tres superficies del panel: rutas, mapa y clientes
// pendientes. El mapa se muestra primero y los clientes del mismo plan debajo.
//
// UN SOLO FETCH: el tablero NO carga nada. Recibe el `day` que ya resolvió
// `useOperationalDay()` (day-control + radar en paralelo) y lo reparte a sus dos
// columnas. Los clientes se DERIVAN de `radar.units[].stops.planned` — cero red
// adicional (ver pendingStops.js).
//
// CRUCE ENTRE SUPERFICIES: una sola pieza de estado, `selectedPlanId`, se
// resuelve a `effectivePlanId` contra el radar vigente. Seleccionar una unidad
// resalta su ruta y filtra el mapa, el rastro y los clientes a ese mismo plan.
// En móvil este componente ni se monta.
//
// REGLAS DEL CONTRATO radar/1 que se respetan:
//   · Banner permanente de retraso; prohibido "en vivo"/"tiempo real".
//   · `signal_status` se LEE del backend (recent/delayed/no_signal). La UI no
//     recalcula umbrales ni los hardcodea.
//   · Unidad sin coordenadas NO va al mapa: va a la lista (lo hace PositionMap).
//   · Horas de servidor = "registrado"; solo el GPS conserva `captured_at`.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import RutasView from '../rutas/RutasView'
import RadarView from '../radar/RadarView'
import { isPlanId, resolveActivePlanId } from '../radar/radarSelection.js'
import { useRadarTrail } from '../radar/useRadarTrail.js'
import { derivePendingStops } from './pendingStops.js'
import './supervisorDesktopBoard.css'

const C = TOKENS.colors
const S = TOKENS.state

function Column({ title, subtitle, children, testid }) {
  return (
    <section
      data-testid={testid}
      style={{
        minWidth: 0, display: 'flex', flexDirection: 'column',
        background: C.surfaceSoft, border: `1px solid ${C.border}`,
        borderRadius: TOKENS.radius.lg, padding: '14px 14px 18px',
      }}
    >
      {(title || subtitle) && (
        <header style={{ marginBottom: 10 }}>
          {title && <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted, margin: 0 }}>{title}</h2>}
          {subtitle && <div style={{ fontSize: 12, color: C.textLow, marginTop: 3 }}>{subtitle}</div>}
        </header>
      )}
      <div style={{ minHeight: 0, overflowY: 'auto', flex: 1 }}>{children}</div>
    </section>
  )
}

function PendingStopsColumn({ radar, selectedPlanId }) {
  const { rows, unknownRoutes } = useMemo(
    () => derivePendingStops(radar, selectedPlanId),
    [radar, selectedPlanId],
  )

  if (!radar) {
    return (
      <div data-testid="v2-desktop-porvisitar-sin-radar" style={{ fontSize: 13, color: C.textMuted }}>
        Sin datos de paradas: la respuesta del radar no llegó. No es lo mismo que
        &quot;no hay clientes por visitar&quot;.
      </div>
    )
  }

  return (
    <div>
      {rows.length === 0 ? (
        <div data-testid="v2-desktop-porvisitar-vacio" style={{ fontSize: 13, color: C.textMuted }}>
          {selectedPlanId != null
            ? 'Esta ruta no tiene clientes pendientes en su plan.'
            : 'Ninguna ruta reporta clientes pendientes en su plan del día.'}
        </div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <li
              key={`${row.planId}:${row.stopId ?? row.sequence}:${row.name}`}
              data-testid="v2-desktop-porvisitar-row"
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: TOKENS.radius.md, padding: '10px 12px', marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{row.name}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                {row.routeName}{row.sequence != null ? ` · secuencia ${row.sequence}` : ''}
              </div>
              {!row.mappable && (
                <div style={{ fontSize: 11, color: C.textLow, marginTop: 4 }}>
                  Sin coordenadas registradas — no se puede ubicar en el mapa.
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {unknownRoutes.length > 0 && (
        <div
          data-testid="v2-desktop-porvisitar-desconocido"
          style={{
            marginTop: 12, fontSize: 11.5, padding: '9px 11px',
            color: S.no_evaluable.fg, background: S.no_evaluable.bg,
            border: `1px solid ${S.no_evaluable.border}`, borderRadius: TOKENS.radius.md,
          }}
        >
          ▢ Sin plan de paradas declarado: {unknownRoutes.join(' · ')}. No es
          &quot;cero pendientes&quot;: es que esas rutas no reportaron su plan.
        </div>
      )}
    </div>
  )
}

export default function SupervisorDesktopBoard({
  day, onOpenRoute, testid = 'supervisor-v2-desktop-board',
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const radarUnits = day?.radar?.units
  const effectivePlanId = resolveActivePlanId(day?.radar?.units, selectedPlanId)
  const { trail, trailStatus } = useRadarTrail(effectivePlanId, day?.dayControl?.date)

  const selectPlan = useCallback((planId) => {
    if (!isPlanId(planId) || resolveActivePlanId(radarUnits, planId) !== planId) return
    setSelectedPlanId(planId)
  }, [radarUnits])

  useEffect(() => {
    if (selectedPlanId !== effectivePlanId) setSelectedPlanId(effectivePlanId)
  }, [effectivePlanId, selectedPlanId])

  return (
    <div data-testid={testid} style={{ padding: '16px 20px 28px', maxWidth: 1680, margin: '0 auto' }}>
      {/* Banner permanente del contrato radar/1. No se oculta ni se condiciona:
          vale para todo el tablero, no solo para la columna del mapa. */}
      <div
        data-testid="v2-desktop-delay-banner"
        role="note"
        style={{
          fontSize: 12, fontWeight: 600, color: S.signal.fg, background: S.signal.bg,
          border: `1px solid ${S.signal.border}`, borderRadius: TOKENS.radius.md,
          padding: '9px 13px', marginBottom: 14,
        }}
      >
        ◈ Las posiciones pueden tener retraso. Consulta la hora de la última señal.
      </div>

      <div className="supervisor-desktop-board-grid">
        <Column testid="v2-desktop-col-rutas" title="Rutas de hoy" subtitle="Selecciona una ruta para ver su mapa y sus clientes pendientes.">
          <RutasView
            dayControl={day?.dayControl}
            source={day?.source || 'live'}
            selectedPlanId={effectivePlanId}
            onSelectRoute={selectPlan}
            onOpenRoute={onOpenRoute}
            title=""
            testid="v2-desktop-rutas"
          />
        </Column>

        <Column testid="v2-desktop-col-operaciones">
          <RadarView
            radar={day?.radar}
            dayControl={day?.dayControl}
            radarError={day?.radarError}
            source={day?.source || 'live'}
            nowMs={day?.nowMs}
            trail={trail}
            trailStatus={trailStatus}
            selectedId={effectivePlanId}
            onSelectUnit={selectPlan}
            showUnitList={false}
            testid="v2-desktop-radar"
          />
          <section aria-labelledby="v2-desktop-clientes-sin-visitar-title">
            <h2 id="v2-desktop-clientes-sin-visitar-title" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted, margin: '8px 0 10px' }}>
              Clientes sin visitar
            </h2>
            <div style={{ fontSize: 12, color: C.textLow, marginBottom: 10 }}>
              Paradas del plan diario seleccionado que aún no se marcan como visitadas.
            </div>
            <PendingStopsColumn radar={day?.radar} selectedPlanId={effectivePlanId} />
          </section>
        </Column>
      </div>
    </div>
  )
}
