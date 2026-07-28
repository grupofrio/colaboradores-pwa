// ─── AdminContext — estado global del Auxiliar Administrativo ───────────────
// Provee los filtros globales (razón social, sucursal, almacén) que todas las
// pantallas del rol consumen. Persiste company_id en session para que api.js
// lo lea en headers en cada request al backend.
//
// Guards de sesión: si falta warehouse_id o company_id, la app muestra error
// explícito (ver SessionErrorState) en lugar de trabajar con IDs hardcodeados.
import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { useSession } from '../../App'
import { COMPANY_LABELS, getCompaniesForSucursal } from '../../tokens'
import { softWarehouse, softEmployee } from '../../lib/sessionGuards'
import { buildSessionIdentity } from '../supervisor-ventas/v2/sessionScope'
import {
  bootCapabilities,
  invalidateCashShiftCapabilities,
} from './adminService'
import { resetCashShiftRequestRegistry } from './cashShiftService'

const AdminContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}

export function AdminProvider({ children }) {
  const { session, updateSession } = useSession()

  const sucursal = session?.sucursal || ''
  // Soft guards: si no hay warehouse/employee, lo dejamos null para que las
  // pantallas validen y muestren mensaje de error claro al usuario.
  const warehouseId = softWarehouse(session)
  const employeeId = softEmployee(session)
  const employeeName = session?.name || ''

  const availableCompanies = useMemo(
    () => getCompaniesForSucursal(sucursal),
    [sucursal],
  )

  // company_id inicial: el de sesión si es válido, sino el primero disponible
  // para la sucursal. Si la sucursal no tiene companies mapeadas, quedamos en
  // null (la UI consumidora muestra SessionErrorState).
  const initialCompanyId = useMemo(() => {
    const fromSession = Number(session?.company_id || 0)
    if (fromSession > 0 && availableCompanies.some(c => c.id === fromSession)) {
      return fromSession
    }
    return availableCompanies[0]?.id || null
  }, [session?.company_id, availableCompanies])

  const [companyId, setCompanyIdInternal] = useState(initialCompanyId)
  const [capsReady, setCapsReady] = useState(false)
  const sessionIdentity = buildSessionIdentity(session).sessionKey
  const employeeToken = session?.odoo_employee_token || session?.gf_employee_token || ''

  // Cada identidad obtiene capacidades nuevas. Cleanup invalida tanto la
  // respuesta en vuelo como cualquier permiso sensible de la sesión anterior.
  useEffect(() => {
    let alive = true
    setCapsReady(false)
    resetCashShiftRequestRegistry(sessionIdentity)
    bootCapabilities(session).finally(() => { if (alive) setCapsReady(true) })
    return () => {
      alive = false
      invalidateCashShiftCapabilities()
      resetCashShiftRequestRegistry()
    }
  }, [session, sessionIdentity, employeeToken])

  // Si cambia la sesión externa (logout/login), re-sincroniza
  useEffect(() => {
    if (session?.company_id && session.company_id !== companyId) {
      if (availableCompanies.some(c => c.id === session.company_id)) {
        setCompanyIdInternal(session.company_id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.company_id])

  const setCompanyId = useCallback((id) => {
    const num = Number(id)
    if (!availableCompanies.some(c => c.id === num)) return
    setCompanyIdInternal(num)
    // Persistir en session → localStorage → api.js headers
    if (updateSession) updateSession({ company_id: num })
  }, [availableCompanies, updateSession])

  const companyLabel = COMPANY_LABELS[companyId] || `ID ${companyId}`

  const value = useMemo(() => ({
    // Contexto organizacional
    companyId,
    companyLabel,
    availableCompanies,
    setCompanyId,
    sucursal,
    warehouseId,
    employeeId,
    employeeName,
    capsReady,
  }), [companyId, companyLabel, availableCompanies, setCompanyId, sucursal, warehouseId, employeeId, employeeName, capsReady])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}
