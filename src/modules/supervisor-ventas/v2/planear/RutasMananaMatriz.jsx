// ─── Supervisor V2 · Matriz semanal de cumplimiento (portada de Mis rutas de
//     mañana) ─────────────────────────────────────────────────────────────────
// Tablero de control semanal + guía de planeación de mañana. Filas = planes
// operativos curados (SO/SP/P, N dinámico). null ≠ 0. Escopo: token/backend.
import { useCallback, useEffect, useMemo, useState } from 'react'

import { BRAND_TOKENS as T } from '../../../../theme/brandTokens'
import StateScreen from '../../../../components/kold/StateScreen'
import { logScreenError } from '../../../shared/logScreenError'
import { getRoutesWeek } from '../../api'
import {
  weekdayLabel, toneWord, cellLabel, cellTone, isCurrentDay, todayFromTomorrow,
  tomorrowSummary, rowName, rowRouteId, rowRequiresRouteSelection, rowZone, TYPE_SHORT,
  executiveSummary, actionPhrase, pendingBreakdown, formatCount, cellAssignmentLine,
  filterMatrixRows, toggleOperationalSelection, tomorrowAction,
} from './routesWeekModel'

const C = T.colors
const R = T.radius
const TONE_COLOR = { ok: C.success, watch: C.warning, bad: C.error, none: C.textMuted, today: C.blue3, planned: C.textSoft }
const TYPE_TONE = { SO: C.blue3, SP: C.text, P: '#7c3aed' }
const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending_tomorrow', label: 'Pendientes mañana' }, // rw-filter-pending_tomorrow
  { id: 'ready_tomorrow', label: 'Listos mañana' },
  { id: 'SO', label: 'SO' },
  { id: 'SP', label: 'SP' },
  { id: 'P', label: 'P' },
  { id: 'week_gaps', label: 'Con huecos esta semana' },
]

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
  const tone = cellTone(cell, todayIso)
  const color = TONE_COLOR[tone] || C.textMuted
  const has = cell?.has_plan
  const assign = cellAssignmentLine(cell)
  return (
    <td data-testid="rw-cell" data-tone={tone} data-assign={cell?.assignment_state || 'no_plan'}
      data-today={isCurrentDay(cell, todayIso) ? '1' : undefined}
      style={{ textAlign: 'center', padding: '6px 4px', borderTop: `1px solid ${C.border}`, minWidth: 56 }}>
      <div
        title={`${toneWord(tone)} · ${assign}`}
        style={{
          minWidth: 52, minHeight: 52, margin: '0 auto', borderRadius: 10, padding: '4px 2px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          border: `2px solid ${has ? color : C.border}`,
          background: has ? 'transparent' : 'rgba(15,42,61,0.03)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: has ? C.text : C.textMuted }}>{cellLabel(cell)}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color }}>{toneWord(tone)}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: C.textMuted }}>{assign}</span>
      </div>
    </td>
  )
}

function TomorrowCell({ row, onOpen }) {
  const s = tomorrowSummary(row?.tomorrow)
  const multi = rowRequiresRouteSelection(row)
  const action = tomorrowAction(row)
  const t = row?.tomorrow || {}
  return (
    <td data-testid="rw-tomorrow" data-assign={action.state}
      style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, minWidth: 168, position: 'sticky', right: 0, background: C.surface, boxShadow: '-8px 0 8px rgba(15,42,61,0.04)' }}>
      {multi ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <span data-testid="rw-varias-rutas" style={{ fontSize: 11, fontWeight: 700, color: C.blue3 }}>Varias rutas mañana</span>
          <button type="button" data-testid="rw-elegir-ruta" onClick={() => onOpen(row)}
            style={{ minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.blue3, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Elegir ruta
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          <span data-testid={t.assigned ? 'rw-assigned' : 'rw-unassigned'}
            style={{ fontSize: 11, fontWeight: 700, color: t.assigned ? C.success : C.warning }}>
            {action.label}
          </span>
          {s.assigned && (
            <span style={{ fontSize: 10.5, color: C.text, fontWeight: 600 }}>{s.text}</span>
          )}
          {t.stops_planned != null && (
            <span style={{ fontSize: 10.5, color: C.textMuted }}>{t.stops_planned} clientes</span>
          )}
          <button type="button" data-testid={action.testid || (t.assigned ? 'rw-reasignar' : 'rw-asignar')} onClick={() => onOpen(row)}
            style={{
              minHeight: 44, borderRadius: R.md, cursor: 'pointer', fontSize: 12, fontWeight: 800,
              border: t.assigned ? `1px solid ${C.border}` : 'none',
              background: t.assigned ? C.surface : C.blue,
              color: t.assigned ? C.blue3 : '#fff',
            }}>
            {action.cta}
          </button>
        </div>
      )}
    </td>
  )
}

