import { resolveEmployeeSignInUrl, StagingOriginError } from './_odooOrigin.js'
const SALESOPS_FIELDS = ['gf_salesops_token', 'salesops_api_token', 'x_gf_token']

function headerValue(headers, name) {
  const found = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return found ? String(found[1] || '').trim() : ''
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(body))
}

function parseRequestBody(req) {
  if (!headerValue(req.headers, 'content-type').toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('Tipo de contenido no permitido.'), { status: 415 })
  }
  if (req.body == null) {
    throw Object.assign(new Error('Solicitud inválida.'), { status: 400 })
  }
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(String(req.body))
    } catch {
      throw Object.assign(new Error('Solicitud inválida.'), { status: 400 })
    }
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw Object.assign(new Error('Solicitud inválida.'), { status: 400 })
  }
  return req.body
}

function redactSalesOpsFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const clean = { ...value }
  for (const field of SALESOPS_FIELDS) delete clean[field]
  if (clean.result && typeof clean.result === 'object' && !Array.isArray(clean.result)) {
    clean.result = redactSalesOpsFields(clean.result)
  }
  return clean
}

export function createEmployeeSignInProxyHandler({ fetchFn = globalThis.fetch, env = process.env } = {}) {
  return async function employeeSignInProxyHandler(req, res) {
    if (String(req.method || '').toUpperCase() !== 'POST') {
      sendJson(res, 405, { ok: false, message: 'Método no permitido.' })
      return
    }

    let body
    try {
      body = parseRequestBody(req)
    } catch (error) {
      sendJson(res, error.status || 400, { ok: false, message: error.message || 'Solicitud inválida.' })
      return
    }

    let loginUrl
    try {
      loginUrl = resolveEmployeeSignInUrl(env)
    } catch (error) {
      const status = error instanceof StagingOriginError ? error.status : 503
      sendJson(res, status, { ok: false, message: error.message || 'Backend staging no configurado.' })
      return
    }

    try {
      const upstream = await fetchFn(loginUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const contentType = upstream.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('application/json')) {
        sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
        return
      }

      let payload
      try {
        payload = JSON.parse(await upstream.text())
      } catch {
        sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
        return
      }
      sendJson(res, upstream.status, redactSalesOpsFields(payload))
    } catch {
      sendJson(res, 502, { ok: false, message: 'No fue posible contactar el servicio.' })
    }
  }
}

export default createEmployeeSignInProxyHandler()
