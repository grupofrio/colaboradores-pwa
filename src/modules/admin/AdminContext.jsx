// ─── AdminContext — estado del módulo Auxiliar Administrativo ───────────────
// El selector de compañía es estado LOCAL del módulo. Nunca reescribe
// session.company_id, gf_session ni el alcance de Entregas.
//
// Guards de sesión: si falta warehouse_id o company_id, la app muestra error
// explícito (ver SessionErrorState) en lugar de trabajar con IDs hardcodeados.
import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { useSession } from '../../App'
import { COMPANY_LABELS, getCompaniesForSucursal } from '../../tokens'
import { softWarehouse, softEmployee } from '../../lib/sessionGuards'
import { buildSessionIdentity } from '../supervisor-ventas/v2/sessionScope'
import { publishedScope } from '../../lib/capabilityContract.js'
import {
  BACKEND_CAPS,
  bootCapabilities,
  invalidateCashShiftCapabilities,
} from './adminService'
import { resetCashShiftRequestRegistry } from './cashShiftService'
import { nextAdminCompanyId } from './adminLocalCompany.js'

const AdminContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}

export function AdminProvider({ children }) {
  const { session } = useSession()

  const published = publishedScope(BACKEND_CAPS)
  const sucursal = published?.plaza_label || ''
  // Soft guards: si no hay warehouse/employee, lo dejamos null para que las
  // pantallas validen y muestren mensaje de error claro al usuario.
  const warehouseId = published?.warehouse_id || softWarehouse(session)
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

  const setCompanyId = useCallback((id) => {
    setCompanyIdInternal((current) => nextAdminCompanyId(availableCompanies, current, id))
  }, [availableCompanies])

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
    sessionIdentity,
  }), [companyId, companyLabel, availableCompanies, setCompanyId, sucursal, warehouseId, employeeId, employeeName, capsReady, sessionIdentity])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}
