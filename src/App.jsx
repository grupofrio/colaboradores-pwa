import { lazy, Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { ToastProvider } from './components/Toast'
import AppShell from './components/AppShell'
import { normalizeSessionRoleContext } from './lib/roleContext'
import { api } from './lib/api'
import { clearGrupoFrioLocalState } from './lib/clearLocalState'
import { clearStaleOperatorTurnClosed, getOperatorCloseState } from './modules/shared/operatorTurnCloseStore'
import { getModuleById, isModuleVisibleForRoles } from './modules/registry'
import { resolveModuleContextRole, getEffectiveJobKeys } from './lib/roleContext'
import { isValidAuthenticatedSession } from './lib/session'
// E1-C.4 — gate de la superficie KOLD Tower por rol AUTORITATIVO (Odoo: session.employee.tower_status)
import { readAuthoritativeTowerStatus } from './modules/torre/e1/loadTowerStatus'
import { readM2Access } from './modules/planeacion/m2/access'
import { readM3Access } from './modules/ejecucion/m3/access'
import { readM4Access } from './modules/ventas/m4/access'
import { readM5Access } from './modules/inventario/m5/access'
import { readM6Access } from './modules/caja-conciliacion/m6/access'

// ─── Pantallas base ──────────────────────────────────────────────────────────
import ScreenLogin   from './screens/ScreenLogin'
import ScreenHome    from './screens/ScreenHome'
import ScreenKPIs    from './screens/ScreenKPIs'
import ScreenSurveys from './screens/ScreenSurveys'
import ScreenBadges  from './screens/ScreenBadges'
import ScreenProfile from './screens/ScreenProfile'

// ─── Módulos operativos (lazy — solo descarga si el rol lo necesita) ─────────
const ScreenModuloPendiente = lazy(() => import('./screens/ScreenModuloPendiente'))
// E1-C.4 — superficie KOLD Tower read-only (E1-B), montada detrás de TowerRoute (gate por rol autoritativo)
const ScreenKoldTowerE1 = lazy(() => import('./modules/torre/e1/ScreenKoldTowerE1'))
// M1-D — Backlog M1 read-only (mismo gate TowerRoute; SIN menú, solo ruta directa)
const ScreenM1Backlog = lazy(() => import('./modules/torre/m1/ScreenM1Backlog'))
// KOLD OS · M2 — Planeación y readiness (observatorio read-only, gate propio M2PlaneacionRoute)
const ScreenPlaneacionM2 = lazy(() => import('./modules/planeacion/ScreenPlaneacionM2'))
// KOLD OS · M3 — Ejecución de rutas (observatorio read-only, gate propio M3EjecucionRoute)
const ScreenEjecucionM3 = lazy(() => import('./modules/ejecucion/ScreenEjecucionM3'))
// KOLD OS · M4 — Ventas y clientes (observatorio read-only, gate propio M4VentasRoute)
const ScreenVentasM4 = lazy(() => import('./modules/ventas/ScreenVentasM4'))
// KOLD OS · M5 — Inventario y flujo (observatorio read-only, gate propio M5InventarioRoute)
const ScreenInventarioM5 = lazy(() => import('./modules/inventario/ScreenInventarioM5'))
// KOLD OS · M6 — Caja y conciliación (observatorio read-only, gate propio M6CajaRoute)
const ScreenCajaConciliacionM6 = lazy(() => import('./modules/caja-conciliacion/ScreenCajaConciliacionM6'))
// Producción
const ScreenMiTurno         = lazy(() => import('./modules/produccion/ScreenMiTurno'))
const ScreenChecklist       = lazy(() => import('./modules/produccion/ScreenChecklist'))
const ScreenCiclo           = lazy(() => import('./modules/produccion/ScreenCiclo'))
const ScreenEmpaque         = lazy(() => import('./modules/produccion/ScreenEmpaque'))
const ScreenCorte           = lazy(() => import('./modules/produccion/ScreenCorte'))
const ScreenTransformacion  = lazy(() => import('./modules/produccion/ScreenTransformacion'))
const ScreenTanqueLista     = lazy(() => import('./modules/produccion/ScreenTanqueLista'))
const ScreenTanque          = lazy(() => import('./modules/produccion/ScreenTanque'))
// Producción V2 — Rolito
const ScreenIncidenciaRolito = lazy(() => import('./modules/produccion/ScreenIncidenciaRolito'))
const ScreenCierreRolito     = lazy(() => import('./modules/produccion/ScreenCierreRolito'))
const ScreenHandoverTurno    = lazy(() => import('./modules/produccion/ScreenHandoverTurno'))
const ScreenTurnoEntregado   = lazy(() => import('./modules/produccion/ScreenTurnoEntregado'))
const ScreenReconciliacionPT = lazy(() => import('./modules/produccion/ScreenReconciliacionPT'))
// Almacén PT V2
const ScreenAlmacenPT       = lazy(() => import('./modules/almacen-pt/ScreenAlmacenPT'))
const ScreenRecepcion       = lazy(() => import('./modules/almacen-pt/ScreenRecepcion'))
const ScreenInventarioPT    = lazy(() => import('./modules/almacen-pt/ScreenInventarioPT'))
const ScreenTraspasoPT      = lazy(() => import('./modules/almacen-pt/ScreenTraspasoPT'))
const ScreenHandoverPT      = lazy(() => import('./modules/almacen-pt/ScreenHandoverPT'))
const ScreenMermaPT         = lazy(() => import('./modules/almacen-pt/ScreenMermaPT'))
const ScreenTransformacionPT = lazy(() => import('./modules/almacen-pt/ScreenTransformacionPT'))
const ScreenMaterialesIssue    = lazy(() => import('./modules/almacen-pt/ScreenMaterialesIssue'))
const ScreenMaterialesReport   = lazy(() => import('./modules/almacen-pt/ScreenMaterialesReport'))
const ScreenMaterialesReconcile = lazy(() => import('./modules/almacen-pt/ScreenMaterialesReconcile'))
const ScreenMaterialesCrearIssue = lazy(() => import('./modules/almacen-pt/ScreenMaterialesCrearIssue'))
// KOLDCUP
const ScreenKoldcupHub        = lazy(() => import('./modules/koldcup/ScreenKoldcupHub'))
const ScreenKoldcupCompra     = lazy(() => import('./modules/koldcup/ScreenKoldcupCompra'))
const ScreenKoldcupProduccion = lazy(() => import('./modules/koldcup/ScreenKoldcupProduccion'))
const ScreenKoldcupCorte      = lazy(() => import('./modules/koldcup/ScreenKoldcupCorte'))
const ScreenKoldcupTraspaso   = lazy(() => import('./modules/koldcup/ScreenKoldcupTraspaso'))
// Supervisión
const ScreenSupervision     = lazy(() => import('./modules/supervision/ScreenSupervision'))
const ScreenParos           = lazy(() => import('./modules/supervision/ScreenParos'))
const ScreenMerma           = lazy(() => import('./modules/supervision/ScreenMerma'))
const ScreenEnergia         = lazy(() => import('./modules/supervision/ScreenEnergia'))
const ScreenMantenimiento   = lazy(() => import('./modules/supervision/ScreenMantenimiento'))
const ScreenControlTurno    = lazy(() => import('./modules/supervision/ScreenControlTurno'))
// Admin Sucursal
const ScreenAdminPanel      = lazy(() => import('./modules/admin/ScreenAdminPanel'))
const ScreenPOS             = lazy(() => import('./modules/admin/ScreenPOS'))
const ScreenTicket          = lazy(() => import('./modules/admin/ScreenTicket'))
const ScreenGastos          = lazy(() => import('./modules/admin/ScreenGastos'))
const ScreenGastosHistorial = lazy(() => import('./modules/admin/ScreenGastosHistorial'))
const ScreenGastosAprobar   = lazy(() => import('./modules/admin/ScreenGastosAprobar'))
const ScreenRequisiciones   = lazy(() => import('./modules/admin/ScreenRequisiciones'))
const ScreenLiquidaciones   = lazy(() => import('./modules/admin/ScreenLiquidaciones'))
const ScreenMateriaPrima    = lazy(() => import('./modules/admin/ScreenMateriaPrima'))
const ScreenTraspasoMateriaPrima = lazy(() => import('./modules/admin/ScreenTraspasoMateriaPrima'))
const ScreenValidacionBolsas = lazy(() => import('./modules/admin/ScreenValidacionBolsas'))
const ScreenDeclaracionBolsas = lazy(() => import('./modules/produccion/ScreenDeclaracionBolsas'))
const ScreenDeclaracionBolsasPT = lazy(() => import('./modules/almacen-pt/ScreenDeclaracionBolsasPT'))
const ScreenCierreCaja      = lazy(() => import('./modules/admin/ScreenCierreCaja'))
const ScreenMaterialesValidate = lazy(() => import('./modules/admin/ScreenMaterialesValidate'))
const ScreenMaterialesResolverRejected = lazy(() => import('./modules/admin/ScreenMaterialesResolverRejected'))
const AdminThemeScope = lazy(() => import('./modules/admin/components/AdminThemeScope'))
// Entregas V2 (V1 eliminado 2026-04-17)
const ScreenHubDia          = lazy(() => import('./modules/entregas/ScreenHubDia'))
const ScreenRecibirPT       = lazy(() => import('./modules/entregas/ScreenRecibirPT'))
const ScreenCargaUnidades   = lazy(() => import('./modules/entregas/ScreenCargaUnidades'))
const ScreenHistorialCargas = lazy(() => import('./modules/entregas/ScreenHistorialCargas'))
const ScreenOperacionDia    = lazy(() => import('./modules/entregas/ScreenOperacionDia'))
const ScreenDevolucionesV2  = lazy(() => import('./modules/entregas/ScreenDevolucionesV2'))
const ScreenMermaEntregas   = lazy(() => import('./modules/entregas/ScreenMerma'))
const ScreenCierreTurno     = lazy(() => import('./modules/entregas/ScreenCierreTurno'))
const ScreenTransformacionEntregas = lazy(() => import('./modules/entregas/ScreenTransformacionEntregas'))
const ScreenInventarioEntregas     = lazy(() => import('./modules/entregas/ScreenInventarioEntregas'))
// Ruta V2 — V1 eliminado 2026-04-17
const ScreenMiRutaV2        = lazy(() => import('./modules/ruta/ScreenMiRutaV2'))
const ScreenChecklistUnidad = lazy(() => import('./modules/ruta/ScreenChecklistUnidad'))
const ScreenAceptarCarga    = lazy(() => import('./modules/ruta/ScreenAceptarCarga'))
const ScreenIncidencias     = lazy(() => import('./modules/ruta/ScreenIncidencias'))
const ScreenKPIsRuta        = lazy(() => import('./modules/ruta/ScreenKPIsRuta'))
const ScreenConciliacion    = lazy(() => import('./modules/ruta/ScreenConciliacion'))
const ScreenControlRuta     = lazy(() => import('./modules/ruta/ScreenControlRuta'))
const ScreenInventarioRuta  = lazy(() => import('./modules/ruta/ScreenInventarioRuta'))
const ScreenCorteRuta       = lazy(() => import('./modules/ruta/ScreenCorteRuta'))
const ScreenLiquidacion     = lazy(() => import('./modules/ruta/ScreenLiquidacion'))
const ScreenCierreRuta      = lazy(() => import('./modules/ruta/ScreenCierreRuta'))
// Supervisor Ventas V2 — V1 (ScreenSupervisorVentas, ScreenVendedores) eliminado 2026-04-17
const ScreenDashboardVentas  = lazy(() => import('./modules/supervisor-ventas/ScreenDashboardVentas'))
const ScreenPronostico       = lazy(() => import('./modules/supervisor-ventas/ScreenPronostico'))
const ScreenPlanDiarioClientes = lazy(() => import('./modules/supervisor-ventas/ScreenPlanDiarioClientes'))
const ScreenClientesSupervisor = lazy(() => import('./modules/supervisor-ventas/ScreenClientesSupervisor'))
const ScreenMetasVendedores  = lazy(() => import('./modules/supervisor-ventas/ScreenMetasVendedores'))
const ScreenTareasSupervisor     = lazy(() => import('./modules/supervisor-ventas/ScreenTareasSupervisor'))
const ScreenNotasCliente         = lazy(() => import('./modules/supervisor-ventas/ScreenNotasCliente'))
const ScreenClientesRecuperacion = lazy(() => import('./modules/supervisor-ventas/ScreenClientesRecuperacion'))
const ScreenControlComercial    = lazy(() => import('./modules/supervisor-ventas/ScreenControlComercial'))
const ScreenBajasHub            = lazy(() => import('./modules/supervisor-ventas/ScreenBajasHub'))
const ScreenBajasSugey          = lazy(() => import('./modules/supervisor-ventas/ScreenBajasSugey'))
const ScreenBajasSugeyDetail    = lazy(() => import('./modules/supervisor-ventas/ScreenBajasSugeyDetail'))
const ScreenBajasAngelica       = lazy(() => import('./modules/supervisor-ventas/ScreenBajasAngelica'))
const ScreenBajasAngelicaDetail = lazy(() => import('./modules/supervisor-ventas/ScreenBajasAngelicaDetail'))
const ScreenDetalleVendedor    = lazy(() => import('./modules/supervisor-ventas/ScreenDetalleVendedor'))
const ScreenClientesSinVisitar = lazy(() => import('./modules/supervisor-ventas/ScreenClientesSinVisitar'))
const ScreenScoreSemanal       = lazy(() => import('./modules/supervisor-ventas/ScreenScoreSemanal'))
const ScreenCierreOperativo    = lazy(() => import('./modules/supervisor-ventas/ScreenCierreOperativo'))
const ScreenNotaRapida         = lazy(() => import('./modules/supervisor-ventas/ScreenNotaRapida'))
const ScreenOperacionesHoy     = lazy(() => import('./modules/supervisor-ventas/ScreenOperacionesHoy'))
// Supervisor V2 — shell de 6 superficies (gated por flag fail-closed).
const HoyTab        = lazy(() => import('./modules/supervisor-ventas/v2/tabs/HoyTab'))
const RadarTab      = lazy(() => import('./modules/supervisor-ventas/v2/tabs/RadarTab'))
const RutasTab      = lazy(() => import('./modules/supervisor-ventas/v2/tabs/RutasTab'))
const ClientesTab   = lazy(() => import('./modules/supervisor-ventas/v2/tabs/ClientesTab'))
const PendientesTab = lazy(() => import('./modules/supervisor-ventas/v2/tabs/PendientesTab'))
const MasTab        = lazy(() => import('./modules/supervisor-ventas/v2/tabs/MasTab'))
import SupervisorV2Gate from './modules/supervisor-ventas/v2/SupervisorV2Gate'
import V2ExcludedRoute from './modules/supervisor-ventas/v2/V2ExcludedRoute'
// Torres de Control — Validación de Requisiciones
const ScreenTorreRequisiciones = lazy(() => import('./modules/torre/ScreenTorreRequisiciones'))
const ScreenTorreDetail        = lazy(() => import('./modules/torre/ScreenTorreDetail'))
// Gerente
const ScreenGerente          = lazy(() => import('./modules/gerente/ScreenGerente'))
const ScreenDashboardGerente = lazy(() => import('./modules/gerente/ScreenDashboardGerente'))
const ScreenAlertasGerente   = lazy(() => import('./modules/gerente/ScreenAlertasGerente'))
const ScreenForecastUnlock   = lazy(() => import('./modules/gerente/ScreenForecastUnlock'))
const ScreenGastosGerente    = lazy(() => import('./modules/gerente/ScreenGastos'))

// ─── Contexto de sesión ──────────────────────────────────────────────────────
// NOTA: Mover SessionContext + useSession a un archivo aparte para satisfacer
// `react-refresh/only-export-components` requeriria refactorizar imports en
// decenas de pantallas. Queda como deuda tecnica documentada (gap).
// eslint-disable-next-line react-refresh/only-export-components
export const SessionContext = createContext(null)
// eslint-disable-next-line react-refresh/only-export-components
export function useSession() { return useContext(SessionContext) }

function getStoredSession() {
  try {
    const raw = localStorage.getItem('gf_session')
    if (!raw) return null
    const s = JSON.parse(raw)
    const normalized = normalizeSessionRoleContext(s)
    // Validación ÚNICA y autoritativa (src/lib/session.js): employee_id +
    // session_token no vacío + exp vigente. Una sesión corrupta/expirada se
    // limpia aquí mismo => la app arranca SIN sesión (cero flash de nav).
    if (!isValidAuthenticatedSession(normalized)) {
      localStorage.removeItem('gf_session')
      return null
    }
    return normalized
  } catch {
    // JSON corrupto/ilegible: eliminarlo para que la próxima carga no vuelva a
    // fallar por el mismo valor. Defensivo: removeItem no debe propagar error;
    // no tocamos otras claves.
    try { localStorage.removeItem('gf_session') } catch { /* ignore */ }
    return null
  }
}

// Sesión VÁLIDA obligatoria (isValidAuthenticatedSession, BLOCKER 1 Codex):
// null / {} / token vacío / expirada / corrupta => /login. Para rutas ancla
// (Inicio, Perfil) sin módulo del registry asociado.
function PrivateRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  return children
}

