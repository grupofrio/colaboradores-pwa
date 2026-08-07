import { MAX_SELECTED_TICKETS } from './salesHistoryApi.js'

function positiveId(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0
}

function finiteAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function snapshot(order) {
  const id = positiveId(order?.id)
  return id ? { id, amount_total: finiteAmount(order?.amount_total) } : null
}

function normalizeSelection(selectedSnapshots) {
  const unique = new Map()
  for (const selected of Array.isArray(selectedSnapshots) ? selectedSnapshots : []) {
    const item = snapshot(selected)
    if (!item || unique.has(item.id) || unique.size >= MAX_SELECTED_TICKETS) continue
    unique.set(item.id, item)
  }
  return [...unique.values()]
}

export function toggleOrderSelection(selectedSnapshots, order) {
  const selected = normalizeSelection(selectedSnapshots)
  const item = snapshot(order)
  if (!item) return selected
  if (selected.some(({ id }) => id === item.id)) return selected.filter(({ id }) => id !== item.id)
  return selected.length >= MAX_SELECTED_TICKETS ? selected : [...selected, item]
}

export function togglePageSelection(selectedSnapshots, pageOrders, checked) {
  const selected = normalizeSelection(selectedSnapshots)
  const page = normalizeSelection(pageOrders)
  if (!checked) {
    const pageIds = new Set(page.map(({ id }) => id))
    return selected.filter(({ id }) => !pageIds.has(id))
  }

  const selectedIds = new Set(selected.map(({ id }) => id))
  for (const item of page) {
    if (selectedIds.has(item.id) || selected.length >= MAX_SELECTED_TICKETS) continue
    selected.push(item)
    selectedIds.add(item.id)
  }
  return selected
}

export function selectedAmount(selectedSnapshots) {
  return normalizeSelection(selectedSnapshots)
    .reduce((total, { amount_total: amount }) => total + amount, 0)
}

export function isSelectionAtLimit(selectedSnapshots) {
  return normalizeSelection(selectedSnapshots).length >= MAX_SELECTED_TICKETS
}
