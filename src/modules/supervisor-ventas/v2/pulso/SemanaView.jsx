import { useEffect, useMemo, useRef, useState } from 'react'
import AttentionList from './AttentionList.jsx'
import CustomerMovementBlock from './CustomerMovementBlock.jsx'
import PurchaseDropList from './PurchaseDropList.jsx'
import WeekMatrix from './WeekMatrix.jsx'
import {
  displayValue,
  focusPulseBlock,
  moneyValue,
  presentPulsePayload,
} from './pulseModel.js'

function ExecutionMetric({ metric }) {
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
  const value = metric.unit === 'count'
    ? displayValue(metric.value)
    : displayValue(metric.value, '%')
  return (
    <div className="pulse-metric">
      <span>{metric.label}</span>
      <strong>{value}</strong>
      <span className={`pulse-tone pulse-tone--${metric.tone || 'unknown'}`}>
        {metric.tone_label || 'Sin dato'}
      </span>
    </div>
  )
}

function executionRowLabel(row) {
  if (!row) return 'Ruta'
  if (row.route_name) return row.route_name
  if (row.operational_plan?.name) return row.operational_plan.name
  if (row.plan_id != null) return `Plan ${row.plan_id}`
  if (row.route_id != null) return `Ruta ${row.route_id}`
  return 'Ruta'
}

function executionTimingLabel(timing) {
  if (!timing || timing.available === false) return 'No disponible'
  return timing.label || 'Sin dato'
}

function executionKmLabel(km) {
  if (!km || km.available === false) return 'No disponible'
  if (km.delta_km == null && km.delta_pct == null) return 'Sin dato'
  const parts = []
  if (km.delta_km != null) parts.push(`${displayValue(km.delta_km)} km`)
  if (km.delta_pct != null) parts.push(`${displayValue(km.delta_pct, '%')}`)
  return parts.join(' · ')
}

function executionCapacityLabel(capacity) {
  if (!capacity || capacity.available === false) return 'No disponible'
  if (capacity.pct == null) return capacity.tone_label || 'Sin dato'
  return displayValue(capacity.pct, '%')
}

function ExecutionRowsDetail({ rows = [] }) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return (
    <div className="pulse-route-list pulse-execution-rows" data-pulse-block="execution_rows">
      {rows.map((row) => {
        const key = row.operational_plan_key
          || (row.plan_id != null ? `plan-${row.plan_id}` : null)
          || (row.route_id != null ? `route-${row.route_id}` : executionRowLabel(row))
        return (
          <article
            className="pulse-route-row"
            key={key}
            data-pulse-execution-row={row.plan_id ?? row.route_id ?? undefined}
          >
            <h3>{executionRowLabel(row)}</h3>
            <dl className="pulse-execution-detail">
              <div>
                <dt>Salida</dt>
                <dd>
                  <span className={`pulse-tone pulse-tone--${row.departure?.tone || 'unknown'}`}>
                    {executionTimingLabel(row.departure)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Primera visita</dt>
                <dd>
                  <span className={`pulse-tone pulse-tone--${row.first_visit?.tone || 'unknown'}`}>
                    {executionTimingLabel(row.first_visit)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Km</dt>
                <dd>
                  <span className={`pulse-tone pulse-tone--${row.km?.tone || 'unknown'}`}>
                    {executionKmLabel(row.km)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Capacidad</dt>
                <dd>
                  <span className={`pulse-tone pulse-tone--${row.capacity?.tone || 'unknown'}`}>
                    {executionCapacityLabel(row.capacity)}
                  </span>
                </dd>
              </div>
            </dl>
          </article>
        )
      })}
    </div>
  )
}

function SameTrancheSection({ sameTranche }) {
  if (!sameTranche) return null
  if (sameTranche.available === false) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-same-tranche-title">
        <p className="pulse-eyebrow">Resultado</p>
        <h2 id="pulse-same-tranche-title">{sameTranche.title || 'Resultado same-tranche'}</h2>
        <p>{sameTranche.summary || 'Comparativo no disponible.'}</p>
      </section>
    )
  }

  const money = sameTranche.money || {}
  return (
    <section
      className="pulse-section"
      aria-labelledby="pulse-same-tranche-title"
      data-pulse-block="same_tranche"
    >
      <div className="pulse-section-heading">
        <div>
          <p className="pulse-eyebrow">Resultado</p>
          <h2 id="pulse-same-tranche-title">{sameTranche.title || 'Resultado same-tranche'}</h2>
        </div>
        {sameTranche.delta_pct == null ? null : (
          <span className="pulse-count">{displayValue(sameTranche.delta_pct, '%')}</span>
        )}
      </div>
      {sameTranche.summary ? <p>{sameTranche.summary}</p> : null}
      <div className="pulse-metric-grid">
        <div className="pulse-metric">
          <span>{sameTranche.current_label}</span>
          <strong>
            {money.available === false || !money.consolidated
              ? '—'
              : moneyValue(money.sales_total, money.currency)}
          </strong>
        </div>
        <div className="pulse-metric">
          <span>{sameTranche.previous_label}</span>
          <strong>
            {money.available === false || !money.consolidated
              ? '—'
              : moneyValue(sameTranche.previous?.sales_total ?? sameTranche.previous?.amount, money.currency)}
          </strong>
        </div>
      </div>
    </section>
  )
}

