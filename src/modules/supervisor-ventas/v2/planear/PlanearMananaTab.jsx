// ─── Supervisor V2 · "Planear mañana" (tema CLARO) ───────────────────────────
// Re-hogar del flujo de planeación (antes ScreenPronostico, oscuro/oculto) a una
// superficie V2 de marca, dentro de Rutas. La supervisora arma y PUBLICA las
// rutas del día siguiente: preparar plan → generar propuesta → ajustar clientes
// → publicar. Piloto: sucursal 29 / compañía 34; fecha fija = MAÑANA.
//
// REUSO (no reinvención):
//   · Escrituras y lecturas: las funciones YA existentes de ./api (ensure,
//     preview, add/remove, publish, búsqueda, plantillas, polígonos).
//   · Reglas puras: routePlanning.js (guards canEdit/canPublish, normalizadores,
//     fecha de mañana) y planearModel.js (readiness, resumen de recursos).
//
// NET-NEW: /available-resources (unidades + equipo del día, marcando dobles
//   asignaciones). Es READ-ONLY: no existe write para asignar unidad/chofer al
//   plan desde la PWA (vienen del route master en ensure); por eso aquí se
//   INFORMAN, no se escriben. Los únicos writes son los del contrato de arriba.
//
// null ≠ 0: lo que no viene del backend dice "Sin dato"/—, nunca un 0 inventado.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BRAND_TOKENS as T } from '../../../../theme/brandTokens'
import StateScreen from '../../../../components/kold/StateScreen'
import { logScreenError } from '../../../shared/logScreenError'
import {
  getRouteTemplatesForPlanning,
  getPlanningPolygons,
  getPlanningSubpolygons,
  ensureDailyRoutePlan,
  previewRoutePlanCustomers,
  addCustomerToRoutePlan,
  removeCustomerFromRoutePlan,
  publishRoutePlan,
  searchPlanningCustomers,
  getRouteStops,
  getAvailableResources,
  assignRoutePlanResources,
} from '../../api'
import {
  getTomorrowDateString,
  buildRoutePlanCriteriaPayload,
  buildRoutePlanPreviewPayload,
  normalizeRoutePlanningRow,
  normalizeRoutePlanCustomer,
  normalizeCustomerSearchResult,
  canEditRoutePlanCustomers,
  getSupervisorRouteErrorMessage,
  DEMAND_CLASSES,
} from '../../routePlanning'
import {
  routeReadiness,
  summarizeResources,
  capacityLabel,
  personRolesLabel,
  planStateLabel,
  derivePlanAssignment,
  resourceOptions,
  resourceReadiness,
  COVERAGE_TONE,
} from './planearModel'

const C = T.colors
const R = T.radius

const DAY_LABEL = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

function dateHuman(dateStr) {
  // Solo etiqueta; la fecha operativa la fija el servidor. Se arma a mediodía
  // local para que el corrimiento de zona no reste un día.
  try {
    const [y, m, d] = String(dateStr).split('-').map(Number)
    if (!y || !m || !d) return dateStr
    return DAY_LABEL.format(new Date(y, m - 1, d, 12, 0, 0))
  } catch { return dateStr }
}

function unwrapList(payload) {
  const value = payload?.data ?? payload
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.items)) return value.items
  return []
}

const optionId = (row) => String(row?.id ?? row?.value ?? '')
const optionLabel = (row) => row?.name || row?.label || `#${optionId(row)}`

// ── Piezas de UI (tema claro) ────────────────────────────────────────────────

function Toast({ text }) {
  if (!text) return null
  return (
    <div data-testid="planear-toast" role="status" style={{
      position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 60, margin: '0 auto', maxWidth: 520,
      background: C.text, color: '#fff', borderRadius: R.md, padding: '11px 14px',
      fontSize: 13, fontWeight: 700, boxShadow: '0 6px 20px rgba(15,42,61,0.25)', textAlign: 'center',
    }}>{text}</div>
  )
}

