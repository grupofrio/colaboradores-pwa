function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function unscheduledDetail(value) {
  return `${value} no programada${value === 1 ? '' : 's'}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAttendanceSummaryCards(summary = {}) {
  const unscheduledPresent = finiteNumber(summary.unscheduled_present)
  const unscheduledAbsent = finiteNumber(summary.unscheduled_absent)
  const workedHours = Math.round(finiteNumber(summary.worked_hours) * 100) / 100

  return [
    {
      key: 'expected',
      label: 'Jornadas esperadas',
      value: finiteNumber(summary.expected),
      detail: '',
    },
    {
      key: 'present',
      label: 'Presentes',
      value: finiteNumber(summary.present) + unscheduledPresent,
      detail: unscheduledDetail(unscheduledPresent),
    },
    {
      key: 'absent',
      label: 'Faltas',
      value: finiteNumber(summary.absent) + unscheduledAbsent,
      detail: unscheduledDetail(unscheduledAbsent),
    },
    {
      key: 'incomplete',
      label: 'Incompletos',
      value: finiteNumber(summary.incomplete),
      detail: 'Diagnóstico; ya incluidos en presentes',
    },
    {
      key: 'hours',
      label: 'Horas trabajadas',
      value: `${workedHours} h`,
      detail: '',
    },
  ]
}

export function AttendanceSummary({ summary }) {
  const cards = buildAttendanceSummaryCards(summary)

  return (
    <section className="attendance-summary" aria-label="Resumen de asistencias">
      {cards.map((card) => (
        <article className={`attendance-summary-card attendance-summary-card--${card.key}`} key={card.key}>
          <p>{card.label}</p>
          <strong>{card.value}</strong>
          {card.detail ? <small>{card.detail}</small> : null}
        </article>
      ))}
    </section>
  )
}
