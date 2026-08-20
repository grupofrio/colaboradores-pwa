// Pure launcher builder for Gerente V2 Admin tab — shared with tests.
// Access/roles come from NAV_ITEMS (same contract as AdminShell + AdminSubRoute).
import { NAV_ITEMS } from '../../admin/adminNavItems.js'
import { filterAdminNavForGerentePilot } from '../../admin/gerentePilotCaps.js'
import { isCashShiftNavigationVisible } from '../../../lib/navModel.js'

/** Copy/glyph overlays (access/roles stay on NAV_ITEMS). */
export const GERENTE_ADMIN_LAUNCHER_COPY = Object.freeze({
  hub: { label: 'Panorama del día', desc: 'Ventas, gastos y caja de la sucursal', glyph: '▤' },
  gastos: { label: 'Gastos', desc: 'Consultar gastos de la sucursal', glyph: '$' },
  requisiciones: { label: 'Requisiciones', desc: 'Consultar solicitudes de compra', glyph: '⊞' },
  cierre: { label: 'Cortes de caja', desc: 'Consultar turnos y cortes', glyph: '▣' },
  liquidaciones: { label: 'Liquidaciones', desc: 'Consultar liquidación de rutas', glyph: '≣' },
  mp: { label: 'Materia prima', desc: 'Existencias de MP', glyph: '◨' },
})

const LAUNCHER_IDS = Object.freeze(Object.keys(GERENTE_ADMIN_LAUNCHER_COPY))

export function buildGerenteAdminLauncherItems(session, capabilities = {}) {
  const roleOk = (item) => Array.isArray(item.roles) && item.roles.includes('gerente_sucursal')
  const base = NAV_ITEMS
    .filter((item) => LAUNCHER_IDS.includes(item.id) && roleOk(item))
    .filter((item) => item.id !== 'cierre' || isCashShiftNavigationVisible(capabilities))
    .map((item) => ({
      ...item,
      ...GERENTE_ADMIN_LAUNCHER_COPY[item.id],
    }))
  return filterAdminNavForGerentePilot(base, session, capabilities)
}