// ── ModuleRoleRoute — guard ÚNICO por módulo (BLOCKER 2 Codex) ───────────────
// La MISMA autoridad decide tarjeta del home, entrada de navegación y ACCESO
// POR URL DIRECTA: registry (fuente canónica de roles por módulo) +
// getEffectiveJobKeys + isModuleVisibleForRoles, sobre una sesión válida.
// Cero allowlists duplicadas en App.jsx (el viejo guard de /ruta desaparece).
// Orden fail-closed:
//   1. sesión inválida        → /login
//   2. moduleId desconocido   → / (fail-closed: nunca montar sin autoridad)
//   3. rol sin visibilidad    → / (la tenancy final sigue siendo server-side:
//      cada endpoint /pwa-* revalida al dueño — p. ej. "/pwa-ruta/*")
//   4. solo entonces monta la ruta.
// Tower NO usa este guard: conserva su TowerRoute especializado (rol
// AUTORITATIVO tower_status servido por Odoo, allowlist dura).
function ModuleRoleRoute({ moduleId, children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  const module = getModuleById(moduleId)
  if (!module) return <Navigate to="/" replace />
  if (!isModuleVisibleForRoles(module, getEffectiveJobKeys(session))) return <Navigate to="/" replace />
  return children
}

// E1-C.4 — montaje de la superficie KOLD Tower (read-only) detrás de auth + rol AUTORITATIVO.
// El rol lo decide Odoo (session.employee.tower_status); allowlist dura en readAuthoritativeTowerStatus
// (solo admin_plataforma/supervisor_ventas). null / no autorizado => redirect seguro a "/".
// Sin menú general (solo ruta directa /torre). Sin datos reales nuevos, sin endpoints, sin writes.
function TowerRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (!readAuthoritativeTowerStatus(session)) return <Navigate to="/" replace />
  return children
}

