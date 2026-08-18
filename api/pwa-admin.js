import { createOdooPwaProxyHandler } from './odoo/[...path].js'

function nestedPathSegments(path) {
  return (Array.isArray(path) ? path : [path])
    .flatMap((part) => String(part || '').split('/'))
    .filter(Boolean)
}

export function createPwaAdminProxyHandler(options = {}) {
  const proxy = createOdooPwaProxyHandler(options)

  return function pwaAdminProxyHandler(req, res) {
    return proxy({
      ...req,
      query: {
        ...req.query,
        path: ['pwa-admin', ...nestedPathSegments(req.query?.path)],
      },
    }, res)
  }
}

export default createPwaAdminProxyHandler()
