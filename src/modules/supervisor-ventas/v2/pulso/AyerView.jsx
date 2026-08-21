import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AttentionList from './AttentionList.jsx'
import {
  conversionState,
  diagnosis as buildDiagnosis,
  focusPulseRoute,
  metricValue,
  pulseRouteRowId,
} from './pulseModel.js'

const FUNNEL_LABELS = Object.freeze({
  scheduled: 'Agendados',
  agendados: 'Agendados',
  visited: 'Visitados',
  visitados: 'Visitados',
  opportunities: 'Oportunidades',
  oportunidades: 'Oportunidades',
  converted: 'Convertidos',
  convertidos: 'Convertidos',
  sales: 'Ventas',
  ventas: 'Ventas',
})

function displayValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (Number.isFinite(number)) {
    return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(number)}${suffix}`
  }
  return String(value)
}

function routeRows(data) {
  if (Array.isArray(data?.routes)) return data.routes
  if (Array.isArray(data?.route_breakdown)) return data.route_breakdown
  if (Array.isArray(data?.breakdown?.routes)) return data.breakdown.routes
  return []
}

function funnelEntries(funnel) {
  if (!funnel || typeof funnel !== 'object') return []
  return Object.entries(funnel)
    .filter(([key, value]) => FUNNEL_LABELS[key] && (typeof value === 'number' || typeof value === 'string'))
    .map(([key, value]) => ({ key, label: FUNNEL_LABELS[key], value }))
}

export default function AyerView({ data = {}, onCta, focusTarget }) {
  const [routesOpen, setRoutesOpen] = useState(false)
  const rootRef = useRef(null)
  const routes = useMemo(() => routeRows(data), [data])
  const attention = data.attention || data.attention_items || []
  const funnel = data.funnel || {}
  const coverage = metricValue(
    funnel,
    'coverage_pct',
    'coverage',
  ) ?? metricValue(data.coverage, 'pct', 'value')
  const conversion = metricValue(
    funnel,
    'conversion_pct',
    'conversion',
  ) ?? metricValue(data.conversion, 'pct', 'value')
  const conversionInfo = conversionState(conversion)
  const diagnosis = data.diagnosis?.kind
    ? data.diagnosis
    : buildDiagnosis(coverage, conversion)
  const result = data.resultado || data.result || {}
  const creditGranted = metricValue(
    result,
    'credit_granted',
    'credito_otorgado',
    'granted_credit',
  )
  const quality = data.quality || data.quality_metric || null
  const recovery = data.recovery || null

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
            <h2 id="pulse-ayer-attention">Requiere atención</h2>
          </div>
          <span className="pulse-count">{attention.length}</span>
        </div>
        <AttentionList items={attention} max={5} onCta={onCta} />
      </section>

      {diagnosis?.summary ? (
        <section className="pulse-section pulse-diagnosis" aria-labelledby="pulse-diagnosis">
          <p className="pulse-eyebrow">Diagnóstico principal</p>
          <h2 id="pulse-diagnosis">{diagnosis.summary}</h2>
        </section>
      ) : null}

      <section className="pulse-section" aria-labelledby="pulse-funnel">
        <div className="pulse-section-heading">
          <div>
            <p className="pulse-eyebrow">Embudo</p>
            <h2 id="pulse-funnel">Ejecución y conversión</h2>
          </div>
          <span className={`pulse-tone pulse-tone--${conversionInfo.tone}`}>
            {conversionInfo.label}
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
            <strong>{displayValue(coverage, '%')}</strong>
          </div>
          <div className="pulse-metric">
            <span>Conversión</span>
            <strong>{displayValue(conversion, '%')}</strong>
          </div>
        </div>
      </section>

      <section className="pulse-section" aria-labelledby="pulse-result">
        <p className="pulse-eyebrow">Resultado</p>
        <div className="pulse-result-row">
          <h2 id="pulse-result">Crédito otorgado</h2>
          <strong>{displayValue(creditGranted)}</strong>
        </div>
      </section>

      {quality ? (
        <section className="pulse-section" aria-labelledby="pulse-quality">
          <p className="pulse-eyebrow">Métrica de calidad</p>
          <div className="pulse-result-row">
            <div>
              <h2 id="pulse-quality">{quality.label || 'Visitas para revisar'}</h2>
              {quality.summary ? <p>{quality.summary}</p> : null}
            </div>
            <strong>{displayValue(metricValue(quality, 'value', 'count', 'pct'), quality.pct != null ? '%' : '')}</strong>
          </div>
        </section>
      ) : null}

      {recovery && recovery.available !== false ? (
        <section className="pulse-section pulse-recovery" aria-labelledby="pulse-recovery">
          <p className="pulse-eyebrow">Recuperación</p>
          <h2 id="pulse-recovery">{recovery.title || 'Clientes por recuperar'}</h2>
          {recovery.summary ? <p>{recovery.summary}</p> : null}
          <Link className="pulse-primary-link" to="/equipo/recuperacion">
            Abrir recuperación
          </Link>
        </section>
      ) : null}

      <section className="pulse-section" aria-labelledby="pulse-routes">
        <button
          className="pulse-collapse-button"
          type="button"
          aria-expanded={routesOpen}
          aria-controls="pulse-route-breakdown"
          onClick={() => setRoutesOpen((open) => !open)}
        >
          <span>
            <span className="pulse-eyebrow">Desglose</span>
            <span id="pulse-routes" className="pulse-collapse-title">Rutas</span>
          </span>
          <span aria-hidden>{routesOpen ? '−' : '+'}</span>
        </button>
        <div id="pulse-route-breakdown" hidden={!routesOpen}>
          {routes.length ? (
            <div className="pulse-route-list">
              {routes.map((route) => {
                const entityId = route.entity_id ?? route.plan_id ?? route.id
                const rowId = pulseRouteRowId(entityId)
                return (
                  <article className="pulse-route-row" data-pulse-row-id={rowId} key={rowId || route.name}>
                    <div>
                      <h3>{route.entity_name || route.route_name || route.name || 'Ruta'}</h3>
                      <p>{route.owner_name || route.salesperson_name || 'Responsable por confirmar'}</p>
                    </div>
                    <div className="pulse-route-metrics">
                      <span>{displayValue(metricValue(route, 'visited', 'visitados'))} visitas</span>
                      <span>{displayValue(metricValue(route, 'conversion_pct', 'conversion'), '%')} conversión</span>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : <p className="pulse-empty">Sin desglose de rutas disponible.</p>}
        </div>
      </section>
    </div>
  )
}
