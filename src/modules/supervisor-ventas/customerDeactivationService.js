import { api } from '../../lib/api.js'

function unwrapData(result) {
  return result?.data || result || {}
}

function queryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export async function getCustomerDeactivationSummary() {
  return unwrapData(await api('GET', '/pwa-supv/customer-deactivation/summary'))
}

export async function getSugeyDeactivationQueue(params = {}) {
  const qs = queryString({
    limit: params.limit,
    offset: params.offset,
    route: params.route,
    reason: params.reason,
  })
  return unwrapData(await api('GET', `/pwa-supv/customer-deactivation/sugey${qs}`))
}

export async function getAngelicaDeactivationQueue(params = {}) {
  const qs = queryString({
    limit: params.limit,
    offset: params.offset,
    route: params.route,
    reason: params.reason,
  })
  return unwrapData(await api('GET', `/pwa-supv/customer-deactivation/angelica${qs}`))
}

export async function getCustomerDeactivationDetail(requestId) {
  return unwrapData(await api('GET', `/pwa-supv/customer-deactivation/${Number(requestId || 0)}`))
}

export async function verifyCustomerDeactivationAsSugey(requestId, payload = {}) {
  return unwrapData(await api('POST', `/pwa-supv/customer-deactivation/${Number(requestId || 0)}/sugey-verify`, payload))
}

export async function decideCustomerDeactivationAsAngelica(requestId, payload = {}) {
  return unwrapData(await api('POST', `/pwa-supv/customer-deactivation/${Number(requestId || 0)}/angelica-decide`, payload))
}
