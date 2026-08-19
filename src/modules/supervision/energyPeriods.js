// energyPeriods.js — periodos tarifarios CFE y validacion de captura.
//
// La AUTORIDAD de la validacion es Odoo (create_period_reading). Esto es
// validacion de UX para no mandar al operador a un round-trip por un campo
// vacio: las mismas reglas, en el mismo orden, con los mismos mensajes.
//
// Reglas (identicas al backend):
//   - los 3 registros son obligatorios y no negativos;
//   - cada fin >= SU inicio (no basta con que suba el total);
//   - foto obligatoria.

export const ENERGY_PERIODS = [
  { key: 'base', label: 'Base', voiceKey: 'kwh_base' },
  { key: 'intermedia', label: 'Intermedia', voiceKey: 'kwh_intermedia' },
  { key: 'punta', label: 'Punta', voiceKey: 'kwh_punta' },
]

/**
 * @param {{base:string, intermedia:string, punta:string, photo:File|null}} form
 * @param {object|null} previousReading  lectura de inicio (solo al capturar fin)
 * @returns {{ok:boolean, errors:Record<string,string>, firstError:string}}
 */
export function validatePeriodForm(form, previousReading = null) {
  const errors = {}

  ENERGY_PERIODS.forEach(({ key, label }) => {
    const raw = form?.[key]
    if (raw === '' || raw === null || raw === undefined) {
      errors[key] = `Captura la lectura ${label}`
      return
    }
    const value = Number(raw)
    if (!Number.isFinite(value)) {
      errors[key] = `La lectura ${label} no es un numero`
      return
    }
    if (value < 0) {
      errors[key] = `La lectura ${label} no puede ser negativa`
    }
  })

  // fin >= inicio, POR REGISTRO. Solo se compara contra un inicio con
  // desglose: contra una lectura unica legacy no hay con que comparar.
  if (previousReading && previousReading.capture_mode === 'periods') {
    ENERGY_PERIODS.forEach(({ key, label }) => {
      if (errors[key]) return
      const value = Number(form[key])
      const previous = Number(previousReading[`kwh_${key}`])
      if (Number.isFinite(previous) && value < previous) {
        errors[key] = `Fin ${label} (${value}) menor que inicio (${previous}). Revisar medidor.`
      }
    })
  }

  if (!form?.photo) {
    errors.photo = 'Foto del medidor obligatoria'
  }

  const order = [...ENERGY_PERIODS.map(p => p.key), 'photo']
  const firstKey = order.find((key) => errors[key])
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    firstError: firstKey ? errors[firstKey] : '',
  }
}
