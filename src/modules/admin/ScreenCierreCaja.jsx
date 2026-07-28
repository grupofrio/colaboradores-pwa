import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { cashShiftAccessMode } from '../../lib/navModel.js'
import { AdminProvider, useAdmin } from './AdminContext'
import { BACKEND_CAPS } from './adminService.js'
import AdminShell from './components/AdminShell'
import CashShiftDashboard from './components/CashShiftDashboard.jsx'
import './cashShift.css'

function queryShiftId(search) {
  const params = new URLSearchParams(search)
  if (params.getAll('shift_id').length !== 1) return null
  const raw = params.get('shift_id')
  if (!/^[1-9]\d*$/.test(String(raw || ''))) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

function CashShiftScreenContent() {
  const { session } = useSession()
  const { capsReady, companyId, warehouseId } = useAdmin()
  const location = useLocation()
  const navigate = useNavigate()
  const [width, setWidth] = useState(typeof window === 'undefined' ? 1280 : window.innerWidth)

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const capabilitiesReady = capsReady
  const accessMode = capabilitiesReady ? cashShiftAccessMode(BACKEND_CAPS) : 'loading'
  const token = session?.odoo_employee_token || session?.gf_employee_token || ''
  const scopeReady = Boolean(token && Number(companyId) > 0 && Number(warehouseId) > 0)
  const authorizerShiftId = useMemo(() => queryShiftId(location.search), [location.search])
  const dashboard = (
    <div className="cash-shift-page">
      <CashShiftDashboard
        accessMode={accessMode}
        scopeReady={scopeReady}
        authorizerShiftId={authorizerShiftId}
        layout={width < 1024 ? 'mobile' : 'desktop'}
      />
    </div>
  )

  if (width < 1024) {
    return (
      <div className="cash-shift-mobile-shell">
        <header className="cash-shift-mobile-header">
          <button type="button" aria-label="Volver a administración" onClick={() => navigate('/admin')}>←</button>
          <h1>Cortes de caja</h1>
        </header>
        {dashboard}
      </div>
    )
  }

  return (
    <AdminShell activeBlock="cierre" title="Cortes de caja" hideActivityFeed>
      {dashboard}
    </AdminShell>
  )
}

export default function ScreenCierreCaja() {
  return (
    <AdminProvider>
      <CashShiftScreenContent />
    </AdminProvider>
  )
}