function ScreenKoldTowerE1Mount() {
  const { session } = useSession()
  return <ScreenKoldTowerE1 session={session} />
}

function ScreenM1BacklogMount() {
  const { session } = useSession()
  return <ScreenM1Backlog session={session} />
}

// KOLD OS · M2 (Planeación) — gate fail-closed PROPIO (NO reutiliza el de Tower):
// direccion_general (x_job_key efectivo) o admin_plataforma (tower_status
// AUTORITATIVO). Cualquier otra sesión => redirect seguro a "/". Cero writes.
function M2PlaneacionRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM2Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}

// KOLD OS · M6 (Caja y conciliación) — gate fail-closed PROPIO: SÓLO
// direccion_general (x_job_key efectivo). Cualquier otra sesión => redirect
// seguro a "/". Cero writes.
//
// OJO — a diferencia de M2PlaneacionRoute, aquí NO se acepta el tower_status
// `admin_plataforma`: el backend M6 sólo valida el job key. Si el frontend fuera
// más permisivo, la tarjeta se vería y el endpoint respondería 403 (bug de M1).
function M6CajaRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM6Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}

function ScreenCajaConciliacionM6Mount() {
  const { session } = useSession()
  return <ScreenCajaConciliacionM6 session={session} />
}

function ScreenPlaneacionM2Mount() {
  const { session } = useSession()
  return <ScreenPlaneacionM2 session={session} />
}

