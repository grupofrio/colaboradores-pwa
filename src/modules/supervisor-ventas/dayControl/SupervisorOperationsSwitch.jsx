import StateScreen from '../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../theme/brandTokens'

function SafeSupervisorState({ state, onRetry }) {
  const retryable = state?.retryable === true
  return (
    <StateScreen tokens={BRAND_TOKENS}
      title={state?.title || 'No pudimos mostrar la operación'}
      detail={state?.detail || 'Intenta nuevamente.'}
      tone={state?.kind === 'error' || state?.kind === 'invalid_contract'
        ? 'error'
        : 'neutral'}
      actionLabel={retryable ? 'Reintentar' : undefined}
      onAction={retryable ? onRetry : undefined}
    />
  )
}

export function SupervisorOperationsSwitch({
  todayState,
  yesterdayState,
  activeDay,
  onSelectDay,
  onRefresh,
  LegacyComponent,
  OperationsComponent,
}) {
  if (todayState?.kind === 'disabled' && LegacyComponent) {
    return <LegacyComponent />
  }

  if (
    (todayState?.kind === 'valid' || todayState?.kind === 'empty')
    && OperationsComponent
  ) {
    return (
      <OperationsComponent
        todayState={todayState}
        yesterdayState={yesterdayState}
        activeDay={activeDay}
        onSelectDay={onSelectDay}
        onRefresh={onRefresh}
      />
    )
  }

  return <SafeSupervisorState state={todayState} onRetry={onRefresh} />
}

export default SupervisorOperationsSwitch
