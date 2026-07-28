import { CASH_SHIFT_DENOMINATIONS } from '../cashShiftModel.js'

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(value)
}

export default function CashShiftDenominations({ counts, disabled = false, onChange }) {
  return (
    <fieldset className="cash-shift-fieldset cash-shift-denominations" disabled={disabled}>
      <legend>Arqueo por denominación</legend>
      <div className="cash-shift-denomination-grid">
        {CASH_SHIFT_DENOMINATIONS.map((denomination) => (
          <label key={denomination}>
            {money(Number(denomination))}
            <input
              name={`denomination-${denomination}`}
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              disabled={disabled}
              value={counts[denomination] ?? '0'}
              onChange={(event) => onChange(denomination, event.target.value)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
