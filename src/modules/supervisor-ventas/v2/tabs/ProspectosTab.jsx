// Supervisor V2 · Prospectos. Descubrimiento read-only sobre el contrato B6.
// La seleccion de una ruta y el write add_lead permanecen en Planear: aqui no se
// inventa un route_plan_id ni se permite ampliar el scope que impone el servidor.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS } from '../../../../theme/brandTokens'
import { getSupervisorProspectScope, getSupervisorProspects } from '../../api'

const C = BRAND_TOKENS.colors
const DEMAND_OPTIONS = ['AA', 'A', 'B', 'C']

function payloadOf(response) {
  if (!response || response.ok === false || response.status === 'error') {
    throw new Error(response?.message || 'No se pudieron cargar los prospectos.')
  }
  const first = response.data && typeof response.data === 'object' ? response.data : response
  return first?.data && typeof first.data === 'object' ? first.data : first
}

function ProspectCard({ prospect, onPlan }) {
  const name = String(prospect?.name || '').trim() || 'Prospecto sin nombre'
  const polygon = String(prospect?.polygon_name || '').trim()
  const demand = String(prospect?.demand_label || prospect?.demand_class || '').trim()
  return (
    <article style={{
      border: `1px solid ${C.gray4}`, borderRadius: 8, background: C.surface,
      padding: '14px 15px', display: 'grid', gap: 7,
    }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 10 }}>
        <strong style={{ color: C.ink, fontSize: 15, lineHeight: 1.3 }}>{name}</strong>
        {demand && <span style={{ color: C.blue3, background: C.blue0, borderRadius: 4, padding: '3px 7px', fontSize: 12, fontWeight: 800 }}>{demand}</span>}
      </div>
      {polygon && <span style={{ color: C.gray1, fontSize: 13 }}>Polígono: {polygon}</span>}
      <button type="button" onClick={() => onPlan(prospect.lead_id)} style={{ justifySelf: 'start', minHeight: 36, border: `1px solid ${C.blue3}`, borderRadius: 6, background: C.surface, color: C.blue3, fontSize: 12, fontWeight: 800, padding: '0 10px', cursor: 'pointer' }}>
        Agregar a una ruta
      </button>
    </article>
  )
}

export default function ProspectosTab() {
  const navigate = useNavigate()
  const [scope, setScope] = useState({ status: 'loading', data: null, error: null })
  const [list, setList] = useState({ status: 'idle', items: [], error: null })
  const [polygonId, setPolygonId] = useState('')
  const [demandClass, setDemandClass] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    let alive = true
    setScope({ status: 'loading', data: null, error: null })
    getSupervisorProspectScope()
      .then((response) => {
        if (alive) setScope({ status: 'ready', data: payloadOf(response), error: null })
      })
      .catch((error) => {
        if (alive) setScope({ status: 'error', data: null, error: error?.message || 'No se pudo cargar el alcance.' })
      })
    return () => { alive = false }
  }, [reloadKey])

  useEffect(() => {
    if (scope.status !== 'ready') return undefined
    const requestId = ++requestRef.current
    setList({ status: 'loading', items: [], error: null })
    getSupervisorProspects({ polygonId: polygonId || null, demandClass: demandClass || null })
      .then((response) => {
        if (requestId !== requestRef.current) return
        const data = payloadOf(response)
        setList({ status: 'ready', items: Array.isArray(data?.prospects) ? data.prospects : [], error: null })
      })
      .catch((error) => {
        if (requestId !== requestRef.current) return
        setList({ status: 'error', items: [], error: error?.message || 'No se pudieron cargar los prospectos.' })
      })
    return () => { requestRef.current += 1 }
  }, [scope.status, polygonId, demandClass, reloadKey])

  if (scope.status === 'loading') {
    return <StateScreen tokens={BRAND_TOKENS} title="Cargando prospectos" detail="Verificando los polígonos autorizados para tu sucursal." tone="neutral" />
  }
  if (scope.status === 'error') {
    return <StateScreen tokens={BRAND_TOKENS} title="No pudimos cargar prospectos" detail={scope.error} tone="error" actionLabel="Reintentar" onAction={() => setReloadKey((n) => n + 1)} />
  }

  const polygons = Array.isArray(scope.data?.polygons) ? scope.data.polygons : []
  return (
    <section aria-labelledby="prospectos-title" style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 id="prospectos-title" style={{ margin: 0, color: C.ink, fontSize: 23 }}>Prospectos</h1>
        <p style={{ margin: 0, color: C.gray1, fontSize: 14, lineHeight: 1.45 }}>
          Oportunidades dentro de los polígonos autorizados para tu sucursal.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 5, minWidth: 190, color: C.gray1, fontSize: 13, fontWeight: 700 }}>
          Polígono
          <select value={polygonId} onChange={(event) => setPolygonId(event.target.value)} style={{ minHeight: 40, borderRadius: 6, border: `1px solid ${C.gray4}`, background: C.surface, color: C.ink, padding: '0 9px' }}>
            <option value="">Todos los autorizados</option>
            {polygons.map((polygon) => <option key={polygon.id} value={polygon.id}>{polygon.name || `Polígono ${polygon.id}`}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 5, minWidth: 150, color: C.gray1, fontSize: 13, fontWeight: 700 }}>
          Demanda
          <select value={demandClass} onChange={(event) => setDemandClass(event.target.value)} style={{ minHeight: 40, borderRadius: 6, border: `1px solid ${C.gray4}`, background: C.surface, color: C.ink, padding: '0 9px' }}>
            <option value="">Todas</option>
            {DEMAND_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => navigate('/equipo/rutas/planear')} style={{ minHeight: 40, borderRadius: 6, border: `1px solid ${C.blue3}`, background: C.blue3, color: C.surface, fontWeight: 800, padding: '0 13px', cursor: 'pointer' }}>
          Planear ruta
        </button>
      </div>

      {list.status === 'loading' && <StateScreen tokens={BRAND_TOKENS} title="Buscando prospectos" detail="Aplicando los filtros autorizados." tone="neutral" />}
      {list.status === 'error' && <StateScreen tokens={BRAND_TOKENS} title="No pudimos cargar la lista" detail={list.error} tone="error" actionLabel="Reintentar" onAction={() => setReloadKey((n) => n + 1)} />}
      {list.status === 'ready' && list.items.length === 0 && <StateScreen tokens={BRAND_TOKENS} title="Sin prospectos con estos filtros" detail="Prueba otro polígono o clase de demanda." tone="neutral" />}
      {list.status === 'ready' && list.items.length > 0 && (
        <div data-testid="v2-prospectos-list" style={{ display: 'grid', gap: 9 }}>
          {list.items.map((prospect) => <ProspectCard key={prospect.lead_id} prospect={prospect} onPlan={(leadId) => navigate(`/equipo/rutas/planear?armar=1&lead=${encodeURIComponent(leadId)}`)} />)}
        </div>
      )}
    </section>
  )
}
