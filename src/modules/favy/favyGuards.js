export function validateCupQuantity(value) {
  const qty = Number(value)
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, code: 'INVALID_QTY', message: 'Captura una cantidad entera mayor a cero.' }
  }
  return { ok: true, qty }
}

export function validateAttendancePreflight({ selfie, facade } = {}) {
  if (!selfie) return { ok: false, code: 'SELFIE_REQUIRED', message: 'La foto del colaborador es obligatoria.' }
  if (!facade) return { ok: false, code: 'FACADE_REQUIRED', message: 'La foto de la fachada es obligatoria.' }
  return { ok: true }
}