export default function RutasMananaMatriz({ onOpenRoute, onArmarSources }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState([])
  const [selectError, setSelectError] = useState(null)

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

  const summary = useMemo(() => executiveSummary(state.data || {}), [state.data])
  const visibleRows = useMemo(
    () => filterMatrixRows(state.data?.rows || [], filter),
    [state.data, filter],
  )
  const breakdown = pendingBreakdown(summary)
  const tomorrowHuman = useMemo(() => {
    if (!state.data?.tomorrow) return null
    try {
      const [y, m, d] = String(state.data.tomorrow).split('-').map(Number)
      return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        .format(new Date(y, m - 1, d, 12, 0, 0))
    } catch { return state.data.tomorrow }
  }, [state.data])

  const open = (row) => onOpenRoute && onOpenRoute(rowRouteId(row), rowZone(row), [row])
  const toggleRow = (row) => {
    const next = toggleOperationalSelection(selected, row)
    setSelected(next.selected)
    setSelectError(next.error)
  }
  const armarSelected = () => {
    if (!selected.length) return
    if (onArmarSources) onArmarSources(selected)
    else {
      const first = selected[0]
      const row = (state.data?.rows || []).find((r) => r.key === first.key)
      if (row) open(row)
    }
  }

  const shell = (children) => (
    <div data-testid="rutas-manana-matriz" data-theme="brand-light" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>Mis planes de mañana</h1>
        <p style={{ fontSize: 12.5, color: C.textMuted, margin: '2px 0 0' }}>
          {tomorrowHuman ? tomorrowHuman.charAt(0).toUpperCase() + tomorrowHuman.slice(1) : 'Cumplimiento de la semana por plan operativo. Asigna y publica el de mañana.'}
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
  const todayIso = todayFromTomorrow(data.tomorrow)
  const totalLabel = formatCount(summary.total)
  return shell(
    <>
      <div data-testid="rw-resumen" style={{
        display: 'grid', gap: 10, padding: 14, border: `1px solid ${C.border}`,
        borderRadius: R.lg, background: C.surface,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
          {totalLabel} planes operativos
          {(summary.SO != null || summary.SP != null || summary.P != null) && (
            <span style={{ fontWeight: 600, color: C.textMuted }}>
              {' '}· {formatCount(summary.SO)} SO · {formatCount(summary.SP)} SP · {formatCount(summary.P)} P
            </span>
          )}
        </div>
        <p data-testid="rw-faltan" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>
          {actionPhrase(summary)}
        </p>
        {breakdown.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.text }}>
            {breakdown.map((b) => <li key={b.text}>{b.n} {b.text}</li>)}
          </ul>
        )}
        <div data-testid="rw-checklist" style={{ display: 'grid', gap: 4, fontSize: 12.5, color: C.text }}>
          <div>PREPARACIÓN DE MAÑANA</div>
          <div>✓ {formatCount(summary.total)} planes operativos detectados</div>
          <div>{summary.noPlan === 0 ? '✓' : '⚠'} {formatCount(summary.total != null && summary.noPlan != null ? summary.total - summary.noPlan : null)} tienen ruta · {formatCount(summary.noPlan)} por preparar</div>
          <div>{summary.incomplete === 0 ? '✓' : '⚠'} {formatCount(summary.incomplete)} requieren recursos</div>
          <div>{summary.published != null && summary.published > 0 ? '✓' : '⚠'} {formatCount(summary.published)} publicados · {formatCount(summary.pending)} pendientes</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.textMuted }}>
          SEMANA · {formatCount(summary.weekGaps)} planes con algún día sin ruta
          {summary.coverage != null ? ` · ${summary.coverage}% cobertura promedio` : ' · cobertura: Sin dato'}
        </div>
      </div>

      <div data-testid="rw-filtros" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" data-testid={`rw-filter-${f.id}`} onClick={() => setFilter(f.id)}
            style={{
              minHeight: 44, padding: '0 12px', borderRadius: R.pill, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: `1px solid ${filter === f.id ? C.blue : C.border}`,
              background: filter === f.id ? C.blue : C.surface,
              color: filter === f.id ? '#fff' : C.text,
            }}>{f.label}</button>
        ))}
      </div>

      {selectError && (
        <div data-testid="rw-select-error" role="alert" style={{
          padding: '10px 12px', borderRadius: R.md, background: C.warningSoft, color: C.warning, fontWeight: 700, fontSize: 13,
        }}>{selectError}</div>
      )}

      {selected.length > 0 && (
        <div data-testid="rw-armar-bar" style={{
          position: 'sticky', top: 0, zIndex: 4, display: 'grid', gap: 8,
          padding: 12, borderRadius: R.lg, border: `1px solid ${C.blue}`, background: C.surface,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{selected.length} {selected.length === 1 ? 'plan seleccionado' : 'planes seleccionados'}</div>
          <div style={{ fontSize: 12.5, color: C.text }}>{selected.map((s) => s.name).join(' + ')}</div>
          <button type="button" data-testid="rw-armar-ruta" onClick={armarSelected}
            style={{ minHeight: 44, border: 'none', borderRadius: R.md, background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
            Armar una ruta
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: R.lg, background: C.surface }}>
        <table data-testid="rw-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, position: 'sticky', left: 0, background: C.surface, zIndex: 2, minWidth: 188 }}>Plan operativo</th>
              {days.map((d) => (
                <th key={d} style={{ textAlign: 'center', padding: '10px 4px', fontSize: 10.5, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap' }}>{weekdayLabel(d)}</th>
              ))}
              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.blue3, position: 'sticky', right: 0, background: C.surface, zIndex: 2 }}>Mañana</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const on = selected.some((s) => s.key === row.key)
              return (
                <tr key={row.key} data-testid="rw-row" data-selected={on ? '1' : '0'}>
                  <td style={{ padding: '6px 10px', borderTop: `1px solid ${C.border}`, position: 'sticky', left: 0, background: on ? 'rgba(0,119,187,0.06)' : C.surface, minWidth: 188, zIndex: 1 }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        data-testid="rw-select"
                        checked={on}
                        onChange={() => toggleRow(row)}
                        style={{ width: 20, height: 20, marginTop: 4, accentColor: C.blue }}
                      />
                      <span>
                        <div style={{ marginBottom: 2 }}><TypeChip tipo={row.tipo} /></div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{rowName(row)}</div>
                        {row.weekly_coverage_pct != null ? (
                          <div style={{ fontSize: 10.5, color: C.textMuted }}>Semana: {row.weekly_coverage_pct}%</div>
                        ) : (
                          <div style={{ fontSize: 10.5, color: C.textMuted }}>Semana: Sin dato</div>
                        )}
                      </span>
                    </label>
                  </td>
                  {(row.days || []).map((cell) => <DayCell key={cell.date} cell={cell} todayIso={todayIso} />)}
                  <TomorrowCell row={row} onOpen={open} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>,
  )
}
