// Identifica la petición más reciente de una secuencia asíncrona. El consumidor
// decide qué estado aplicar; una respuesta solo es vigente si conserva su id.
export function createLatestRequestGate() {
  let latestRequestId = 0
  return {
    begin() {
      latestRequestId += 1
      return latestRequestId
    },
    isLatest(requestId) {
      return requestId === latestRequestId
    },
  }
}
