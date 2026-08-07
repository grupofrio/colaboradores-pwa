// ─── Modelo PURO de "Planear mañana" (sin React, sin red) ────────────────────
// Toda la lógica de forma/derivación vive aquí para poder probarla sin runtime.
// La pestaña (PlanearMananaTab) solo orquesta red + estado y delega el render.
//
// CONTRATO DE ESCRITURA: ensure → preview → add/remove → assign-resources →
// publish. La asignación se valida en backend y su readiness es autoritativa.
//
// null ≠ 0: la ausencia de un dato se dice "Sin dato" / —, nunca un 0 inventado.

import {
  canEditRoutePlanCustomers,
  canPublishRoutePlan,
  getRoutePlanningState,
} from '../../routePlanning.js'

// Estados del plan de ruta en palabra (el color solo no basta bajo el sol).
export const PLAN_STATE_LABEL = Object.freeze({
  sin_plan: 'Sin preparar',
  plan_draft: 'Borrador',
  forecast_confirmed: 'Borrador',
  published: 'Publicada',
  load_ready: 'Carga lista',
  load_executed: 'Carga sellada',
  blocked: 'Bloqueada',
})

export function planStateLabel(row = {}) {
  return PLAN_STATE_LABEL[getRoutePlanningState(row)] || 'Sin preparar'
}

// ── Readiness de UNA ruta para publicarse ────────────────────────────────────
// Devuelve el veredicto de publicación con RAZONES en palabra, para que la
// supervisora sepa qué falta, no solo que "no se puede".
function resourceBlockerReason(coverage = {}) {
  const blockers = Array.isArray(coverage.blockers) ? coverage.blockers.filter(Boolean) : []
  if (blockers.length > 0) return String(blockers[0])
  if (coverage.missing_vehicle) return 'Falta asignar una unidad a la ruta.'
  if (coverage.missing_driver) return 'Falta asignar un chofer a la ruta.'
  if (coverage.missing_salesperson) return 'Falta asignar un vendedor a la ruta.'
  return 'Completa la asignación de recursos antes de publicar.'
}

function coverageBlocksPublishing(coverage) {
  if (!coverage) return false
  const state = String(coverage.coverage_state || '').toLowerCase()
  const blockers = Array.isArray(coverage.blockers) ? coverage.blockers.filter(Boolean) : []
  return blockers.length > 0 || state === 'blocked' || state === 'incomplete'
}

export function routeReadiness(route = {}, customersCount = 0, coverage = null) {
  const editable = canEditRoutePlanCustomers(route)
  const planPublishable = canPublishRoutePlan({
    state: route.state,
    plan_state: route.plan_state,
    customersCount,
    load_sealed: route.load_sealed,
    load_picking_id: route.load_picking_id,
  })
  const resourceBlocked = coverageBlocksPublishing(coverage)
  const publishable = planPublishable && !resourceBlocked
  const reasons = []
  const st = getRoutePlanningState(route)
  if (st === 'sin_plan' || !route.plan_id) {
    reasons.push('Aún no preparas el plan del día.')
  } else if (st === 'published') {
    reasons.push('Ya está publicada.')
  } else if (!editable) {
    reasons.push('La carga ya está lista o sellada: no admite cambios.')
  } else if (Number(customersCount || 0) <= 0) {
    reasons.push('No tiene clientes; genera la propuesta primero.')
  } else if (resourceBlocked) {
    reasons.push(resourceBlockerReason(coverage))
  }
  return {
    state: st,
    stateLabel: planStateLabel(route),
    editable,
    publishable,
    published: st === 'published',
    customersCount: Number(customersCount || 0),
    resourceBlocked,
    reasons,
  }
}

// ── Resumen de recursos del día (read-only) ──────────────────────────────────
// A partir del payload de /available-resources. Cuenta libres vs tomados y marca
// cuántas unidades no tienen capacidad registrada (para no prometer "cabe").
export function summarizeResources(resources = {}) {
  const vehicles = Array.isArray(resources.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources.people) ? resources.people : []
  const vehiclesAvailable = resources.vehicles_available === true
  const rosterAvailable = people.length > 0

  const unitsFree = vehicles.filter((v) => v && v.available).length
  const unitsTaken = vehicles.length - unitsFree
  const capacityUnknown = vehicles.filter((v) => v && v.capacity_kg == null).length

  const peopleFree = people.filter((p) => p && p.available).length
  const peopleTaken = people.length - peopleFree
  const drivers = people.filter((p) => p && p.is_driver).length
  const sellers = people.filter((p) => p && p.is_seller).length

  return {
    vehiclesAvailable,
    rosterAvailable,
    unitsTotal: vehicles.length,
    unitsFree,
    unitsTaken,
    capacityUnknown,
    peopleTotal: people.length,
    peopleFree,
    peopleTaken,
    drivers,
    sellers,
  }
}

