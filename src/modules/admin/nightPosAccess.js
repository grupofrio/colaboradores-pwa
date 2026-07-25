import { isValidAuthenticatedSession } from '../../lib/session.js'

function tokenize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function hasHectorTapiaIdentity(session = {}) {
  const candidates = [
    session?.name,
    session?.display_name,
    session?.employee?.name,
  ]

  return candidates.some((candidate) => {
    const tokens = tokenize(candidate)
    return tokens.includes('hector') && tokens.includes('tapia')
  })
}

export function canAccessHectorNightPos(session = {}) {
  return isValidAuthenticatedSession(session) && hasHectorTapiaIdentity(session)
}
