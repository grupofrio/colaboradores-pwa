import { displayValue } from './pulseModel.js'

export default function PurchaseDropList({ drops, id = 'pulse-drops-list' }) {
  if (!drops) return null

  if (drops.available === false) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-drops-title">
        <p className="pulse-eyebrow">Detalle</p>
        <h2 id="pulse-drops-title">{drops.title || 'Caídas de compra'}</h2>
        <p>{drops.summary || 'Listado no disponible.'}</p>
      </section>
    )
  }

  return (
    <section
      className="pulse-section"
      aria-labelledby="pulse-drops-title"
      data-pulse-block="drops"
      id={id}
    >
      <p className="pulse-eyebrow">Detalle</p>
      <h2 id="pulse-drops-title">{drops.title || 'Caídas de compra'}</h2>
      {drops.summary ? <p>{drops.summary}</p> : null}
      {drops.items.length === 0 ? (
        <p className="pulse-empty">Sin clientes con caída de compra.</p>
      ) : (
        <div className="pulse-drop-list">
          {drops.items.map((item) => (
            <article className="pulse-drop-row" key={item.id ?? item.name}>
              <div>
                <h3>{item.name}</h3>
                {item.summary ? <p>{item.summary}</p> : null}
              </div>
              <strong>
                {item.available === false || item.drop_pct == null
                  ? 'Sin dato'
                  : displayValue(item.drop_pct, '%')}
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
