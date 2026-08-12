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
// NET-NEW: /available-resources y /route-plan-assign-resources. La supervisora
//   puede asignar recursos del día; el backend devuelve la readiness
//   autoritativa, que también bloquea la publicación cuando corresponde.
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
  getPlanningSegments,
  ensureDailyRoutePlan,
  previewRoutePlanCustomers,
  addCustomerToRoutePlan,
  removeCustomerFromRoutePlan,
  optimizeRoutePlan,
  publishRoutePlan,
  searchPlanningCustomers,
  getRouteStops,
  getRoutePlanReadiness,
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
  interpretOptimizeResponse,
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
        Puedes asignar recursos al abrir una ruta; los ocupados en otra ruta no se pueden doblar.
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
        currentId={assignment?.vehicle?.id || ''} busy={Boolean(busyField)}
        onChange={(v) => onAssign('vehicle_id', v)}
      />
      <ResourcePickerRow
        label="Chofer" testid="planear-asignar-chofer"
        options={resourceOptions(drivers, planId, assignment?.driver?.id)}
        currentId={assignment?.driver?.id || ''} busy={Boolean(busyField)}
        onChange={(v) => onAssign('driver_employee_id', v)}
      />
      <ResourcePickerRow
        label="Vendedor" testid="planear-asignar-vendedor"
        options={resourceOptions(sellers, planId, assignment?.salesperson?.id)}
        currentId={assignment?.salesperson?.id || ''} busy={Boolean(busyField)}
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

