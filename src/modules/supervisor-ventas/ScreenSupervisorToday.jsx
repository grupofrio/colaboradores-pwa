import ModuleHeader from '../../components/kold/ModuleHeader'
import StateScreen from '../../components/kold/StateScreen'
import SupervisorDayOverview from './dayControl/SupervisorDayOverview'
import SupervisorQuickActions from './dayControl/SupervisorQuickActions'
import SupervisorRouteOperations from './dayControl/SupervisorRouteOperations'
import { buildDayControlViewModel } from './dayControl/viewModel.js'

const SCREEN_CSS = `
  .supervisor-ops-shell {
    box-sizing: border-box;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    color: #14253c;
  }
  .supervisor-ops-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 12px;
  }
  .supervisor-ops-span-4 { grid-column: span 4; }
  .supervisor-ops-span-8 { grid-column: span 8; }
  .supervisor-ops-span-12 { grid-column: 1 / -1; }
  .supervisor-ops-tabs,
  .supervisor-ops-toolbar,
  .supervisor-ops-quick-actions,
  .supervisor-ops-route-heading,
  .supervisor-ops-priority,
  .supervisor-ops-priority-actions,
  .supervisor-ops-secondary-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .supervisor-ops-toolbar {
    justify-content: space-between;
    margin: 0 0 14px;
  }
  .supervisor-ops-tabs button,
  .supervisor-ops-toolbar button {
    min-height: 44px;
    border: 1px solid #b8c4d6;
    border-radius: 999px;
    padding: 8px 18px;
    background: #ffffff;
    color: #14253c;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .supervisor-ops-tabs button[aria-pressed=true] {
    border-color: #2563eb;
    background: #e9f1ff;
    color: #174ea6;
  }
  .supervisor-ops-card {
    box-sizing: border-box;
    height: 100%;
    border: 1px solid #dce3ec;
    border-radius: 14px;
    padding: 16px;
    background: #ffffff;
  }
  .supervisor-ops-card h2 {
    margin: 0 0 12px;
    font-size: 1rem;
  }
  .supervisor-ops-metric-grid,
  .supervisor-ops-stage-grid,
  .supervisor-ops-route-details {
    display: grid;
    gap: 10px;
  }
  .supervisor-ops-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .supervisor-ops-metric-grid-five,
  .supervisor-ops-stage-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .supervisor-ops-metric {
    min-width: 0;
    border-radius: 10px;
    padding: 10px;
    background: #f6f8fb;
  }
  .supervisor-ops-metric strong,
  .supervisor-ops-label {
    display: block;
  }
  .supervisor-ops-label,
  .supervisor-ops-route-details dt {
    color: #5a6879;
    font-size: 0.78rem;
  }
  .supervisor-ops-unavailable,
  .supervisor-ops-empty-copy,
  .supervisor-ops-note {
    color: #5a6879;
  }
  .supervisor-ops-note {
    margin: 12px 0 0;
    font-size: 0.82rem;
  }
  .supervisor-ops-secondary-row {
    justify-content: space-between;
    margin-top: 10px;
    border-top: 1px solid #edf0f4;
    padding-top: 10px;
  }
  .supervisor-ops-route-operations,
  .supervisor-ops-route-list {
    display: grid;
    gap: 12px;
  }
  .supervisor-ops-priority-list,
  .supervisor-ops-plain-list {
    margin: 0;
    padding-left: 20px;
  }
  .supervisor-ops-priority {
    justify-content: space-between;
    min-height: 44px;
    border-bottom: 1px solid #edf0f4;
    padding: 9px 0;
  }
  .supervisor-ops-priority p {
    margin: 0;
  }
  .supervisor-ops-priority small {
    color: #6b7280;
  }
  .supervisor-ops-count-chip {
    border-radius: 999px;
    padding: 3px 8px;
    background: #fff1d6;
    font-weight: 800;
  }
  .supervisor-ops-card a {
    color: #174ea6;
    font-weight: 700;
  }
  .supervisor-ops-route {
    border: 1px solid #e4e9f0;
    border-radius: 12px;
    padding: 14px;
  }
  .supervisor-ops-route-heading {
    justify-content: space-between;
  }
  .supervisor-ops-route-heading h3,
  .supervisor-ops-route-heading p {
    margin: 0;
  }
  .supervisor-ops-route-heading p {
    margin-top: 3px;
    color: #5a6879;
  }
  .supervisor-ops-route-details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 14px 0;
  }
  .supervisor-ops-route-details div {
    min-width: 0;
  }
  .supervisor-ops-route-details dd {
    margin: 3px 0 0;
  }
  .supervisor-ops-markers {
    border-top: 1px solid #edf0f4;
    padding-top: 10px;
  }
  .supervisor-ops-quick-actions {
    flex-wrap: wrap;
  }
  .supervisor-ops-quick-actions a {
    min-height: 44px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    border: 1px solid #b8c4d6;
    border-radius: 999px;
    padding: 8px 14px;
    text-decoration: none;
  }
  @media (max-width: 760px) {
    .supervisor-ops-shell { padding: 16px; }
    .supervisor-ops-span-4,
    .supervisor-ops-span-8 { grid-column: 1 / -1; }
    .supervisor-ops-metric-grid-five,
    .supervisor-ops-stage-grid,
    .supervisor-ops-route-details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .supervisor-ops-toolbar,
    .supervisor-ops-priority {
      align-items: stretch;
      flex-direction: column;
    }
  }
`

