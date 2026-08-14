import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COMPANY_LABELS, TOKENS } from '../../tokens.js'
import { getBuyerRequisitions, getBuyerScope } from './api.js'

function money(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0))
}

function label(value, fallback = 'No disponible') {
  return String(value || '').trim() || fallback
}

export default function ScreenComprasCSC() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scopeCount, setScopeCount] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [scopeResult, result] = await Promise.all([getBuyerScope(), getBuyerRequisitions()])
      const scopeData = scopeResult?.data || scopeResult || {}
      setScopeCount(Array.isArray(scopeData.scopes) ? scopeData.scopes.length : 0)
      const data = result?.data || result || {}
      setItems(Array.isArray(data.requisitions) ? data.requisitions : [])
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar las requisiciones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <main style={{ minHeight: '100dvh', background: TOKENS.colors.bg0, color: TOKENS.colors.text, padding: '20px 16px 36px' }}>
      <div style={{ width: 'min(100%, 860px)', margin: '0 auto' }}>
        <header style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ color: TOKENS.colors.blue3, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', margin: 0 }}>CSC GF</p>
            <h1 style={{ fontSize: 23, margin: '4px 0', letterSpacing: '-0.03em' }}>Compras</h1>
            <p style={{ color: TOKENS.colors.textMuted, fontSize: 12, margin: 0 }}>Requisiciones pendientes de las plazas autorizadas{scopeCount !== null ? ` · ${scopeCount} alcance${scopeCount === 1 ? '' : 's'}` : ''}</p>
          </div>
          <button type="button" onClick={load} disabled={loading} style={{ border: `1px solid ${TOKENS.colors.borderBlue}`, borderRadius: 9, color: TOKENS.colors.blue3, background: TOKENS.colors.blueGlow, padding: '9px 12px', cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'Cargando…' : 'Actualizar'}</button>
        </header>
        {error && <p role="alert" style={{ padding: 12, color: TOKENS.colors.error, background: TOKENS.colors.errorSoft, borderRadius: 10 }}>{error}</p>}
        {!loading && !error && items.length === 0 && <p style={{ color: TOKENS.colors.textMuted, padding: 20, textAlign: 'center' }}>No hay requisiciones pendientes en tus alcances.</p>}
        <section style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => {
            const id = item.purchase_order_id || item.id
            const company = item.company_name || COMPANY_LABELS[item.company_id] || `Empresa ${item.company_id}`
            return <button key={id} type="button" onClick={() => navigate(`/compras-csc/requisicion/${id}`)} style={{ textAlign: 'left', padding: 16, cursor: 'pointer', background: TOKENS.glass.panel, color: TOKENS.colors.text, border: `1px solid ${TOKENS.colors.border}`, borderRadius: TOKENS.radius.md }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{item.name || `PO ${id}`}</strong><strong style={{ color: TOKENS.colors.blue3 }}>{money(item.amount_total)}</strong></div>
              <p style={{ margin: '7px 0 0', color: TOKENS.colors.textSoft, fontSize: 13 }}>{company} · {label(item.gf_plaza_analytic_account_name, 'Plaza no disponible')}</p>
              <p style={{ margin: '4px 0 0', color: TOKENS.colors.textMuted, fontSize: 12 }}>Almacén: {label(item.authority_warehouse_name, 'Protegido por servidor')} · Solicitante: {label(item.requested_by_employee_name, 'Protegido por servidor')}</p>
              <span style={{ display: 'inline-block', marginTop: 10, color: TOKENS.colors.warning, fontSize: 11, fontWeight: 700, background: TOKENS.colors.warningSoft, padding: '3px 7px', borderRadius: TOKENS.radius.pill }}>{item.operational_label || item.approval_state || 'Pendiente'}</span>
            </button>
          })}
        </section>
      </div>
    </main>
  )
}
