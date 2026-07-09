function unwrapResponse(response) {
  if (response?.result !== undefined) return unwrapResponse(response.result)
  return response
}

function localIsoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  // Fecha del día en la zona horaria de NEGOCIO (México, -06 sin DST desde 2022),
  // determinística sin importar la TZ del runtime (browser MX, servidor UTC o CI UTC).
  // Antes usaba getFullYear/getMonth/getDate (TZ ambiente) → el "hoy" se corría al día
  // siguiente a partir de las 18:00 MX (00:00 UTC) en entornos UTC. `en-CA` => YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
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

export function getDefaultLiquidationHistoryDateRange(today = new Date()) {
  const currentDay = localIsoDate(today)
  return {
    dateFrom: currentDay,
    dateTo: currentDay,
  }
}
