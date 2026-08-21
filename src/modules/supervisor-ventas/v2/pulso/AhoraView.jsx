import AttentionList from './AttentionList.jsx'
import { compactState, presentPulsePayload } from './pulseModel.js'

export { compactState }

export default function AhoraView({ data = {}, onCta }) {
  const presented = presentPulsePayload(data)
  const attention = presented.attention
  const state = compactState(presented)

  return (
    <div className="pulse-view">
      <section className="pulse-section" aria-labelledby="pulse-ahora-attention">
        <div className="pulse-section-heading">
          <div>
            <p className="pulse-eyebrow">Operación en curso</p>
            <h2 id="pulse-ahora-attention">Necesita tu atención</h2>
          </div>
          <span className="pulse-count">{presented.attention_total ?? attention.length}</span>
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