// Personas ya tomadas por un plan de ESA fecha (para avisar de dobles turnos).
export function assignedPeople(resources = {}) {
  const people = Array.isArray(resources.people) ? resources.people : []
  return people.filter((p) => p && !p.available && p.assigned_plan_id)
}

// Capacidad en kg → texto honesto (— cuando no hay dato, no "0 kg").
export function capacityLabel(kg) {
  if (kg == null || !(Number(kg) > 0)) return 'Sin dato'
  return `${Number(kg).toLocaleString('es-MX')} kg`
}

// ── Asignación de recursos de UNA ruta ───────────────────────────────────────
// Deriva del payload de /available-resources qué unidad/chofer/vendedor ya trae
// ESTE plan. El backend marca los planes que ocupan cada recurso en
// `assigned_plan_ids` (LISTA: un recurso puede aparecer en varios planes del día).
// Antes se leía `assigned_plan_id` en singular —campo que el backend NUNCA
// devuelve—, así que la comparación era siempre 0 ≠ planId: los selectores salían
// "Sin asignar" aunque el plan ya tuviera sus recursos, y `busyElsewhere` jamás se
// activaba (se podía doblar una unidad ya usada en otra ruta del día).
const planIdsOfResource = (it) => {
  const raw = it?.assigned_plan_ids
  const list = Array.isArray(raw) ? raw : (raw == null ? [] : [raw])
  return list.map((v) => Number(v || 0)).filter((v) => v > 0)
}

export function isResourceAssignedTo(item, planId) {
  const pid = Number(planId || 0)
  return pid > 0 && planIdsOfResource(item).includes(pid)
}

export function derivePlanAssignment(resources = {}, planId = 0) {
  const pid = Number(planId || 0)
  const vehicles = Array.isArray(resources.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources.people) ? resources.people : []
  const veh = vehicles.find((v) => isResourceAssignedTo(v, pid)) || null
  const driver = people.find((p) => p.is_driver && isResourceAssignedTo(p, pid)) || null
  const seller = people.find((p) => p.is_seller && isResourceAssignedTo(p, pid)) || null
  return {
    vehicle: veh ? { id: veh.id, name: veh.name, capacity_kg: veh.capacity_kg } : null,
    driver: driver ? { id: driver.id, name: driver.name } : null,
    salesperson: seller ? { id: seller.id, name: seller.name } : null,
  }
}

// Opciones de un recurso para el picker: marca ocupado (en otra ruta de la fecha)
// y conserva la selección actual aunque esté "ocupada" por este mismo plan.
export function resourceOptions(items = [], planId = 0, currentId = 0) {
  const pid = Number(planId || 0)
  return (Array.isArray(items) ? items : []).map((it) => {
    const planIds = planIdsOfResource(it)
    // Ocupado en OTRA ruta del día: cualquier plan distinto del actual.
    const busyElsewhere = planIds.some((id) => id !== pid)
    return {
      id: it.id,
      name: it.name,
      capacity_kg: it.capacity_kg,
      busyElsewhere,
      isCurrent: Number(it.id) === Number(currentId || 0),
    }
  })
}

// Readiness de PRESENCIA (foto local antes del write). El backend devuelve la
// readiness completa (incluye sobrecapacidad) en cada asignación; ésta solo dice
// qué recurso falta para no mostrar nada hasta el primer write.
export function resourceReadiness(assignment = {}) {
  const missing_vehicle = !assignment.vehicle
  const missing_driver = !assignment.driver
  const missing_salesperson = !assignment.salesperson
  let coverage_state = 'ready'
  if (missing_vehicle) coverage_state = 'blocked'
  else if (missing_driver || missing_salesperson) coverage_state = 'incomplete'
  return {
    missing_vehicle, missing_driver, missing_salesperson,
    coverage_state,
    coverage_label: coverage_state === 'ready' ? 'Lista' : coverage_state === 'incomplete' ? 'Incompleta' : 'Falta lo indispensable',
  }
}

export const COVERAGE_TONE = Object.freeze({ ready: 'ok', incomplete: 'warn', blocked: 'bad' })

// Roles de una persona en palabra (puede ser chofer y vendedor a la vez).
export function personRolesLabel(person = {}) {
  const roles = []
  if (person.is_driver) roles.push('Chofer')
  if (person.is_seller) roles.push('Vendedor')
  return roles.length ? roles.join(' · ') : 'Equipo'
}
