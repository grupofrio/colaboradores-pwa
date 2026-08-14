import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPipeline, fetchWorklist, fetchVacancies, fetchRequisitions, fetchInterviews, fetchAnalytics, fetchApplicant, mapTalentError, classifyTalentStatus } from './talentoApi.js'
import { TalentState } from './TalentState.jsx'

function useTalentLoad(loader) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  function load() {
    setStatus('loading')
    loader()
      .then((payload) => { setData(payload); setStatus('ready') })
      .catch((err) => {
        setError(err.message || mapTalentError(err.code))
        setStatus(classifyTalentStatus(err))
      })
  }
  useEffect(() => { load() }, [])
  return { status, error, data, load }
}

const wrap = { padding: 16, maxWidth: 720, margin: '0 auto' }

export function ScreenTalentoPipeline() {
  const { status, error, data, load } = useTalentLoad(fetchPipeline)
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const stages = data.stages || []
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>Pipeline</h1>
      {stages.map((s) => (
        <section key={s.stage_id} style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16 }}>{s.stage} · {s.count}</h2>
          {(s.applicants || []).map((a) => (
            <Link key={a.id} to={`/talento/candidatos/${a.id}`} style={{ display: 'block', padding: '12px 0', color: 'inherit' }}>
              <strong>{a.name}</strong> · {a.cedis || 's/CEDIS'} · SLA {a.sla}
              {a.hire_gate?.missing_count ? ` · faltan ${a.hire_gate.missing_count}` : ''}
            </Link>
          ))}
        </section>
      ))}
    </main>
  )
}

export function ScreenTalentoInbox() {
  const { status, error, data, load } = useTalentLoad(() => fetchWorklist({ scope: 'mine' }))
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const items = data.items || []
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>Mis pendientes</h1>
      {items.length === 0 ? <TalentState status="empty" /> : items.map((a) => (
        <Link key={a.id} to={`/talento/candidatos/${a.id}`} style={{ display: 'block', padding: '12px 0', color: 'inherit' }}>
          <strong>{a.name}</strong> · {a.stage} · {a.sla}
        </Link>
      ))}
    </main>
  )
}

export function ScreenTalentoVacancies() {
  const { status, error, data, load } = useTalentLoad(fetchVacancies)
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const items = data.items || []
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>Vacantes</h1>
      {items.length === 0 ? <TalentState status="empty" message="No hay vacantes en tu compañía." /> : items.map((j) => (
        <div key={j.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
          <strong>{j.name}</strong> · {j.cedis || ''} · {j.published ? 'Publicada' : 'No publicada'} · postulantes {j.application_count}
        </div>
      ))}
    </main>
  )
}

export function ScreenTalentoRequisitions() {
  const { status, error, data, load } = useTalentLoad(fetchRequisitions)
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const items = data.items || []
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>Requisiciones</h1>
      {items.length === 0 ? <TalentState status="empty" message="No hay requisiciones." /> : items.map((r) => (
        <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
          <strong>{r.name}</strong> · {r.state} · {r.job || 'sin puesto'} · {r.headcount} plaza(s)
        </div>
      ))}
    </main>
  )
}

export function ScreenTalentoInterviews() {
  const { status, error, data, load } = useTalentLoad(fetchInterviews)
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const items = data.items || []
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>Entrevistas</h1>
      {items.length === 0 ? <TalentState status="empty" message="No hay entrevistas agendadas." /> : items.map((a) => (
        <Link key={a.id} to={`/talento/candidatos/${a.id}`} style={{ display: 'block', padding: '12px 0', color: 'inherit' }}>
          <strong>{a.name}</strong> · {a.interview_state} · {a.interview_at || 'sin hora'}
        </Link>
      ))}
    </main>
  )
}

export function ScreenTalentoAnalytics() {
  const { status, error, data, load } = useTalentLoad(fetchAnalytics)
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const funnel = data.funnel || {}
  const quality = data.quality || {}
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>Analytics</h1>
      <h2 style={{ fontSize: 16 }}>Funnel</h2>
      <ul>{Object.entries(funnel).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
      <h2 style={{ fontSize: 16 }}>Calidad / retención</h2>
      <ul>{Object.entries(quality).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
    </main>
  )
}

export function ScreenTalentoCandidate() {
  const { id } = useParams()
  const { status, error, data, load } = useTalentLoad(() => fetchApplicant(id))
  if (status !== 'ready') return <TalentState status={status} message={error} onRetry={load} />
  const gate = data.hire_gate || {}
  const header = data.header || {}
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22 }}>{header.name}</h1>
      <p>{header.job} · {header.cedis} · {header.stage}</p>
      <section style={{ padding: 12, borderRadius: 12, background: gate.ready_to_hire ? '#e8f7ee' : '#fff6e5', margin: '12px 0' }}>
        {gate.ready_to_hire
          ? 'Listo para contratar'
          : `Faltan ${gate.missing_count} cosas para contratar`}
        <ul>{(gate.blockers || []).map((b) => <li key={b}>{b}</li>)}</ul>
      </section>
      <h2 style={{ fontSize: 16 }}>Documentos</h2>
      <ul>{(data.documents || []).map((d) => <li key={d.id}>{d.name} — {d.state}</li>)}</ul>
      <h2 style={{ fontSize: 16 }}>Entrevista</h2>
      <p>{data.interview?.result} · {data.interview?.datetime || 'sin agenda'}</p>
      <h2 style={{ fontSize: 16 }}>Ofertas</h2>
      <ul>{(data.offers || []).map((o) => <li key={o.id}>{o.state} · {o.start_date || ''}</li>)}</ul>
      <h2 style={{ fontSize: 16 }}>Pruebas</h2>
      <ul>{(data.assessments || []).map((a) => <li key={a.id}>{a.type} — {a.state}</li>)}</ul>
      <h2 style={{ fontSize: 16 }}>Siguiente acción</h2>
      <p>{data.next_action || 'Sin bloqueo visible'}</p>
    </main>
  )
}
