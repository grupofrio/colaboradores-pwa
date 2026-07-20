// ─── Day Control · cargador de DEMO (solo dev/preview) ───────────────────────
// Expuesto vía el módulo virtual `virtual:supervisor-daycontrol-demo` (alias en
// vite.config.js). En build de PRODUCCIÓN el alias apunta al stub `.prod.js`, de
// modo que estos fixtures SINTÉTICOS jamás entran al bundle de producción
// (misma técnica que M4). Datos 100% artificiales (BR-DEMO, ids en banda demo,
// moneda de prueba XTS, coordenadas oceánicas) — verificados por
// tests/supervisorContractDrift.test.mjs.
import { DAY_CONTROL_FIXTURE, RADAR_FIXTURE } from './fixtures.js'

export const demoAvailable = true

export async function loadDayControlDemo() {
  return {
    dayControl: DAY_CONTROL_FIXTURE,
    radar: RADAR_FIXTURE,
    provenance: {
      synthetic: true,
      source: 'gf.salesops.supervisor.day_control/1 · radar/1 (golden #80)',
      note: 'Datos de DEMOSTRACIÓN sintéticos (BR-DEMO). NO son operación real.',
    },
  }
}
