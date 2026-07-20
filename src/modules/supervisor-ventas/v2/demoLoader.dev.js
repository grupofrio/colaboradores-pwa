// ─── Supervisor V2 · cargador de DEMO (dev/preview) ──────────────────────────
// Expuesto vía `virtual:supervisor-v2-demo` (alias vite). En build de PRODUCCIÓN
// el alias apunta al stub `.prod.js` ⇒ estos fixtures SINTÉTICOS jamás entran al
// bundle de producción. Compone los golden de #80 (day-control + radar) + los
// route-stops sintéticos de Clientes.
import { DAY_CONTROL_FIXTURE, RADAR_FIXTURE } from '../dayControl/fixtures.js'
import { ROUTE_STOPS_FIXTURE } from './fixtures/routeStops.fixture.js'

export const demoAvailable = true

export async function loadSupervisorV2Demo() {
  return {
    dayControl: DAY_CONTROL_FIXTURE,
    radar: RADAR_FIXTURE,
    routeStops: ROUTE_STOPS_FIXTURE,
    provenance: {
      synthetic: true,
      source: 'golden #80 (day_control/1 · radar/1) + route-stops sintéticos',
      note: 'Datos de DEMOSTRACIÓN sintéticos (BR-DEMO). NO son operación real.',
    },
  }
}
