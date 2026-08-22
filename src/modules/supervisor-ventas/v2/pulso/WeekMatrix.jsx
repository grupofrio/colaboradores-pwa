export default function WeekMatrix({ matrix }) {
  if (!matrix) return null

  if (matrix.available === false) {
    return (
      <section className="pulse-section" aria-labelledby="pulse-matrix-title">
        <p className="pulse-eyebrow">Cobertura</p>
        <h2 id="pulse-matrix-title">{matrix.title || 'Matriz semanal'}</h2>
        <p>{matrix.summary || 'Matriz semanal no disponible.'}</p>
      </section>
    )
  }

  return (
    <section
      className="pulse-section"
      aria-labelledby="pulse-matrix-title"
      data-pulse-block="matrix"
    >
      <div className="pulse-section-heading">
        <div>
          <p className="pulse-eyebrow">Cobertura</p>
          <h2 id="pulse-matrix-title">{matrix.title || 'Matriz semanal'}</h2>
        </div>
      </div>
      {matrix.summary ? <p>{matrix.summary}</p> : null}
      {matrix.rows.length === 0 ? (
        <p className="pulse-empty">Sin datos de matriz para esta semana.</p>
      ) : (
        <div className="pulse-matrix-wrap" role="table" aria-label="Matriz semanal de cobertura">
          <div className="pulse-matrix-row pulse-matrix-row--head" role="row">
            <span className="pulse-matrix-label" role="columnheader">Indicador</span>
            {matrix.days.map((day) => (
              <span className="pulse-matrix-day" role="columnheader" key={day}>{day}</span>
            ))}
          </div>
          {matrix.rows.map((row) => (
            <div className="pulse-matrix-row" role="row" key={row.label}>
              <span className="pulse-matrix-label" role="rowheader">{row.label}</span>
              {row.cells.map((cell, index) => (
                <span
                  className={`pulse-matrix-cell pulse-matrix-cell--${cell.tone || 'unknown'}`}
                  role="cell"
                  key={`${row.label}-${matrix.days[index] || index}`}
                  aria-label={`${row.label} ${matrix.days[index] || ''}: ${cell.label}`}
                >
                  <span className="pulse-matrix-cell-value">{cell.label}</span>
                  <span className={`pulse-tone pulse-tone--${cell.tone || 'unknown'}`}>
                    {cell.tone_label || 'Sin dato'}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
