// ─── Tablero de ESCRITORIO (3 columnas) para supervisión de ventas ───────────
// Materializa el wireframe "Desktop 3 columnas" de la auditoría de perfil, que
// hasta ahora solo existía en papel.
//
//   1. Rutas de hoy   → RutasView (la MISMA de móvil, con selección opcional)
//   2. Radar / mapa   → RadarView (PositionMap + lista de respaldo)
//   3. Por visitar    → clientes pendientes derivados del payload de radar
//
// UN SOLO FETCH: el tablero NO carga nada. Recibe el `day` que ya resolvió
// `useOperationalDay()` (day-control + radar en paralelo) y lo reparte a las tres
// columnas. La columna 3 se DERIVA de `radar.units[].stops.planned` — cero red
// adicional (ver pendingStops.js).
//
// CRUCE ENTRE COLUMNAS: una sola pieza de estado, `selectedPlanId`. Seleccionar
// una unidad en el radar resalta su ruta en la columna 1 y filtra sus clientes
// pendientes en la columna 3. En móvil ese cruce es navegación entre pestañas y
// este componente ni se monta.
//
// REGLAS DEL CONTRATO radar/1 que se respetan:
//   · Banner permanente de retraso; prohibido "en vivo"/"tiempo real".
//   · `signal_status` se LEE del backend (recent/delayed/no_signal). La UI no
//     recalcula umbrales ni los hardcodea.
//   · Unidad sin coordenadas NO va al mapa: va a la lista (lo hace PositionMap).
//   · Horas de servidor = "registrado"; solo el GPS conserva `captured_at`.
import { useCallback, useMemo, useState } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import RutasView from '../rutas/RutasView'
import RadarView from '../radar/RadarView'
import { isPlanId, resolveActivePlanId } from '../radar/radarSelection.js'
import { derivePendingStops } from './pendingStops.js'

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

function PendingStopsColumn({ radar, selectedPlanId, onClearFilter }) {
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
      {selectedPlanId != null && (
        <button
          type="button"
          onClick={onClearFilter}
          data-testid="v2-desktop-porvisitar-limpiar"
          style={{
            cursor: 'pointer', fontSize: 11.5, fontWeight: 700, marginBottom: 10,
            padding: '5px 12px', borderRadius: TOKENS.radius.pill,
            color: C.blue3, background: 'transparent', border: `1px solid ${C.borderBlue}`,
          }}
        >
          Filtrado por la ruta seleccionada · ver todas
        </button>
      )}

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

  const toggle = useCallback((planId) => {
    const id = planId == null ? null : Number(planId)
    setSelectedPlanId((prev) => (prev === id ? null : id))
  }, [])

  const selectPlan = useCallback((planId) => {
    if (!isPlanId(planId) || resolveActivePlanId(radarUnits, planId) !== planId) return
    setSelectedPlanId(planId)
  }, [radarUnits])

  const clear = useCallback(() => setSelectedPlanId(null), [])

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.05fr) minmax(340px, 1.25fr) minmax(280px, 0.9fr)',
          gap: 14,
          alignItems: 'stretch',
          // Alto acotado para que cada columna tenga su propio scroll y el
          // supervisor no pierda de vista las otras dos.
          height: 'calc(100dvh - 190px)',
          minHeight: 520,
        }}
      >
        <Column testid="v2-desktop-col-rutas" title="Rutas de hoy" subtitle="Toca una ruta para cruzarla con el radar y sus pendientes.">
          <RutasView
            dayControl={day?.dayControl}
            source={day?.source || 'live'}
            selectedPlanId={selectedPlanId}
            onSelectRoute={selectPlan}
            onOpenRoute={onOpenRoute}
            title=""
            testid="v2-desktop-rutas"
          />
        </Column>

        <Column testid="v2-desktop-col-radar" title="Radar de unidades">
          <RadarView
            radar={day?.radar}
            dayControl={day?.dayControl}
            radarError={day?.radarError}
            source={day?.source || 'live'}
            nowMs={day?.nowMs}
            selectedId={selectedPlanId}
            onSelectUnit={toggle}
            onOpenRoute={onOpenRoute}
            testid="v2-desktop-radar"
          />
        </Column>

        <Column
          testid="v2-desktop-col-porvisitar"
          title="Clientes por visitar"
          subtitle="Paradas del plan del día que aún no se marcan como visitadas."
        >
          <PendingStopsColumn radar={day?.radar} selectedPlanId={selectedPlanId} onClearFilter={clear} />
        </Column>
      </div>
    </div>
  )
}
