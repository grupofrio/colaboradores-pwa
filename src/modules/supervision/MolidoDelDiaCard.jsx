import { useCallback, useEffect, useState } from 'react'
import { TOKENS } from '../../tokens'
import { getMillingDailySummary } from '../shared/millingAPI'
import { logScreenError } from '../shared/logScreenError'

// "Molido de hoy" — la visibilidad que se enciende ANTES que el candado.
//
// No depende de que el dato sea confiable: precisamente por eso va primero.
// Muestra lo que el dato dice, con las palabras que lo dicen, y hace evidente
// que alguien esta mirando la conversion todos los dias.
//
// `null != 0`: sin lotes no se pinta un 0 %, se dice que no hubo molido.
export default function MolidoDelDiaCard({ warehouseId, typo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getMillingDailySummary({ warehouseId }))
    } catch (e) {
      logScreenError('MolidoDelDiaCard', 'getMillingDailySummary', e)
      setError(e.message || 'No se pudo leer la conversión del día')
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 18 }}>
        Cargando molido del día...
      </p>
    )
  }
  if (error) return null

  const lots = Number(data?.lots || 0)
  const compliance = data?.compliance_pct
  const hasCompliance = compliance !== null && compliance !== undefined
  const tone = !hasCompliance
    ? TOKENS.colors.textMuted
    : compliance >= 95 ? TOKENS.colors.success
      : compliance >= 80 ? TOKENS.colors.warning
        : TOKENS.colors.error

  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ ...typo.overline, color: TOKENS.colors.textLow, marginBottom: 10 }}>
        MOLIDO DE HOY
      </p>
      <div style={{
        padding: 14,
        borderRadius: TOKENS.radius.lg,
        background: TOKENS.glass.panel,
        border: `1px solid ${hasCompliance ? `${tone}38` : TOKENS.colors.border}`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {lots === 0 ? (
          <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>
            Sin transformaciones registradas hoy.
          </span>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Cell label="REAL" value={fmtRatio(data.actual_per_input)} />
              <Cell label="ESPERADO" value={fmtRatio(data.expected_per_input)} />
              <Cell
                label="CUMPLE"
                value={hasCompliance ? `${Number(compliance).toFixed(0)}%` : '—'}
                color={hasCompliance ? tone : null}
              />
            </div>
            <span style={{ ...typo.caption, color: TOKENS.colors.textSoft }}>
              {lots} lote{lots === 1 ? '' : 's'}
              {data.missing_units > 0
                ? ` · faltan ${Number(data.missing_units).toFixed(0)} bolsas contra lo esperado`
                : ''}
            </span>
            {Number(data.lots_over_threshold || 0) > 0 && (
              <span style={{ ...typo.caption, color: TOKENS.colors.warning, fontWeight: 700 }}>
                &#x26A0; {data.lots_over_threshold} lote(s) fuera de umbral
                {Number(data.recounts_requested || 0) > 0
                  ? ` · ${data.recounts_that_changed} de ${data.recounts_requested} recuentos cambiaron el número`
                  : ''}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Cell({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 6px', borderRadius: TOKENS.radius.sm,
      background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, color: TOKENS.colors.textMuted, margin: 0, letterSpacing: '0.1em' }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: color || TOKENS.colors.text, margin: '2px 0 0' }}>{value}</p>
    </div>
  )
}

function fmtRatio(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(2)} b/u`
}
