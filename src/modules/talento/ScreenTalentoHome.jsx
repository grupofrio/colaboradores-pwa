import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchInbox, mapTalentError, classifyTalentStatus } from './talentoApi.js'
import { TalentState } from './TalentState.jsx'

export default function ScreenTalentoHome() {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  function load() {
    setStatus('loading')
    fetchInbox()
      .then((data) => {
        setItems(data.items || [])
        setStatus('ready')
      })
      .catch((err) => {
        setError(err.message || mapTalentError(err.code))
        setStatus(classifyTalentStatus(err))
      })
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount + retry manual

  if (status !== 'ready') {
    return <TalentState status={status} message={error} onRetry={load} />
  }

  const actionable = items.filter((i) => i.count > 0)

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Talento</h1>
      <p style={{ margin: '0 0 16px', opacity: 0.8 }}>¿Qué necesita atención hoy?</p>
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Link to="/talento/pipeline" style={chip}>Pipeline</Link>
        <Link to="/talento/pendientes" style={chip}>Mis pendientes</Link>
        <Link to="/talento/vacantes" style={chip}>Vacantes</Link>
        <Link to="/talento/requisiciones" style={chip}>Requisiciones</Link>
        <Link to="/talento/entrevistas" style={chip}>Entrevistas</Link>
        <Link to="/talento/analytics" style={chip}>Analytics</Link>
      </nav>
      {actionable.length === 0 ? (
        <TalentState status="empty" message="Nada urgente hoy." />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {actionable.map((i) => (
            <li key={i.code} style={{ padding: '14px 0', borderBottom: '1px solid #e5e5e5', fontSize: 16 }}>
              <strong>{i.count}</strong> {i.label}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

const chip = {
  display: 'inline-block',
  padding: '10px 14px',
  minHeight: 44,
  borderRadius: 999,
  background: '#15499B',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 14,
}
