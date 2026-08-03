export default function CashShiftAdjustments({ rows, disabled = false, onAdd, onChange, onRemove }) {
  return (
    <fieldset className="cash-shift-fieldset" disabled={disabled}>
      <legend>Ajustes de caja</legend>
      <p className="cash-shift-muted">
        Registra otros ingresos o egresos con importe positivo y concepto obligatorio.
      </p>
      <div className="cash-shift-adjustment-list">
        {rows.map((row, index) => (
          <div className="cash-shift-adjustment-row" key={row.id}>
            <label>Tipo
              <select
                name={`adjustment-type-${index}`}
                disabled={disabled}
                value={row.type}
                onChange={(event) => onChange(row.id, 'type', event.target.value)}
              >
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </label>
            <label>Concepto
              <input
                name={`adjustment-concept-${index}`}
                disabled={disabled}
                value={row.concept}
                onChange={(event) => onChange(row.id, 'concept', event.target.value)}
              />
            </label>
            <label>Importe
              <input
                name={`adjustment-amount-${index}`}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                disabled={disabled}
                value={row.amount}
                onChange={(event) => onChange(row.id, 'amount', event.target.value)}
              />
            </label>
            <button
              className="cash-shift-secondary cash-shift-remove"
              type="button"
              disabled={disabled}
              aria-label={`Eliminar ajuste ${index + 1}`}
              onClick={() => onRemove(row.id)}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
      <button className="cash-shift-secondary" type="button" disabled={disabled} onClick={onAdd}>
        Agregar ajuste
      </button>
    </fieldset>
  )
}
