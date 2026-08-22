import { displayValue } from './pulseModel.js'

export default function CustomerMovementBlock({
  movement,
  onCta,
  onDrill,
  activeDrill = null,
}) {
  if (!movement) return null

  if (movement.available === false) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-movement-title">
        <p className="pulse-eyebrow">Clientes</p>
        <h2 id="pulse-movement-title">{movement.title || 'Movimiento de clientes'}</h2>
        <p>{movement.summary || 'Movimiento de clientes no disponible.'}</p>
      </section>
    )
  }

  return (
    <section
      className="pulse-section"
      aria-labelledby="pulse-movement-title"
      data-pulse-block="customer_movement"
    >
      <div className="pulse-section-heading">
        <div>
          <p className="pulse-eyebrow">Clientes</p>
          <h2 id="pulse-movement-title">{movement.title || 'Movimiento de clientes'}</h2>
        </div>
      </div>
      {movement.summary ? <p>{movement.summary}</p> : null}
      <div className="pulse-movement-grid">
        {movement.cards.map((card) => {
          const isActive = activeDrill === card.key
          const countLabel = card.available === false || card.count == null
            ? 'Sin dato'
            : displayValue(card.count)
          return (
            <button
              className={`pulse-movement-card pulse-movement-card--${card.tone || 'unknown'}${isActive ? ' pulse-movement-card--active' : ''}`}
              type="button"
              key={card.key}
              aria-pressed={isActive}
              aria-label={`${card.label}: ${countLabel}. ${card.tone_label || 'Sin estado'}.`}
              onClick={() => {
                onDrill?.(card.key)
                if (card.cta) onCta?.(card.cta, card)
              }}
            >
              <span className={`pulse-tone pulse-tone--${card.tone || 'unknown'}`}>
                {card.tone_label || 'Sin dato'}
              </span>
              <strong>{countLabel}</strong>
              <span>{card.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
