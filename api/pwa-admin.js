import { createOdooPwaProxyHandler } from './odoo/[...path].js'

function nestedPathSegments(path) {
  return (Array.isArray(path) ? path : [path])
    .flatMap((part) => String(part || '').split('/'))
    .filter(Boolean)
}

/**
 * Build the request object for the shared Odoo PWA proxy.
 *
 * IMPORTANT: never object-spread the IncomingMessage. On Vercel/Node,
 * `IncomingMessage.headers` is often non-enumerable, so spreading drops the
 * employee token and the proxy returns 401 "Sesión de empleado requerida."
 * — which the PWA treats as logout.
 */
export function buildPwaAdminProxyRequest(req = {}) {
  const {
    path,
    // Vercel keeps the source wildcard beside the rewritten `path` query.
    // It is routing metadata, not part of the Odoo endpoint contract.
    proxyPath: _proxyPath,
    ...forwardedQuery
  } = req.query || {}
  return {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: {
      ...forwardedQuery,
      path: ['pwa-admin', ...nestedPathSegments(path ?? _proxyPath)],
    },
  }
}

export function createPwaAdminProxyHandler(options = {}) {
  const proxy = createOdooPwaProxyHandler(options)

  return function pwaAdminProxyHandler(req, res) {
    return proxy(buildPwaAdminProxyRequest(req), res)
  }
}

export default createPwaAdminProxyHandler()
