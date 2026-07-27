const STATUS_OPTIONS = [
  ['', 'Todos los estados'],
  ['complete', 'Completa'],
  ['open', 'Registro abierto'],
  ['absence_pending', 'Falta pendiente'],
  ['absence_justified', 'Falta justificada'],
  ['absence_processed', 'Falta procesada'],
  ['missing_expected', 'Asistencia faltante'],
  ['not_scheduled', 'Día no programado'],
]

export function AttendanceFilters({
  filters,
  errors = {},
  onChange,
  onPresetChange,
  onExport,
  exporting = false,
  disabled = false,
}) {
  function update(field, value) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <section className="attendance-filters" aria-label="Filtros de asistencias">
      <div className="attendance-presets" aria-label="Periodo" role="group">
        {[
          ['day', 'Día'],
          ['week', 'Semana'],
          ['custom', 'Rango'],
        ].map(([value, label]) => (
          <button
            className={filters.preset === value ? 'is-active' : ''}
            disabled={disabled}
            key={value}
            onClick={() => onPresetChange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <label>
        Desde
        <input
          aria-invalid={Boolean(errors.date_from)}
          disabled={disabled}
          max={filters.date_to || undefined}
          name="date_from"
          onChange={(event) => update('date_from', event.target.value)}
          type="date"
          value={filters.date_from}
        />
        {errors.date_from ? <span className="attendance-field-error">{errors.date_from}</span> : null}
      </label>

      <label>
        Hasta
        <input
          aria-invalid={Boolean(errors.date_to)}
          disabled={disabled}
          min={filters.date_from || undefined}
          name="date_to"
          onChange={(event) => update('date_to', event.target.value)}
          type="date"
          value={filters.date_to}
        />
        {errors.date_to ? <span className="attendance-field-error">{errors.date_to}</span> : null}
      </label>

      <label>
        Cuenta analítica
        <select
          disabled={disabled}
          name="analytic_code"
          onChange={(event) => update('analytic_code', event.target.value)}
          value={filters.analytic_code}
        >
          <option value="">Todas</option>
          <option value="IGU">IGU</option>
          <option value="IGU34">IGU34</option>
        </select>
      </label>

      <label className="attendance-search-field">
        Buscar empleado
        <input
          disabled={disabled}
          name="search"
          onChange={(event) => update('search', event.target.value)}
          placeholder="Nombre o número"
          type="search"
          value={filters.search}
        />
      </label>

      <label>
        Estado
        <select
          disabled={disabled}
          name="status"
          onChange={(event) => update('status', event.target.value)}
          value={filters.status}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value || 'all'} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <button
        className="attendance-button attendance-button--primary attendance-export"
        disabled={disabled || exporting || Object.keys(errors).length > 0}
        onClick={onExport}
        type="button"
      >
        {exporting ? 'Preparando Excel…' : 'Exportar Excel'}
      </button>
    </section>
  )
}
