import { resolveOdooOrigin, StagingOriginError } from './_odooOrigin.js'

const ALLOWED_PREFIXES = [
  'web/',
  'jsonrpc',
  'api/',
  'pwa-',
  'gf/',
  'get_records',
  'get_records_sorted',
]

function headerValue(headers, name) {
  const found = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return found ? String(found[1] || '').trim() : ''
}

function pathFromQuery(query = {}) {
  const raw = query.path
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((part) => String(part || '').split('/'))
    .filter(Boolean)
  return parts.join('/')
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(body))
}

export function createOdooOriginProxyHandler({
  fetchFn = globalThis.fetch,
  env = process.env,
} = {}) {
  return async function odooOriginProxyHandler(req, res) {
    let origin
    try {
      origin = resolveOdooOrigin(env)
    } catch (error) {
      const status = error instanceof StagingOriginError ? error.status : 503
      sendJson(res, status, { ok: false, message: error.message || 'Backend staging no configurado.' })
      return
    }

    const method = String(req.method || 'GET').toUpperCase()
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      sendJson(res, 405, { ok: false, message: 'Método no permitido.' })
      return
    }

    const path = pathFromQuery(req.query)
    if (!path || path.includes('..') || !ALLOWED_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix))) {
      sendJson(res, 404, { ok: false, message: 'Ruta no disponible.' })
      return
    }

    const headers = {
      Accept: headerValue(req.headers, 'accept') || 'application/json',
    }
    const contentType = headerValue(req.headers, 'content-type')
    if (contentType) headers['Content-Type'] = contentType
    const employeeToken = headerValue(req.headers, 'x-gf-employee-token')
    if (employeeToken) headers['X-GF-Employee-Token'] = employeeToken
    const authorization = headerValue(req.headers, 'authorization')
    if (authorization) headers.Authorization = authorization
    const apiKey = headerValue(req.headers, 'api-key')
    if (apiKey && !path.startsWith('pwa-admin')) headers['Api-Key'] = apiKey

    const search = new URLSearchParams()
    for (const [key, rawValue] of Object.entries(req.query || {})) {
      if (key === 'path' || rawValue === undefined) continue
      for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
        if (value !== undefined) search.append(key, String(value))
      }
    }
    const query = search.toString()
    const url = `${origin}/${path}${query ? `?${query}` : ''}`
    const body = ['GET', 'HEAD'].includes(method) || req.body == null
      ? undefined
      : (typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body))

    try {
      const upstream = await fetchFn(url, { method, headers, body })
      const responseType = upstream.headers.get('content-type') || 'application/json'
      const responseBody = Buffer.from(await upstream.arrayBuffer())
      res.setHeader('Content-Type', responseType)
      res.setHeader('Cache-Control', 'no-store')
      res.status(upstream.status).send(responseBody)
    } catch {
      sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
    }
  }
}

export default createOdooOriginProxyHandler()
