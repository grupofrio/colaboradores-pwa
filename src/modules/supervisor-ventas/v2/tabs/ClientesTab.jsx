// ─── Supervisor V2 · ClientesTab (contenedor) ────────────────────────────────
// Une el día operativo (planes del día) con route-stops segmentados + paneles
// create/edit dedicados. Create NUNCA agrega al plan automáticamente.
// Quitar del plan ≠ borrar partner (sin CTA de eliminación de maestro).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import DayStateGate from '../dayStateGate'
import ClientesView from '../clientes/ClientesView'
import CustomerFormPanel from '../clientes/CustomerFormPanel'
import { useOperationalDay } from '../useOperationalDay'
import { loadRouteStops, sourceVersion, PHASE } from '../dataSources'
import { segmentCustomers } from '../presentation.js'
import {
  createSupervisorCustomer,
  updateSupervisorCustomer,
  listSupervisorCustomersCatalog,
} from '../../api'
import {
  buildCustomerEditorDraft,
  buildSupervisorCustomerUpdatePayload,
  getCustomerEditorValidationError,
  normalizeSupervisorCustomer,
} from '../../customerEditorState'
import {
  buildCustomerCreateDraft,
  buildSupervisorCustomerCreatePayload,
} from '../../customerCreateState'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

const planRoutesOf = (dayControl) => {
  const routes = Array.isArray(dayControl?.routes) ? dayControl.routes : []
  return routes
    .map((r) => ({ planId: Number(r?.plan_id), routeName: r?.route_name || '' }))
    .filter((r) => Number.isFinite(r.planId) && r.planId > 0)
}

const bySequence = (a, b) => {
  const ra = String(a?.route_name || '')
  const rb = String(b?.route_name || '')
  if (ra !== rb) return ra.localeCompare(rb, 'es')
  const sa = Number.isFinite(Number(a?.sequence)) ? Number(a.sequence) : Number.POSITIVE_INFINITY
  const sb = Number.isFinite(Number(b?.sequence)) ? Number(b.sequence) : Number.POSITIVE_INFINITY
  if (sa !== sb) return sa - sb
  return Number(a?.stop_id || 0) - Number(b?.stop_id || 0)
}

async function loadDemoStops() {
  try {
    const mod = await import('virtual:supervisor-v2-demo')
    const demo = mod?.demoAvailable && typeof mod.loadSupervisorV2Demo === 'function'
      ? await mod.loadSupervisorV2Demo()
      : null
    const byPlan = demo?.routeStops && typeof demo.routeStops === 'object' ? demo.routeStops : {}
    const flat = Object.values(byPlan).reduce((acc, arr) => (Array.isArray(arr) ? acc.concat(arr) : acc), [])
    return { stops: flat, failures: 0 }
  } catch {
    return { stops: [], failures: 0 }
  }
}

async function loadLiveStops(planRoutes) {
  if (planRoutes.length === 0) return { stops: [], failures: 0 }
  const results = await Promise.allSettled(planRoutes.map((r) => loadRouteStops(r.planId)))
  const stops = []
  let failures = 0
  results.forEach((res, i) => {
    const { planId, routeName } = planRoutes[i]
    const tag = (list) => { for (const st of list || []) stops.push({ ...st, route_name: routeName, plan_id: planId }) }
    const v = res.status === 'fulfilled' ? res.value : null
    if (v && (v.phase === PHASE.OK || v.phase === PHASE.EMPTY)) {
      tag(v.stops)
    } else {
      failures += 1
      if (v && v.partial) tag(v.stops)
    }
  })
  return { stops: stops.sort(bySequence), failures }
}

function writeErrorMessage(res) {
  if (!res) return 'Error de red.'
  if (res.code === 'FEATURE_DISABLED') return res.message || 'Función deshabilitada.'
  if (res.code === 'DUPLICATE_CUSTOMER') {
    const by = res?.data?.matched_by || 'contacto'
    return res.message || `Cliente duplicado (${by}).`
  }
  if (res?.data?.unsupported_field) {
    return res.message || `Campo no permitido: ${res.data.field || ''}`.trim()
  }
  return res.message || 'No se pudo completar la operación.'
}

