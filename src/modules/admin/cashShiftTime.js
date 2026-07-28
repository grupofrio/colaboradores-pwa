const WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/

function wallTimeParts(value) {
  const match = String(value || '').match(WALL_TIME_PATTERN)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number)
  const second = Number(match[6] ?? 0)
  const semantic = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (
    semantic.getUTCFullYear() !== year
    || semantic.getUTCMonth() !== month - 1
    || semantic.getUTCDate() !== day
    || semantic.getUTCHours() !== hour
    || semantic.getUTCMinutes() !== minute
    || semantic.getUTCSeconds() !== second
  ) return null
  return { year, month, day, hour, minute, second }
}

function formatterFor(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
  } catch {
    return null
  }
}

function representedWallTimeMs(formatter, instant) {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  )
  return Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
}

export function zonedWallTimeToUtcMs(value, timeZone) {
  const desired = wallTimeParts(value)
  const formatter = formatterFor(timeZone)
  if (!desired || !formatter) return Number.NaN
  const target = Date.UTC(
    desired.year, desired.month - 1, desired.day,
    desired.hour, desired.minute, desired.second,
  )
  let instant = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const correction = target - representedWallTimeMs(formatter, instant)
    instant += correction
    if (correction === 0) break
  }
  return representedWallTimeMs(formatter, instant) === target ? instant : Number.NaN
}

export function durationFromWallTime(value, timeZone, nowMs = Date.now()) {
  const openedAt = zonedWallTimeToUtcMs(value, timeZone)
  if (!Number.isFinite(openedAt) || !Number.isFinite(nowMs)) return 'Duración no disponible'
  const minutes = Math.max(0, Math.floor((nowMs - openedAt) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`
}
