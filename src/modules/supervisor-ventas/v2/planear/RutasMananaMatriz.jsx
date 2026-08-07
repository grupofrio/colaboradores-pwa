// ─── Supervisor V2 · Matriz semanal de cumplimiento (portada de Mis rutas de
//     mañana) ─────────────────────────────────────────────────────────────────
// Filas = subpolígono/ruta de la sucursal; columnas = Lun…Dom (cumplimiento del
// día) + "Mañana" (asignada/sin asignar → entra al flujo de armar/asignar).
// Diagnóstico → acción. Tema claro, AA, semáforo en palabra+color. null≠0:
// "sin ruta" es gris neutro, no 0%. Escopo lo impone el backend (token).
import { useCallback, useEffect, useState } from 'react'

import { BRAND_TOKENS as T } from '../../../../theme/brandTokens'
import StateScreen from '../../../../components/kold/StateScreen'
import { logScreenError } from '../../../shared/logScreenError'
import { getRoutesWeek } from '../../api'
import { weekdayLabel, toneWord, cellLabel, cellTone, isCurrentDay, todayFromTomorrow, tomorrowSummary, rowName, rowRouteId, rowZone, TYPE_SHORT } from './routesWeekModel'

const C = T.colors
const R = T.radius
const TONE_COLOR = { ok: C.success, watch: C.warning, bad: C.error, none: C.textMuted, today: C.blue3, planned: C.textSoft }
// Chip de tipo de plan operativo (color + palabra; el color solo no basta, AA).
const TYPE_TONE = { SO: C.blue3, SP: C.text, P: '#7c3aed' }

function TypeChip({ tipo }) {
  const fg = TYPE_TONE[tipo] || C.textMuted
  return (
    <span data-testid="rw-tipo" data-tipo={tipo} style={{
      fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: R.pill,
      color: fg, border: `1px solid ${fg}`, background: 'transparent', whiteSpace: 'nowrap',
    }}>{TYPE_SHORT[tipo] || 'Plan'}</span>
  )
}

function DayCell({ cell, todayIso }) {
  // El día EN CURSO no emite veredicto: la jornada no ha terminado.
  const tone = cellTone(cell, todayIso)
  const color = TONE_COLOR[tone] || C.textMuted
  const has = cell?.has_plan
  return (
    <td data-testid="rw-cell" data-tone={tone} data-today={isCurrentDay(cell, todayIso) ? '1' : undefined}
      style={{ textAlign: 'center', padding: '6px 4px', borderTop: `1px solid ${C.border}` }}>
      <div
        title={toneWord(tone)}
        style={{
          width: 42, height: 42, margin: '0 auto', borderRadius: '50%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${has ? color : C.border}`,
          background: has ? 'transparent' : 'rgba(15,42,61,0.03)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: has ? C.text : C.textMuted }}>{cellLabel(cell)}</span>
      </div>
      {/* palabra del semáforo: el color solo no basta */}
      <span style={{ fontSize: 8.5, fontWeight: 700, color }}>{toneWord(tone)}</span>
    </td>
  )
}

function TomorrowCell({ row, onOpen }) {
  const s = tomorrowSummary(row?.tomorrow)
  return (
    <td data-testid="rw-tomorrow" style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, minWidth: 150 }}>
      {s.assigned ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <span data-testid="rw-assigned" style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{s.text}</span>
          <button type="button" data-testid="rw-reasignar" onClick={() => onOpen(row)}
            style={{ minHeight: 32, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.blue3, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
            Reasignar
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          <span data-testid="rw-unassigned" style={{ fontSize: 11, fontWeight: 700, color: C.warning }}>⚑ Sin asignar</span>
          <button type="button" data-testid="rw-asignar" onClick={() => onOpen(row)}
            style={{ minHeight: 32, borderRadius: R.md, border: 'none', background: C.blue, color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
            Asignar →
          </button>
        </div>
      )}
    </td>
  )
}

export default function RutasMananaMatriz({ onOpenRoute }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(() => {
    let cancelled = false
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading' }))
    getRoutesWeek()
      .then((res) => {
        if (cancelled) return
        const d = res?.rows ? res : (res?.data || null)
        if (!d || !Array.isArray(d.rows) || !d.week) { setState({ status: 'error', data: null, error: String(res?.code || 'RESPUESTA_SIN_MATRIZ') }); return }
        setState({ status: 'ready', data: d, error: null })
      })
      .catch((e) => { if (!cancelled) { logScreenError('RutasMananaMatriz', 'getRoutesWeek', e); setState({ status: 'error', data: null, error: String(e?.code || e?.message || e) }) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => load(), [load])

  const open = (row) => onOpenRoute && onOpenRoute(rowRouteId(row), rowZone(row))

  const shell = (children) => (
    <div data-testid="rutas-manana-matriz" data-theme="brand-light" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>Mis planes de mañana</h1>
        <p style={{ fontSize: 12.5, color: C.textMuted, margin: '2px 0 0' }}>
          Cumplimiento de la semana por plan operativo. Asigna y publica el de mañana.
        </p>
      </div>
      {children}
    </div>
  )

  if (state.status === 'loading') {
    return shell(<div style={{ fontSize: 13, color: C.textMuted }}>Cargando la semana…</div>)
  }
  if (state.status === 'error') {
    return shell(
      <StateScreen tokens={T} tone="error" testid="rutas-manana-error"
        title="No se pudo cargar la semana" detail={`El servidor respondió ${state.error}.`}
        actionLabel="Reintentar" onAction={load} />,
    )
  }

  const { data } = state
  if (data.rows.length === 0) {
    return shell(
      <StateScreen tokens={T} testid="rutas-manana-vacio"
        title="Sin planes operativos en tu sucursal" detail="Aún no hay planes operativos (segmentos, subpolígonos o polígonos) asignados a tu sucursal." />,
    )
  }

  const days = data.week.days || []
  // Jornada EN CURSO derivada del servidor (tomorrow − 1 día, tz de la sucursal),
  // nunca del reloj del navegador. Su celda no emite veredicto.
  const todayIso = todayFromTomorrow(data.tomorrow)
  return shell(
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: R.lg, background: C.surface }}>
      <table data-testid="rw-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, position: 'sticky', left: 0, background: C.surface }}>Plan operativo</th>
            {days.map((d) => (
              <th key={d} style={{ textAlign: 'center', padding: '10px 4px', fontSize: 10.5, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap' }}>{weekdayLabel(d)}</th>
            ))}
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>Mañana</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.key} data-testid="rw-row">
              <td style={{ padding: '6px 10px', borderTop: `1px solid ${C.border}`, position: 'sticky', left: 0, background: C.surface, minWidth: 150 }}>
                <div style={{ marginBottom: 2 }}><TypeChip tipo={row.tipo} /></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{rowName(row)}</div>
                {row.weekly_coverage_pct != null && (
                  <div style={{ fontSize: 10.5, color: C.textMuted }}>Semana: {row.weekly_coverage_pct}%</div>
                )}
              </td>
              {(row.days || []).map((cell) => <DayCell key={cell.date} cell={cell} todayIso={todayIso} />)}
              <TomorrowCell row={row} onOpen={open} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
  )
}