export default function SemanaView({ data = {}, onCta, focusTarget }) {
  const [movementDrill, setMovementDrill] = useState(null)
  const rootRef = useRef(null)
  const presented = useMemo(() => presentPulsePayload(data), [data])
  const attention = presented.attention
  const movement = presented.customer_movement
  const matrix = presented.week_matrix
  const sameTranche = presented.same_tranche
  const execution = presented.execution
  const drops = presented.purchase_drops

  useEffect(() => {
    if (!focusTarget?.block) return undefined
    if (['recovered', 'missing', 'drops', 'opportunities', 'customer_movement'].includes(focusTarget.block)) {
      setMovementDrill(focusTarget.block === 'customer_movement' ? 'drops' : focusTarget.block)
    }
    const run = () => focusPulseBlock(rootRef.current, focusTarget.block)
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(run)
      return () => {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      }
    }
    const timer = setTimeout(run, 0)
    return () => clearTimeout(timer)
  }, [focusTarget])

  const showDrops = movementDrill === 'drops' && drops

  return (
    <div className="pulse-view" ref={rootRef}>
      <section className="pulse-section" aria-labelledby="pulse-semana-attention">
        <div className="pulse-section-heading">
          <div>
            <p className="pulse-eyebrow">Semana en curso</p>
            <h2 id="pulse-semana-attention">Necesita tu atención</h2>
          </div>
          <span className="pulse-count">{presented.attention_total ?? attention.length}</span>
        </div>
        <AttentionList items={attention} max={5} onCta={onCta} />
      </section>

      <CustomerMovementBlock
        movement={movement}
        onCta={onCta}
        onDrill={setMovementDrill}
        activeDrill={movementDrill}
      />

      <WeekMatrix matrix={matrix} />

      <SameTrancheSection sameTranche={sameTranche} />

      {execution ? (
        <section
          className="pulse-section"
          aria-labelledby="pulse-execution-title"
          data-pulse-block="execution"
        >
          {execution.available === false ? (
            <>
              <p className="pulse-eyebrow">Ejecución</p>
              <h2 id="pulse-execution-title">{execution.title || 'Ejecución'}</h2>
              <p>{execution.summary || 'Ejecución no disponible.'}</p>
            </>
          ) : (
            <>
              <div className="pulse-section-heading">
                <div>
                  <p className="pulse-eyebrow">Ejecución</p>
                  <h2 id="pulse-execution-title">{execution.title || 'Ejecución'}</h2>
                </div>
              </div>
              {execution.summary ? <p>{execution.summary}</p> : null}
              <div className="pulse-metric-grid">
                <ExecutionMetric metric={execution.punctuality} />
                <ExecutionMetric metric={execution.km} />
                <ExecutionMetric metric={execution.capacity} />
                <ExecutionMetric
                  metric={execution.quality ? { ...execution.quality, dataPulseBlock: 'quality' } : null}
                />
              </div>
              <ExecutionRowsDetail rows={execution.rows} />
            </>
          )}
        </section>
      ) : null}

      {showDrops ? <PurchaseDropList drops={drops} /> : null}
    </div>
  )
}
