// ─── Gerente V2 · Pendientes (tareas + notas, SOLO LECTURA) ──────────────────
// El gerente ve las tareas y notas del equipo de su sucursal en modo lectura: la
// creación/edición es exclusiva del supervisor (guard de escritura, del que el
// gerente está excluido a propósito). Aquí no hay acciones de escritura.
import { useCallback, useEffect, useState } from 'react'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { getGerentePendientes } from '../../api'

const C = TOKENS.colors

const STATE_LABEL = {
  todo: 'Por hacer', in_progress: 'En curso', done: 'Hecha',
  blocked: 'Bloqueada', cancelled: 'Cancelada',
}
const PRIORITY_TONE = { high: C.error, urgent: C.error, medium: C.warning, low: C.textMuted }

const fmtDate = (d) => {
  if (!d) return null
  const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : String(d).replace(' ', 'T') + 'Z')
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function TaskRow({ t }) {
  const done = t.state === 'done' || t.state === 'cancelled'
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: done ? 0.6 : 1,
    }}>
      <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: PRIORITY_TONE[t.priority] || C.border }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{t.name || 'Tarea'}</p>
        <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>
          {t.assignee ? `${t.assignee}` : 'Sin asignar'}
          {t.partner ? ` · ${t.partner}` : ''}
          {t.due_date ? ` · vence ${fmtDate(t.due_date)}` : ''}
        </p>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color: C.blue3, background: C.surfaceStrong,
        borderRadius: TOKENS.radius.pill, padding: '2px 8px', whiteSpace: 'nowrap',
      }}>{STATE_LABEL[t.state] || t.state || '—'}</span>
    </div>
  )
}

export default function PendientesGerenteTab() {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const res = await getGerentePendientes()
      if (!res.ok) { setState({ status: 'error', data: null, error: res.error }); return }
      setState({ status: 'live', data: res.data, error: '' })
    } catch (e) {
      setState({ status: 'error', data: null, error: e?.message || 'No se pudieron cargar los pendientes.' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (state.status === 'loading') return <StateScreen title="Cargando pendientes…" tokens={TOKENS} />
  if (state.status === 'error') {
    return <StateScreen title="No se pudieron cargar los pendientes" detail={state.error} tone="error"
      actionLabel="Reintentar" onAction={load} tokens={TOKENS} />
  }
  const d = state.data
  if (!d || d.available === false) {
    return <StateScreen title="Sin pendientes disponibles"
      detail="No hay equipo con analítica de sucursal para mostrar tareas o notas." tokens={TOKENS} />
  }
  const tasks = d.tasks || []
  const notes = d.notes || []

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
          MI SUCURSAL · PENDIENTES
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>Tareas y notas del equipo</h1>
        <p style={{ fontSize: 11, color: C.textLow, margin: '4px 0 0' }}>
          Solo lectura. La creación y edición las hace el supervisor.
        </p>
      </div>

      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: '0 0 8px' }}>
        TAREAS ({tasks.length})
      </p>
      {tasks.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 18px' }}>Sin tareas del equipo.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {tasks.map((t) => <TaskRow key={t.id} t={t} />)}
        </div>
      )}

      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: '0 0 8px' }}>
        NOTAS ({notes.length})
      </p>
      {notes.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Sin notas del equipo.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n) => (
            <div key={n.id} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, padding: '10px 14px',
            }}>
              <p style={{ fontSize: 13, color: C.text, margin: 0, whiteSpace: 'pre-wrap' }}>{n.body}</p>
              <p style={{ fontSize: 11, color: C.textMuted, margin: '4px 0 0' }}>
                {[n.author, n.employee, n.partner].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
