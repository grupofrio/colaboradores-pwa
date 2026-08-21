import { useMemo, useState } from 'react'
import { formatCashCopy, sliceAttention, sortAttention } from './pulseModel.js'

const SEVERITY_LABEL = Object.freeze({
  critical: 'Crítico',
  warning: 'Atención',
  info: 'Información',
})

export default function AttentionList({
  items = [],
  max = 5,
  onCta,
  emptyCopy = 'Sin asuntos que requieran atención.',
}) {
  const [expanded, setExpanded] = useState(false)
  const sorted = useMemo(() => sortAttention(items), [items])
  const visible = expanded ? sorted : sliceAttention(sorted, max)

  if (!sorted.length) return <p className="pulse-empty">{emptyCopy}</p>

  return (
    <div className="pulse-attention-list">
      {visible.map((item) => {
        const cashCopy = item.type === 'close_cash_composed'
          ? formatCashCopy(item.metric || item.evidence?.cash)
          : null
        return (
          <article
            className={`pulse-attention-card pulse-attention-card--${item.severity || 'info'}`}
            key={item.id || `${item.type}-${item.entity_id ?? 'branch'}`}
          >
            <div className="pulse-attention-heading">
              <span className="pulse-severity">
                {SEVERITY_LABEL[item.severity] || SEVERITY_LABEL.info}
              </span>
              {item.entity_name ? <span className="pulse-entity">{item.entity_name}</span> : null}
            </div>
            <h3>{item.title || 'Requiere atención'}</h3>
            {item.summary ? <p>{item.summary}</p> : null}
            {cashCopy && cashCopy !== item.title && cashCopy !== item.summary
              ? <p className="pulse-cash-copy">{cashCopy}</p>
              : null}
            {item.owner_name ? <p className="pulse-owner">Responsable: {item.owner_name}</p> : null}
            {item.cta ? (
              <button
                className="pulse-link-button"
                type="button"
                onClick={() => onCta?.(item.cta, item)}
              >
                {item.cta.label || 'Atender'}
              </button>
            ) : null}
          </article>
        )
      })}
      {!expanded && sorted.length > max ? (
        <button className="pulse-secondary-button" type="button" onClick={() => setExpanded(true)}>
          Ver todas
        </button>
      ) : null}
    </div>
  )
}