function Card({ children, testid, style }) {
  return (
    <div data-testid={testid} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg,
      padding: '14px 16px', boxShadow: '0 1px 2px rgba(15,42,61,0.05)', ...style,
    }}>{children}</div>
  )
}

function Chip({ text, tone = 'neutral' }) {
  const map = {
    ok: { fg: C.success, bg: C.successSoft, border: 'rgba(22,101,52,0.30)' },
    warn: { fg: C.warning, bg: C.warningSoft, border: 'rgba(180,83,9,0.30)' },
    bad: { fg: C.error, bg: C.errorSoft, border: 'rgba(185,28,28,0.30)' },
    info: { fg: C.blue3, bg: 'rgba(0,119,187,0.08)', border: 'rgba(0,119,187,0.24)' },
    neutral: { fg: C.textMuted, bg: 'rgba(15,42,61,0.03)', border: 'rgba(15,42,61,0.14)' },
  }
  const t = map[tone] || map.neutral
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: R.pill, color: t.fg, background: t.bg, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{text}</span>
}

function PrimaryButton({ children, onClick, disabled, busy, testid, tone = 'blue' }) {
  const bg = tone === 'green' ? C.success : C.blue
  return (
    <button
      type="button" data-testid={testid} onClick={onClick} disabled={disabled || busy}
      style={{
        width: '100%', minHeight: 46, borderRadius: R.md, border: 'none', cursor: disabled || busy ? 'not-allowed' : 'pointer',
        background: disabled || busy ? C.surfaceStrong : bg, color: disabled || busy ? C.textMuted : '#fff',
        fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
      }}
    >{busy ? 'Un momento…' : children}</button>
  )
}

function GhostButton({ children, onClick, testid }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} style={{
      minHeight: 40, padding: '0 12px', borderRadius: R.md, border: `1px solid ${C.border}`,
      background: C.surface, color: C.blue3, fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
    }}>{children}</button>
  )
}

function ResourcesSummary({ resources }) {
  const s = summarizeResources(resources)
  return (
    <Card testid="planear-recursos">
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Recursos del día</div>
      {!s.vehiclesAvailable && !s.rosterAvailable ? (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>Sin dato de recursos para esta fecha.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.textMuted, minWidth: 68 }}>Unidades</span>
            {s.vehiclesAvailable
              ? <>
                  <Chip text={`${s.unitsFree} libres`} tone={s.unitsFree > 0 ? 'ok' : 'warn'} />
                  {s.unitsTaken > 0 && <Chip text={`${s.unitsTaken} asignadas`} tone="info" />}
                  {s.capacityUnknown > 0 && <Chip text={`${s.capacityUnknown} sin capacidad`} tone="neutral" />}
                </>
              : <Chip text="Sin dato" tone="neutral" />}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.textMuted, minWidth: 68 }}>Equipo</span>
            {s.rosterAvailable
              ? <>
                  <Chip text={`${s.peopleFree} libres`} tone={s.peopleFree > 0 ? 'ok' : 'warn'} />
                  {s.peopleTaken > 0 && <Chip text={`${s.peopleTaken} en ruta`} tone="info" />}
                  <Chip text={`${s.drivers} choferes · ${s.sellers} vendedores`} tone="neutral" />
                </>
              : <Chip text="Sin dato" tone="neutral" />}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 9, lineHeight: 1.5 }}>
        Disponibilidad de referencia: una unidad/persona es “libre” si no está en otra ruta de esta fecha.
        La asignación se hace donde ya se hace hoy (no desde aquí).
      </div>
    </Card>
  )
}