// KOLD OS · M3 (Ejecución de rutas) — gate fail-closed PROPIO, misma mecánica
// que M2 y sin reutilizar el de Tower: cada módulo revalida con SU contrato.
// El route guard es la autoridad FINAL, independiente de lo que decida la nav.
function M3EjecucionRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM3Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}

function ScreenEjecucionM3Mount() {
  const { session } = useSession()
  return <ScreenEjecucionM3 session={session} />
}

// KOLD OS · M4 (Ventas y clientes) — gate fail-closed PROPIO, misma mecánica
// que M2 y sin reutilizar el de Tower: cada módulo revalida con SU contrato.
// El route guard es la autoridad FINAL, independiente de lo que decida la nav.
function M4VentasRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM4Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}

function ScreenVentasM4Mount() {
  const { session } = useSession()
  return <ScreenVentasM4 session={session} />
}

// KOLD OS · M5 (Inventario y flujo) — gate fail-closed propio. La autoridad
// final coincide con la tarjeta y la navegación: readM5Access(session).
function M5InventarioRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM5Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}

function ScreenInventarioM5Mount() {
  const { session } = useSession()
  return <ScreenInventarioM5 session={session} />
}

function ProductionOperatorRoute({ children, allowDelivered = false }) {
  const { session } = useSession()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [blockedState, setBlockedState] = useState(null)

  useEffect(() => {
    let active = true

    async function validate() {
      if (!session) {
        if (active) {
          setBlockedState(null)
          setLoading(false)
        }
        return
      }

      const productionRole = resolveModuleContextRole(
        session,
        getModuleById('registro_produccion'),
        location.state?.selected_role,
      ) || String(session?.role || '').trim()

      const normalizedRole = String(productionRole || '').trim().toLowerCase()
      if (normalizedRole !== 'operador_barra' && normalizedRole !== 'operador_rolito') {
        if (active) {
          setBlockedState(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const shift = await api('GET', '/pwa-prod/my-shift')
        if (!active) return
        if (!shift?.id) {
          setBlockedState(null)
          setLoading(false)
          return
        }

        clearStaleOperatorTurnClosed(shift, normalizedRole, shift)
        const closeState = getOperatorCloseState(shift, normalizedRole, shift)
        if (closeState?.effectively_closed) {
          setBlockedState({ shift, role: normalizedRole, closeState })
        } else {
          setBlockedState(null)
        }
      } catch {
        if (!active) return
        setBlockedState(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    validate()
    return () => { active = false }
  }, [session, location.state?.selected_role, location.pathname])

  if (!session) return <Navigate to="/login" replace />
  if (loading) return <PageLoader />
  if (blockedState?.closeState?.effectively_closed && !allowDelivered) {
    return <Navigate to="/produccion/turno-entregado" replace state={blockedState} />
  }
  return children
}

function PageLoader() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#030811',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid rgba(255,255,255,0.12)',
        borderTop: '2px solid #2B8FE0',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// ─── Error Boundary — evita pantallas blancas por crash de módulos ────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // Expose last crash for debugging. Safe in prod (no PII).
    try {
      window.__gfLastError = {
        name: error?.name, message: error?.message, stack: error?.stack,
        componentStack: info?.componentStack,
      }
    } catch { /* no-op */ }
  }
  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || ''
      return (
        <div style={{
          minHeight: '100dvh', background: '#030811',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', gap: 16, fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>⚠️</div>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Algo salió mal
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 420 }}>
            Ocurrió un error al cargar esta pantalla. Intenta de nuevo.
          </p>
          {msg && (
            <p style={{
              color: 'rgba(239,68,68,0.7)', fontSize: 11, margin: 0,
              textAlign: 'center', maxWidth: 420, fontFamily: 'monospace',
            }}>
              {msg}
            </p>
          )}
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            style={{
              border: 'none', cursor: 'pointer', padding: '12px 28px',
              borderRadius: 999, background: 'linear-gradient(90deg,#15499B,#2B8FE0)',
              color: 'white', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            Volver al inicio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(getStoredSession)

  useEffect(() => {
    if (session) {
      localStorage.setItem('gf_session', JSON.stringify(session))
    } else {
      localStorage.removeItem('gf_session')
    }
    // Codex §2/§3: notifica a la capa reactiva de scope (sessionStore) que la
    // sesión cambió EN ESTA pestaña (los writes de localStorage de la misma
    // pestaña NO disparan `storage`). Al cambiar la identidad, los hooks de datos
    // limpian su estado visible, invalidan caché y refetch.
    try { window.dispatchEvent(new Event('gf:session-changed')) } catch { /* noop */ }
  }, [session])

  // Global listener: any api.js that detects expired/missing token fires this.
  // Limpieza completa de estado operativo conocido — phone-loss data retention.
  useEffect(() => {
    function onSessionExpired() {
      try { clearGrupoFrioLocalState() } catch { /* ignore */ }
      setSession(null)
    }
    window.addEventListener('gf:session-expired', onSessionExpired)
    return () => window.removeEventListener('gf:session-expired', onSessionExpired)
  }, [])

  // Multi-tab safety: detect when another tab cambia la sesion (logout o
  // login distinto). Cuando el employee_id en localStorage difiere del que
  // tenemos en memoria, hard-reload para descartar cualquier estado en RAM
  // del usuario anterior y arrancar limpio con la nueva sesion.
  useEffect(() => {
    function checkSessionDrift() {
      const stored = getStoredSession()
      const memEmpId = session?.employee_id || null
      const storedEmpId = stored?.employee_id || null
      if (memEmpId !== storedEmpId) {
        // Drift detectado: hard reload a "/" para que el routing recompute
        // landing y se descarte la pila de history del usuario anterior.
        window.location.replace('/')
      }
    }
    function onStorage(e) {
      if (e.key === 'gf_session') checkSessionDrift()
    }
    function onFocus() { checkSessionDrift() }
    function onVisibility() { if (document.visibilityState === 'visible') checkSessionDrift() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [session?.employee_id])

  function login(sessionData) {
    const next = normalizeSessionRoleContext(sessionData)
    const nextEmpId = next?.employee_id || null
    const prevEmpId = session?.employee_id || null
    setSession(next)
    // Si entra otro empleado distinto al que estaba (raro, pero pasa cuando
    // el mismo navegador cambia de usuario), forzamos reload despues de
    // persistir la sesion para limpiar history y estado de modulos viejos.
    if (prevEmpId && nextEmpId && prevEmpId !== nextEmpId) {
      // Persistir primero para que el reload ya lea la nueva sesion.
      try { localStorage.setItem('gf_session', JSON.stringify(next)) } catch {}
      window.location.replace('/')
    }
  }
  function logout() {
    setSession(null)
    // Reload para descartar cualquier dato en RAM del usuario que sale +
    // limpieza explícita de estado operativo conocido en localStorage
    // (KM, cierre, liquidación, handover, inventario, reconciliaciones).
    // No usamos localStorage.clear() para no tocar preferencias de UI ni
    // storage de librerías externas — ver src/lib/clearLocalState.js.
    try { clearGrupoFrioLocalState() } catch { /* ignore */ }
    window.location.replace('/login')
  }
  function updateSession(patch) {
    setSession(prev => (prev ? normalizeSessionRoleContext({ ...prev, ...patch }) : prev))
  }

  return (
    <SessionContext.Provider value={{ session, login, logout, updateSession }}>
      <ToastProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={isValidAuthenticatedSession(session) ? <Navigate to="/" replace /> : <ScreenLogin />} />

            {/* ── Layout global: navegación por rol persistente en todas las pantallas autenticadas ── */}
            <Route element={<AppShell />}>

            {/* Generales */}
            <Route path="/" element={<PrivateRoute><ScreenHome /></PrivateRoute>} />
            <Route path="/kpis" element={<ModuleRoleRoute moduleId="kpis"><ScreenKPIs /></ModuleRoleRoute>} />
            <Route path="/surveys" element={<ModuleRoleRoute moduleId="encuestas"><ScreenSurveys /></ModuleRoleRoute>} />
            <Route path="/badges" element={<ModuleRoleRoute moduleId="logros"><ScreenBadges /></ModuleRoleRoute>} />
            <Route path="/profile" element={<PrivateRoute><ScreenProfile /></PrivateRoute>} />

            {/* ── E1-C.4 — KOLD Tower (read-only, gated por tower_status autoritativo; SIN menú) ── */}
            <Route path="/torre" element={<TowerRoute><ScreenKoldTowerE1Mount /></TowerRoute>} />
            {/* ── M1-D — Backlog M1 (read-only, mismo gate; SIN menú, ruta directa) ── */}
            <Route path="/torre/backlog" element={<TowerRoute><ScreenM1BacklogMount /></TowerRoute>} />

            {/* ── Producción — Operadores ─────────────────────────────────── */}
            <Route path="/produccion" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenMiTurno /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/checklist" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenChecklist /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/ciclo" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenCiclo /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/empaque" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenEmpaque /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/corte" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenCorte /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/transformacion" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenTransformacion /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/tanque" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenTanqueLista /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/tanque/:machineId" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenTanque /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/incidencia" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenIncidenciaRolito /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/cierre" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenCierreRolito /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/declaracion-bolsas" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenDeclaracionBolsas /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/handover" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenHandoverTurno /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/turno-entregado" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute allowDelivered><ScreenTurnoEntregado /></ProductionOperatorRoute></ModuleRoleRoute>} />
            <Route path="/produccion/reconciliacion" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenReconciliacionPT /></ProductionOperatorRoute></ModuleRoleRoute>} />

            {/* ── Almacén PT V2 ────────────────────────────────────────── */}
            <Route path="/almacen-pt" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenAlmacenPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/recepcion" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenRecepcion /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/inventario" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenInventarioPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/transformacion" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenTransformacionPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/traspaso" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenTraspasoPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/handover" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenHandoverPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/merma" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMermaPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/materiales" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMaterialesIssue /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/materiales/crear" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMaterialesCrearIssue /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/declaracion-bolsas" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenDeclaracionBolsasPT /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/materiales/report/:issueId" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMaterialesReport /></ModuleRoleRoute>} />
            <Route path="/almacen-pt/materiales/reconciliar" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMaterialesReconcile /></ModuleRoleRoute>} />

            {/* ── KOLDCUP ─────────────────────────────────────────────── */}
            <Route path="/koldcup" element={<ModuleRoleRoute moduleId="koldcup"><ScreenKoldcupHub /></ModuleRoleRoute>} />
            <Route path="/koldcup/compra" element={<ModuleRoleRoute moduleId="koldcup"><ScreenKoldcupCompra /></ModuleRoleRoute>} />
            <Route path="/koldcup/produccion" element={<ModuleRoleRoute moduleId="koldcup"><ScreenKoldcupProduccion /></ModuleRoleRoute>} />
            <Route path="/koldcup/corte" element={<ModuleRoleRoute moduleId="koldcup"><ScreenKoldcupCorte /></ModuleRoleRoute>} />
            <Route path="/koldcup/traspaso" element={<ModuleRoleRoute moduleId="koldcup"><ScreenKoldcupTraspaso /></ModuleRoleRoute>} />

            {/* ── Supervisión Producción ───────────────────────────────── */}
            <Route path="/supervision" element={<ModuleRoleRoute moduleId="supervision_produccion"><ScreenSupervision /></ModuleRoleRoute>} />
            <Route path="/supervision/paros" element={<ModuleRoleRoute moduleId="supervision_produccion"><ScreenParos /></ModuleRoleRoute>} />
            <Route path="/supervision/merma" element={<ModuleRoleRoute moduleId="supervision_produccion"><ScreenMerma /></ModuleRoleRoute>} />
            <Route path="/supervision/energia" element={<ModuleRoleRoute moduleId="supervision_produccion"><ScreenEnergia /></ModuleRoleRoute>} />
            <Route path="/supervision/mantenimiento" element={<ModuleRoleRoute moduleId="supervision_produccion"><ScreenMantenimiento /></ModuleRoleRoute>} />
            <Route path="/supervision/turno" element={<ModuleRoleRoute moduleId="supervision_produccion"><ScreenControlTurno /></ModuleRoleRoute>} />

            {/* ── Admin Sucursal (POS + Gastos + Requisiciones) ────────── */}
            <Route path="/admin" element={<ModuleRoleRoute moduleId="admin_sucursal"><AdminThemeScope /></ModuleRoleRoute>}>
              <Route index element={<ScreenAdminPanel />} />
              <Route path="pos" element={<ScreenPOS />} />
              <Route path="ticket/:orderId" element={<ScreenTicket />} />
              <Route path="gastos" element={<ScreenGastos />} />
              <Route path="gastos-historial" element={<ScreenGastosHistorial />} />
              <Route path="gastos/aprobar" element={<ScreenGastosAprobar />} />
              <Route path="requisiciones" element={<ScreenRequisiciones />} />
              <Route path="liquidaciones" element={<ScreenLiquidaciones />} />
              <Route path="materia-prima" element={<ScreenMateriaPrima />} />
              <Route path="traspaso-materia-prima" element={<ScreenTraspasoMateriaPrima />} />
              <Route path="historial-cargas" element={<ScreenHistorialCargas />} />
              <Route path="bolsas/validar" element={<ScreenValidacionBolsas />} />
              <Route path="cierre" element={<ScreenCierreCaja />} />
              <Route path="materiales/validar" element={<ScreenMaterialesValidate />} />
              <Route path="materiales/resolver-rechazo" element={<ScreenMaterialesResolverRejected />} />
            </Route>

            {/* ── Almacenista Entregas ─────────────────────────────────── */}
            {/* Entregas V2 — flujo guiado */}
            <Route path="/entregas" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenHubDia /></ModuleRoleRoute>} />
            <Route path="/entregas/recibir-pt" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenRecibirPT /></ModuleRoleRoute>} />
            <Route path="/entregas/transformacion" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenTransformacionEntregas /></ModuleRoleRoute>} />
            <Route path="/entregas/carga" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenCargaUnidades /></ModuleRoleRoute>} />
            <Route path="/entregas/historial-cargas" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenHistorialCargas /></ModuleRoleRoute>} />
            <Route path="/entregas/operacion" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenOperacionDia /></ModuleRoleRoute>} />
            <Route path="/entregas/devoluciones" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenDevolucionesV2 /></ModuleRoleRoute>} />
            <Route path="/entregas/merma" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenMermaEntregas /></ModuleRoleRoute>} />
            <Route path="/entregas/cierre-turno" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenCierreTurno /></ModuleRoleRoute>} />
            {/* Legacy route aliases — eliminado V1 2026-04-17 */}
            <Route path="/entregas/aceptar-turno" element={<Navigate to="/entregas/cierre-turno" replace />} />
            <Route path="/entregas/validar" element={<Navigate to="/entregas/operacion" replace />} />
            <Route path="/entregas/inventario" element={<ModuleRoleRoute moduleId="almacen_entregas"><ScreenInventarioEntregas /></ModuleRoleRoute>} />

            {/* ── Jefe de Ruta ─────────────────────────────────────────── */}
            {/* Role gating: solo jefe_ruta y auxiliar_ruta acceden por URL directa. */}
            <Route path="/ruta" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenMiRutaV2 /></ModuleRoleRoute>} />
            <Route path="/ruta/checklist" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenChecklistUnidad /></ModuleRoleRoute>} />
            <Route path="/ruta/carga" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenAceptarCarga /></ModuleRoleRoute>} />
            <Route path="/ruta/incidencias" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenIncidencias /></ModuleRoleRoute>} />
            <Route path="/ruta/kpis" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenKPIsRuta /></ModuleRoleRoute>} />
            <Route path="/ruta/conciliacion" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenConciliacion /></ModuleRoleRoute>} />
            <Route path="/ruta/control" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenControlRuta /></ModuleRoleRoute>} />
            <Route path="/ruta/inventario" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenInventarioRuta /></ModuleRoleRoute>} />
            <Route path="/ruta/corte" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenCorteRuta /></ModuleRoleRoute>} />
            <Route path="/ruta/liquidacion" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenLiquidacion /></ModuleRoleRoute>} />
            <Route path="/ruta/cierre" element={<ModuleRoleRoute moduleId="cierre_ruta"><ScreenCierreRuta /></ModuleRoleRoute>} />

            {/* ── Supervisor de Ventas ─────────────────────────────────── */}
            {/* Supervisor Ventas V2 — Centro de Control Comercial */}
            {/* Supervisor V2 shell (flag fail-closed; OFF ⇒ legacy/redirect). */}
            <Route path="/equipo" element={<ModuleRoleRoute moduleId="supervisor_ventas"><SupervisorV2Gate active="hoy" legacy={<ScreenControlComercial />}><HoyTab /></SupervisorV2Gate></ModuleRoleRoute>} />
            <Route path="/equipo/radar" element={<ModuleRoleRoute moduleId="supervisor_ventas"><SupervisorV2Gate active="radar" v2Only><RadarTab /></SupervisorV2Gate></ModuleRoleRoute>} />
            <Route path="/equipo/rutas" element={<ModuleRoleRoute moduleId="supervisor_ventas"><SupervisorV2Gate active="rutas" v2Only><RutasTab /></SupervisorV2Gate></ModuleRoleRoute>} />
            <Route path="/equipo/pendientes" element={<ModuleRoleRoute moduleId="supervisor_ventas"><SupervisorV2Gate active="pendientes" v2Only><PendientesTab /></SupervisorV2Gate></ModuleRoleRoute>} />
            <Route path="/equipo/mas" element={<ModuleRoleRoute moduleId="supervisor_ventas"><SupervisorV2Gate active="mas" v2Only><MasTab /></SupervisorV2Gate></ModuleRoleRoute>} />
            {/* /equipo/hoy y /equipo/clientes: legacy directo (deep-link compat). */}
            <Route path="/equipo/hoy" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenOperacionesHoy /></ModuleRoleRoute>} />
            {/* Bajas: EXCLUIDA de V2 (backend no auditado). V2 ON ⇒ no disponible sin fetch; V2 OFF ⇒ legacy. */}
            <Route path="/equipo/bajas" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenBajasHub />} /></ModuleRoleRoute>} />
            <Route path="/equipo/bajas/sugey" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenBajasSugey />} /></ModuleRoleRoute>} />
            <Route path="/equipo/bajas/sugey/:requestId" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenBajasSugeyDetail />} /></ModuleRoleRoute>} />
            <Route path="/equipo/bajas/angelica" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenBajasAngelica />} /></ModuleRoleRoute>} />
            <Route path="/equipo/bajas/angelica/:requestId" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenBajasAngelicaDetail />} /></ModuleRoleRoute>} />
            <Route path="/equipo/vendedor/:vendedorId" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenDetalleVendedor /></ModuleRoleRoute>} />
            <Route path="/equipo/sin-visitar" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenClientesSinVisitar /></ModuleRoleRoute>} />
            <Route path="/equipo/score-semanal" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenScoreSemanal /></ModuleRoleRoute>} />
            <Route path="/equipo/cierre" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenCierreOperativo /></ModuleRoleRoute>} />
            <Route path="/equipo/dashboard" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenDashboardVentas /></ModuleRoleRoute>} />
            <Route path="/equipo/pronostico" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenPronostico />} /></ModuleRoleRoute>} />
            <Route path="/equipo/planes/clientes" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenPlanDiarioClientes />} /></ModuleRoleRoute>} />
            <Route path="/equipo/clientes" element={<ModuleRoleRoute moduleId="supervisor_ventas"><SupervisorV2Gate active="clientes" legacy={<ScreenClientesSupervisor />}><ClientesTab /></SupervisorV2Gate></ModuleRoleRoute>} />
            <Route path="/equipo/metas" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenMetasVendedores /></ModuleRoleRoute>} />
            <Route path="/equipo/tareas" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenTareasSupervisor />} /></ModuleRoleRoute>} />
            <Route path="/equipo/notas" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenNotasCliente />} /></ModuleRoleRoute>} />
            <Route path="/equipo/recuperacion" element={<ModuleRoleRoute moduleId="supervisor_ventas"><ScreenClientesRecuperacion /></ModuleRoleRoute>} />
            <Route path="/equipo/nota-rapida" element={<ModuleRoleRoute moduleId="supervisor_ventas"><V2ExcludedRoute legacy={<ScreenNotaRapida />} /></ModuleRoleRoute>} />
            {/* V1 legacy routes */}
            <Route path="/equipo/vendedores" element={<Navigate to="/equipo" replace />} />
            <Route path="/equipo/control" element={<Navigate to="/equipo" replace />} />

            {/* ── KOLD OS · M2 — Planeación y readiness (read-only) ────── */}
            <Route path="/planeacion" element={<M2PlaneacionRoute><ScreenPlaneacionM2Mount /></M2PlaneacionRoute>} />
            {/* ── KOLD OS · M3 — Ejecución de rutas (read-only) ────────── */}
            <Route path="/ejecucion" element={<M3EjecucionRoute><ScreenEjecucionM3Mount /></M3EjecucionRoute>} />
            {/* ── KOLD OS · M4 — Ventas y clientes (read-only) ─────────── */}
            <Route path="/ventas-clientes" element={<M4VentasRoute><ScreenVentasM4Mount /></M4VentasRoute>} />
            {/* ── KOLD OS · M5 — Inventario y flujo (read-only) ────────── */}
            <Route path="/inventario-flujo" element={<M5InventarioRoute><ScreenInventarioM5Mount /></M5InventarioRoute>} />
            {/* ── KOLD OS · M6 — Caja y conciliación (read-only) ───────── */}
            <Route path="/caja-conciliacion" element={<M6CajaRoute><ScreenCajaConciliacionM6Mount /></M6CajaRoute>} />

            {/* ── Gerente de Sucursal ──────────────────────────────────── */}
            <Route path="/gerente" element={<ModuleRoleRoute moduleId="gerente"><ScreenGerente /></ModuleRoleRoute>} />
            <Route path="/gerente/dashboard" element={<ModuleRoleRoute moduleId="gerente"><ScreenDashboardGerente /></ModuleRoleRoute>} />
            <Route path="/gerente/alertas" element={<ModuleRoleRoute moduleId="gerente"><ScreenAlertasGerente /></ModuleRoleRoute>} />
            <Route path="/gerente/gastos" element={<ModuleRoleRoute moduleId="gerente"><ScreenGastosGerente /></ModuleRoleRoute>} />
            <Route path="/gerente/forecast" element={<ModuleRoleRoute moduleId="gerente"><ScreenForecastUnlock /></ModuleRoleRoute>} />

            {/* ── Torres de Control — Validación de Requisiciones ────────── */}
            <Route path="/torres" element={<ModuleRoleRoute moduleId="torre_control"><ScreenTorreRequisiciones /></ModuleRoleRoute>} />
            <Route path="/torres/requisicion/:poId" element={<ModuleRoleRoute moduleId="torre_control"><ScreenTorreDetail /></ModuleRoleRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      </ToastProvider>
    </SessionContext.Provider>
  )
}
