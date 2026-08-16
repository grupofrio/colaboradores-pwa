// ─── AdminGastosForm — formulario de gastos del Auxiliar Administrativo V2 ──
// Backend: `gf_pwa_admin` (Sebastián, rollout 2026-04-10).
// Modo LIVE:
//   · analytic_distribution (dict Odoo 18) — Opción A
//   · warehouse_id + sucursal_code estructurados; empleado derivado del token
//   · Filtros server-side por company_id/warehouse_id en today-expenses
//   · Validación cross-company en el backend; acá sólo seleccionamos cuentas
//     que ya vienen filtradas por company_id de la razón social activa.
import { useEffect, useMemo, useRef, useState } from 'react'
import { TOKENS } from '../../../tokens'
import { useAdmin } from '../AdminContext'
import {
  getTodayExpenses,
  filterByCompany,
  BACKEND_CAPS,
} from '../adminService'
import { createFuelExpense, getFuelRoutes } from '../api'
import { api, todayLocal } from '../../../lib/api'
import AnalyticAccountPicker from '../components/AnalyticAccountPicker'
import {
  createFase0Expense,
  getExpenseCatalog,
  uploadExpenseEvidence,
} from '../expenseAccounting'

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024 // 8 MB

/** Convierte un File a { filename, mime, base64 } sin el prefijo data:. */
function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      const base64 = comma >= 0 ? result.slice(comma + 1) : result
      resolve({ filename: file.name, mime: file.type || 'application/octet-stream', base64 })
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export default function AdminGastosForm() {
  const { companyId, companyLabel, sucursal, warehouseId } = useAdmin()

  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Campos del formulario
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [quantity, setQuantity] = useState('1')
  // Combustible conserva su contrato actual; gasto general ya no usa controles contables del cliente.
  const [paymentMode, setPaymentMode] = useState('company')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [expenseMode, setExpenseMode] = useState('general')
  const [fuelRoutes, setFuelRoutes] = useState([])
  const [fuelRoutesLoading, setFuelRoutesLoading] = useState(false)
  const [fuelRouteId, setFuelRouteId] = useState('')
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [articleId, setArticleId] = useState('')
  const [operation, setOperation] = useState('')
  const [assetKind, setAssetKind] = useState('')
  const [analyticDistribution, setAnalyticDistribution] = useState(null)

  // Adjunto (Sprint 4 — expense-attach)
  const [attachment, setAttachment] = useState(null) // File
  const [attachPreview, setAttachPreview] = useState('') // dataURL
  const [attachError, setAttachError] = useState('')
  const fileInputRef = useRef(null)

  function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachError('')
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError('El archivo supera 8 MB')
      e.target.value = ''
      return
    }
    setAttachment(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setAttachPreview(String(reader.result || ''))
      reader.readAsDataURL(file)
    } else {
      setAttachPreview('')
    }
  }
  function clearAttachment() {
    setAttachment(null)
    setAttachPreview('')
    setAttachError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const filtered = useMemo(
    () => filterByCompany(expenses, companyId),
    [expenses, companyId],
  )
  const selectedArticle = catalog.find((item) => item.product_id === Number(articleId))

  // Reload expenses al cambiar razón social o warehouse (filtro server-side)
  useEffect(() => {
    loadExpenses()
    setAnalyticDistribution(null)
    setArticleId('')
    setOperation('')
    setAssetKind('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, warehouseId])

  useEffect(() => {
    let alive = true
    setCatalog([])
    setArticleId('')
    setOperation('')
    setAssetKind('')
    if (!companyId || !warehouseId || !date) {
      setCatalogError('Selecciona una razón social y almacén válidos para cargar artículos.')
      return () => { alive = false }
    }
    setCatalogLoading(true)
    setCatalogError('')
    getExpenseCatalog({ companyId, warehouseId, date })
      .then((articles) => {
        if (alive) setCatalog(articles)
      })
      .catch((catalogLoadError) => {
        if (alive) {
          setCatalog([])
          setCatalogError(catalogLoadError?.message || 'No se pudo cargar el catálogo de gastos.')
        }
      })
      .finally(() => {
        if (alive) setCatalogLoading(false)
      })
    return () => { alive = false }
  }, [companyId, warehouseId, date])

  useEffect(() => {
    if (expenseMode !== 'fuel') return
    let alive = true
    setFuelRoutesLoading(true)
    setFuelRouteId('')
    getFuelRoutes(date)
      .then(result => {
        if (!alive) return
        const data = result?.data ?? result ?? {}
        setFuelRoutes(Array.isArray(data.routes) ? data.routes : [])
      })
      .catch(() => {
        if (alive) setFuelRoutes([])
      })
      .finally(() => {
        if (alive) setFuelRoutesLoading(false)
      })
    return () => { alive = false }
  }, [expenseMode, date])

  async function loadExpenses() {
    setLoading(true)
    try {
      const data = await getTodayExpenses({ companyId, warehouseId })
      const list = data?.data ?? data
      setExpenses(Array.isArray(list) ? list : [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Ingresa una descripción'); return }
    if (!amount || Number(amount) <= 0) { setError('Ingresa un monto válido'); return }
    if (expenseMode === 'general' && !companyId) { setError('Selecciona una razón social'); return }
    if (expenseMode === 'fuel' && !fuelRouteId) { setError('Selecciona la ruta de gasolina'); return }
    if (expenseMode === 'general' && catalogLoading) {
      setError('Espera a que cargue el catálogo de gastos.')
      return
    }
    if (expenseMode === 'general' && catalogError) {
      setError(catalogError)
      return
    }
    if (expenseMode === 'general' && !selectedArticle) {
      setError('Selecciona un artículo de gasto habilitado.')
      return
    }
    if (expenseMode === 'fuel' && BACKEND_CAPS.expenseAnalytics && !analyticDistribution) {
      setError('Selecciona la cuenta analítica del gasto')
      return
    }

    const amountNum = Number(amount)
    const threshold = Number(BACKEND_CAPS.expenseApprovalThreshold ?? 1000)
    const requiresAttach =
      expenseMode === 'general'
        ? Boolean(selectedArticle.requires_evidence) || amountNum > threshold
        : BACKEND_CAPS.expenseRequiresAttachment && amountNum > threshold
    if (requiresAttach && !attachment) {
      setError('Este gasto requiere adjuntar comprobante.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      let uploadedAttachmentId = null
      let uploadedFuelEvidenceToken = null
      if (attachment && BACKEND_CAPS.evidenceUpload) {
        const payload = await fileToPayload(attachment)
        if (expenseMode === 'general') {
          uploadedAttachmentId = await uploadExpenseEvidence(payload)
        } else {
          const uploadRes = await api('POST', '/pwa-admin/fuel-evidence-upload', {
            filename: payload.filename,
            file_base64: payload.base64,
            mime_type: payload.mime,
          })
          const uploaded = uploadRes?.data ?? uploadRes ?? {}
          uploadedFuelEvidenceToken = uploaded.evidence_token || null
        }
      }

      if (requiresAttach && !(expenseMode === 'fuel' ? uploadedFuelEvidenceToken : uploadedAttachmentId)) {
        throw new Error('No se pudo cargar el comprobante requerido.')
      }

      if (expenseMode === 'fuel') {
        await createFuelExpense({
          name: name.trim(),
          total_amount: Number(amount),
          quantity: 1.0,
          date,
          payment_mode: paymentMode === 'company' ? 'company_account' : 'own_account',
          reference: reference.trim() || undefined,
          description: description.trim() || undefined,
          company_id: companyId,
          warehouse_id: warehouseId || undefined,
          sucursal_code: sucursal || undefined,
          analytic_distribution: analyticDistribution,
          attachment_id: uploadedAttachmentId || undefined,
          evidence_token: uploadedFuelEvidenceToken || undefined,
          route_plan_id: Number(fuelRouteId),
        })
      } else {
        await createFase0Expense({
          article: selectedArticle,
          name,
          amount: amountNum,
          quantity: Number(quantity),
          date,
          operation,
          assetKind,
          attachmentId: uploadedAttachmentId || undefined,
          reference,
          description,
        })
      }

      setSuccess(`Gasto registrado en ${companyLabel}${attachment ? ' (con comprobante)' : ''}`)
      setName('')
      setAmount('')
      setQuantity('1')
      setReference('')
      setDescription('')
      setPaymentMode('company')
      setAnalyticDistribution(null)
      setArticleId('')
      setOperation('')
      setAssetKind('')
      if (expenseMode === 'fuel') {
        setExpenseMode('general')
        setFuelRouteId('')
      }
      clearAttachment()
      await loadExpenses()
      setTimeout(() => setSuccess(''), 3500)
    } catch (e) {
      setError(e?.message || 'Error al registrar gasto')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    borderRadius: TOKENS.radius.md,
    background: TOKENS.colors.surface,
    border: `1px solid ${TOKENS.colors.border}`,
    color: TOKENS.colors.text, fontSize: 14, outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          color: TOKENS.colors.textLow, margin: 0,
        }}>
          GASTOS · {companyLabel.toUpperCase()}
        </p>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          color: TOKENS.colors.text, margin: '4px 0 0',
        }}>
          Registrar gasto
        </h1>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: TOKENS.radius.sm, marginBottom: 12,
          background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}40`,
          fontSize: 12, fontWeight: 600, color: TOKENS.colors.error,
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '10px 14px', borderRadius: TOKENS.radius.sm, marginBottom: 12,
          background: TOKENS.colors.successSoft, border: `1px solid ${TOKENS.colors.success}40`,
          fontSize: 12, fontWeight: 600, color: TOKENS.colors.success,
        }}>
          {success}
        </div>
      )}

      {/* Grid: formulario + lista lado a lado en desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 20,
      }}>
        {/* Formulario */}
        <div style={{
          padding: 22, borderRadius: TOKENS.radius.xl,
          background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            color: TOKENS.colors.textLow, marginTop: 0, marginBottom: 16,
          }}>
            NUEVO GASTO
          </p>

          {/* Banner informativo de razón social */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.blueGlow,
            border: `1px solid ${TOKENS.colors.borderBlue}`,
            marginBottom: 16,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: TOKENS.colors.blue3,
            }} />
            <span style={{ fontSize: 12, color: TOKENS.colors.textSoft }}>
              El gasto se registrará en <strong style={{ color: TOKENS.colors.text }}>{companyLabel}</strong>
              {sucursal && <> · {sucursal}</>}
            </span>
          </div>

          <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
            Descripción *
          </label>
          <input
            type="text" placeholder="Ej: Compra de papelería"
            value={name} onChange={e => setName(e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Monto *
              </label>
              <input
                type="number" placeholder="0.00" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Fecha
              </label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
          </div>

          <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 6 }}>
            Tipo de gasto
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setExpenseMode('general')}
              style={{
                flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md,
                background: expenseMode === 'general' ? `${TOKENS.colors.blue2}22` : TOKENS.colors.surface,
                border: `1px solid ${expenseMode === 'general' ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
                color: expenseMode === 'general' ? TOKENS.colors.blue3 : TOKENS.colors.textMuted,
                fontSize: 12, fontWeight: 600,
              }}
            >General</button>
            <button
              type="button"
              onClick={() => setExpenseMode('fuel')}
              style={{
                flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md,
                background: expenseMode === 'fuel' ? `${TOKENS.colors.warning}22` : TOKENS.colors.surface,
                border: `1px solid ${expenseMode === 'fuel' ? TOKENS.colors.warning : TOKENS.colors.border}`,
                color: expenseMode === 'fuel' ? TOKENS.colors.warning : TOKENS.colors.textMuted,
                fontSize: 12, fontWeight: 600,
              }}
            >Gasolina</button>
          </div>

          {expenseMode === 'fuel' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Ruta de la sucursal *
              </label>
              <select
                value={fuelRouteId}
                onChange={e => setFuelRouteId(e.target.value)}
                disabled={fuelRoutesLoading}
                style={inputStyle}
              >
                <option value="">{fuelRoutesLoading ? 'Cargando rutas…' : 'Selecciona una ruta'}</option>
                {fuelRoutes.map(route => (
                  <option key={route.id} value={route.id}>
                    {route.name} · {route.vehicle || 'Sin vehículo'} · {route.state}
                  </option>
                ))}
              </select>
              {!fuelRoutesLoading && fuelRoutes.length === 0 && (
                <p style={{ fontSize: 11, color: TOKENS.colors.textMuted, margin: '6px 0 0' }}>
                  No hay rutas elegibles con vehículo y operador para esta fecha.
                </p>
              )}
            </div>
          )}

          {expenseMode === 'general' && (
            <>
              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Artículo de gasto *
              </label>
              <select
                value={articleId}
                onChange={e => {
                  setArticleId(e.target.value)
                  setOperation('')
                  setAssetKind('')
                }}
                disabled={catalogLoading || !companyId || !warehouseId}
                style={{ ...inputStyle, marginBottom: 12 }}
              >
                <option value="">
                  {catalogLoading ? 'Cargando artículos…' : 'Selecciona un artículo'}
                </option>
                {catalog.map(article => (
                  <option key={article.product_id} value={article.product_id}>
                    {article.name}
                  </option>
                ))}
              </select>
              {catalogError && (
                <p style={{ fontSize: 11, color: TOKENS.colors.error, margin: '-6px 0 12px' }}>
                  {catalogError}
                </p>
              )}

              {selectedArticle && (
                <>
                  <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                    Cantidad *
                  </label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={quantity} onChange={e => setQuantity(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 12 }}
                  />

                  {selectedArticle.allowed_operations?.length > 0 && (
                    <>
                      <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                        Operación *
                      </label>
                      <select value={operation} onChange={e => setOperation(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
                        <option value="">Selecciona una operación</option>
                        {selectedArticle.allowed_operations.map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </>
                  )}

                  {(selectedArticle.requires_asset || selectedArticle.allowed_asset_kinds?.length > 0) && (
                    <>
                      <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                        Tipo de activo {selectedArticle.requires_asset ? '*' : ''}
                      </label>
                      <select value={assetKind} onChange={e => setAssetKind(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
                        <option value="">Selecciona un tipo</option>
                        {(selectedArticle.allowed_asset_kinds || []).map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {expenseMode === 'fuel' && (
            <>
              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 6 }}>
                Modo de pago
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button type="button" onClick={() => setPaymentMode('company')} style={{ flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md, background: paymentMode === 'company' ? `${TOKENS.colors.blue2}22` : TOKENS.colors.surface, border: `1px solid ${paymentMode === 'company' ? TOKENS.colors.blue2 : TOKENS.colors.border}`, fontSize: 12, fontWeight: 600, color: paymentMode === 'company' ? TOKENS.colors.blue3 : TOKENS.colors.textMuted }}>
                  Pagado por empresa
                </button>
                <button type="button" onClick={() => setPaymentMode('employee')} style={{ flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md, background: paymentMode === 'employee' ? `${TOKENS.colors.warning}22` : TOKENS.colors.surface, border: `1px solid ${paymentMode === 'employee' ? TOKENS.colors.warning : TOKENS.colors.border}`, fontSize: 12, fontWeight: 600, color: paymentMode === 'employee' ? TOKENS.colors.warning : TOKENS.colors.textMuted }}>
                  Pagado por empleado
                </button>
              </div>
              <div style={{ padding: 14, borderRadius: TOKENS.radius.md, background: TOKENS.colors.surfaceSoft, border: `1px solid ${TOKENS.colors.border}`, marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: TOKENS.colors.textLow, margin: '0 0 10px' }}>
                  CLASIFICACIÓN ANALÍTICA · {companyLabel.toUpperCase()}
                </p>
                <AnalyticAccountPicker value={analyticDistribution} onChange={setAnalyticDistribution} companyId={companyId} required={BACKEND_CAPS.expenseAnalytics} />
              </div>
            </>
          )}

          {(expenseMode === 'general' || BACKEND_CAPS.expenseAttachments) && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 6 }}>
                Comprobante (opcional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={onPickFile}
                style={{ display: 'none' }}
              />
              {!attachment ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: TOKENS.radius.md,
                    background: `${TOKENS.colors.blue2}12`, border: `1px dashed ${TOKENS.colors.blue2}60`,
                    color: TOKENS.colors.blue3, fontSize: 12, fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Adjuntar foto / PDF
                </button>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, borderRadius: TOKENS.radius.md,
                  background: TOKENS.colors.surfaceSoft, border: `1px solid ${TOKENS.colors.border}`,
                }}>
                  {attachPreview ? (
                    <img
                      src={attachPreview}
                      alt="preview"
                      style={{
                        width: 48, height: 48, objectFit: 'cover',
                        borderRadius: TOKENS.radius.sm,
                        border: `1px solid ${TOKENS.colors.border}`,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: TOKENS.radius.sm,
                      background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: TOKENS.colors.textMuted, fontSize: 10, fontWeight: 700,
                    }}>
                      {attachment.name.split('.').pop()?.toUpperCase() || 'DOC'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 600, color: TOKENS.colors.text, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {attachment.name}
                    </p>
                    <p style={{ fontSize: 10, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>
                      {(attachment.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    style={{
                      width: 30, height: 30, borderRadius: TOKENS.radius.sm,
                      background: 'transparent', border: `1px solid ${TOKENS.colors.border}`,
                      color: TOKENS.colors.error, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )}
              {attachError && (
                <p style={{ fontSize: 11, color: TOKENS.colors.error, margin: '6px 0 0' }}>
                  {attachError}
                </p>
              )}
            </div>
          )}

          <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
            Folio / referencia (opcional)
          </label>
          <input
            type="text" placeholder="Ej: FACT-001"
            value={reference} onChange={e => setReference(e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
            Notas (opcional)
          </label>
          <textarea
            placeholder="Detalles adicionales…"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '14px 0', borderRadius: TOKENS.radius.md,
              background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
              opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
              color: 'white', fontSize: 14, fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {submitting ? 'Registrando…' : 'Registrar gasto'}
          </button>
        </div>

        {/* Lista del día */}
        <div>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            color: TOKENS.colors.textLow, margin: '0 0 12px',
          }}>
            GASTOS DE HOY · {companyLabel.toUpperCase()}
          </p>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
              <div style={{
                width: 24, height: 24, border: '2px solid rgba(255,255,255,0.12)',
                borderTop: '2px solid #2B8FE0', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '24px 20px', borderRadius: TOKENS.radius.lg, textAlign: 'center',
              background: TOKENS.glass.panelSoft, border: `1px dashed ${TOKENS.colors.border}`,
            }}>
              <p style={{ fontSize: 13, color: TOKENS.colors.textMuted, margin: 0 }}>
                Sin gastos registrados hoy en esta razón social
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((exp, i) => (
                <div key={exp.id || i} style={{
                  padding: '12px 14px', borderRadius: TOKENS.radius.md,
                  background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: TOKENS.colors.text,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {exp.name || exp.description || 'Gasto'}
                    </p>
                    <p style={{
                      fontSize: 11, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2,
                    }}>
                      {exp.create_date ? new Date(exp.create_date.replace(' ', 'T') + 'Z').toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }) : exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: TOKENS.colors.warning }}>
                    {fmt(exp.total_amount || exp.amount)}
                  </span>
                  {exp.state && (
                    <div style={{
                      padding: '3px 8px', borderRadius: TOKENS.radius.pill,
                      background: exp.state === 'posted' ? TOKENS.colors.successSoft : TOKENS.colors.warningSoft,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: exp.state === 'posted' ? TOKENS.colors.success : TOKENS.colors.warning,
                      }}>
                        {exp.state === 'posted' ? 'Confirmado' : exp.state === 'draft' ? 'Borrador' : exp.state}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}
