export function extractOpeningStateSnapshot(res) {
  if (res?.result?.data) return res.result.data
  if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data
  return res
}

export function resolveOpeningReadySlotCount({ openingState = null, tankData = null } = {}) {
  const operations = openingState?.operations
  if (operations && Object.prototype.hasOwnProperty.call(operations, 'ready_slot_count')) {
    const readySlotCount = Number(operations.ready_slot_count)
    return Number.isFinite(readySlotCount) ? readySlotCount : 0
  }

  const tankReadySlotsCount = Number(tankData?.ready_slots_count || 0)
  return Number.isFinite(tankReadySlotsCount) ? tankReadySlotsCount : 0
}
