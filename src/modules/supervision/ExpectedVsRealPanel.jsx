import { useCallback, useEffect, useState } from 'react'
import { TOKENS } from '../../tokens'
import { getExpectedVsReal } from '../shared/plantEnergyAPI'
import { logScreenError } from '../shared/logScreenError'

// Esperado vs real por linea + KPI de ciclos Rolito.
//
// La formula vive en Odoo (gf_plant_energy). Esta pantalla NO calcula la
// brecha ni decide el semaforo: pinta `status_label` y `gap_pct` tal cual.
//
// `null != 0`: sin bitacora de compresor el backend manda `expected_kg = null`
// y `status = 'sin_registro_compresor'` — se muestra con esas palabras, no
// como un esperado de 0.

const STATUS_COLORS = {
  en_meta: TOKENS.colors.success,
  arriba_de_esperado: TOKENS.colors.blue2,
  abajo_de_esperado: TOKENS.colors.warning,
  muy_abajo_de_esperado: TOKENS.colors.error,
}

const NEUTRAL_STATUSES = new Set([
  'sin_registro_compresor',
  'sin_capacidad_configurada',
  'sin_fuente_real',
  'compresor_sin_horas',
  'sin_dato',
])

export default function ExpectedVsRealPanel({ shiftId, typo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!shiftId) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      setData(await getExpectedVsReal(shiftId))
    } catch (e) {
      logScreenError('ExpectedVsRealPanel', 'getExpectedVsReal', e)
      setError(e.message || 'No se pudo leer esperado vs real')
    } finally {
      setLoading(false)
    }
  }, [shiftId])

  useEffect(() => { load() }, [load])

  if (!shiftId) return null

  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ ...typo.overline, color: TOKENS.colors.textLow, marginBottom: 10 }}>
        PRODUCCION: REAL VS ESPERADO
      </p>

      {loading ? (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>Calculando...</p>
      ) : error ? (
        <div style={{ padding: 12, borderRadius: TOKENS.radius.md, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span style={{ ...typo.caption, color: TOKENS.colors.error }}>{error}</span>
        </div>
      ) : !data?.lines?.length ? (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>
          Sin lineas con compresor configurado en esta planta.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.lines.map((line) => <LineRow key={line.line_id} line={line} typo={typo} />)}
        </div>
      )}

      {!loading && !error && data?.rolito_cycles && (
        <RolitoCyclesCard kpi={data.rolito_cycles} typo={typo} />
      )}
    </div>
  )
}

function LineRow({ line, typo }) {
  const neutral = NEUTRAL_STATUSES.has(line.status)
  const color = neutral ? TOKENS.colors.textMuted : (STATUS_COLORS[line.status] || TOKENS.colors.textMuted)
  const hasExpected = line.expected_kg !== null && line.expected_kg !== undefined
  const hasReal = line.real_kg !== null && line.real_kg !== undefined

  return (
    <div style={{
      padding: 14, borderRadius: TOKENS.radius.lg,
      background: TOKENS.glass.panel, border: `1px solid ${neutral ? TOKENS.colors.border : `${color}38`}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...typo.body, color: TOKENS.colors.text, margin: 0, fontWeight: 700 }}>{line.line_name}</p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>
            {line.compressor_name}
            {line.compressor_hours === null || line.compressor_hours === undefined
              ? ' · sin bitacora'
              : ` · ${Number(line.compressor_hours).toFixed(1)} h encendido`}
          </p>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: TOKENS.radius.pill, fontSize: 11, fontWeight: 700,
          background: `${color}18`, color, border: `1px solid ${color}38`, whiteSpace: 'nowrap',
        }}>{line.status_label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Cell label="REAL" value={hasReal ? `${formatKg(line.real_kg)} kg` : 'Sin fuente'} />
        <Cell label="ESPERADO" value={hasExpected ? `${formatKg(line.expected_kg)} kg` : 'Sin registro'} />
        <Cell
          label="BRECHA"
          value={line.gap_pct === null || line.gap_pct === undefined
            ? '—'
            : `${line.gap_pct > 0 ? '+' : ''}${Number(line.gap_pct).toFixed(1)}%`}
          color={line.gap_pct === null || line.gap_pct === undefined ? null : color}
        />
      </div>

      {line.expected_kg_by_cycles !== null && line.expected_kg_by_cycles !== undefined && (
        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>
          Cross-check por ciclos posibles: {formatKg(line.expected_kg_by_cycles)} kg
        </p>
      )}

      {(line.machines_missing_capacity || []).length > 0 && (
        <p style={{ ...typo.caption, color: TOKENS.colors.warning, margin: 0 }}>
          &#x26A0; No suma al esperado: {line.machines_missing_capacity.map(m => m.name).join(', ')} (sin capacidad configurada)
        </p>
      )}
    </div>
  )
}

function RolitoCyclesCard({ kpi, typo }) {
  if (!kpi.cycles_measured) {
    return (
      <div style={{
        marginTop: 10, padding: 12, borderRadius: TOKENS.radius.md,
        background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
      }}>
        <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>
          Ciclos Rolito: sin ciclos medidos en este turno.
        </span>
      </div>
    )
  }

  const outOfRange = kpi.out_of_range || []
  return (
    <div style={{
      marginTop: 10, padding: 14, borderRadius: TOKENS.radius.lg,
      background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ ...typo.caption, color: TOKENS.colors.textSoft, margin: 0, fontWeight: 700, flex: 1 }}>
          Ciclos Rolito
        </p>
        <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>
          objetivo {kpi.target_min_minutes}–{kpi.target_max_minutes} min
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        <Cell label="PROMEDIO" value={`${Number(kpi.avg_minutes).toFixed(0)} min`} />
        <Cell label="EN RANGO" value={String(kpi.in_target)} color={TOKENS.colors.success} />
        <Cell label="CORTOS" value={String(kpi.below_target)} color={kpi.below_target ? TOKENS.colors.warning : null} />
        <Cell label="LARGOS" value={String(kpi.above_target)} color={kpi.above_target ? TOKENS.colors.error : null} />
      </div>

      {outOfRange.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {outOfRange.slice(0, 5).map((cycle) => (
            <span key={cycle.cycle_id} style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>
              Ciclo {cycle.cycle_number || cycle.cycle_id}: {Number(cycle.minutes).toFixed(0)} min ({cycle.bucket === 'arriba' ? 'largo' : 'corto'})
            </span>
          ))}
          {outOfRange.length > 5 && (
            <span style={{ ...typo.caption, color: TOKENS.colors.textMuted, fontStyle: 'italic' }}>
              +{outOfRange.length - 5} ciclo(s) mas fuera de rango
            </span>
          )}
        </div>
      )}
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

function formatKg(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX', { maximumFractionDigits: 0 })
}
