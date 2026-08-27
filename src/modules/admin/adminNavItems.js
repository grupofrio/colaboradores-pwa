// ─── NAV_ITEMS — fuente ÚNICA de "qué rol ve qué pantalla de /admin" ────────
// Vive en un .js (no en AdminShell.jsx) porque además del menú lo consume la
// autorización por subruta (`adminRouteAccess.js`), y Node no sabe cargar .jsx
// en los tests. Que menú y ruta lean la MISMA lista es justamente lo que impide
// que vuelvan a divergir: el hueco original fue tener el filtro solo en el menú.
//
// Mapping alineado con el backend (guía de pruebas 2026-04-18):
//   auxiliar_admin    → captura del día: caja, POS, gastos, requisiciones, cierre
//   gerente_sucursal  → además: aprobar gastos, liquidaciones, materia prima
//   direccion_general → acceso completo (supervisa todo)
//
// `access`: read | write | mixed — piloto Gerente (gerente_writes=0) oculta writes
// vía filterAdminNavForGerentePilot (CLEAN-01).
import { ADMIN_NAV_ACCESS } from './gerentePilotCaps.js'

export const NAV_ITEMS = [
  { id: 'hub',          label: 'Caja del día',     route: '/admin',                    roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.READ },
  { id: 'pos',          label: 'Venta mostrador',  route: '/admin/pos',                roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.MIXED },
  { id: 'gastos',       label: 'Gastos',           route: '/admin/gastos',             roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.MIXED },
  { id: 'gastos-hist',  label: 'Historial gastos', route: '/admin/gastos-historial',   roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.READ },
  { id: 'historial-cargas', label: 'Historial cargas', route: '/admin/historial-cargas', roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.READ },
  // Aprobar gastos: SOLO gerente/dirección (auxiliar_admin NO aprueba — ver guía §2d)
  { id: 'gastos-aprobar', label: 'Aprobar gastos', route: '/admin/gastos/aprobar',     roles: ['gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.WRITE },
  { id: 'requisiciones',label: 'Requisiciones',    route: '/admin/requisiciones',      roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.MIXED },
  { id: 'cierre',       label: 'Cortes de caja',   route: '/admin/cierre',             roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.MIXED },
  // ── Restringidos a gerente / dirección ──────────────────────────────────
  { id: 'liquidaciones',label: 'Liquidaciones',    route: '/admin/liquidaciones',      roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.MIXED },
  { id: 'mp',           label: 'Materia prima',    route: '/admin/materia-prima',      roles: ['gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.READ },
  { id: 'traspaso-mp',  label: 'Traspaso MP',      route: '/admin/traspaso-materia-prima', roles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'], status: 'live', access: ADMIN_NAV_ACCESS.WRITE },
  // Validar materiales / Validar bolsas: ELIMINADO (2026-04-25).
  // El traspaso MP ahora mueve stock real al confirmar, y la declaración del
  // operador al cierre devuelve el remanente automáticamente — no requiere
  // segunda validación del gerente.
]
