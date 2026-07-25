import { Link } from 'react-router-dom'

function targetTimeLabel(targetAt) {
  if (typeof targetAt !== 'number' || !Number.isFinite(targetAt)) return 'Sin dato'
  const hours = Math.floor(targetAt)
  const minutes = Math.round((targetAt - hours) * 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function routeProgressText(stops) {
  if (stops.done === null || stops.total === null) return 'Sin dato'
  return `${stops.done}/${stops.total}`
}

function PriorityItem({ priority }) {
  return (
    <li
      className="supervisor-ops-priority"
      data-severity={priority.severity}
    >
      <div>
        <p>{priority.reason}</p>
        {priority.dataAsOf && <small>{priority.dataAsOf}</small>}
      </div>
      <div className="supervisor-ops-priority-actions">
        {priority.countChip.show && (
          <span className="supervisor-ops-count-chip">{priority.countChip.text}</span>
        )}
        {priority.href && <Link to={priority.href}>Abrir</Link>}
      </div>
    </li>
  )
}

function RouteLoads({ loads }) {
  if (!loads.available) {
    return <span>{loads.text}</span>
  }
  return (
    <div>
      <span>{loads.text}</span>
      {loads.items.length > 0 && (
        <ul className="supervisor-ops-plain-list">
          {loads.items.map((item) => (
            <li
              key={item.pickingId
                || `${item.kindLabel}:${item.statusLabel}:${item.createdAt}`}
            >
              {item.kindLabel} · {item.statusLabel}
              {item.createdAt ? ` · ${item.createdAt}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RouteCard({ route }) {
  return (
    <article className="supervisor-ops-route">
      <div className="supervisor-ops-route-heading">
        <div>
          <h3>{route.name}</h3>
          <p>{route.driver.name} · {route.vehicle.name}</p>
        </div>
        {route.href && <Link to={route.href}>Ver detalle</Link>}
      </div>

      <dl className="supervisor-ops-route-details">
        <div>
          <dt>Salida objetivo</dt>
          <dd>{targetTimeLabel(route.departure.targetAt)}</dd>
        </div>
        <div>
          <dt>Salida registrada</dt>
          <dd>{route.departure.realAt || 'Sin dato'}</dd>
        </div>
        <div>
          <dt>Estado de salida</dt>
          <dd>
            {route.departure.label}
            {route.departure.deviation ? ` · ${route.departure.deviation}` : ''}
          </dd>
        </div>
        <div>
          <dt>Visitas completadas</dt>
          <dd>{routeProgressText(route.stops)}</dd>
        </div>
        <div>
          <dt>Venta del día</dt>
          <dd>{route.sales.available ? route.sales.text : 'Información no disponible'}</dd>
        </div>
        <div>
          <dt>Señal</dt>
          <dd>
            {route.signal.label}
            {route.signal.age ? ` · ${route.signal.age}` : ''}
            {route.signal.capturedAt ? ` · ${route.signal.capturedAt}` : ''}
          </dd>
        </div>
        <div>
          <dt>Cargas</dt>
          <dd><RouteLoads loads={route.loads} /></dd>
        </div>
        <div>
          <dt>Cierre</dt>
          <dd>{route.close.label}</dd>
        </div>
      </dl>

      <div className="supervisor-ops-markers">
        <span className="supervisor-ops-label">Marcadores de incidencia</span>
        {route.incidentMarkers.length === 0 ? (
          <span>Sin marcadores</span>
        ) : (
          <ul className="supervisor-ops-plain-list">
            {route.incidentMarkers.map((marker) => (
              <li key={marker.id || `${marker.name}:${marker.stopId || 'route'}`}>
                {marker.name}
                {marker.recordedAt ? ` · ${marker.recordedAt}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export default function SupervisorRouteOperations({
  priorities,
  routes,
  routesAvailable,
}) {
  return (
    <div className="supervisor-ops-route-operations">
      <section
        className="supervisor-ops-card"
        data-testid="supervisor-priorities"
        aria-labelledby="supervisor-priorities-title"
      >
        <h2 id="supervisor-priorities-title">Prioridades</h2>
        {!routesAvailable ? (
          <p className="supervisor-ops-unavailable">Información no disponible</p>
        ) : priorities.length === 0 ? (
          <p className="supervisor-ops-empty-copy">Sin prioridades para este día.</p>
        ) : (
          <ol className="supervisor-ops-priority-list">
            {priorities.map((priority) => (
              <PriorityItem
                key={`${priority.type}:${priority.href || priority.reason}`}
                priority={priority}
              />
            ))}
          </ol>
        )}
      </section>

      <section
        className="supervisor-ops-card"
        data-testid="supervisor-routes"
        aria-labelledby="supervisor-routes-title"
      >
        <h2 id="supervisor-routes-title">Rutas</h2>
        {!routesAvailable ? (
          <p className="supervisor-ops-unavailable">Información no disponible</p>
        ) : routes.length === 0 ? (
          <p className="supervisor-ops-empty-copy">Sin rutas registradas.</p>
        ) : (
          <div className="supervisor-ops-route-list">
            {routes.map((route) => (
              <RouteCard
                key={route.planId || `${route.name}:${route.driver.employeeId || 'unassigned'}`}
                route={route}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
