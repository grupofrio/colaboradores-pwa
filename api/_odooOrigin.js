const PRODUCTION_ODOO_HOSTS = new Set([
  'grupofrio.odoo.com',
  'www.grupofrio.odoo.com',
  'grupofrio-gf.odoo.com',
])
const STAGING_ODOO_HOST = /^grupofrio-gf-staging280826-\d+\.dev\.odoo\.com$/

export class StagingOriginError extends Error {
  constructor(message = 'Backend staging no configurado.') {
    super(message)
    this.name = 'StagingOriginError'
    this.status = 503
  }
}

export function hostnameOf(origin) {
  try {
    return new URL(String(origin || '')).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function isProductionOdooOrigin(origin) {
  return PRODUCTION_ODOO_HOSTS.has(hostnameOf(origin))
}

function normalizeOdooOrigin(origin) {
  return String(origin || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/odoo$/i, '')
}

export function isIsolatedStagingOdooOrigin(origin, authorizedOrigin) {
  const normalized = normalizeOdooOrigin(origin)
  const authorized = normalizeOdooOrigin(authorizedOrigin)
  if (!normalized || normalized !== authorized || isProductionOdooOrigin(normalized)) return false

  try {
    const url = new URL(normalized)
    return (
      url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.port
      && (url.pathname === '' || url.pathname === '/')
      && !url.search
      && !url.hash
      && STAGING_ODOO_HOST.test(url.hostname.toLowerCase())
    )
  } catch {
    return false
  }
}

export function mustIsolateFromProduction(env = process.env) {
  const runtime = String(env.GF_PWA_RUNTIME || env.VITE_GF_PWA_RUNTIME || '').trim().toLowerCase()
  const vercelEnv = String(env.VERCEL_ENV || env.VITE_VERCEL_ENV || '').trim().toLowerCase()
  const project = String(env.VERCEL_PROJECT_NAME || '').trim().toLowerCase()
  return (
    runtime === 'staging'
    || runtime === 'preview'
    || vercelEnv === 'preview'
    || project.includes('staging')
  )
}

export function resolveOdooOrigin(env = process.env) {
  const explicit = normalizeOdooOrigin(env.ODOO_ORIGIN)
  if (mustIsolateFromProduction(env)) {
    const authorized = normalizeOdooOrigin(env.GF_ALLOWED_ODOO_ORIGIN)
    if (!isIsolatedStagingOdooOrigin(explicit, authorized)) {
      throw new StagingOriginError(
        'Frontend staging/preview requiere el origen exacto autorizado de Odoo staging.',
      )
    }
    return explicit
  }
  return explicit || 'https://grupofrio-gf.odoo.com'
}

export function resolveEmployeeSignInUrl(env = process.env) {
  return `${resolveOdooOrigin(env)}/api/employee-sign-in`
}
