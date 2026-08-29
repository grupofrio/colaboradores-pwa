const PRODUCTION_ODOO_HOSTS = new Set([
  'grupofrio.odoo.com',
  'www.grupofrio.odoo.com',
  'grupofrio-gf.odoo.com',
])

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

export function isIsolatedStagingOdooOrigin(origin) {
  const host = hostnameOf(origin)
  if (!host || isProductionOdooOrigin(origin)) return false
  return host.endsWith('.dev.odoo.com') && host.includes('staging')
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
  const explicit = String(env.ODOO_ORIGIN || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/odoo$/i, '')
  if (mustIsolateFromProduction(env)) {
    if (!isIsolatedStagingOdooOrigin(explicit)) {
      throw new StagingOriginError(
        'Frontend staging/preview no puede usar el backend de producción.',
      )
    }
    return explicit
  }
  return explicit || 'https://grupofrio-gf.odoo.com'
}

export function resolveEmployeeSignInUrl(env = process.env) {
  return `${resolveOdooOrigin(env)}/api/employee-sign-in`
}
