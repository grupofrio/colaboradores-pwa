export const MORE_SHEET_HISTORY_KEY = 'gf_more_sheet_open'

export function pushTransientHistoryEntry(history, markerKey) {
  const currentState = history?.state && typeof history.state === 'object'
    ? history.state
    : {}
  history.pushState({ ...currentState, [markerKey]: true }, '')
}

export function consumeTransientHistoryEntry(history, markerKey) {
  if (history?.state?.[markerKey] !== true) return false
  history.back()
  return true
}
