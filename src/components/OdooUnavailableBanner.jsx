import { ODOO_UNAVAILABLE_MESSAGE } from '../lib/odooAvailability'
import { getOdooServiceState, retryCapabilities } from '../modules/admin/adminService'
import { useCapabilitiesRevision } from '../modules/admin/useCapabilitiesRevision'
import { useSessionContext } from '../lib/sessionContext'

export default function OdooUnavailableBanner() {
  const ctx = useSessionContext()
  const session = ctx?.session
  useCapabilitiesRevision()
  const state = getOdooServiceState()
  if (state.status !== 'unavailable') return null

  return (
    <div
      role="status"
      data-testid="odoo-unavailable-banner"
      className="sticky top-0 z-[110] flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
    >
      <span>{state.message || ODOO_UNAVAILABLE_MESSAGE}</span>
      <button
        type="button"
        className="min-h-11 min-w-11 shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-bold"
        onClick={() => retryCapabilities(session)}
      >
        Reintentar
      </button>
    </div>
  )
}
