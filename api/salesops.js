import { env as nodeEnv } from 'node:process'

import { resolveOdooOrigin, StagingOriginError, mustIsolateFromProduction } from './_odooOrigin.js'

// Static identifiers so hosting include-lists keep these secrets on the function.
void process.env.GF_SALESOPS_TOKEN
void process.env.GF_SALEOPS_TOKEN

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/

export class SalesOpsProxyError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'SalesOpsProxyError'
    this.status = status
  }
}

function headerValue(headers, name) {
  const found = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return found ? String(found[1] || '').trim() : ''
}

function pathSegments(path) {
  return (Array.isArray(path) ? path : [path])
    .flatMap((entry) => String(entry || '').split('/'))
    .filter(Boolean)
}

function normalizedPath(path) {
  const segments = pathSegments(path)
  if (
    segments.length < 3
    || segments[0] !== 'gf'
    || segments[1] !== 'salesops'
    || !segments.every((segment) => PATH_SEGMENT.test(segment))
  ) {
    throw new SalesOpsProxyError('Ruta SalesOps no disponible.', 404)
  }
  return segments.join('/')
}

function normalizedMethod(method) {
  const value = String(method || '').toUpperCase()
  if (!ALLOWED_METHODS.has(value)) {
    throw new SalesOpsProxyError('Método no permitido.', 405)
  }
  return value
}

function requestQuery(query = {}) {
  const search = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(query)) {
    if (key === 'path' || rawValue === undefined) continue
    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
      if (value !== undefined) search.append(key, String(value))
    }
  }
  return search.toString()
}

export function buildSalesOpsRequest({
  path,
  method,
  query = '',
  employeeToken,
  salesOpsToken,
  authorization,
  accept,
  odooOrigin,
  env = process.env,
}) {
  const normalizedEmployeeToken = String(employeeToken || '').trim()
  if (!normalizedEmployeeToken) {
    throw new SalesOpsProxyError('Sesión de empleado requerida.', 401)
  }

  const normalizedSalesOpsToken = String(salesOpsToken || '').trim()
  if (!normalizedSalesOpsToken) {
    throw new SalesOpsProxyError('Servicio temporalmente no disponible.', 503)
  }

  const normalizedAuthorization = String(authorization || '').trim()
  const headers = {
    Accept: String(accept || 'application/json').trim() || 'application/json',
    'X-GF-Employee-Token': normalizedEmployeeToken,
    'X-GF-Token': normalizedSalesOpsToken,
  }
  if (normalizedAuthorization) headers.Authorization = normalizedAuthorization

  const normalizedQuery = String(query || '').replace(/^\?/, '')
  let origin
  try {
    origin = odooOrigin || resolveOdooOrigin(env)
  } catch (error) {
    if (error instanceof StagingOriginError) {
      throw new SalesOpsProxyError(error.message, error.status)
    }
    throw error
  }
  return {
    method: normalizedMethod(method),
    url: `${origin}/${normalizedPath(path)}${normalizedQuery ? `?${normalizedQuery}` : ''}`,
    headers,
  }
}

function bodyForRequest(req, headers) {
  if (['GET', 'HEAD'].includes(String(req.method || '').toUpperCase()) || req.body == null) {
    return undefined
  }
  headers['Content-Type'] = 'application/json'
  return typeof req.body === 'string' || Buffer.isBuffer(req.body)
    ? req.body
    : JSON.stringify(req.body)
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(body))
}

const SALESOPS_TOKEN_KEYS = ['GF_SALESOPS_TOKEN', 'GF_SALEOPS_TOKEN']

function tokenFromSource(source, key) {
  if (!source) return ''
  const direct = source[key]
  if (direct != null && String(direct).trim()) return String(direct).trim()
  for (const name of Object.keys(source)) {
    if (name.trim() === key) {
      return String(source[name] || '').trim()
    }
  }
  return ''
}

export function readSalesOpsToken(env) {
  const source = env || process.env || {}
  for (const key of SALESOPS_TOKEN_KEYS) {
    const value = tokenFromSource(source, key)
    if (value) return value
  }
  if (env && env !== process.env && env !== nodeEnv) return ''
  for (const key of SALESOPS_TOKEN_KEYS) {
    const value = String(process.env[key] || nodeEnv[key] || '').trim()
    if (value) return value
  }
  return ''
}

export function salesOpsTokenProbe(env) {
  const source = env || process.env || {}
  const canonical = source.GF_SALESOPS_TOKEN !== undefined
    ? source.GF_SALESOPS_TOKEN
    : source['GF_SALESOPS_TOKEN']
  if (canonical !== undefined) {
    return String(canonical).trim() ? 'set' : 'empty'
  }
  const typo = source.GF_SALEOPS_TOKEN !== undefined
    ? source.GF_SALEOPS_TOKEN
    : source['GF_SALEOPS_TOKEN']
  if (typo !== undefined) {
    return String(typo).trim() ? 'typo' : 'empty'
  }
  return 'undef'
}

function maybeSetConfiguredHeader(res, env) {
  if (!mustIsolateFromProduction(env)) return
  res.setHeader('x-gf-salesops-configured', readSalesOpsToken(env) ? '1' : '0')
  res.setHeader('x-gf-salesops-probe', salesOpsTokenProbe(env))
  const apiRaw = env && Object.prototype.hasOwnProperty.call(env, 'ODOO_PWA_SERVICE_API_KEY')
    ? env.ODOO_PWA_SERVICE_API_KEY
    : process.env.ODOO_PWA_SERVICE_API_KEY
  res.setHeader(
    'x-gf-pwa-key-probe',
    apiRaw === undefined ? 'undef' : (String(apiRaw).trim() ? 'set' : 'empty'),
  )
}

export function createSalesOpsProxyHandler({
  fetchFn = globalThis.fetch,
  salesOpsToken,
  env,
} = {}) {
  return async function salesOpsProxyHandler(req, res) {
    const runtimeEnv = env || process.env
    maybeSetConfiguredHeader(res, runtimeEnv)
    try {
      const fromEnv = salesOpsToken === undefined
        ? (readSalesOpsToken(runtimeEnv) || String(process.env.GF_SALESOPS_TOKEN || '').trim())
        : salesOpsToken
      const forward = buildSalesOpsRequest({
        path: req.query?.path,
        method: req.method,
        query: requestQuery(req.query),
        employeeToken: headerValue(req.headers, 'x-gf-employee-token'),
        salesOpsToken: salesOpsToken === undefined ? fromEnv : salesOpsToken,
        authorization: headerValue(req.headers, 'authorization'),
        accept: headerValue(req.headers, 'accept'),
        env: runtimeEnv,
      })
      const body = bodyForRequest(req, forward.headers)
      const upstream = await fetchFn(forward.url, {
        method: forward.method,
        headers: forward.headers,
        body,
      })
      const contentType = upstream.headers.get('content-type') || 'application/json'
      const responseBody = Buffer.from(await upstream.arrayBuffer())
      const secret = forward.headers['X-GF-Token']

      if (contentType.includes(secret) || responseBody.toString().includes(secret)) {
        sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
        return
      }

      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.status(upstream.status).send(responseBody)
    } catch (error) {
      if (error instanceof SalesOpsProxyError) {
        sendJson(res, error.status, { ok: false, message: error.message })
        return
      }
      sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
    }
  }
}

export default createSalesOpsProxyHandler()
