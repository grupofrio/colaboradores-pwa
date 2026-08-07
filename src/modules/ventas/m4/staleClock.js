import { isRunStale } from './contract.js'

export const M4_STALE_REFRESH_MS = 60_000

export function getM4RunAgeDays(run, nowMs = Date.now()) {
  const finishedMs = Date.parse(run?.finished_at ?? '')
  if (!Number.isFinite(finishedMs) || !Number.isFinite(nowMs)) return null
  return Math.max((nowMs - finishedMs) / 86_400_000, 0)
}

export function isM4PayloadStale(payload, nowMs = Date.now()) {
  if (payload?.stale === true) return true
  return isRunStale(payload?.run, new Date(nowMs).toISOString())
}

export function getM4PayloadAgeDays(payload, nowMs = Date.now()) {
  const localAge = getM4RunAgeDays(payload?.run, nowMs)
  const backendAge = Number(payload?.age_days)
  const ages = [localAge, backendAge].filter((age) => Number.isFinite(age) && age >= 0)
  return ages.length ? Math.max(...ages) : null
}

export function buildM4EffectivePayload(payload, staleState = {}) {
  if (!payload || typeof payload !== 'object') return payload
  const stale = payload.stale === true || staleState.stale === true
  const ages = [payload.age_days, staleState.ageDays]
    .filter((age) => Number.isFinite(Number(age)) && Number(age) >= 0)
    .map(Number)
  const maxAge = ages.length ? Math.max(...ages) : null
  const ageDays = maxAge == null ? null : (stale ? Math.ceil(maxAge) : Math.floor(maxAge))
  return {
    ...payload,
    stale,
    age_days: ageDays,
    run: {
      ...payload.run,
      technical_state: stale ? 'STALE' : payload.run?.technical_state,
    },
  }
}

export function startM4StaleMonitor(payload, {
  onChange,
  now = Date.now,
  schedule = setInterval,
  cancel = clearInterval,
  intervalMs = M4_STALE_REFRESH_MS,
} = {}) {
  const tick = () => {
    const nowMs = now()
    onChange?.({
      stale: isM4PayloadStale(payload, nowMs),
      ageDays: getM4PayloadAgeDays(payload, nowMs),
      nowMs,
    })
  }
  tick()
  const timerId = schedule(tick, Math.min(Math.max(intervalMs, 1_000), M4_STALE_REFRESH_MS))
  return () => cancel(timerId)
}
