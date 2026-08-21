import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AttentionList from './AttentionList.jsx'
import {
  conversionState,
  diagnosis as buildDiagnosis,
  focusPulseRoute,
  metricValue,
  presentPulsePayload,
  pulseRouteRowId,
} from './pulseModel.js'

function displayValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (Number.isFinite(number)) {
    return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(number)}${suffix}`
  }
  return String(value)
}

function moneyValue(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return '—'
  if (!currency) return '—'
  const number = Number(amount)
  if (!Number.isFinite(number)) return '—'
  const formatted = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(number)
  return `${formatted} ${currency}`
}

function funnelEntries(funnel) {
  return [
    { key: 'agendados', label: 'Agendados', value: funnel.agendados ?? funnel.scheduled },
    { key: 'visitados', label: 'Visitados', value: funnel.visitados ?? funnel.visited },
    { key: 'compraron', label: 'Compraron', value: funnel.compraron ?? funnel.bought },
  ]
}

function MoneyResultSection({ money, creditLabel }) {
  const status = money?.currency_status || 'not_applicable'
  const breakdown = Array.isArray(money?.breakdown) ? money.breakdown : []

  if (!money || money.available === false) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-result">
        <p className="pulse-eyebrow">Resultado</p>
        <h2 id="pulse-result">Venta del día</h2>
        <p>Venta no disponible.</p>
      </section>
    )
  }

  if (status === 'known_multiple') {
    return (
      <section className="pulse-section" aria-labelledby="pulse-result">
        <p className="pulse-eyebrow">Resultado</p>
        <h2 id="pulse-result">
          Venta en {Math.max(breakdown.length, 2)} monedas
        </h2>
        <div className="pulse-metric-grid">
          {breakdown.map((row) => (
            <div className="pulse-metric" key={row.currency || 'row'}>
              <span>{row.currency || 'Moneda'}</span>
              <strong>{moneyValue(row.sales_total, row.currency)}</strong>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (status === 'unknown') {
    return (
      <section className="pulse-section" aria-labelledby="pulse-result">
        <p className="pulse-eyebrow">Resultado</p>
        <h2 id="pulse-result">Venta · moneda por confirmar</h2>
        {breakdown.length ? (
          <div className="pulse-metric-grid">
            {breakdown.map((row) => (
              <div className="pulse-metric" key={row.currency || 'row'}>
                <span>{row.currency || 'Moneda'}</span>
                <strong>{moneyValue(row.sales_total, row.currency)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>Hay montos, pero la moneda aún no está confirmada.</p>
        )}
      </section>
    )
  }

  if (status === 'not_applicable' || !money.consolidated) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-result">
        <p className="pulse-eyebrow">Resultado</p>
        <h2 id="pulse-result">Venta del día</h2>
        <p>—</p>
      </section>
    )
  }

  return (
    <section className="pulse-section" aria-labelledby="pulse-result">
      <p className="pulse-eyebrow">Resultado</p>
      <h2 id="pulse-result">Venta del día</h2>
      <div className="pulse-metric-grid">
        <div className="pulse-metric">
          <span>Venta</span>
          <strong>{moneyValue(money.sales_total, money.currency)}</strong>
        </div>
        <div className="pulse-metric">
          <span>Pedidos</span>
          <strong>{displayValue(money.orders)}</strong>
        </div>
        <div className="pulse-metric">
          <span>Ticket</span>
          <strong>{moneyValue(money.avg_ticket, money.currency)}</strong>
        </div>
        <div className="pulse-metric">
          <span>Contado</span>
          <strong>{moneyValue(money.cash, money.currency)}</strong>
        </div>
        <div className="pulse-metric">
          <span>{creditLabel || 'Crédito otorgado'}</span>
          <strong>{moneyValue(money.credit, money.currency)}</strong>
        </div>
      </div>
    </section>
  )
}

export default function AyerView({ data = {}, onCta, focusTarget }) {
  const [routesOpen, setRoutesOpen] = useState(false)
  const rootRef = useRef(null)
  const presented = useMemo(() => presentPulsePayload(data), [data])
  const routes = presented.yesterday_route_breakdown || []
  const attention = presented.attention
  const funnel = presented.funnel || {}
  const coverage = metricValue(funnel, 'coverage_pct', 'coverage')
  const conversion = metricValue(funnel, 'conversion_pct', 'conversion')
  const conversionInfo = funnel.conversion_state || conversionState(conversion)
  const diagnosis = presented.diagnosis?.kind
    ? presented.diagnosis
    : buildDiagnosis(coverage, conversion)
  const result = presented.resultado || {}
  const money = result.money || {}
  const quality = presented.quality
  const recovery = presented.recovery

  useEffect(() => {
    if (focusTarget?.block !== 'routes') return undefined
    setRoutesOpen(true)
    const run = () => focusPulseRoute(rootRef.current, focusTarget.entityId)
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(run)
      return () => {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      }
    }
    const timer = setTimeout(run, 0)
    return () => clearTimeout(timer)
  }, [focusTarget])

  return (
    <div className="pulse-view" ref={rootRef}>
      <section className="pulse-section" aria-labelledby="pulse-ayer-attention">
        <div className="pulse-section-heading">
          <div>
            <p className="pulse-eyebrow">Cierre de ayer</p>
            <h2 id="pulse-ayer-attention">Necesita tu atención</h2>
          </div>
          <span className="pulse-count">{presented.attention_total ?? attention.length}</span>
        </div>
        <AttentionList items={attention} max={5} onCta={onCta} />
      </section>

      {diagnosis?.summary ? (
        <section className="pulse-section pulse-diagnosis" aria-labelledby="pulse-diagnosis">
          <p className="pulse-eyebrow">Diagnóstico</p>
          <h2 id="pulse-diagnosis">{diagnosis.summary}</h2>
        </section>
      ) : null}

      <section className="pulse-section" aria-labelledby="pulse-funnel">
        <div className="pulse-section-heading">
          <div>
            <p className="pulse-eyebrow">Embudo</p>
            <h2 id="pulse-funnel">Agendados → Visitados → Compraron</h2>
          </div>
          <span className={`pulse-tone pulse-tone--${conversionInfo.tone || 'unknown'}`}>
            {conversionInfo.label || 'Sin dato'}
          </span>
        </div>
        <div className="pulse-metric-grid">
          {funnelEntries(funnel).map((metric) => (
            <div className="pulse-metric" key={metric.key}>
              <span>{metric.label}</span>
              <strong>{displayValue(metric.value)}</strong>
            </div>
          ))}
          <div className="pulse-metric">
            <span>Cobertura</span>
            <strong>{coverage == null ? '—' : displayValue(coverage, '%')}</strong>
          </div>
          <div className="pulse-metric">
            <span>Conversión</span>
            <strong>{conversion == null ? '—' : displayValue(conversion, '%')}</strong>
          </div>
        </div>
      </section>

      <MoneyResultSection money={money} creditLabel={result.credit_label} />

      {quality && quality.available !== false ? (
        <section className="pulse-section" aria-labelledby="pulse-quality">
          <p className="pulse-eyebrow">Métrica de calidad</p>
          <div className="pulse-result-row">
            <div>
              <h2 id="pulse-quality">
                Visitas a revisar: {displayValue(metricValue(quality, 'a_revisar', 'value', 'count'))}
              </h2>
              {quality.pct != null ? <p>{displayValue(quality.pct, '%')} del total evaluable</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {recovery && recovery.available !== false ? (
        <section className="pulse-section pulse-recovery" aria-labelledby="pulse-recovery">
          <p className="pulse-eyebrow">Recuperación</p>
          <h2 id="pulse-recovery">
            Clientes prioritarios {displayValue(metricValue(recovery, 'count', 'total', 'value'))}
          </h2>
          {recovery.summary ? <p>{recovery.summary}</p> : null}
          <Link className="pulse-primary-link" to="/equipo/recuperacion">
            Ver recuperación
          </Link>
        </section>
      ) : null}

      <section className="pulse-section" aria-labelledby="pulse-routes" id="pulse-routes-block">
        <button
          className="pulse-collapse-button"
          type="button"
          aria-expanded={routesOpen}
          aria-controls="pulse-route-breakdown"
          onClick={() => setRoutesOpen((open) => !open)}
        >
          <span>
            <p className="pulse-eyebrow">Rutas</p>
            <h2 id="pulse-routes">Desglose de ayer</h2>
          </span>
          <strong>{routesOpen ? 'Ocultar' : 'Ver rutas'}</strong>
        </button>
        {routesOpen ? (
          <div id="pulse-route-breakdown" className="pulse-route-list">
            {routes.length === 0 ? (
              <p>No hay rutas en el alcance de ayer.</p>
            ) : routes.map((route) => {
              const entityId = route.plan_id ?? route.id ?? route.entity_id
              const rowId = pulseRouteRowId(entityId)
              return (
                <article
                  className="pulse-route-row"
                  key={rowId || `${route.route_name}-${entityId}`}
                  data-pulse-row-id={rowId || undefined}
                >
                  <div>
                    <h3>{route.route_name || route.name || `Ruta ${entityId}`}</h3>
                    {route.seller_name ? <p>{route.seller_name}</p> : null}
                  </div>
                  <dl>
                    <div><dt>Agendados</dt><dd>{displayValue(route.scheduled)}</dd></div>
                    <div><dt>Visitados</dt><dd>{displayValue(route.visited)}</dd></div>
                    <div><dt>Compraron</dt><dd>{displayValue(route.bought)}</dd></div>
                    <div><dt>Cobertura</dt><dd>{route.coverage_pct == null ? '—' : displayValue(route.coverage_pct, '%')}</dd></div>
                    <div><dt>Conversión</dt><dd>{route.conversion_pct == null ? '—' : displayValue(route.conversion_pct, '%')}</dd></div>
                  </dl>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </div>
  )
}
