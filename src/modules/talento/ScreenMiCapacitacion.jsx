import { useEffect, useState } from 'react'
import { useSession } from '../../App'
import { fetchCapacitacion, fetchMe, mapTalentError, classifyTalentStatus } from './talentoApi.js'
import { TalentState } from './TalentState.jsx'

export default function ScreenMiCapacitacion() {
  const { session } = useSession()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  function load() {
    setStatus('loading')
    Promise.allSettled([fetchCapacitacion(), fetchMe()]).then(([capRes, meRes]) => {
      const cap = capRes.status === 'fulfilled' ? capRes.value : null
      const me = meRes.status === 'fulfilled' ? meRes.value : null
      if (cap || me) {
        setData(cap || me)
        setStatus('ready')
        return
      }
      const err = capRes.reason || meRes.reason || { code: 'network' }
      setError(err.message || mapTalentError(err.code))
      setStatus(classifyTalentStatus(err))
    })
  }

  useEffect(() => { load() }, [session?.employee_id]) // eslint-disable-line react-hooks/exhaustive-deps -- recarga si cambia el empleado

  if (status !== 'ready') {
    return <TalentState status={status} message={error} onRetry={load} />
  }

  const passport = data.passport
  const operating = data.operating
  const induction = data.induction || []
  if (data.academy === 'off' && !passport) {
    return <TalentState status="empty" message="Tu capacitación aún no está activa." />
  }

  const pendientes = passport?.pendientes || []
  const completadas = passport?.completadas || []
  const certs = passport?.certificaciones || []

  return (
    <main style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Mi capacitación</h1>
      {operating ? (
        <section style={{ padding: 12, borderRadius: 12, background: operating.released_to_operate ? '#e8f7ee' : '#fff6e5', marginBottom: 16 }}>
          <strong>{operating.released_to_operate ? 'Ya puedes operar' : `Faltan ${operating.missing_count} cosas para liberarte`}</strong>
          {!operating.released_to_operate ? (
            <ul>{(operating.blockers || []).map((b) => <li key={b}>{b}</li>)}</ul>
          ) : null}
        </section>
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