export default function ClientesTab() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const day = useOperationalDay({ demoEnabled: DEMO })
  const [activeSegment, setActiveSegment] = useState('pendientes')
  const [stopsState, setStopsState] = useState({ status: 'idle', stops: [], failures: 0 })
  const [panel, setPanel] = useState(null) // null | { mode, customerId?, draft, original? }
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [createdNotice, setCreatedNotice] = useState(null)
  const reqIdRef = useRef(0)

  const dayStatus = day.status
  const daySource = day.source
  const dayControl = day.dayControl
  const dayVersion = sourceVersion(dayControl, day.scopeKey)

  useEffect(() => {
    if (dayStatus !== 'live' && dayStatus !== 'demo') {
      setStopsState({ status: dayStatus === 'loading' ? 'loading' : 'idle', stops: [], failures: 0 })
      return undefined
    }
    const myId = ++reqIdRef.current
    setStopsState((s) => ({ ...s, status: 'loading', stops: [], failures: 0 }))
    ;(async () => {
      const out = daySource === 'demo'
        ? await loadDemoStops()
        : await loadLiveStops(planRoutesOf(dayControl))
      if (myId !== reqIdRef.current) return
      setStopsState({ status: 'ready', stops: out.stops, failures: out.failures })
    })()
    return () => { reqIdRef.current += 1 }
  }, [dayStatus, daySource, dayControl, dayVersion])

  // Deep-link ?cid= → abrir edición (autoridad solo por token server-side).
  useEffect(() => {
    const cid = Number(searchParams.get('cid') || 0)
    if (!cid) return
    const stop = (stopsState.stops || []).find((s) => Number(s?.customer_id) === cid)
    openEdit(cid, stop || { customer_id: cid, name: `Cliente #${cid}` })
    // consume param once
    const next = new URLSearchParams(searchParams)
    next.delete('cid')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, stopsState.stops])

  const segments = useMemo(() => segmentCustomers(stopsState.stops), [stopsState.stops])
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(segments).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    [segments],
  )

  const onOpenCustomer = (customerId) => {
    if (customerId == null) return
    navigate(`/equipo/clientes?cid=${encodeURIComponent(customerId)}`)
  }

  const openCreate = () => {
    setFormError('')
    setFormSuccess('')
    setCreatedNotice(null)
    setPanel({ mode: 'create', draft: buildCustomerCreateDraft() })
  }

  const openEdit = (customerId, stop) => {
    setFormError('')
    setFormSuccess('')
    const original = normalizeSupervisorCustomer({
      id: customerId,
      name: stop?.name || stop?.customer_name || `Cliente #${customerId}`,
      phone: stop?.phone || '',
      email: stop?.email || '',
      latitude: stop?.partner_latitude ?? stop?.latitude ?? '',
      longitude: stop?.partner_longitude ?? stop?.longitude ?? '',
    })
    setPanel({
      mode: 'edit',
      customerId: Number(customerId),
      original,
      draft: buildCustomerEditorDraft(original),
    })
  }

  const closePanel = () => {
    setPanel(null)
    setFormBusy(false)
    setFormError('')
    setFormSuccess('')
  }

  const submitCreate = async () => {
    if (!panel || panel.mode !== 'create' || formBusy) return
    const built = buildSupervisorCustomerCreatePayload(panel.draft)
    if (!built.ok) {
      setFormError(built.error)
      return
    }
    setFormBusy(true)
    setFormError('')
    setFormSuccess('')
    try {
      const res = await createSupervisorCustomer(built.values)
      if (!res?.ok) {
        setFormError(writeErrorMessage(res))
        setFormBusy(false)
        return
      }
      const customer = res?.data?.customer || {}
      setFormSuccess('Cliente creado.')
      setCreatedNotice(customer)
      setFormBusy(false)
      // Refresco de listado de paradas (el nuevo cliente no está en plan aún).
      day.reload?.()
      setTimeout(() => {
        closePanel()
      }, 600)
      // Create NO llama add-to-plan — acción explícita aparte (P2).
    } catch (err) {
      setFormError(err?.message || 'Error de red.')
      setFormBusy(false)
    }
  }

  const submitEdit = async () => {
    if (!panel || panel.mode !== 'edit' || formBusy) return
    const verr = getCustomerEditorValidationError(panel.draft)
    if (verr) {
      setFormError(verr)
      return
    }
    const payload = buildSupervisorCustomerUpdatePayload(panel.customerId, panel.original, panel.draft)
    if (Object.prototype.hasOwnProperty.call(payload.values, 'name')) {
      setFormError('El nombre no es editable.')
      return
    }
    if (!Object.keys(payload.values).length) {
      setFormSuccess('Sin cambios')
      return
    }
    setFormBusy(true)
    setFormError('')
    setFormSuccess('')
    try {
      const res = await updateSupervisorCustomer(payload.customer_id, payload.values)
      if (!res?.ok) {
        setFormError(writeErrorMessage(res))
        setFormBusy(false)
        return
      }
      setFormSuccess('Cliente actualizado.')
      setFormBusy(false)
      day.reload?.()
      setTimeout(closePanel, 500)
    } catch (err) {
      setFormError(err?.message || 'Error de red.')
      setFormBusy(false)
    }
  }

  // Prefetch catalog (dedicated list) when opening create — soft; failures don't block create.
  useEffect(() => {
    if (!panel || panel.mode !== 'create') return undefined
    let cancelled = false
    listSupervisorCustomersCatalog({ q: '', limit: 1 }).catch(() => {})
    return () => { cancelled = true; void cancelled }
  }, [panel])

  if (dayStatus !== 'live' && dayStatus !== 'demo') {
    return <DayStateGate day={day} loadingTitle="Cargando el día operativo…" />
  }
  if (stopsState.status === 'loading' || stopsState.status === 'idle') {
    return <StateScreen title="Cargando clientes de las rutas…" detail="Agregando las paradas de cada ruta del día." tone="neutral" />
  }

  const { stops, failures } = stopsState
  if (stops.length === 0 && !panel) {
    if (failures > 0) {
      return <StateScreen title="No se pudieron cargar los clientes" detail="Las paradas de las rutas del día no respondieron. Ninguna ruta entregó datos." tone="error" actionLabel="Reintentar" onAction={day.reload} />
    }
    return (
      <>
        <div style={{ marginBottom: 12 }}>
          <button type="button" data-testid="clientes-cta-nuevo" onClick={openCreate} style={{
            minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'pointer', fontWeight: 800,
          }}>+ Nuevo cliente</button>
        </div>
        <StateScreen title="Sin clientes en las rutas de hoy" detail="No hay paradas registradas en las rutas del día operativo. Puedes dar de alta un cliente nuevo." tone="neutral" />
      </>
    )
  }

  return (
    <>
      {failures > 0 && (
        <div data-testid="v2-clientes-partial" role="note" style={{
          fontSize: 12, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.10)',
          border: '1px solid rgba(245,158,11,0.30)', borderRadius: 18, padding: '9px 12px', marginBottom: 13,
        }}>
          ⚠ Datos parciales: {failures} ruta{failures === 1 ? '' : 's'} no entregó sus paradas. Los conteos por segmento excluyen esas rutas.
        </div>
      )}
      {createdNotice?.id ? (
        <div data-testid="clientes-created-notice" role="status" style={{
          fontSize: 13, fontWeight: 700, color: '#15803d', background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.35)', borderRadius: 12, padding: '10px 12px', marginBottom: 12,
        }}>
          Cliente creado: {createdNotice.name || `#${createdNotice.id}`} (aún no está en un plan).
        </div>
      ) : null}
      {panel ? (
        <CustomerFormPanel
          mode={panel.mode}
          draft={panel.draft}
          nameReadOnly={panel.mode === 'edit'}
          saving={formBusy}
          error={formError}
          success={formSuccess}
          onChange={(draft) => setPanel((p) => ({ ...p, draft }))}
          onCancel={closePanel}
          onSubmit={panel.mode === 'create' ? submitCreate : submitEdit}
        />
      ) : null}
      <ClientesView
        segments={segments}
        activeSegment={activeSegment}
        onSelectSegment={setActiveSegment}
        source={daySource || 'live'}
        onOpenCustomer={onOpenCustomer}
        onCreateCustomer={openCreate}
        onEditCustomer={openEdit}
        counts={counts}
      />
    </>
  )
}
