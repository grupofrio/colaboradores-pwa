import { buildOdooPwaRequest } from '../_odooPwaProxy.js'
import {
  fingerprintServiceApiKey,
  matchesId14Reference,
} from '../_serviceKeyFingerprint.js'

const ODOO_ORIGIN = 'https://grupofrio-gf.odoo.com'
const GATE_HEADER = 'x-pwa-service-key-diag-gate'

function headerValue(headers, name) {
  const found = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )
  return found ? String(found[1] || '').trim() : ''
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(body))
}

function gateAllowed(req, env) {
  const expected = String(env.PWA_SERVICE_KEY_DIAG_GATE || '').trim()
  if (!expected) return false
  const provided = headerValue(req.headers, GATE_HEADER)
  return provided.length > 0 && provided === expected
}

async function probeOdooDirect(serviceApiKey, employeeToken, fetchFn = globalThis.fetch) {
  const url = `${ODOO_ORIGIN}/pwa-admin/capabilities`
  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Api-Key': String(serviceApiKey || '').trim(),
      'X-GF-Employee-Token': String(employeeToken || '').trim(),
    },
  })
  let body = {}
  try {
    body = await response.json()
  } catch {
    body = {}
  }
  const data = body?.data || {}
  return {
    HTTP: response.status,
    ok: body?.ok ?? null,
    code: data?.code ?? body?.code ?? null,
  }
}

export function createDebugPwaServiceKeyFingerprintHandler({
  fetchFn = globalThis.fetch,
  env = process.env,
} = {}) {
  return async function debugPwaServiceKeyFingerprintHandler(req, res) {
    if (String(req.method || '').toUpperCase() !== 'GET') {
      sendJson(res, 405, { ok: false, message: 'Método no permitido.' })
      return
    }

    if (!gateAllowed(req, env)) {
      sendJson(res, 404, { ok: false, message: 'Not found.' })
      return
    }

    const runtimeEnv = fingerprintServiceApiKey(env.ODOO_PWA_SERVICE_API_KEY)
    const payload = {
      present: runtimeEnv.present,
      len: runtimeEnv.len,
      sha256_12: runtimeEnv.sha256_12,
      matches_id14: matchesId14Reference(runtimeEnv),
    }

    const employeeToken = headerValue(req.headers, 'x-gf-employee-token')
    const probe = String(req.query?.probe || '').trim().toLowerCase()

    if (probe === 'odoo' && employeeToken) {
      const rawKey = env.ODOO_PWA_SERVICE_API_KEY
      payload.odoo_direct = await probeOdooDirect(rawKey, employeeToken, fetchFn)

      const forward = buildOdooPwaRequest({
        path: ['pwa-admin', 'capabilities'],
        method: 'GET',
        employeeToken,
        serviceApiKey: rawKey,
      })
      const preRequest = fingerprintServiceApiKey(forward.headers['Api-Key'])
      payload.pre_request = {
        present: preRequest.present,
        len: preRequest.len,
        sha256_12: preRequest.sha256_12,
        matches_id14: matchesId14Reference(preRequest),
      }
    }

    sendJson(res, 200, payload)
  }
}

export default createDebugPwaServiceKeyFingerprintHandler()
