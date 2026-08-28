import { resolveOdooOrigin, StagingOriginError } from './_odooOrigin.js'

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/

export class PwaProxyError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'PwaProxyError'
    this.status = status
  }
}

function normalizedPath(path) {
  if (!Array.isArray(path) || path.length < 2 || path[0] !== 'pwa-admin') {
    throw new PwaProxyError('Ruta PWA no disponible.', 404)
  }

  if (!path.every((segment) => typeof segment === 'string' && PATH_SEGMENT.test(segment))) {
    throw new PwaProxyError('Ruta PWA no disponible.', 404)
  }

  return path.join('/')
}

export function buildOdooPwaRequest({
  path,
  method,
  query = '',
  employeeToken,
  serviceApiKey,
  odooOrigin,
  env = process.env,
}) {
  const normalizedMethod = String(method || '').toUpperCase()
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    throw new PwaProxyError('Método no permitido.', 405)
  }

  const normalizedEmployeeToken = String(employeeToken || '').trim()
  if (!normalizedEmployeeToken) {
    throw new PwaProxyError('Sesión de empleado requerida.', 401)
  }

  const normalizedServiceApiKey = String(serviceApiKey || '').trim()
  if (!normalizedServiceApiKey) {
    throw new PwaProxyError('Servicio temporalmente no disponible.', 503)
  }

  let origin
  try {
    origin = odooOrigin || resolveOdooOrigin(env)
  } catch (error) {
    if (error instanceof StagingOriginError) {
      throw new PwaProxyError(error.message, error.status)
    }
    throw error
  }

  const urlPath = normalizedPath(path)
  const normalizedQuery = String(query || '').replace(/^\?/, '')
  return {
    method: normalizedMethod,
    url: `${origin}/${urlPath}${normalizedQuery ? `?${normalizedQuery}` : ''}`,
    headers: {
      Accept: 'application/json',
      'Api-Key': normalizedServiceApiKey,
      'X-GF-Employee-Token': normalizedEmployeeToken,
    },
  }
}
