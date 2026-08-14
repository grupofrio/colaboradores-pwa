export function TalentState({ status, message, onRetry }) {
  const label = {
    loading: 'Cargando…',
    empty: 'No hay nada pendiente.',
    error: message || 'No se pudo cargar.',
    unauthorized: 'No tienes acceso.',
    expired: 'Tu sesión venció. Entra de nuevo.',
    offline: 'Sin conexión.',
  }[status] || message
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 16 }}>{label}</p>
      {onRetry && status === 'error' ? (
        <button type="button" onClick={onRetry} style={{ marginTop: 16, minHeight: 44, padding: '10px 20px' }}>
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