function DayTabs({ selectedDay, onSelectDay }) {
  return (
    <div className="supervisor-ops-tabs" role="group" aria-label="Día operativo">
      <button
        type="button"
        aria-pressed={selectedDay === 'today'}
        onClick={() => onSelectDay?.('today')}
      >
        Hoy
      </button>
      <button
        type="button"
        aria-pressed={selectedDay === 'yesterday'}
        onClick={() => onSelectDay?.('yesterday')}
      >
        Ayer
      </button>
    </div>
  )
}

function SelectedDayState({ state, onRefresh }) {
  const kind = state?.kind
  const retryable = state?.retryable === true
    || kind === 'error'
    || kind === 'invalid_contract'
    || kind === 'date_unavailable'

  if (kind === 'empty') {
    return (
      <StateScreen
        title="No hay rutas para este día"
        detail="No hay operación registrada para la fecha seleccionada."
        actionLabel={onRefresh ? 'Actualizar' : undefined}
        onAction={onRefresh}
      />
    )
  }

  if (!state || kind === 'idle') {
    return (
      <StateScreen
        title="Información no disponible"
        detail="Este día todavía no tiene información para mostrar."
      />
    )
  }

  return (
    <StateScreen
      title={state.title || 'No pudimos mostrar la operación'}
      detail={state.detail || 'Intenta nuevamente.'}
      tone={kind === 'error' || kind === 'invalid_contract' ? 'error' : 'neutral'}
      actionLabel={retryable && onRefresh ? 'Reintentar' : undefined}
      onAction={retryable ? onRefresh : undefined}
    />
  )
}

function ValidDay({ state, nowMs, onRefresh }) {
  const view = buildDayControlViewModel(state.payload)

  return (
    <>
      <ModuleHeader
        title="Operación de hoy"
        subtitle={`${view.header.branch} · ${view.header.date} · ${view.header.timezoneSource}`}
        meta={{
          dataAsOf: view.header.dataAsOf,
          branchScope: view.header.branch,
          source: 'Control diario del servidor',
          companies: [],
          decisionCaveats: [],
          technicalEvidence: {},
        }}
        nowMs={nowMs}
      />
      <div className="supervisor-ops-toolbar">
        <span>Información del día seleccionado</span>
        {onRefresh && (
          <button type="button" onClick={onRefresh}>Actualizar</button>
        )}
      </div>
      <div className="supervisor-ops-grid">
        <div className="supervisor-ops-span-4">
          <SupervisorDayOverview view={view} section="journey" />
        </div>
        <div className="supervisor-ops-span-8">
          <SupervisorRouteOperations
            priorities={view.priorities}
            routes={view.routes}
            routesAvailable={view.capabilities.routes_available}
          />
        </div>
        <div className="supervisor-ops-span-4">
          <SupervisorDayOverview view={view} section="commercial" />
        </div>
        <div className="supervisor-ops-span-8">
          <SupervisorDayOverview view={view} section="closure" />
        </div>
        <div className="supervisor-ops-span-12">
          <SupervisorQuickActions actions={view.quickActions} />
        </div>
      </div>
    </>
  )
}

export default function ScreenSupervisorToday({
  todayState,
  yesterdayState,
  activeDay,
  onSelectDay,
  onRefresh,
  nowMs,
}) {
  const selectedDay = activeDay === 'yesterday' ? 'yesterday' : 'today'
  const activeState = selectedDay === 'yesterday' ? yesterdayState : todayState

  return (
    <main className="supervisor-ops-shell">
      <style>{SCREEN_CSS}</style>
      <div className="supervisor-ops-toolbar">
        <DayTabs selectedDay={selectedDay} onSelectDay={onSelectDay} />
      </div>
      {activeState?.kind === 'valid' ? (
        <ValidDay state={activeState} nowMs={nowMs} onRefresh={onRefresh} />
      ) : (
        <SelectedDayState state={activeState} onRefresh={onRefresh} />
      )}
    </main>
  )
}
