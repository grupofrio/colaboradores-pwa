// ─── API FAVY (Módulo CEDIS CDMX) ───────────────────────────────────────────
// Endpoints reutilizados:
//   - Requisiciones (admin): /pwa-admin/requisition-*
//   - Empaque / producción: /pwa-prod/packing-*
//   - Carga a camioneta (entregas): /pwa-entregas/van-manual-load
//   - Catálogo y roster: /pwa-entregas/*, destino: /pwa-pt/entregas-destination

import {
  createRequisition,
  getRequisitions,
  getRequisitionReceiptDetail,
  receiveRequisitionProducts,
} from '../admin/api.js'
import { getVanRoster, getProductsAtCedis, executeVanLoad } from '../entregas/entregasService.js'
import { apiPost } from '../../lib/api.js'

function toArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  return []
}

// ── Requisiciones ─────────────────────────────────────────────────────────

export function createBagRequisition(payload) {
  return createRequisition(payload)
}

export async function getBagRequisitions(filters = {}) {
  const res = await getRequisitions(filters)
  return toArray(res)
}

export function getBagRequisitionReceiptDetail(id) {
  return getRequisitionReceiptDetail(id)
}

export function receiveBagRequisitionProducts(payload) {
  return receiveRequisitionProducts(payload)
}

// ── Operación fija Faviola: producción de vaso y asistencia ──────────────

export function createFavyCupProduction(qty) {
  return apiPost('/api/favy/cup-production', { qty: Number(qty) })
}

export function getFavyAttendanceToday() {
  return apiPost('/api/favy/attendance/today', {})
}

function photoPayload(dataUrl, label) {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(String(dataUrl || ''))
  if (!match) throw new Error(`La foto de ${label} no tiene un formato valido.`)
  return { base64: match[2], mimeType: match[1] }
}

export function checkInFavyAttendance({ selfie, facade }) {
  const selfiePhoto = photoPayload(selfie, 'colaborador')
  const facadePhoto = photoPayload(facade, 'fachada')
  return apiPost('/api/favy/attendance/check-in', {
    selfie_base64: selfiePhoto.base64,
    selfie_mime_type: selfiePhoto.mimeType,
    facade_base64: facadePhoto.base64,
    facade_mime_type: facadePhoto.mimeType,
  })
}

// ── Carga a camionetas (solo Doctores/CDMX) ─────────────────────────────

export async function getFavyVanRoster(warehouseId) {
  const vans = await getVanRoster(warehouseId)
  return toArray(vans)
}

export async function getFavyVanCatalog(locationId) {
  const res = await getProductsAtCedis(locationId)
  return toArray(res)
}

export function executeFavyVanLoad(mobileLocationId, lines, driverEmployeeId) {
  return executeVanLoad(mobileLocationId, lines, driverEmployeeId)
}

export function getFavyEntregasDestination() {
  return Promise.resolve({
    id: 1362,
    name: 'CCDMX/Existencias',
  })
}

export function isDoctorVan(van = {}) {
  const haystack = `${van.employee_name || ''} ${van.mobile_location_name || ''} ${van.cedis_location_name || ''} ${van.plate || ''}`
    .toLowerCase()
  return haystack.includes('doctor')
}
