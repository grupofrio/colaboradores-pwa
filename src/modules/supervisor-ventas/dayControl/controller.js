import { previousOperationalDate } from './operationalDate.js'
import { loadDayControlState, stateCopy } from './state.js'

const IDLE = Object.freeze({ kind: 'idle' })

const canLoadYesterday = (state) =>
  state?.kind === 'valid' || state?.kind === 'empty'

export async function loadSupervisorOperationDays({
  requester,
  onToday = () => {},
  onYesterdayLoading = () => {},
}) {
  const today = await loadDayControlState(undefined, requester)
  onToday(today)

  if (!canLoadYesterday(today)) {
    return { today, yesterday: IDLE }
  }

  let yesterdayDate
  try {
    yesterdayDate = previousOperationalDate(today.payload.date)
  } catch {
    return { today, yesterday: stateCopy('date_unavailable') }
  }
  onYesterdayLoading({ kind: 'loading', date: yesterdayDate })
  const yesterday = await loadDayControlState(yesterdayDate, requester)
  return { today, yesterday }
}
