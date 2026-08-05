// ─── Modelo PURO de "Planear mañana" (sin React, sin red) ────────────────────
// Toda la lógica de forma/derivación vive aquí para poder probarla sin runtime.
// La pestaña (PlanearMananaTab) solo orquesta red + estado y delega el render.
//
// CONTRATO DE ESCRITURA (respetado, no inventado):
//   El único write es el que ya existe: ensure → preview → add/remove → publish.
//   NO existe endpoint para asignar unidad/chofer/vendedor al plan desde la PWA:
//   esos vienen del route master al hacer ensure. Por eso "Recursos del día" es
//   READ-ONLY: informa disponibilidad y dobles asignaciones; no las escribe.
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
export function routeReadiness(route = {}, customersCount = 0) {
  const editable = canEditRoutePlanCustomers(route)
  const publishable = canPublishRoutePlan({
    state: route.state,
    plan_state: route.plan_state,
    customersCount,
    load_sealed: route.load_sealed,
    load_picking_id: route.load_picking_id,
  })
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
  }
  return {
    state: st,
    stateLabel: planStateLabel(route),
    editable,
    publishable,
    published: st === 'published',
    customersCount: Number(customersCount || 0),
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
// ESTE plan (los recursos marcan assigned_plan_id). Es la foto inicial antes de
// que la supervisora reasigne; tras cada write, el backend devuelve la autoridad.
export function derivePlanAssignment(resources = {}, planId = 0) {
  const pid = Number(planId || 0)
  const vehicles = Array.isArray(resources.vehicles) ? resources.vehicles : []
  const people = Array.isArray(resources.people) ? resources.people : []
  const veh = vehicles.find((v) => Number(v.assigned_plan_id || 0) === pid) || null
  const driver = people.find((p) => p.is_driver && Number(p.assigned_plan_id || 0) === pid) || null
  const seller = people.find((p) => p.is_seller && Number(p.assigned_plan_id || 0) === pid) || null
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
    const otherPlan = Number(it.assigned_plan_id || 0)
    const busyElsewhere = otherPlan > 0 && otherPlan !== pid
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