export default function PlanearMananaTab({ initialRouteId = 0, initialPolygonId = 0, initialSubpolygonId = 0, initialSegmentId = 0, onExit = null }) {
  const navigate = useNavigate()
  const dateTarget = getTomorrowDateString()
  // Se entró desde una fila de SEGMENTO operativo (sin zona geográfica heredada):
  // la propuesta debería salir SOLO de la lista curada del segmento.
  const segmentOnlyPlan = Boolean(initialSegmentId) && !initialPolygonId

  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)
  const autoOpenedRef = useRef(false)
  // Herencia de zona: si vino de la matriz con polígono/subpolígono, se preselecciona
  // y se muestra como DATO (no como pregunta). "Cambiar zona" revela los selectores.
  const zoneInherited = Boolean(initialPolygonId || initialSubpolygonId || initialSegmentId)
  const [showZoneEditor, setShowZoneEditor] = useState(false)
  const zoneSubAppliedRef = useRef(false)
  const zoneSegAppliedRef = useRef(false)
  const [routes, setRoutes] = useState([])
  const [polygons, setPolygons] = useState([])
  const [subpolygons, setSubpolygons] = useState([])
  const [segments, setSegments] = useState([])
  const [resources, setResources] = useState(null)

  const [view, setView] = useState('list') // list | detail
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [routePlanId, setRoutePlanId] = useState(null)
  const [previewCustomers, setPreviewCustomers] = useState([])

  const [polygonId, setPolygonId] = useState('')
  const [subpolygonId, setSubpolygonId] = useState('')
  // Se inicializa SÍNCRONO desde initialSegmentId (Codex P1): la autoapertura
  // (handlePrepare al cargar rutas) corre ANTES de que resuelva el fetch de
  // segmentos; si segmentId arrancara vacío, el primer ensure de un plan SO iría
  // sin polígono ni segmento ⇒ polygon_required, y autoOpenedRef bloquea el
  // reintento. Con el valor ya puesto, el primer ensure lleva su segment_id.
  const [segmentId, setSegmentId] = useState(initialSegmentId ? String(initialSegmentId) : '')
  const [demandClasses, setDemandClasses] = useState([])

  const [preparing, setPreparing] = useState(null)   // route_id en preparación
  const [previewing, setPreviewing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  // Resultado de la última optimización (F5/B5): paradas · km · min + revisión.
  // Se muestra tras "Optimizar y publicar" para que el número sea visible.
  const [optimizeResult, setOptimizeResult] = useState(null)
  const [rowBusy, setRowBusy] = useState(null)        // add-/remove-<id>
  const [assignBusy, setAssignBusy] = useState(null)  // vehicle_id | driver_employee_id | salesperson_employee_id
  const [assignReadiness, setAssignReadiness] = useState(null)  // readiness del backend (incluye sobrecapacidad)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [msg, setMsg] = useState(null)

  const msgTimer = useRef(null)
  const previewReq = useRef(0)
  const resourceReq = useRef(0)

  const flash = useCallback((text, ms = 2600) => {
    setMsg(text)
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), ms)
  }, [])

  const selectedRoute = routes.find((r) => Number(r.route_id) === Number(selectedRouteId)) || null
  const canEdit = canEditRoutePlanCustomers(selectedRoute || {})
  // Asignación actual del plan: derivada de available-resources (marca qué recurso
  // trae ESTE plan). Tras cada write se recarga resources ⇒ se re-deriva sola.
  const assignment = routePlanId ? derivePlanAssignment(resources || {}, routePlanId) : { vehicle: null, driver: null, salesperson: null }
  // Readiness a mostrar: la del backend (con sobrecapacidad) si ya hubo un write;
  // si no, la de presencia (falta unidad/chofer/vendedor) derivada localmente.
  const coverage = assignReadiness || resourceReadiness(assignment)
  const readiness = selectedRoute ? routeReadiness(selectedRoute, previewCustomers.length, coverage) : null
  // Recursos "vacíos" = no llegó ninguna unidad NI persona de la sucursal. Estado
  // honesto: no se oculta el bloque de asignar; se muestra error + reintento.
  const resourcesEmpty = !resources
    || ((!Array.isArray(resources.vehicles) || resources.vehicles.length === 0)
        && (!Array.isArray(resources.people) || resources.people.length === 0))
  // Etiquetas de la zona heredada (para mostrarla como dato, no como pregunta).
  const currentPolyLabel = optionLabel(polygons.find((p) => optionId(p) === String(polygonId)) || {})
  const currentSubLabel = subpolygonId ? optionLabel(subpolygons.find((s) => optionId(s) === String(subpolygonId)) || {}) : ''
  const currentSegLabel = segmentId ? optionLabel(segments.find((s) => optionId(s) === String(segmentId)) || {}) : ''
  // F2.2: la fila heredó un polígono que NO resuelve entre los disponibles. No se
  // arma con otra zona en silencio: se pide elegirla (estado honesto + selector).
  const zoneUnresolved = Boolean(initialPolygonId) && !segmentOnlyPlan && polygons.length > 0
    && !polygons.some((p) => Number(optionId(p)) === Number(initialPolygonId))
  const showZoneSelectors = !zoneInherited || showZoneEditor || zoneUnresolved

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
      // La zona heredada de la fila gana la preselección del polígono; si no vino
      // (o ya no existe), se conserva la actual o se cae al primero.
      // Si se entró por un SEGMENTO operativo (plan SO), NO se preselecciona un
      // polígono: la propuesta la arma la lista curada del segmento (server-side),
      // no una zona. Preseleccionar "el primero" armaría por zona, que no es el
      // plan. El polígono queda vacío a propósito.
      setPolygonId((cur) => {
        // Zona heredada de la fila: úsala SOLO si resuelve entre los polígonos
        // disponibles. Si NO resuelve, queda vacío y se marca "zona sin resolver"
        // (F2.2) — jamás se arma con OTRA zona en silencio.
        if (initialPolygonId) {
          return normPolys.some((p) => Number(optionId(p)) === Number(initialPolygonId)) ? String(initialPolygonId) : ''
        }
        if (segmentOnlyPlan) return ''
        // Sin herencia: conserva la elección actual; NO preselecciona "el primero"
        // (default silencioso del primer polígono eliminado). El selector arranca
        // vacío y la supervisora elige la zona.
        return (cur && normPolys.some((p) => optionId(p) === cur)) ? cur : ''
      })
      setPhase('ready')
      setLoadError(null)
    } catch (e) {
      logScreenError('PlanearManana', 'loadData', e)
      setLoadError(getSupervisorRouteErrorMessage(e))
      setPhase('error')
    }
  }, [dateTarget, initialPolygonId, segmentOnlyPlan])

  useEffect(() => { loadData() }, [loadData])

  // Apertura directa desde la matriz semanal: si llega initialRouteId, entra al
  // detalle de esa ruta apenas cargan las rutas (una sola vez).
  useEffect(() => {
    if (autoOpenedRef.current || !initialRouteId || phase !== 'ready') return
    const route = routes.find((r) => Number(r.route_id) === Number(initialRouteId))
    if (route) { autoOpenedRef.current = true; handlePrepare(route) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRouteId, phase, routes])

  // Subpolígonos del polígono elegido.
  useEffect(() => {
    if (!polygonId) { setSubpolygons([]); setSubpolygonId(''); return undefined }
    let cancelled = false
    getPlanningSubpolygons(polygonId)
      .then((rows) => {
        if (cancelled) return
        const list = unwrapList(rows)
        setSubpolygons(list)
        // Preselección ÚNICA del subpolígono heredado de la fila (si existe en el
        // polígono cargado). No pisa una elección manual posterior.
        if (!zoneSubAppliedRef.current && initialSubpolygonId
          && list.some((s) => Number(optionId(s)) === Number(initialSubpolygonId))) {
          zoneSubAppliedRef.current = true
          setSubpolygonId((cur) => cur || String(initialSubpolygonId))
        }
      })
      .catch((e) => { logScreenError('PlanearManana', 'getPlanningSubpolygons', e); if (!cancelled) setSubpolygons([]) })
    return () => { cancelled = true }
  }, [polygonId, initialSubpolygonId])

  // Segmentos operativos de la sucursal (escopo server-side por token). NO se
  // filtran por polígono/subpolígono: un segmento es una LISTA CURADA de clientes
  // (partner_ids) y su polígono es solo referencia — en la sucursal 29, 4 de 5
  // segmentos no tienen polígono, así que filtrar por la zona heredada los
  // borraba todos y la pantalla mentía con "Sin segmentos operativos".
  useEffect(() => {
    let cancelled = false
    getPlanningSegments()
      .then((res) => {
        if (cancelled) return
        const payload = res?.segments ? res : (res?.data || {})
        const list = Array.isArray(payload.segments) ? payload.segments : []
        setSegments(list)
        // Preselección ÚNICA del segmento heredado (plan operativo tipo SO).
        if (!zoneSegAppliedRef.current && initialSegmentId
          && list.some((s) => Number(s?.id) === Number(initialSegmentId))) {
          zoneSegAppliedRef.current = true
          setSegmentId((cur) => cur || String(initialSegmentId))
        }
      })
      .catch((e) => { logScreenError('PlanearManana', 'getPlanningSegments', e); if (!cancelled) setSegments([]) })
    return () => { cancelled = true }
  }, [initialSegmentId])

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

  // F1: invalidar la readiness cacheada del backend ⇒ null, para que `coverage`
  // (línea ~411) caiga a la derivación LOCAL `resourceReadiness(assignment)` —
  // presencia de unidad/chofer/vendedor, ya reflejada en `resources`. Antes se
  // hacía un POST a assign-resources con payload vacío para "leer" la readiness;
  // pero ese endpoint responde VALIDATION_ERROR ("Nada que asignar") sin recursos
  // ⇒ el semáforo quedaba en `blocked` con los tres selectores llenos (el bug de
  // "asignar varias veces"). La readiness autoritativa del servidor (con
  // sobrecapacidad) vuelve con el DTO de un assign real (handleAssign); el GET
  // readiness dedicado (B1) la restituirá para add/remove/preview.
  function invalidateResourceReadiness() {
    resourceReq.current += 1
    // Codex P1 (3ª): estado 'blocked' (verificando) mientras se pide la readiness
    // AUTORITATIVA (B1). NO se cae a la derivación local en la ventana EN VUELO — si
    // no, tras preparar/previsualizar y antes de que responda B1, publish podría
    // habilitarse por la derivación local (que no conoce sobrecapacidad server-side).
    // refreshReadinessFromServer lo resuelve: authoritative, blocked (error real), o
    // null/local SOLO con 404 (capacidad ausente, backend pre-B1).
    setAssignReadiness({ coverage_state: 'blocked', blockers: ['Verificando la cobertura con el servidor…'] })
  }

  // B1 (F1↔B1, Codex P1): tras una mutación lee la readiness AUTORITATIVA del
  // servidor (conoce sobrecapacidad y bloqueos que la derivación local NO ve, y que
  // podrían habilitar publicar por error). Si el endpoint aún no está desplegado o no
  // devuelve readiness, degrada a la derivación local (setAssignReadiness(null) ⇒
  // coverage local) — sigue mejor que el POST vacío, y se cierra al desplegar B1.
  async function refreshReadinessFromServer(planId) {
    if (!planId) return
    const reqId = ++resourceReq.current
    // Codex P1 (2ª): un resultado NO autoritativo NO debe habilitar publicar por la
    // derivación local (que no conoce sobrecapacidad ni bloqueos del backend). Se
    // BLOQUEA. La única excepción es la señal EXPLÍCITA de capacidad ausente: la ruta
    // B1 no existe (HTTP 404 ⇒ backend pre-B1) ⇒ compatibilidad transitoria con la
    // derivación local. Cualquier otro error (500, red, FORBIDDEN, envelope de error,
    // ok:false) bloquea.
    const blocked = { coverage_state: 'blocked', blockers: ['No se pudo verificar la cobertura con el servidor. Reintenta.'] }
    try {
      const resp = await getRoutePlanReadiness(planId)
      if (reqId !== resourceReq.current) return
      const isErr = resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error'
      const data = resp?.data || resp || {}
      if (!isErr && data.readiness) { setAssignReadiness(data.readiness); return }
      setAssignReadiness(blocked)
    } catch (e) {
      if (reqId !== resourceReq.current) return
      const status = Number(e?.status || 0)
      if (status === 404) {
        // Capacidad ausente (endpoint B1 no desplegado): derivación local transitoria.
        setAssignReadiness(null)
        return
      }
      logScreenError('PlanearManana', 'getRoutePlanReadiness', e)
      setAssignReadiness(blocked)
    }
  }

  async function handlePrepare(route) {
    if (!route?.route_id) return
    setPreparing(route.route_id)
    try {
      const criteria = buildRoutePlanCriteriaPayload({
        routeId: route.route_id, dateTarget, polygonId, subpolygonId, segmentId,
        channelIds: [], visitDays: [], timeWindowId: null, demandClasses,
      })
      const res = await ensureDailyRoutePlan(route.route_id, dateTarget, criteria)
      if (res?.ok === false) { flash(getSupervisorRouteErrorMessage(res), 5000); return }
      const planId = res?.route_plan_id || res?.plan_id || res?.id || route.plan_id || null
      setSelectedRouteId(route.route_id)
      setRoutePlanId(planId)
      invalidateResourceReadiness()
      setView('detail')
      await loadData()
      if (planId) {
        await loadPlanCustomers(planId)
        await refreshReadinessFromServer(planId)
      }
    } catch (e) {
      logScreenError('PlanearManana', 'ensureDailyRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally {
      setPreparing(null)
    }
  }

  async function handlePreview() {
    if (!selectedRoute) { flash('Selecciona una ruta'); return }
    // Plan por SEGMENTO (lista curada): ya existe server-side. Sin polígono, el
    // backend propone los MIEMBROS del segmento (no clientes ajenos). Antes esto
    // se bloqueaba porque el server viejo no sabía planear por segmento; ahora se
    // deja pasar con segment_id y sin zona. Si el backend desplegado aún fuera el
    // viejo, responderá polygon_required y la vista lo muestra como error honesto.
    if (segmentOnlyPlan) {
      if (!segmentId) { flash('Este plan no trae segmento resoluble.'); return }
      // sigue sin polígono: la propuesta la arma el segmento.
    } else if (!polygonId) {
      flash('Elige una zona para generar la propuesta'); return
    }
    const reqId = ++previewReq.current
    invalidateResourceReadiness()
    setPreviewing(true)
    try {
      const payload = buildRoutePlanPreviewPayload({
        routeId: selectedRoute.route_id, dateTarget, polygonId,
        subpolygonIds: subpolygonId ? [subpolygonId] : [], segmentId,
        channelIds: [], visitDays: [], timeWindowId: null, demandClasses,
      })
      const resp = await previewRoutePlanCustomers(payload)
      if (previewReq.current !== reqId) return
      if (resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error' || String(resp?.data?.status || '').toLowerCase() === 'error') {
        flash(getSupervisorRouteErrorMessage(resp), 5000); return
      }
      const data = resp?.data || resp || {}
      const planId = data.route_plan_id || data.plan_id || routePlanId || null
      setRoutePlanId(planId)
      const rows = Array.isArray(data) ? data : (data.customers || data.items || data.records || [])
      setPreviewCustomers(rows.map(normalizeRoutePlanCustomer))
      await loadData()
      if (planId) await refreshReadinessFromServer(planId)
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
    invalidateResourceReadiness()
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
      await refreshReadinessFromServer(routePlanId)
    } catch (e) {
      logScreenError('PlanearManana', 'addCustomerToRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally { setRowBusy(null) }
  }

  async function handleRemove(customer) {
    if (!routePlanId || !canEdit) return
    invalidateResourceReadiness()
    setRowBusy(`remove-${customer.stop_id || customer.id}`)
    try {
      const res = await removeCustomerFromRoutePlan(routePlanId, customer)
      if (res?.ok === false || String(res?.status || '').toLowerCase() === 'error' || String(res?.data?.status || '').toLowerCase() === 'error') throw res
      setPreviewCustomers((cur) => cur.filter((it) => customer.stop_id
        ? String(it.stop_id || '') !== String(customer.stop_id)
        : String(it.customer_id || it.id || '') !== String(customer.customer_id || customer.id || '')))
      await refreshReadinessFromServer(routePlanId)
    } catch (e) {
      logScreenError('PlanearManana', 'removeCustomerFromRoutePlan', e)
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally { setRowBusy(null) }
  }

  // Corre el optimizador (B5) sobre el plan y guarda la revisión + métricas.
  // Contrato optimize↔publish (Codex P1): SOLO un éxito con `plan_revision`
  // habilita publicar. Cualquier otro desenlace BLOQUEA la publicación:
  //   · error explícito del backend (FORBIDDEN/LOCKED/VALIDATION/NOT_FOUND/
  //     CONFLICT/CAPABILITY_UNAVAILABLE/red) — incluido el solver caído;
  //   · un "éxito" malformado SIN revisión (contrato incompleto).
  // No degradamos a publicar directo: con el flag de publish apagado eso dejaría
  // publicar una ruta que no podemos anclar a una revisión verificable, y
  // CAPABILITY_UNAVAILABLE es ambiguo en el front (optimizador ausente vs
  // autoridad de sucursal rota comparten code y el shim no expone el motivo).
  async function runOptimize(planId) {
    const opt = await optimizeRoutePlan(planId)
    const { revision, blocked, message, metrics } = interpretOptimizeResponse(opt)
    setOptimizeResult(metrics)
    return { revision, blocked, message }
  }

  async function handlePublish() {
    // Codex P1 (3ª): tampoco publicar mientras se prepara/previsualiza (readiness
    // autoritativa en vuelo). El estado 'blocked' de invalidate ya deshabilita el
    // botón; esto cierra también la ruta programática.
    if (publishing || assignBusy || rowBusy || preparing || previewing || !routePlanId) {
      if (!routePlanId) flash('Genera primero la propuesta')
      else if (assignBusy) flash('Espera la validación de recursos antes de publicar')
      else if (rowBusy) flash('Espera que termine la modificación de clientes')
      else if (preparing || previewing) flash('Espera a que termine de verificarse el plan')
      return
    }
    if (!readiness?.publishable) { flash('Este plan no se puede publicar en su estado actual'); return }
    setPublishing(true)
    try {
      // 1) Optimizar (reordena + revisión). Si el optimizador falla de verdad, NO
      //    se publica una ruta sin secuencia.
      const first = await runOptimize(routePlanId)
      if (first.blocked) {
        flash(first.message || 'El optimizador no pudo secuenciar la ruta. Intenta de nuevo o avisa a soporte.', 6000)
        return
      }
      // 2) Publicar con la revisión. Un revision_mismatch (alguien mutó el plan
      //    entre optimizar y publicar) ⇒ reoptimiza UNA vez y reintenta.
      let resp = await publishRoutePlan(routePlanId, first.revision)
      if (String(resp?.code || resp?.data?.code || '').toLowerCase() === 'revision_mismatch') {
        const again = await runOptimize(routePlanId)
        if (again.blocked) {
          flash(again.message || 'El optimizador no pudo secuenciar la ruta.', 6000)
          return
        }
        resp = await publishRoutePlan(routePlanId, again.revision)
      }
      if (resp?.ok === false || String(resp?.status || '').toLowerCase() === 'error' || String(resp?.data?.status || '').toLowerCase() === 'error') throw resp
      flash('Ruta optimizada y publicada para mañana')
      await loadData()
      setView('list'); setRoutePlanId(null); setPreviewCustomers([]); setQuery(''); setResults([]); setOptimizeResult(null)
    } catch (e) {
      logScreenError('PlanearManana', 'optimizeAndPublish', e)
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
    if (assignBusy || !routePlanId || !id) return
    const reqId = ++resourceReq.current
    setAssignBusy(field)
    try {
      const resp = await assignRoutePlanResources(routePlanId, { [field]: id })
      const status = String(resp?.status || (resp?.ok === false ? 'error' : 'ok')).toLowerCase()
      if (reqId !== resourceReq.current) return
      if (status === 'error' || resp?.ok === false) {
        flash(resp?.user_message || resp?.message || getSupervisorRouteErrorMessage(resp), 5000)
        return
      }
      const data = resp?.data || resp || {}
      if (!data.readiness) {
        setAssignReadiness({
          coverage_state: 'blocked',
          blockers: ['No se pudo validar la cobertura de recursos.'],
        })
        flash('El servidor no confirmó la cobertura de recursos', 5000)
        await loadData()
        return
      }
      setAssignReadiness(data.readiness)
      flash('Recurso asignado')
      await loadData()  // refresca ocupación; assignment se re-deriva de resources
    } catch (e) {
      if (reqId !== resourceReq.current) return
      logScreenError('PlanearManana', 'assignRoutePlanResources', e)
      setAssignReadiness({
        coverage_state: 'blocked',
        blockers: ['No se pudo validar la cobertura de recursos.'],
      })
      flash(getSupervisorRouteErrorMessage(e), 5000)
    } finally {
      if (reqId === resourceReq.current) setAssignBusy(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = (
    <div data-testid="planear-header" style={{ marginBottom: 12 }}>
      {/* Vino de la matriz semanal: puerta de regreso a la portada. */}
      {onExit && view !== 'detail' && (
        <button type="button" data-testid="planear-a-semana" onClick={() => onExit()}
          style={{ marginBottom: 8, minHeight: 32, padding: '0 12px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.blue3, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>← Semana</button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {view === 'detail' && (
          <button type="button" data-testid="planear-volver" aria-label="Volver" onClick={() => { if (onExit) { onExit(); return } setView('list'); setQuery(''); setResults([]) }}
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
          {/* Contexto del PLAN por segmento (SO): antes se entraba a la lista
              genérica de rutas sin señal de que era "para armar Mercado". */}
          {segmentOnlyPlan && (
            <div data-testid="planear-plan-contexto" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', border: '1px solid #7c3aed', borderRadius: R.pill, padding: '2px 8px', whiteSpace: 'nowrap' }}>Segmento</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                Plan: {currentSegLabel || 'Segmento'}
                {previewCustomers.length > 0 ? <span style={{ fontWeight: 600, color: C.textMuted }}> · {previewCustomers.length} clientes</span> : null}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{selectedRoute.route_name || `Ruta #${selectedRoute.route_id}`}</div>
            <Chip text={readiness.stateLabel} tone={readiness.published ? 'ok' : 'info'} />
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
            {segmentOnlyPlan
              ? <>Esta es la ruta/vendedor que ejecutará el plan <strong>{currentSegLabel || 'del segmento'}</strong> mañana. Asigna <strong>unidad</strong>, <strong>chofer</strong> y <strong>vendedor</strong>, arma la lista del segmento y publica.</>
              : <>Asigna abajo la <strong>unidad</strong>, el <strong>chofer</strong> y el <strong>vendedor</strong> de esta ruta; luego arma la lista de clientes y publica.</>}
          </div>
        </Card>

        {/* Recursos ACCIONABLES — PROTAGONISTA: asignar/reasignar unidad, chofer y
            vendedor va PRIMERO (antes se enterraba bajo la lista de clientes). Estado
            honesto: si no llegaron recursos de la sucursal, no se oculta el bloque. */}
        {routePlanId && (
          resourcesEmpty ? (
            <StateScreen tokens={T} tone="error" testid="planear-recursos-error"
              title="No se pudieron cargar los recursos de la sucursal"
              detail="Sin unidades ni equipo para asignar en esta fecha. Reintenta o avisa al administrador."
              actionLabel="Reintentar" onAction={loadData} />
          ) : (
            <ResourcePicker
              resources={resources}
              planId={routePlanId}
              assignment={assignment}
              coverage={coverage}
              onAssign={handleAssign}
              busyField={assignBusy}
            />
          )
        )}

        {/* Criterios de la propuesta. Para un plan por SEGMENTO no hay zona: la
            lista es la curada del segmento. Para SP/P sigue siendo la zona. */}
        <Card testid="planear-criterios">
          {segmentOnlyPlan ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                Plan por segmento (lista curada)
              </div>
              <div data-testid="planear-segmento-so" style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                Se proponen los clientes del segmento
                {currentSegLabel ? <b style={{ color: C.text }}> {currentSegLabel}</b> : ''}.
                No hay zona que elegir: la lista es la del segmento.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>¿De qué zona propongo los clientes?</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                La zona geográfica de donde se arma la lista sugerida de clientes.
              </div>
            </>
          )}
          {/* F2.2: la zona heredada no resolvió ⇒ estado honesto, no se arma con
              otra en silencio. Se muestra el mensaje y el selector queda visible. */}
          {zoneUnresolved && (
            <div data-testid="planear-zona-sin-resolver" style={{ fontSize: 12.5, color: C.warning, fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>
              No pude resolver la zona de este plan — elígela abajo para armar la propuesta.
            </div>
          )}
          {/* Selectores de zona/segmento/demanda: solo para planes por ZONA. En un
              plan por segmento no aplican (la lista curada manda). */}
          {segmentOnlyPlan ? null : !showZoneSelectors ? (
            <div data-testid="planear-zona-heredada" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{currentSegLabel ? 'Segmento' : 'Zona'}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                  {currentSegLabel || (currentSubLabel || currentPolyLabel || 'Sin zona')}
                  {!currentSegLabel && currentSubLabel && currentPolyLabel ? <span style={{ fontSize: 11.5, fontWeight: 600, color: C.textMuted }}> · {currentPolyLabel}</span> : null}
                </div>
              </div>
              <GhostButton testid="planear-cambiar-zona" onClick={() => setShowZoneEditor(true)}>Cambiar zona</GhostButton>
            </div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Zona (polígono)</label>
              <select data-testid="planear-poligono" value={polygonId} onChange={(e) => setPolygonId(e.target.value)}
                style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 10px', marginBottom: 10 }}>
                {polygons.length === 0 && <option value="">Sin polígonos disponibles</option>}
                {polygons.map((p) => <option key={optionId(p)} value={optionId(p)}>{optionLabel(p)}</option>)}
              </select>
              {subpolygons.length > 0 && (
                <>
                  <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Sub-zona (opcional)</label>
                  <select data-testid="planear-subpoligono" value={subpolygonId} onChange={(e) => setSubpolygonId(e.target.value)}
                    style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 10px', marginBottom: 10 }}>
                    <option value="">Todas</option>
                    {subpolygons.map((s) => <option key={optionId(s)} value={optionId(s)}>{optionLabel(s)}</option>)}
                  </select>
                </>
              )}
            </>
          )}
          {/* Segmento operativo de la sucursal (lista curada). Escopado server-side.
              En un plan por segmento (SO) no se ofrece: el segmento ya está fijo. */}
          {!segmentOnlyPlan && (
          <>
          <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Segmento operativo (opcional)</label>
          {segments.length === 0 ? (
            <div data-testid="planear-segmentos-vacio" style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
              Sin segmentos operativos para esta sucursal.
            </div>
          ) : (
            <select data-testid="planear-segmento" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}
              style={{ width: '100%', minHeight: 44, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, padding: '0 10px', marginBottom: 10 }}>
              <option value="">Todos</option>
              {segments.map((s) => <option key={optionId(s)} value={optionId(s)}>{optionLabel(s)}</option>)}
            </select>
          )}
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 2 }}>Clase de demanda (opcional)</div>
          <div style={{ fontSize: 11, color: C.textLow, marginBottom: 8, lineHeight: 1.5 }}>
            Filtra por importancia del cliente (AA/A/B/C). Déjalo vacío para incluir todas.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {DEMAND_CLASSES.map((cls) => {
              const on = demandClasses.includes(cls)
              return (
                <button key={cls} type="button" data-testid={`planear-demanda-${cls}`} aria-pressed={on} onClick={() => toggleDemand(cls)}
                  style={{ minHeight: 36, padding: '0 14px', borderRadius: R.pill, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue : C.surface, color: on ? '#fff' : C.textMuted, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{cls}</button>
              )
            })}
          </div>
          </>
          )}
          <PrimaryButton testid="planear-generar" onClick={handlePreview} busy={previewing}
            disabled={segmentOnlyPlan ? !segmentId : !polygonId}>
            {previewCustomers.length > 0
              ? 'Volver a sugerir clientes'
              : (segmentOnlyPlan ? 'Sugerir clientes del segmento' : 'Sugerir clientes de la zona')}
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

        {/* Readiness + publicar */}
        <Card testid="planear-readiness">
          {readiness.publishable ? (
            <div style={{ fontSize: 13, color: C.success, fontWeight: 700, marginBottom: 10 }}>Lista para publicar: {readiness.customersCount} cliente(s).</div>
          ) : (
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>{readiness.reasons[0] || 'Completa la preparación para publicar.'}</div>
          )}
          {!readiness.published && (
            <PrimaryButton testid="planear-publicar" tone="green" onClick={handlePublish} busy={publishing} disabled={!readiness.publishable || Boolean(assignBusy || rowBusy || preparing || previewing)}>
              Optimizar y publicar
            </PrimaryButton>
          )}
          {optimizeResult && (
            <div data-testid="planear-optimizacion" style={{ marginTop: 10, fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
              {[
                optimizeResult.stops != null ? `${optimizeResult.stops} paradas` : null,
                optimizeResult.km != null ? `${optimizeResult.km} km` : null,
                optimizeResult.min != null ? `${optimizeResult.min} min de trayecto` : null,
              ].filter(Boolean).join(' · ') || 'Ruta optimizada'}
              {/* Carga esperada vs capacidad de la unidad (null ≠ 0: si el backend no
                  lo manda, no se inventa un 0). Utilización > 100% ⇒ no cabe. */}
              {(optimizeResult.demandKg != null || optimizeResult.capacityKg != null || optimizeResult.utilizationPct != null) && (
                <div data-testid="planear-optimizacion-carga" style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                  {[
                    optimizeResult.demandKg != null
                      ? `Carga ${optimizeResult.demandKg} kg${optimizeResult.capacityKg != null ? ` de ${optimizeResult.capacityKg} kg` : ''}`
                      : (optimizeResult.capacityKg != null ? `Capacidad ${optimizeResult.capacityKg} kg` : null),
                    optimizeResult.utilizationPct != null ? `${optimizeResult.utilizationPct}% de la unidad` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              )}
              {optimizeResult.unassigned > 0 && (
                <div data-testid="planear-optimizacion-noasignadas" style={{ fontSize: 11.5, fontWeight: 700, color: C.warning, marginTop: 3 }}>
                  {optimizeResult.unassigned} {optimizeResult.unassigned === 1 ? 'cliente no cupo' : 'clientes no cupieron'} en esta unidad
                </div>
              )}
              {optimizeResult.revision ? <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 2 }}>Revisión {optimizeResult.revision} — se publica exactamente esta secuencia</div> : null}
            </div>
          )}
        </Card>
      </>,
    )
  }

  // Vista lista
  return shell(
    <>
      {/* F2.1: se entró desde la matriz para un plan operativo SIN ruta (has_route
          false ⇒ no hay route.id que autoabrir). En vez de aterrizar sin contexto,
          se enmarca la lista como el SELECTOR de ruta para armar ese plan. */}
      {zoneInherited && !initialRouteId && (
        <Card testid="planear-elegir-ruta" style={{ borderColor: 'rgba(0,119,187,0.35)', background: 'rgba(0,119,187,0.06)', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.blue3, marginBottom: 2 }}>Este plan aún no tiene ruta</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>Elige abajo con qué ruta armar el plan de mañana. Al abrirla se hereda la zona{currentSegLabel ? ' / segmento' : ''} de este plan.</div>
        </Card>
      )}
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
