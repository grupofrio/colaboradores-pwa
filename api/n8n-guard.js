import { mustIsolateFromProduction } from './_odooOrigin.js'

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(body))
}

export function createN8nGuardHandler({
  fetchFn = globalThis.fetch,
  env = process.env,
} = {}) {
  return async function n8nGuardHandler(req, res) {
    if (mustIsolateFromProduction(env)) {
      sendJson(res, 503, {
        ok: false,
        message: 'n8n productivo deshabilitado en staging/preview.',
      })
      return
    }
    const path = String(req.query?.path || '').replace(/^\/+/, '')
    const target = `https://n8n.grupofrio.mx/webhook/${path}`
    try {
      const upstream = await fetchFn(target, {
        method: req.method,
        headers: { 'Content-Type': headerValue(req.headers, 'content-type') || 'application/json' },
        body: ['GET', 'HEAD'].includes(String(req.method || '').toUpperCase()) ? undefined : req.body,
      })
      const contentType = upstream.headers.get('content-type') || 'application/json'
      res.setHeader('Content-Type', contentType)
      res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()))
    } catch {
      sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
    }
  }
}

function headerValue(headers, name) {
  const found = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return found ? String(found[1] || '').trim() : ''
}

export default createN8nGuardHandler()
