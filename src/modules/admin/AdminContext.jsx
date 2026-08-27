// ─── AdminContext — estado del módulo Auxiliar Administrativo ───────────────
// El selector de compañía es estado LOCAL del módulo. Nunca reescribe
// session.company_id, gf_session ni el alcance de Entregas.
//
// Superficies v2: el alcance efectivo es published_scope de un contrato
// validado. Sin contrato: carga o no disponible, nunca un warehouse heredado.
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from '../../App'
import { COMPANY_LABELS } from '../../tokens'
import { softEmployee } from '../../lib/sessionGuards'
import { buildSessionIdentity } from '../supervisor-ventas/v2/sessionScope'
import { publishedScope, validateContract } from '../../lib/capabilityContract.js'
import {
  BACKEND_CAPS,
  bootCapabilities,
  getOdooServiceState,
  retryCapabilities,
} from './adminService'
import { useCapabilitiesRevision } from './useCapabilitiesRevision'
import { resetCashShiftRequestRegistry } from './cashShiftService'
import {
  adminCompaniesFromPublishedScope,
  nextAdminCompanyId,
  syncAdminCompanyForIdentity,
} from './adminLocalCompany.js'

const AdminContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}

export function AdminProvider({ children }) {
  const { session } = useSession()
  const capsRevision = useCapabilitiesRevision()
  const odoo = getOdooServiceState()

  const contractOk = validateContract(BACKEND_CAPS).ok
  const published = contractOk ? publishedScope(BACKEND_CAPS) : null
  const sucursal = published?.plaza_label || ''
  const warehouseId = published?.warehouse_id || null
  const employeeId = softEmployee(session)
  const employeeName = session?.name || ''

  const availableCompanies = useMemo(
    () => adminCompaniesFromPublishedScope(published),
    [published],
  )

  const sessionIdentity = buildSessionIdentity(session).sessionKey
  const employeeToken = session?.odoo_employee_token || session?.gf_employee_token || ''
  const identityRef = useRef(sessionIdentity)
  const [companyId, setCompanyIdInternal] = useState(() => (
    availableCompanies[0]?.id || null
  ))
  const [capsReady, setCapsReady] = useState(false)

  useEffect(() => {
    setCompanyIdInternal((current) => syncAdminCompanyForIdentity({
      previousIdentity: identityRef.current,
      nextIdentity: sessionIdentity,
      published,
      currentCompanyId: current,
    }))
    identityRef.current = sessionIdentity
  }, [sessionIdentity, published])

  useEffect(() => {
    let alive = true
    setCapsReady(false)
    resetCashShiftRequestRegistry(sessionIdentity)
    bootCapabilities(session).finally(() => { if (alive) setCapsReady(true) })
    return () => {
      alive = false
      resetCashShiftRequestRegistry()
    }
  }, [session, sessionIdentity, employeeToken])

  const setCompanyId = useCallback((id) => {
    setCompanyIdInternal((current) => nextAdminCompanyId(availableCompanies, current, id))
  }, [availableCompanies])

  const companyLabel = published?.company_label
    || COMPANY_LABELS[companyId]
    || (companyId ? `ID ${companyId}` : '')

  const value = useMemo(() => ({
    companyId,
    companyLabel,
    availableCompanies,
    setCompanyId,
    sucursal,
    warehouseId,
    employeeId,
    employeeName,
    capsReady,
    capsRevision,
    sessionIdentity,
    scopeState: !capsReady ? 'loading' : (published ? 'ready' : 'unavailable'),
    odooUnavailable: odoo.status === 'unavailable',
    odooMessage: odoo.message || '',
    retryOdoo: () => retryCapabilities(session),
  }), [companyId, companyLabel, availableCompanies, setCompanyId, sucursal, warehouseId, employeeId, employeeName, capsReady, capsRevision, sessionIdentity, published, odoo.status, odoo.message, session])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}
