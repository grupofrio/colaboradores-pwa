function keyPart(value, fallback) {
  const text = value === null || value === undefined ? '' : String(value).trim()
  return encodeURIComponent(text || fallback)
}

export function priorityRenderKey(priority) {
  const type = keyPart(priority?.type, 'unknown')
  const entityType = keyPart(priority?.entityType, 'unknown')
  const entityId = priority?.entityId ?? null
  const routeId = priority?.routeId ?? null
  const contractIdentity = entityId !== null || routeId !== null
    ? `entity-${keyPart(entityId, 'none')}:route-${keyPart(routeId, 'none')}`
    : [
        'fallback',
        keyPart(priority?.reason, 'no-reason'),
        keyPart(priority?.occurredAt, 'no-occurrence'),
        keyPart(priority?.dataAsOf, 'no-cut'),
        keyPart(priority?.href, 'no-action'),
        keyPart(priority?.count, 'no-count'),
      ].join(':')
  return `priority:${type}:${entityType}:${contractIdentity}`
}

export function markerRenderKey(marker) {
  return [
    'marker',
    `type-${keyPart(marker?.id, 'unknown')}`,
    `stop-${keyPart(marker?.stopId, 'route')}`,
    `recorded-${keyPart(marker?.recordedAt, 'no-time')}`,
    `name-${keyPart(marker?.name, 'unnamed')}`,
  ].join(':')
}

export function uniqueRenderEntries(items, keyFor) {
  const occurrences = new Map()
  return items.map((item) => {
    const baseKey = keyFor(item)
    const occurrence = (occurrences.get(baseKey) || 0) + 1
    occurrences.set(baseKey, occurrence)
    return {
      item,
      key: occurrence === 1 ? baseKey : `${baseKey}:duplicate-${occurrence}`,
    }
  })
}
