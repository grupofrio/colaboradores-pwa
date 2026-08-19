import { buildOdooPwaRequest, PwaProxyError } from '../_odooPwaProxy.js'
import { sanitizeUpstreamAuthBody } from '../../src/lib/sanitizeAuthErrors.js'

function headerValue(headers, name) {
  const found = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )
  return found ? String(found[1] || '').trim() : ''
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

function bodyForRequest(req, headers) {
  if (['GET', 'HEAD'].includes(String(req.method || '').toUpperCase()) || req.body == null) {
    return undefined
  }

  const contentType = req.headers?.['content-type'] || 'application/json'
  headers['Content-Type'] = contentType
  return typeof req.body === 'string' || Buffer.isBuffer(req.body)
    ? req.body
    : JSON.stringify(req.body)
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(body))
}

export function createOdooPwaProxyHandler({
  fetchFn = globalThis.fetch,
  serviceApiKey,
} = {}) {
  return async function odooPwaProxyHandler(req, res) {
    try {
      const forward = buildOdooPwaRequest({
        path: req.query?.path,
        method: req.method,
        query: requestQuery(req.query),
        // Case-insensitive: same contract as api/salesops.js. Bracket access on
        // a single lowercase key fails when the runtime preserves header casing.
        employeeToken: headerValue(req.headers, 'x-gf-employee-token'),
        serviceApiKey: serviceApiKey === undefined
          ? process.env.ODOO_PWA_SERVICE_API_KEY
          : serviceApiKey,
      })
      const body = bodyForRequest(req, forward.headers)
      const upstream = await fetchFn(forward.url, {
        method: forward.method,
        headers: forward.headers,
        body,
      })
      const contentType = upstream.headers.get('content-type') || 'application/json'
      const rawBody = Buffer.from(await upstream.arrayBuffer())
      // Never forward Odoo auth errors that embed the raw Api-Key
      // ("The key <secret> is not allowed") to the browser.
      const sanitized = sanitizeUpstreamAuthBody(rawBody, contentType)

      res.setHeader('Content-Type', sanitized.contentType || contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.status(upstream.status).send(sanitized.body)
    } catch (error) {
      if (error instanceof PwaProxyError) {
        sendJson(res, error.status, { ok: false, message: error.message })
        return
      }
      sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
    }
  }
}

export default createOdooPwaProxyHandler()
