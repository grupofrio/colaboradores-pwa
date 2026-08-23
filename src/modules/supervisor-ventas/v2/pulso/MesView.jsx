import { useEffect, useMemo, useRef } from 'react'
import CustomerMovementBlock from './CustomerMovementBlock.jsx'
import MonthTargets from './MonthTargets.jsx'
import {
  displayValue,
  focusPulseBlock,
  presentPulsePayload,
} from './pulseModel.js'

export default function MesView({ data = {}, onCta, focusTarget }) {
  const rootRef = useRef(null)
  const presented = useMemo(() => presentPulsePayload(data), [data])
  const targets = presented.targets
  const movement = presented.customer_movement
  const trend = presented.trend
  const products = presented.products
  const recurrent = presented.recurrent_execution

  useEffect(() => {
    if (!focusTarget?.block) return undefined
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

  return (
    <div className="pulse-view" ref={rootRef}>
      <MonthTargets targets={targets} />

      <CustomerMovementBlock movement={movement} onCta={onCta} />

      {trend ? (
        <section
          className="pulse-section"
          aria-labelledby="pulse-trend-title"
          data-pulse-block="trend"
        >
          {trend.available === false ? (
            <>
              <p className="pulse-eyebrow">Tendencia</p>
              <h2 id="pulse-trend-title">{trend.title || 'Tendencia'}</h2>
              <p>{trend.summary || 'Tendencia no disponible.'}</p>
            </>
          ) : (
            <>
              <p className="pulse-eyebrow">Tendencia</p>
              <h2 id="pulse-trend-title">{trend.title || 'Tendencia'}</h2>
              {trend.summary ? <p>{trend.summary}</p> : null}
              {trend.direction ? (
                <span className="pulse-count">{String(trend.direction)}</span>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {products && products.available !== false && products.items.length > 0 ? (
        <section
          className="pulse-section"
          aria-labelledby="pulse-products-title"
          data-pulse-block="products"
        >
          <p className="pulse-eyebrow">Productos</p>
          <h2 id="pulse-products-title">{products.title || 'Productos'}</h2>
          {products.summary ? <p>{products.summary}</p> : null}
          <div className="pulse-drop-list">
            {products.items.map((item) => (
              <article className="pulse-drop-row" key={item.name}>
                <div>
                  <h3>{item.name}</h3>
                </div>
                <span className={`pulse-tone pulse-tone--${item.tone || 'unknown'}`}>
                  {item.tone_label || 'Sin dato'}
                  {' · '}
                  {item.available === false || item.change_pct == null
                    ? 'Sin dato'
                    : displayValue(item.change_pct, '%')}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {recurrent ? (
        <section
          className="pulse-section"
          aria-labelledby="pulse-recurrent-title"
          data-pulse-block="recurrent_execution"
        >
          {recurrent.available === false ? (
            <>
              <p className="pulse-eyebrow">Ejecución</p>
              <h2 id="pulse-recurrent-title">{recurrent.title || 'Ejecución recurrente'}</h2>
              <p>{recurrent.summary || 'Ejecución recurrente no disponible.'}</p>
            </>
          ) : (
            <>
              <p className="pulse-eyebrow">Ejecución</p>
              <h2 id="pulse-recurrent-title">{recurrent.title || 'Ejecución recurrente'}</h2>
              {recurrent.summary ? <p>{recurrent.summary}</p> : null}
              <div className="pulse-drop-list">
                {recurrent.items.map((item) => (
                  <article className="pulse-drop-row" key={`${item.type}-${item.label}`}>
                    <div>
                      <h3>{item.label}</h3>
                    </div>
                    <span className={`pulse-tone pulse-tone--${item.tone || 'unknown'}`}>
                      {item.tone_label || 'Sin dato'}
                      {' · '}
                      {item.available === false || item.count == null
                        ? 'Sin dato'
                        : displayValue(item.count)}
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}
