import { displayValue, moneyValue } from './pulseModel.js'

function TargetMetric({ metric }) {
  if (!metric) return null
  if (metric.available === false) {
    return (
      <div className="pulse-metric">
        <span>{metric.label}</span>
        <strong>No disponible</strong>
        {metric.summary ? <p>{metric.summary}</p> : null}
      </div>
    )
  }
  return (
    <div className="pulse-metric">
      <span>{metric.label}</span>
      <strong>{moneyValue(metric.amount, metric.currency)}</strong>
      {metric.summary ? <p>{metric.summary}</p> : null}
    </div>
  )
}

export default function MonthTargets({ targets }) {
  if (!targets) return null

  if (targets.available === false) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-targets-title">
        <p className="pulse-eyebrow">Objetivos</p>
        <h2 id="pulse-targets-title">{targets.title || 'Venta vs objetivos'}</h2>
        <p>{targets.summary || 'Objetivos no disponibles.'}</p>
      </section>
    )
  }

  const pace = targets.pace
  const paceValue = pace?.available === false || pace?.pct == null
    ? 'Sin dato'
    : displayValue(pace.pct, '%')

  return (
    <section
      className="pulse-section"
      aria-labelledby="pulse-targets-title"
      data-pulse-block="targets"
    >
      <div className="pulse-section-heading">
        <div>
          <p className="pulse-eyebrow">Objetivos</p>
          <h2 id="pulse-targets-title">{targets.title || 'Venta vs objetivos'}</h2>
        </div>
        {pace ? (
          <span className={`pulse-tone pulse-tone--${pace.tone || 'unknown'}`}>
            {pace.tone_label || 'Sin dato'} · {paceValue}
          </span>
        ) : null}
      </div>
      {targets.summary ? <p>{targets.summary}</p> : null}
      <div className="pulse-metric-grid">
        <TargetMetric metric={targets.sales} />
        <TargetMetric metric={targets.frozen_demand} />
        <TargetMetric metric={targets.direct_target} />
      </div>
      {pace?.summary ? <p>{pace.summary}</p> : null}
    </section>
  )
}
