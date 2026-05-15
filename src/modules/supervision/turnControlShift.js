const CLOSED_STATES = new Set(['closed', 'cancelled'])

export function resolveTurnControlShift(fetchedShift, navigatedShift = null) {
  if (fetchedShift?.id) return fetchedShift
  if (!navigatedShift?.id) return null
  return CLOSED_STATES.has(String(navigatedShift.state || '').toLowerCase())
    ? null
    : navigatedShift
}
