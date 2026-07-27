import {
  getAttendanceActionEligibility,
  getAttendanceStatusLabel,
} from '../attendanceState.js'

function formatDate(value) {
  const [year, month, day] = String(value || '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function formatTime(value) {
  if (!value) return 'Pendiente'
  const match = String(value).match(/T(\d{2}:\d{2})/)
  return match ? match[1] : String(value)
}

function finiteHours(value) {
  const hours = Number(value)
  return Number.isFinite(hours) ? `${Math.round(hours * 100) / 100} h` : '0 h'
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAttendanceRowViewModels(rows = []) {
  return rows.map((row) => {
    const rowKey = `${row?.employee?.id}:${row?.date}`
    return {
      ...row,
      key: rowKey,
      segments: (Array.isArray(row.attendances) ? row.attendances : []).map((attendance) => ({
        ...attendance,
        key: `${rowKey}:attendance:${attendance.id}`,
      })),
      actions: getAttendanceActionEligibility(row),
    }
  })
}

export function AttendanceRows({
  rows,
  onAttendance,
  onAbsence,
  onAudit,
  disabled = false,
}) {
  const viewRows = buildAttendanceRowViewModels(rows)

  function actionsFor(row, compact = false) {
    return (
      <div className={compact ? 'attendance-row-actions attendance-row-actions--compact' : 'attendance-row-actions'}>
        {row.actions.registerAttendance ? (
          <button disabled={disabled} onClick={() => onAttendance('create', row)} type="button">
            Registrar asistencia
          </button>
        ) : null}
        {row.actions.registerAbsence ? (
          <button disabled={disabled} onClick={() => onAbsence('create', row)} type="button">
            Registrar falta
          </button>
        ) : null}
        {row.actions.addSegment ? (
          <button disabled={disabled} onClick={() => onAttendance('add', row)} type="button">
            Agregar tramo
          </button>
        ) : null}
        {row.actions.justifyAbsence ? (
          <button disabled={disabled} onClick={() => onAbsence('justify', row)} type="button">
            Justificar falta
          </button>
        ) : null}
        {row.absence && row.actions.viewHistory ? (
          <button
            disabled={disabled}
            onClick={() => onAudit({
              model: 'x_kold.hr.falta',
              recordId: row.absence.id,
              label: `${row.employee.name} · ${formatDate(row.date)}`,
            })}
            type="button"
          >
            Ver historial de falta
          </button>
        ) : null}
      </div>
    )
  }

  function segmentsFor(row) {
    if (!row.segments.length) return <span className="attendance-muted">Sin tramos</span>
    return (
      <ol className="attendance-segments">
        {row.segments.map((segment) => (
          <li key={segment.key}>
            <div>
              <strong>{formatTime(segment.check_in)}–{formatTime(segment.check_out)}</strong>
              <span>{finiteHours(segment.worked_hours)}</span>
            </div>
            <div className="attendance-segment-actions">
              <button
                disabled={disabled}
                onClick={() => onAttendance('correct', row, segment)}
                type="button"
              >
                Corregir horario
              </button>
              {!segment.check_out ? (
                <button
                  disabled={disabled}
                  onClick={() => onAttendance('close', row, segment)}
                  type="button"
                >
                  Registrar salida
                </button>
              ) : null}
              <button
                disabled={disabled}
                onClick={() => onAudit({
                  model: 'hr.attendance',
                  recordId: segment.id,
                  label: `${row.employee.name} · ${formatDate(row.date)}`,
                })}
                type="button"
              >
                Ver historial
              </button>
            </div>
          </li>
        ))}
      </ol>
    )
  }

  if (!viewRows.length) {
    return (
      <div className="attendance-empty" role="status">
        No hay empleado-días que coincidan con los filtros.
      </div>
    )
  }

  return (
    <section className="attendance-results" aria-label="Empleado-días">
      <div className="attendance-table" role="region" aria-label="Tabla de asistencias" tabIndex="0">
        <table>
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Cuenta</th>
              <th>Fecha</th>
              <th>Tramos</th>
              <th>Horas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <strong>{row.employee.name}</strong>
                  <span>{row.employee.number || 'Sin número'} · {row.employee.job || 'Sin puesto'}</span>
                </td>
                <td><span className="attendance-code">{row.employee.analytic_code}</span></td>
                <td>{formatDate(row.date)}</td>
                <td>{segmentsFor(row)}</td>
                <td>{finiteHours(row.worked_hours)}</td>
                <td>
                  <span className={`attendance-status attendance-status--${row.status}`}>
                    {getAttendanceStatusLabel(row.status)}
                  </span>
                  {row.absence ? <small>{row.absence.rolling_count_30d || 0} faltas en 30 días</small> : null}
                </td>
                <td>{actionsFor(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="attendance-mobile-cards">
        {viewRows.map((row) => (
          <article className="attendance-mobile-card" key={row.key}>
            <header>
              <div>
                <strong>{row.employee.name}</strong>
                <span>{row.employee.number || 'Sin número'} · {row.employee.job || 'Sin puesto'}</span>
              </div>
              <span className="attendance-code">{row.employee.analytic_code}</span>
            </header>
            <dl>
              <div><dt>Fecha</dt><dd>{formatDate(row.date)}</dd></div>
              <div><dt>Horas</dt><dd>{finiteHours(row.worked_hours)}</dd></div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span className={`attendance-status attendance-status--${row.status}`}>
                    {getAttendanceStatusLabel(row.status)}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="attendance-card-segments">
              <h3>Tramos</h3>
              {segmentsFor(row)}
            </div>
            {actionsFor(row, true)}
          </article>
        ))}
      </div>
    </section>
  )
}
