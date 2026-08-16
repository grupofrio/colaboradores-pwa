import { TalentState } from './TalentState.jsx'

export default function CapacitacionScreenView({ result, onRetry }) {
  if (!result || result.status !== 'ready') {
    return (
      <TalentState
        status={result?.status || 'loading'}
        message={result?.message || ''}
        onRetry={onRetry}
      />
    )
  }

  const data = result.data || {}
  const degraded = result.degraded || {}
  const passport = data.passport
  const operating = data.operating
  const induction = data.induction || []

  if (!degraded.capacitacion && data.academy === 'off' && !passport) {
    return <TalentState status="empty" message="Tu capacitación aún no está activa." />
  }

  const pendientes = passport?.pendientes || []
  const completadas = passport?.completadas || []
  const certs = passport?.certificaciones || []
  const emptyPassport = !passport || (
    pendientes.length === 0 && completadas.length === 0 && certs.length === 0
  )

  return (
    <main style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Mi capacitación</h1>
      {degraded.me ? (
        <p>No se pudo cargar tu estado laboral.</p>
      ) : null}
      {degraded.capacitacion ? (
        <p>No se pudo cargar tu pasaporte de capacitación.</p>
      ) : null}

      {operating ? (
        <section style={{ padding: 12, borderRadius: 12, background: operating.released_to_operate ? '#e8f7ee' : '#fff6e5', marginBottom: 16 }}>
          <strong>{operating.released_to_operate ? 'Ya puedes operar' : `Faltan ${operating.missing_count} cosas para liberarte`}</strong>
          {!operating.released_to_operate ? (
            <ul>{(operating.blockers || []).map((b) => <li key={b}>{b}</li>)}</ul>
          ) : null}
        </section>
      ) : null}

      {!degraded.capacitacion && data.academy === 'on' && emptyPassport ? (
        <p>Todavía no tienes programas de capacitación asignados.</p>
      ) : null}

      <h2 style={{ fontSize: 18 }}>Pendientes</h2>
      {pendientes.length === 0 ? <p>No tienes programas pendientes.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {pendientes.map((p) => (
            <li key={p.enrollment_id} style={{ marginBottom: 8 }}>
              <strong>{p.name}</strong> — {p.progress_pct}% · {p.modules_pending} módulos
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 18 }}>Completadas</h2>
      {completadas.length === 0 ? <p>Aún no hay programas completados.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {completadas.map((p) => (
            <li key={p.enrollment_id}>{p.name} — {p.score || 0}</li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 18 }}>Certificados</h2>
      {certs.length === 0 ? <p>Sin certificados.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {certs.map((c) => (
            <li key={c.certificate_id}>{c.name} · {c.state} · vence {c.valid_until || 's/f'}</li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 18 }}>Mi inducción</h2>
      {induction.length === 0 ? <p>Sin checklist de inducción.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {induction.map((i) => (
            <li key={i.id}>{i.name} — {i.state}{i.deadline ? ` · ${i.deadline}` : ''}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
