import AttentionList from './AttentionList.jsx'

function compactState(data) {
  const value = data?.estado || data?.state || data?.compact_state
  if (!value || typeof value !== 'object') return null
  return {
    title: value.title || value.label || 'Estado comercial',
    summary: value.summary || value.message || null,
    value: value.value ?? value.count ?? null,
  }
}

export default function AhoraView({ data = {}, onCta }) {
  const attention = data.attention || data.attention_items || []
  const state = compactState(data)

  return (
    <div className="pulse-view">
      <section className="pulse-section" aria-labelledby="pulse-ahora-attention">
        <div className="pulse-section-heading">
          <div>
            <p className="pulse-eyebrow">Operación en curso</p>
            <h2 id="pulse-ahora-attention">Requiere atención</h2>
          </div>
          <span className="pulse-count">{attention.length}</span>
        </div>
        <AttentionList items={attention} max={5} onCta={onCta} />
      </section>

      {state ? (
        <section className="pulse-section pulse-section--compact" aria-label="Estado comercial">
          <p className="pulse-eyebrow">Estado</p>
          <div className="pulse-state-row">
            <div>
              <h2>{state.title}</h2>
              {state.summary ? <p>{state.summary}</p> : null}
            </div>
            {state.value !== null ? <strong>{state.value}</strong> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
