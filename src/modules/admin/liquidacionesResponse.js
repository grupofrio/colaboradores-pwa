function unwrapResponse(response) {
  if (response?.result !== undefined) return unwrapResponse(response.result)
  return response
}

export function assertOkResponse(response) {
  const envelope = unwrapResponse(response)
  if (envelope?.ok === false) {
    throw new Error(envelope.message || envelope.error || 'Error de liquidaciones')
  }
  return envelope
}

export function normalizeLiquidationListResponse(response, listKeys = ['plans']) {
  const envelope = assertOkResponse(response)
  const data = envelope?.data ?? envelope
  if (Array.isArray(data)) return data

  for (const key of listKeys) {
    if (Array.isArray(data?.[key])) return data[key]
  }

  return []
}

export function normalizeLiquidationDetailResponse(response) {
  const envelope = assertOkResponse(response)
  return envelope?.data ?? envelope ?? null
}
