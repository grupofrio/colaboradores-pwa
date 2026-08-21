import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS as DARK_TOKENS, getTypo, getCompaniesForSucursal } from '../../tokens'
import { getTodayExpenses } from '../admin/api'
import { createExpense as createExpenseOrchestrated, BACKEND_CAPS } from '../admin/adminService'
import { unwrapExpenseListEnvelope } from '../admin/expenseListEnvelope'
import { isGerentePilotReadOnly } from '../admin/gerentePilotCaps'
import { todayLocal } from '../../lib/api'

// `tokens` OPCIONAL con default OSCURO: este componente lo comparten
// /admin/gastos (auxiliar_admin/gerente_sucursal/direccion_general — tema
// claro incondicional del módulo admin_sucursal) y /gerente/gastos (que
// sigue oscuro salvo piloto). Cada caller decide qué tokens pasar.
export default function GastosScreenBase({
  title = 'Gastos',
  backRoute = '/admin',
  listLabel = 'GASTOS DE HOY',
  readOnly: readOnlyProp,
  tokens = DARK_TOKENS,
}) {
  const { session } = useSession()
  const navigate = useNavigate()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const TOKENS = tokens
  const isLightSurface = tokens !== DARK_TOKENS
  // Etiquetas más oscuras SOLO en claro (textMuted ahí se lee pálido); en
  // oscuro se conserva el tono original para no alterar /gerente/gastos.
  const labelColor = isLightSurface ? TOKENS.colors.textSoft : TOKENS.colors.textMuted

  const readOnly = readOnlyProp ?? isGerentePilotReadOnly(session, BACKEND_CAPS)

  const [expenses, setExpenses] = useState([])
  const [listStatus, setListStatus] = useState('loading') // loading | ok | empty | error | unavailable
  const [listMessage, setListMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const companies = useMemo(() => getCompaniesForSucursal(session?.sucursal), [session?.sucursal])

  const [companyId, setCompanyId] = useState(session?.company_id || companies[0]?.id || null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [description, setDescription] = useState('')

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => { loadExpenses() }, [])

  async function loadExpenses() {
    setListStatus('loading')
    setListMessage('')
    try {
      const data = await getTodayExpenses()
      const envelope = unwrapExpenseListEnvelope(data)
      setExpenses(envelope.items)
      setListStatus(envelope.status === 'ok' || envelope.status === 'empty' ? envelope.status : envelope.status)
      if (envelope.status === 'error' || envelope.status === 'unavailable') {
        setListMessage(envelope.message || 'No se pudieron cargar los gastos')
      }
    } catch (e) {
      setExpenses([])
      setListStatus('error')
      setListMessage(e?.message || 'Error al cargar gastos')
    }
  }

  async function handleSubmit() {
    if (readOnly) {
      setError('Solo lectura: el piloto Gerente no puede registrar gastos.')
      return
    }
    if (!name.trim()) { setError('Ingresa una descripcion'); return }
    if (!amount || Number(amount) <= 0) { setError('Ingresa un monto valido'); return }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      // Server derives payment mode; never send it from the client.
      await createExpenseOrchestrated({
        name: name.trim(),
        total_amount: Number(amount),
        date,
        description: description.trim(),
        company_id: companyId,
        sucursal: session?.sucursal || '',
        capturista: session?.name || '',
      })
      setSuccess('Gasto registrado')
      setName('')
      setAmount('')
      setDescription('')
      await loadExpenses()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Error al registrar gasto')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (n) => {
    if (n == null || !Number.isFinite(Number(n))) return '—'
    return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: TOKENS.radius.md,
    background: TOKENS.colors.surface,
    border: `1px solid ${TOKENS.colors.border}`,
    color: TOKENS.colors.text,
    fontSize: typo.body.fontSize,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
        input, textarea { font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button onClick={() => navigate(backRoute)} style={{
            width: 38, height: 38, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TOKENS.colors.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span style={{ ...typo.title, color: TOKENS.colors.textSoft }}>{title}</span>
        </div>

        {readOnly && (
          <div style={{
            padding: '10px 14px', borderRadius: TOKENS.radius.sm, marginBottom: 12,
            background: `${TOKENS.colors.blue}1f`, border: `1px solid ${TOKENS.colors.blue}40`,
          }}>
            <span style={{ ...typo.caption, color: TOKENS.colors.blue3 }}>
              Solo lectura — puedes consultar gastos; el registro está desactivado en el piloto Gerente.
            </span>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: TOKENS.radius.sm, background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}40`, marginBottom: 12 }}>
            <span style={{ ...typo.caption, color: TOKENS.colors.error }}>{error}</span>
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', borderRadius: TOKENS.radius.sm, background: TOKENS.colors.successSoft, border: `1px solid ${TOKENS.colors.success}40`, marginBottom: 12 }}>
            <span style={{ ...typo.caption, color: TOKENS.colors.success }}>{success}</span>
          </div>
        )}

        {!readOnly && (
          <div style={{
            padding: 18, borderRadius: TOKENS.radius.xl,
            background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
            marginBottom: 20,
          }}>
            <p style={{ ...typo.overline, color: labelColor, marginTop: 0, marginBottom: 14 }}>NUEVO GASTO</p>

            <label style={{ ...typo.caption, color: labelColor, display: 'block', marginBottom: 4 }}>Empresa *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {companies.map(co => (
                <button key={co.id} onClick={() => setCompanyId(co.id)} style={{
                  padding: '8px 14px', borderRadius: TOKENS.radius.pill,
                  background: companyId === co.id ? `${TOKENS.colors.blue}22` : TOKENS.colors.surface,
                  border: `1px solid ${companyId === co.id ? TOKENS.colors.blue : TOKENS.colors.border}`,
                  color: companyId === co.id ? TOKENS.colors.blue3 : TOKENS.colors.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {co.name}
                </button>
              ))}
            </div>

            <label style={{ ...typo.caption, color: labelColor, display: 'block', marginBottom: 4 }}>Descripcion *</label>
            <input type="text" placeholder="Ej: Compra de papeleria" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

            <label style={{ ...typo.caption, color: labelColor, display: 'block', marginBottom: 4 }}>Monto *</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

            <label style={{ ...typo.caption, color: labelColor, display: 'block', marginBottom: 4 }}>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 12, colorScheme: isLightSurface ? 'light' : 'dark' }} />

            <label style={{ ...typo.caption, color: labelColor, display: 'block', marginBottom: 4 }}>Notas (opcional)</label>
            <textarea placeholder="Detalles adicionales..." rows={3} value={description} onChange={e => setDescription(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
            />

            <button
              type="button"
              data-testid="expense-create-cta"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: '14px 0', borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.ctaGradient,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              ) : (
                <span style={{ ...typo.body, color: TOKENS.colors.onPrimary, fontWeight: 700 }}>Registrar Gasto</span>
              )}
            </button>
          </div>
        )}

        <p style={{ ...typo.overline, color: labelColor, marginBottom: 10 }}>{listLabel}</p>

        {listStatus === 'loading' ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${TOKENS.colors.border}`, borderTop: `2px solid ${TOKENS.colors.blue}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : listStatus === 'error' || listStatus === 'unavailable' ? (
          <div style={{
            padding: '24px 20px', borderRadius: TOKENS.radius.lg, textAlign: 'center',
            background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}40`,
          }}>
            <p style={{ ...typo.body, color: TOKENS.colors.error, margin: 0 }}>{listMessage || 'Gastos no disponibles'}</p>
          </div>
        ) : expenses.length === 0 ? (
          <div style={{
            padding: '24px 20px', borderRadius: TOKENS.radius.lg, textAlign: 'center',
            background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
          }}>
            <p style={{ ...typo.body, color: TOKENS.colors.textMuted, margin: 0 }}>Sin gastos registrados hoy</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 30 }}>
            {expenses.map((exp, i) => (
              <div key={exp.id || exp.expense_id || i} style={{
                padding: '12px 14px', borderRadius: TOKENS.radius.md,
                background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...typo.caption, color: TOKENS.colors.text, margin: 0, fontWeight: 600 }}>{exp.name || exp.description || 'Gasto'}</p>
                  <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2 }}>
                    {exp.create_date ? new Date(exp.create_date.replace(' ', 'T') + 'Z').toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }) : exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''}
                  </p>
                </div>
                <span style={{ ...typo.title, color: TOKENS.colors.warning }}>{fmt(exp.total_amount ?? exp.amount)}</span>
                {exp.state && (
                  <div style={{
                    padding: '3px 8px', borderRadius: TOKENS.radius.pill,
                    background: exp.state === 'posted' ? TOKENS.colors.successSoft : TOKENS.colors.warningSoft,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: exp.state === 'posted' ? TOKENS.colors.success : TOKENS.colors.warning }}>
                      {exp.state === 'posted' ? 'Confirmado' : exp.state === 'draft' ? 'Borrador' : exp.state}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}
