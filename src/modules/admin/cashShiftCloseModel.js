import {
  calculatePhysicalTotal,
  nextTransitionLabel,
  normalizeAdjustments,
  normalizeDenominations,
} from './cashShiftModel.js'

function moneyValue(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new TypeError(`${label} es obligatorio.`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${label} no es válido.`)
  return Math.round(parsed * 100) / 100
}

function moneyCents(value) {
  const cents = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(cents)) throw new TypeError('El importe excede el límite válido.')
  return cents
}

export function hasCashDifference(value) {
  return moneyCents(value) !== 0
}

export function calculateCloseFeedback({ serverExpectedCash, denominations, adjustments }) {
  const normalizedAdjustments = normalizeAdjustments(adjustments)
  const serverCents = moneyCents(serverExpectedCash)
  const adjustmentCents = normalizedAdjustments.reduce((total, row) => (
    total + (row.type === 'income' ? moneyCents(row.amount) : -moneyCents(row.amount))
  ), 0)
  const physicalCash = calculatePhysicalTotal(denominations)
  const adjustedExpectedCents = serverCents + adjustmentCents
  const physicalCents = moneyCents(physicalCash)
  return {
    serverExpectedCash: serverCents / 100,
    adjustedExpectedCash: adjustedExpectedCents / 100,
    physicalCash: physicalCents / 100,
    difference: (physicalCents - adjustedExpectedCents) / 100,
  }
}

export function cashShiftCloseBinding(cashShift) {
  const state = cashShift?.shift?.state
  if (state !== 'open' && state !== 'reopened') {
    throw new TypeError('El turno no está disponible para cierre.')
  }
  const reclose = state === 'reopened'
  const expectedVersion = reclose ? cashShift.shift.version : 0
  if (!Number.isSafeInteger(expectedVersion) || (reclose ? expectedVersion < 1 : expectedVersion !== 0)) {
    throw new TypeError('La versión del turno no corresponde al cierre.')
  }
  const purpose = reclose ? 'reclose' : 'close'
  return {
    shiftId: cashShift.shift.id,
    expectedVersion,
    purpose,
    key: `${cashShift.shift.id}:${expectedVersion}:${purpose}`,
  }
}

export function buildCashShiftCloseOperation({
  cashShift,
  denominations,
  adjustments,
  notes,
  nextOpeningFund,
}) {
  const binding = cashShiftCloseBinding(cashShift)
  const normalizedDenominations = normalizeDenominations(denominations)
  const normalizedAdjustments = normalizeAdjustments(adjustments)
  const feedback = calculateCloseFeedback({
    serverExpectedCash: cashShift.totals.expectedCash,
    denominations: normalizedDenominations,
    adjustments: normalizedAdjustments,
  })
  const normalizedNotes = String(notes || '').trim()
  if (hasCashDifference(feedback.difference) && !normalizedNotes) {
    throw new TypeError('Toda diferencia requiere nota.')
  }
  const request = {
    shiftId: binding.shiftId,
    expectedVersion: binding.expectedVersion,
    denominations: normalizedDenominations,
    adjustments: normalizedAdjustments,
    notes: normalizedNotes,
  }
  if (binding.purpose === 'close') {
    request.nextOpeningFund = moneyValue(nextOpeningFund, 'El fondo inicial del siguiente turno')
  }
  const shiftName = cashShift.shift.type === 'night' ? 'Noche' : 'Día'
  const day = Number(cashShift.shift.businessDate.slice(-2))
  return {
    operation: binding.purpose,
    request,
    feedback,
    label: binding.purpose === 'reclose'
      ? `Volver a cerrar ${shiftName} ${day}`
      : nextTransitionLabel(cashShift.shift),
  }
}
