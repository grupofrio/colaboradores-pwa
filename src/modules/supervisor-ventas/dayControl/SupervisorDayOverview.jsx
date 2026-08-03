const JOURNEY_BUCKETS = Object.freeze([
  { key: 'total', label: 'Rutas asignadas' },
  { key: 'departed', label: 'Salieron' },
  { key: 'late', label: 'Salieron tarde' },
  { key: 'notDeparted', label: 'Sin salir' },
  { key: 'unknown', label: 'Sin dato de salida' },
])

function valueOrMissing(value) {
  return value === null || value === undefined ? 'Sin dato' : value
}

function JourneyOverview({ view }) {
  const available = view.capabilities.routes_available

  return (
    <section
      className="supervisor-ops-card"
      data-testid="supervisor-journey-overview"
      aria-labelledby="supervisor-journey-title"
    >
      <h2 id="supervisor-journey-title">Estado de jornada</h2>
      {!available ? (
        <p className="supervisor-ops-unavailable">Información no disponible</p>
      ) : (
        <div className="supervisor-ops-metric-grid supervisor-ops-metric-grid-five">
          {JOURNEY_BUCKETS.map((bucket) => (
            <div className="supervisor-ops-metric" key={bucket.key}>
              <span className="supervisor-ops-label">{bucket.label}</span>
              <strong>{valueOrMissing(view.journey[bucket.key])}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SalesValue({ sales }) {
  if (!sales.available) {
    return (
      <strong data-testid="commercial-sales-total">
        Información no disponible
      </strong>
    )
  }

  return (
    <>
      <strong data-testid="commercial-sales-total">
        {sales.consolidated ? sales.text : 'Sin dato consolidado'}
      </strong>
      {!sales.consolidated && sales.lines.length > 0 && (
        <ul className="supervisor-ops-plain-list" aria-label="Venta por moneda">
          {sales.lines.map((line) => (
            <li key={line.currency || line.text}>{line.text}</li>
          ))}
        </ul>
      )}
    </>
  )
}

function CommercialOverview({ view }) {
  return (
    <section
      className="supervisor-ops-card"
      data-testid="supervisor-commercial-overview"
      aria-labelledby="supervisor-commercial-title"
    >
      <h2 id="supervisor-commercial-title">Resultado comercial</h2>
      <div className="supervisor-ops-metric-grid">
        <div className="supervisor-ops-metric">
          <span className="supervisor-ops-label">Venta del día</span>
          <SalesValue sales={view.commercial.sales} />
        </div>
        <div className="supervisor-ops-metric">
          <span className="supervisor-ops-label">Visitas completadas</span>
          <strong>
            {view.commercial.visits.available
              ? view.commercial.visits.text
              : 'Sin dato'}
          </strong>
        </div>
      </div>
    </section>
  )
}

function CashValue({ cash }) {
  if (!cash.available) {
    return <strong>Información no disponible</strong>
  }
  if (cash.consolidated) {
    return <strong>{cash.text}</strong>
  }
  if (cash.lines.length === 0) {
    return <strong>Sin dato</strong>
  }
  return (
    <ul className="supervisor-ops-plain-list" aria-label="Caja pendiente por moneda">
      {cash.lines.map((line) => (
        <li key={line.currency || line.text}>{line.text}</li>
      ))}
    </ul>
  )
}

function ClosureOverview({ view }) {
  return (
    <section
      className="supervisor-ops-card"
      data-testid="supervisor-closure-overview"
      aria-labelledby="supervisor-closure-title"
    >
      <h2 id="supervisor-closure-title">Cierre y caja</h2>
      <div className="supervisor-ops-stage-grid" aria-label="Etapas de cierre">
        {view.closure.stages.map((stage) => (
          <div className="supervisor-ops-metric" key={stage.key}>
            <span className="supervisor-ops-label">{stage.label}</span>
            <strong>{valueOrMissing(stage.count)}</strong>
          </div>
        ))}
      </div>
      <div className="supervisor-ops-secondary-row">
        <span>{view.closure.unknown.label}</span>
        <strong>{valueOrMissing(view.closure.unknown.count)}</strong>
      </div>
      <div className="supervisor-ops-secondary-row">
        <span>Caja pendiente</span>
        <CashValue cash={view.closure.cash} />
      </div>
      <p className="supervisor-ops-note">{view.closure.systemReconciliationNote}</p>
    </section>
  )
}

export default function SupervisorDayOverview({ view, section = 'all' }) {
  if (section === 'journey') return <JourneyOverview view={view} />
  if (section === 'commercial') return <CommercialOverview view={view} />
  if (section === 'closure') return <ClosureOverview view={view} />

  return (
    <>
      <JourneyOverview view={view} />
      <CommercialOverview view={view} />
      <ClosureOverview view={view} />
    </>
  )
}