function ResourceLists({ resources }) {
  const vehicles = Array.isArray(resources?.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources?.people) ? resources.people : []
  if (!vehicles.length && !people.length) return null
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {vehicles.length > 0 && (
        <Card testid="planear-unidades">
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Unidades</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {vehicles.map((v) => (
              <div key={v.id} data-testid="planear-unidad-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v.name}{v.license_plate ? ` · ${v.license_plate}` : ''}</div>
                  <div style={{ fontSize: 11.5, color: C.textMuted }}>{capacityLabel(v.capacity_kg)}{v.default_driver ? ` · ${v.default_driver.name}` : ''}</div>
                </div>
                <Chip text={v.available ? 'Libre' : 'Asignada'} tone={v.available ? 'ok' : 'info'} />
              </div>
            ))}
          </div>
        </Card>
      )}
      {people.length > 0 && (
        <Card testid="planear-equipo">
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Equipo</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {people.map((p) => (
              <div key={p.id} data-testid="planear-persona-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: C.textMuted }}>{personRolesLabel(p)}</div>
                </div>
                <Chip text={p.available ? 'Libre' : 'En ruta'} tone={p.available ? 'ok' : 'info'} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// Un selector de recurso (unidad/chofer/vendedor). Marca los ocupados en otra
// ruta del día como deshabilitados (no se puede doblar). AA: label + estado en
// texto, no solo color.
function ResourcePickerRow({ label, testid, options, currentId, onChange, busy, withCapacity = false }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{label}</label>
      <select
        data-testid={testid}
        value={currentId || ''}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 10px', cursor: busy ? 'wait' : 'pointer' }}
      >
        <option value="">{currentId ? 'Cambiar…' : 'Sin asignar — elige…'}</option>
        {options.map((o) => {
          const cap = withCapacity && o.capacity_kg != null ? ` · ${capacityLabel(o.capacity_kg)}` : ''
          const busyTag = o.busyElsewhere && !o.isCurrent ? ' — en otra ruta' : ''
          return (
            <option key={o.id} value={o.id} disabled={o.busyElsewhere && !o.isCurrent}>
              {o.name}{cap}{busyTag}
            </option>
          )
        })}
      </select>
      {busy && <span style={{ fontSize: 11.5, color: C.textMuted }}>Guardando…</span>}
    </div>
  )
}

function ResourcePicker({ resources, planId, assignment, coverage, onAssign, busyField }) {
  const vehicles = Array.isArray(resources?.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources?.people) ? resources.people : []
  const drivers = people.filter((p) => p.is_driver)
  const sellers = people.filter((p) => p.is_seller)
  const covTone = COVERAGE_TONE[coverage?.coverage_state] || 'neutral'
  return (
    <Card testid="planear-recursos-accionable">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Recursos de esta ruta</div>
        <Chip text={coverage?.coverage_label || '—'} tone={covTone} />
      </div>

      <ResourcePickerRow
        label="Unidad" testid="planear-asignar-unidad" withCapacity
        options={resourceOptions(vehicles, planId, assignment?.vehicle?.id)}
        currentId={assignment?.vehicle?.id || ''} busy={busyField === 'vehicle_id'}
        onChange={(v) => onAssign('vehicle_id', v)}
      />
      <ResourcePickerRow
        label="Chofer" testid="planear-asignar-chofer"
        options={resourceOptions(drivers, planId, assignment?.driver?.id)}
        currentId={assignment?.driver?.id || ''} busy={busyField === 'driver_employee_id'}
        onChange={(v) => onAssign('driver_employee_id', v)}
      />
      <ResourcePickerRow
        label="Vendedor" testid="planear-asignar-vendedor"
        options={resourceOptions(sellers, planId, assignment?.salesperson?.id)}
        currentId={assignment?.salesperson?.id || ''} busy={busyField === 'salesperson_employee_id'}
        onChange={(v) => onAssign('salesperson_employee_id', v)}
      />

      {coverage?.blockers?.length > 0 && (
        <div data-testid="planear-cobertura-bloqueos" style={{ fontSize: 12, color: C.error, marginTop: 2 }}>
          {coverage.blockers.map((b, i) => <div key={i}>⛔ {b}</div>)}
        </div>
      )}
      {coverage?.warnings?.length > 0 && (
        <div data-testid="planear-cobertura-avisos" style={{ fontSize: 12, color: C.warning, marginTop: 2 }}>
          {coverage.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 8, lineHeight: 1.5 }}>
        Reasignar aquí cambia la unidad/persona del plan (incluso a última hora). Un recurso
        ya en otra ruta del día aparece deshabilitado para no doblarlo.
      </div>
    </Card>
  )
}

function RouteRow({ route, onPrepare, busy }) {
  const st = planStateLabel(route)
  const tone = route.plan_id ? (route.plan_state === 'published' ? 'ok' : 'info') : 'neutral'
  return (
    <Card testid="planear-ruta-row" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{route.route_name || `Ruta #${route.route_id}`}</div>
        <Chip text={st} tone={tone} />
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
        {route.employee_name ? `Vendedor: ${route.employee_name}` : 'Sin vendedor asignado'}
      </div>
      <div style={{ marginTop: 10 }}>
        <GhostButton testid="planear-preparar" onClick={() => onPrepare(route)}>
          {route.plan_id ? 'Abrir preparación' : 'Preparar ruta'}
        </GhostButton>
        {busy && <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 10 }}>Preparando…</span>}
      </div>
    </Card>
  )
}

function CustomerRow({ customer, onRemove, canEdit, removing }) {
  return (
    <div data-testid="planear-cliente-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.name || `Cliente #${customer.customer_id || customer.id}`}</div>
        {customer.address && <div style={{ fontSize: 11.5, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.address}</div>}
      </div>
      {canEdit && (
        <button type="button" data-testid="planear-cliente-quitar" onClick={() => onRemove(customer)} disabled={removing}
          style={{ flex: '0 0 auto', minHeight: 36, padding: '0 10px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.error, fontSize: 12, fontWeight: 800, cursor: removing ? 'wait' : 'pointer' }}>
          Quitar
        </button>
      )}
    </div>
  )
}

// ── Contenedor ───────────────────────────────────────────────────────────────

export default function PlanearMananaTab() {
  const navigate = useNavigate()
  const dateTarget = getTomorrowDateString()

  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)
  const [routes, setRoutes] = useState([])
  const [polygons, setPolygons] = useState([])
  const [subpolygons, setSubpolygons] = useState([])
  const [resources, setResources] = useState(null)

  const [view, setView] = useState('list') // list | detail
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [routePlanId, setRoutePlanId] = useState(null)
  const [previewCustomers, setPreviewCustomers] = useState([])

  const [polygonId, setPolygonId] = useState('')
  const [subpolygonId, setSubpolygonId] = useState('')
  const [demandClasses, setDemandClasses] = useState([])

  const [preparing, setPreparing] = useState(null)   // route_id en preparación
  const [previewing, setPreviewing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [rowBusy, setRowBusy] = useState(null)        // add-/remove-<id>
  const [assignBusy, setAssignBusy] = useState(null)  // vehicle_id | driver_employee_id | salesperson_employee_id
  const [assignReadiness, setAssignReadiness] = useState(null)  // readiness del backend (incluye sobrecapacidad)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [msg, setMsg] = useState(null)

  const msgTimer = useRef(null)
  const previewReq = useRef(0)

  const flash = useCallback((text, ms = 2600) => {
    setMsg(text)
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), ms)
  }, [])

  const selectedRoute = routes.find((r) => Number(r.route_id) === Number(selectedRouteId)) || null
  const canEdit = canEditRoutePlanCustomers(selectedRoute || {})
  const readiness = selectedRoute ? routeReadiness(selectedRoute, previewCustomers.length) : null
  // Asignación actual del plan: derivada de available-resources (marca qué recurso
  // trae ESTE plan). Tras cada write se recarga resources ⇒ se re-deriva sola.
  const assignment = routePlanId ? derivePlanAssignment(resources || {}, routePlanId) : { vehicle: null, driver: null, salesperson: null }
  // Readiness a mostrar: la del backend (con sobrecapacidad) si ya hubo un write;
  // si no, la de presencia (falta unidad/chofer/vendedor) derivada localmente.
  const coverage = assignReadiness || resourceReadiness(assignment)

  const loadData = useCallback(async () => {
    setPhase((p) => (p === 'ready' ? 'ready' : 'loading'))
    try {
      const [routeRows, polyRows, resRows] = await Promise.all([
        getRouteTemplatesForPlanning(dateTarget),
        getPlanningPolygons().catch((e) => { logScreenError('PlanearManana', 'getPlanningPolygons', e); return [] }),
        getAvailableResources(dateTarget).catch((e) => { logScreenError('PlanearManana', 'getAvailableResources', e); return null }),
      ])
      const normRoutes = unwrapList(routeRows).map(normalizeRoutePlanningRow)
      const normPolys = unwrapList(polyRows)
      setRoutes(normRoutes)
      setPolygons(normPolys)
      setResources(resRows?.data ?? resRows ?? null)
      setPolygonId((cur) => (cur && normPolys.some((p) => optionId(p) === cur)) ? cur : (normPolys[0] ? optionId(normPolys[0]) : ''))
      setPhase('ready')
      setLoadError(null)
    } catch (e) {
      logScreenError('PlanearManana', 'loadData', e)
      setLoadError(getSupervisorRouteErrorMessage(e))
      setPhase('error')
    }
  }, [dateTarget])

  useEffect(() => { loadData() }, [loadData])

  // Subpolígonos del polígono elegido.
  useEffect(() => {
    if (!polygonId) { setSubpolygons([]); setSubpolygonId(''); return undefined }
    let cancelled = false
    getPlanningSubpolygons(polygonId)
      .then((rows) => { if (!cancelled) setSubpolygons(unwrapList(rows)) })
      .catch((e) => { logScreenError('PlanearManana', 'getPlanningSubpolygons', e); if (!cancelled) setSubpolygons([]) })
    return () => { cancelled = true }
  }, [polygonId])

  // Búsqueda de clientes (debounce), solo en detalle y con plan editable.
  useEffect(() => {
    const needle = query.trim()
    if (view !== 'detail' || needle.length < 2) { setResults([]); return undefined }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const rows = await searchPlanningCustomers(needle)
        if (!cancelled) setResults(unwrapList(rows).map(normalizeCustomerSearchResult).filter((c) => c.id))
      } catch (e) { logScreenError('PlanearManana', 'searchPlanningCustomers', e); if (!cancelled) setResults([]) }
    }, 320)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, view])

  async function loadPlanCustomers(planId) {
    if (!planId) { setPreviewCustomers([]); return }
    try {
      const rows = await getRouteStops(planId)
      setPreviewCustomers(unwrapList(rows).map((row) => normalizeRoutePlanCustomer({ ...row, source: row.source || 'existing' })))
    } catch (e) {
      logScreenError('PlanearManana', 'getRouteStops', e)
      setPreviewCustomers([])
      flash(getSupervisorRouteErrorMessage(e))
    }
  }

  async function handlePrepare(route) {
    if (!route?.route_id) return
    setPreparing(route.route_id)
    try {
      const criteria = buildRoutePlanCriteriaPayload({
        routeId: route.route_id, dateTarget, polygonId, subpolygonId,
        channelIds: [], visitDays: [], timeWindowId: null, demandClasses,
      })
      const res = await ensureDailyRoutePlan(route.route_id, dateTarget, criteria)
      if (res?.ok === false) { flash(getSupervisorRouteErrorMessage(res), 5000); return }
      const planId = res?.route_plan_id || res?.plan_id || res?.id || route.plan_id || null
      setSelectedRouteId(route.route_id)
      setRoutePlanId(planId)
      setAssignReadiness(null)  // readiness fresca por plan; se llena al primer write
      setView('detail')
      await loadData()
      if (planId) await loadPlanCustomers(planId)
    } catch (e) {
      logScreenError('PlanearManana', 'ensureDailyRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally {
      setPreparing(null)
    }
  }

  async function handlePreview() {
    if (!selectedRoute) { flash('Selecciona una ruta'); return }
    if (!polygonId) { flash('Elige un polígono para generar la propuesta'); return }
    const reqId = ++previewReq.current
    setPreviewing(true)
    try {
      const payload = buildRoutePlanPreviewPayload({
        routeId: selectedRoute.route_id, dateTarget, polygonId,
        subpolygonIds: subpolygonId ? [subpolygonId] : [],
        channelIds: [], visitDays: [], timeWindowId: null, demandClasses,
      })
      const resp = await previewRoutePlanCustomers(payload)
      if (previewReq.current !== reqId) return
      if (resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error' || String(resp?.data?.status || '').toLowerCase() === 'error') {
        flash(getSupervisorRouteErrorMessage(resp), 5000); return
      }
      const data = resp?.data || resp || {}
      setRoutePlanId((cur) => data.route_plan_id || data.plan_id || cur || null)
      const rows = Array.isArray(data) ? data : (data.customers || data.items || data.records || [])
      setPreviewCustomers(rows.map(normalizeRoutePlanCustomer))
      await loadData()
      if (previewReq.current === reqId) flash('Propuesta generada')
    } catch (e) {
      if (previewReq.current !== reqId) return
      logScreenError('PlanearManana', 'previewRoutePlanCustomers', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally {
      if (previewReq.current === reqId) setPreviewing(false)
    }
  }

  async function handleAdd(customer) {
    if (!canEdit) { flash('Este plan no permite modificar clientes', 4000); return }
    if (!routePlanId) { flash('Genera primero la propuesta'); return }
    setRowBusy(`add-${customer.id}`)
    try {
      const res = await addCustomerToRoutePlan(routePlanId, customer.id, '')
      if (res?.ok === false || String(res?.status || '').toLowerCase() === 'error' || String(res?.data?.status || '').toLowerCase() === 'error') throw res
      const data = res?.data || res || {}
      const added = data.customer
        ? normalizeRoutePlanCustomer(data.customer)
        : normalizeRoutePlanCustomer({ id: data.stop_id || customer.id, stop_id: data.stop_id || 0, customer_id: customer.id, name: customer.name, address: customer.address, source: 'manual' })
      setPreviewCustomers((cur) => {
        const key = String(added.customer_id || added.id || customer.id || '')
        if (!key || cur.some((it) => String(it.customer_id || it.id || '') === key)) return cur
        return [...cur, added]
      })
      setQuery(''); setResults([])
    } catch (e) {
      logScreenError('PlanearManana', 'addCustomerToRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally { setRowBusy(null) }
  }

  async function handleRemove(customer) {
    if (!routePlanId || !canEdit) return
    setRowBusy(`remove-${customer.stop_id || customer.id}`)
    try {
      const res = await removeCustomerFromRoutePlan(routePlanId, customer)
      if (res?.ok === false || String(res?.status || '').toLowerCase() === 'error' || String(res?.data?.status || '').toLowerCase() === 'error') throw res
      setPreviewCustomers((cur) => cur.filter((it) => customer.stop_id
        ? String(it.stop_id || '') !== String(customer.stop_id)
        : String(it.customer_id || it.id || '') !== String(customer.customer_id || customer.id || '')))
    } catch (e) {
      logScreenError('PlanearManana', 'removeCustomerFromRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally { setRowBusy(null) }
  }

  async function handlePublish() {
    if (publishing || !routePlanId) { if (!routePlanId) flash('Genera primero la propuesta'); return }
    if (!readiness?.publishable) { flash('Este plan no se puede publicar en su estado actual'); return }
    setPublishing(true)
    try {
      const resp = await publishRoutePlan(routePlanId)
      if (resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error' || String(resp?.data?.status || '').toLowerCase() === 'error') throw resp
      flash('Ruta publicada para mañana')
      await loadData()
      setView('list'); setRoutePlanId(null); setPreviewCustomers([]); setQuery(''); setResults([])
    } catch (e) {
      logScreenError('PlanearManana', 'publishRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally { setPublishing(false) }
  }

  function toggleDemand(cls) {
    setDemandClasses((cur) => cur.includes(cls) ? cur.filter((c) => c !== cls) : [...cur, cls])
  }

  // Asignar/reasignar UN recurso (unidad/chofer/vendedor). `value` vacío = no
  // hace nada (no soportamos desasignar por ahora). Tras éxito, guarda la
  // readiness autoritativa del backend y recarga recursos (para reflejar
  // ocupación en las demás rutas). Un CONFLICT muestra el mensaje y no cambia.
  async function handleAssign(field, value) {
    const id = Number(value || 0)
    if (!routePlanId || !id) return
    setAssignBusy(field)
    try {
      const resp = await assignRoutePlanResources(routePlanId, { [field]: id })
      const status = String(resp?.status || (resp?.ok === false ? 'error' : 'ok')).toLowerCase()
      if (status === 'error' || resp?.ok === false) {
        flash(resp?.user_message || resp?.message || getSupervisorRouteErrorMessage(resp), 5000)
        return
      }
      const data = resp?.data || resp || {}
      if (data.readiness) setAssignReadiness(data.readiness)
      flash('Recurso asignado')
      await loadData()  // refresca ocupación; assignment se re-deriva de resources
    } catch (e) {
      logScreenError('PlanearManana', 'assignRoutePlanResources', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally { setAssignBusy(null) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = (
    <div data-testid="planear-header" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {view === 'detail' && (
          <button type="button" data-testid="planear-volver" aria-label="Volver a rutas" onClick={() => { setView('list'); setQuery(''); setResults([]) }}
            style={{ minHeight: 36, minWidth: 36, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.blue3, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>‹</button>
        )}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Planear mañana</h1>
          <div data-testid="planear-fecha" style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2, textTransform: 'capitalize' }}>{dateHuman(dateTarget)}</div>
        </div>
      </div>
    </div>
  )

  const shell = (children) => (
    <div data-testid="planear-panel" data-theme="brand-light" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      {header}
      {children}
      <Toast text={msg} />
    </div>
  )

  if (phase === 'loading') {
    return shell(<Card testid="planear-loading"><div style={{ fontSize: 13, color: C.textMuted }}>Cargando rutas de mañana…</div></Card>)
  }

  if (phase === 'error') {
    return shell(
      <StateScreen tokens={T} tone="error" testid="planear-error"
        title="No se pudieron cargar las rutas" detail={`El servidor respondió ${loadError}.`}
        actionLabel="Reintentar" onAction={loadData} />,
    )
  }

  if (view === 'detail' && selectedRoute) {
    return shell(
      <>
        <Card testid="planear-detalle-cabecera">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{selectedRoute.route_name || `Ruta #${selectedRoute.route_id}`}</div>
            <Chip text={readiness.stateLabel} tone={readiness.published ? 'ok' : 'info'} />
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
            {selectedRoute.employee_name ? `Vendedor: ${selectedRoute.employee_name}` : 'Sin vendedor asignado'}
          </div>
        </Card>

        {/* Criterios de la propuesta */}
        <Card testid="planear-criterios">
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Criterios de la propuesta</div>
          <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Polígono</label>
          <select data-testid="planear-poligono" value={polygonId} onChange={(e) => setPolygonId(e.target.value)}
            style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 10px', marginBottom: 10 }}>
            {polygons.length === 0 && <option value="">Sin polígonos disponibles</option>}
            {polygons.map((p) => <option key={optionId(p)} value={optionId(p)}>{optionLabel(p)}</option>)}
          </select>
          {subpolygons.length > 0 && (
            <>
              <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Subpolígono (opcional)</label>
              <select data-testid="planear-subpoligono" value={subpolygonId} onChange={(e) => setSubpolygonId(e.target.value)}
                style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 10px', marginBottom: 10 }}>
                <option value="">Todos</option>
                {subpolygons.map((s) => <option key={optionId(s)} value={optionId(s)}>{optionLabel(s)}</option>)}
              </select>
            </>
          )}
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Clase de demanda (opcional)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {DEMAND_CLASSES.map((cls) => {
              const on = demandClasses.includes(cls)
              return (
                <button key={cls} type="button" data-testid={`planear-demanda-${cls}`} aria-pressed={on} onClick={() => toggleDemand(cls)}
                  style={{ minHeight: 36, padding: '0 14px', borderRadius: R.pill, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue : C.surface, color: on ? '#fff' : C.textMuted, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{cls}</button>
              )
            })}
          </div>
          <PrimaryButton testid="planear-generar" onClick={handlePreview} busy={previewing} disabled={!polygonId}>
            {previewCustomers.length > 0 ? 'Regenerar propuesta' : 'Generar propuesta'}
          </PrimaryButton>
        </Card>

        {/* Clientes del plan */}
        <Card testid="planear-clientes">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Clientes del día</div>
            <Chip text={`${previewCustomers.length} en ruta`} tone={previewCustomers.length > 0 ? 'ok' : 'neutral'} />
          </div>

          {canEdit && (
            <div style={{ marginBottom: 10 }}>
              <input data-testid="planear-buscar-cliente" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente para agregar…"
                style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 12px' }} />
              {results.length > 0 && (
                <div style={{ marginTop: 6, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'hidden' }}>
                  {results.slice(0, 8).map((c) => (
                    <button key={c.id} type="button" data-testid="planear-resultado-cliente" onClick={() => handleAdd(c)} disabled={rowBusy === `add-${c.id}`}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.name}</div>
                      {c.address && <div style={{ fontSize: 11.5, color: C.textMuted }}>{c.address}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {previewCustomers.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.textMuted }}>Aún no hay clientes. Genera la propuesta o agrega manualmente.</div>
          ) : (
            <div>{previewCustomers.map((c) => (
              <CustomerRow key={c.stop_id || c.id || c.customer_id} customer={c} onRemove={handleRemove} canEdit={canEdit} removing={rowBusy === `remove-${c.stop_id || c.id}`} />
            ))}</div>
          )}
        </Card>

        {/* Recursos ACCIONABLES: asignar/reasignar unidad, chofer y vendedor */}
        {resources && routePlanId && (
          <ResourcePicker
            resources={resources}
            planId={routePlanId}
            assignment={assignment}
            coverage={coverage}
            onAssign={handleAssign}
            busyField={assignBusy}
          />
        )}

        {/* Readiness + publicar */}
        <Card testid="planear-readiness">
          {readiness.publishable ? (
            <div style={{ fontSize: 13, color: C.success, fontWeight: 700, marginBottom: 10 }}>Lista para publicar: {readiness.customersCount} cliente(s).</div>
          ) : (
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>{readiness.reasons[0] || 'Completa la preparación para publicar.'}</div>
          )}
          {!readiness.published && (
            <PrimaryButton testid="planear-publicar" tone="green" onClick={handlePublish} busy={publishing} disabled={!readiness.publishable}>
              Publicar ruta de mañana
            </PrimaryButton>
          )}
        </Card>
      </>,
    )
  }

  // Vista lista
  return shell(
    <>
      {resources && <ResourcesSummary resources={resources} />}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '2px 0 10px' }}>Rutas para mañana</div>
        {routes.length === 0 ? (
          <StateScreen tokens={T} testid="planear-sin-rutas"
            title="Sin rutas para preparar" detail="No hay rutas del CEDIS asignadas para esta fecha." />
        ) : routes.map((r) => (
          <RouteRow key={r.route_id} route={r} onPrepare={handlePrepare} busy={preparing === r.route_id} />
        ))}
      </div>
      {resources && <ResourceLists resources={resources} />}
    </>,
  )
}
