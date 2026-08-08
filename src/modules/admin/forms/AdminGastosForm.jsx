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
  createExpense,
  getTodayExpenses,
  filterByCompany,
  BACKEND_CAPS,
} from '../adminService'
import { attachExpense, createFuelExpense, getFuelRoutes } from '../api'
import { api, todayLocal } from '../../../lib/api'
import AnalyticAccountPicker from '../components/AnalyticAccountPicker'
import {
  businessToday,
  dimensionChips,
  looksLikeDeposit,
  minCaptureDate,
  validateExpenseDate,
} from '../expenseCapture'

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
  const [paymentMode, setPaymentMode] = useState('company')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [expenseMode, setExpenseMode] = useState('general')
  const [fuelRoutes, setFuelRoutes] = useState([])
  const [fuelRoutesLoading, setFuelRoutesLoading] = useState(false)
  const [fuelRouteId, setFuelRouteId] = useState('')
  // Analítica Odoo 18: dict { account_id: pct } o null.
  // Solo se usa en modo LEGACY: con las dimensiones derivadas activas, la
  // analítica la asienta el servidor y el payload deja de mandarla.
  const [analyticDistribution, setAnalyticDistribution] = useState(null)

  // ── Categoría + dimensiones derivadas ────────────────────────────────────
  const [catalog, setCatalog] = useState(null)   // null = aún no se sabe
  const [catalogError, setCatalogError] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [dimensions, setDimensions] = useState(null)
  const [dimensionsError, setDimensionsError] = useState('')
  const [dimensionsLoading, setDimensionsLoading] = useState(false)

  // Un solo formulario para escritorio y móvil: el layout se adapta, la
  // funcionalidad NO se degrada.
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  )
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isNarrow = viewportWidth < 900

  const derivedMode = Boolean(catalog?.dimensions_enabled)
  const backdateDays = Number(catalog?.backdate_days ?? 7)
  const today = businessToday()
  const dateError = derivedMode ? validateExpenseDate(date, backdateDays, today) : ''
  const depositWarning = looksLikeDeposit(name)
  const chips = dimensionChips(dimensions)

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

  // Reload expenses al cambiar razón social o warehouse (filtro server-side)
  useEffect(() => {
    loadExpenses()
    // Limpiar la cuenta analítica: depende de la company
    setAnalyticDistribution(null)
    setCategoryId(null)
    setDimensions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, warehouseId])

  // Catálogo de categorías. Su respuesta también dice si el modo derivado está
  // encendido: la UI NO adivina el modo, se lo pregunta al backend.
  useEffect(() => {
    let alive = true
    setCatalogError('')
    getExpenseCategories()
      .then((res) => {
        if (!alive) return
        const d = res?.data ?? res ?? {}
        setCatalog({
          categories: Array.isArray(d.categories) ? d.categories : [],
          dimensions_enabled: Boolean(d.dimensions_enabled),
          backdate_days: d.backdate_days ?? 7,
        })
      })
      .catch((e) => {
        if (!alive) return
        // Sin catálogo se cae al modo legacy, que es el comportamiento actual.
        setCatalog({ categories: [], dimensions_enabled: false, backdate_days: 7 })
        setCatalogError(e?.message || '')
      })
    return () => { alive = false }
  }, [companyId])

  // Preview de dimensiones al elegir categoría: los chips muestran lo que el
  // servidor VA a asentar, no lo que el cliente cree.
  useEffect(() => {
    if (!derivedMode || !categoryId) { setDimensions(null); setDimensionsError(''); return }
    let alive = true
    setDimensionsLoading(true)
    setDimensionsError('')
    getExpenseDimensions(categoryId)
      .then((res) => {
        if (!alive) return
        const d = res?.data ?? res ?? {}
        setDimensions(d.dimensions || null)
        if (!d.dimensions) setDimensionsError('El backend no devolvió las dimensiones.')
      })
      .catch((e) => {
        if (!alive) return
        setDimensions(null)
        setDimensionsError(e?.message || 'No se pudieron calcular las dimensiones.')
      })
      .finally(() => { if (alive) setDimensionsLoading(false) })
    return () => { alive = false }
  }, [derivedMode, categoryId])

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
    if (derivedMode && expenseMode === 'general') {
      // Fail-closed espejo del backend: sin categoría no hay dimensiones, y sin
      // dimensiones el gasto no sirve para el P&L por UN ni por CC.
      if (!categoryId) { setError('Selecciona la categoría del gasto'); return }
      if (dateError) { setError(dateError); return }
      if (dimensionsError) { setError(dimensionsError); return }
    } else if (BACKEND_CAPS.expenseAnalytics && !analyticDistribution) {
      setError('Selecciona la cuenta analítica del gasto')
      return
    }

    // Validación de foto obligatoria cuando el monto supera el umbral
    // (guía de pruebas sección 2b — backend rechaza sin attachment).
    const amountNum = Number(amount)
    const threshold = Number(BACKEND_CAPS.expenseApprovalThreshold ?? 1000)
    const requiresAttach =
      BACKEND_CAPS.expenseRequiresAttachment &&
      amountNum > threshold
    if (requiresAttach && !attachment) {
      setError(`Gastos mayores a $${threshold.toLocaleString('es-MX')} requieren adjuntar comprobante.`)
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      // Si hay attachment: subir PRIMERO a /pwa/evidence/upload para tener
      // el attachment_id antes de crear el gasto (guía §2c). Backend rechaza
      // expense-create si monto > threshold y no viene attachment_id.
      let uploadedAttachmentId = null
      let uploadedFuelEvidenceToken = null
      let uploadError = null
      if (attachment && BACKEND_CAPS.evidenceUpload) {
        try {
          const payload = await fileToPayload(attachment)
          const uploadRes = await api('POST', expenseMode === 'fuel'
            ? '/pwa-admin/fuel-evidence-upload'
            : '/pwa/evidence/upload', {
            filename:    payload.filename,
            file_base64: payload.base64,
            mime_type:   payload.mime,
            ...(expenseMode === 'fuel' ? {} : { linked_model: 'hr.expense' }),
          })
          const uploaded = uploadRes?.data ?? uploadRes ?? {}
          uploadedAttachmentId = uploaded.attachment_id || null
          uploadedFuelEvidenceToken = uploaded.evidence_token || null
          if (!uploadedAttachmentId) {
            if (!uploadedFuelEvidenceToken) {
              uploadError = 'No se pudo subir el comprobante (backend no devolvió credencial)'
            }
          }
        } catch (upErr) {
          uploadError = upErr?.message || 'Error subiendo comprobante'
        }
      }

      // Si monto requiere attachment y la subida falló → no crear gasto
      if (requiresAttach && !(expenseMode === 'fuel' ? uploadedFuelEvidenceToken : uploadedAttachmentId)) {
        setError(uploadError || 'Sube el comprobante antes de enviar el gasto.')
        setSubmitting(false)
        return
      }

      const functionalPayload = {
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
        // Attachment pre-subido (guía §2c). Backend lo vincula al expense.
        attachment_id: uploadedAttachmentId || undefined,
        evidence_token: uploadedFuelEvidenceToken || undefined,
      }
      // En modo derivado el payload NO manda analítica ni alcance: el backend
      // los deriva del token y de la categoría, y RECHAZA si vienen.
      const {
        company_id: _c, warehouse_id: _w, sucursal_code: _s,
        analytic_distribution: _a, ...derivedPayload
      } = functionalPayload
      const res = expenseMode === 'fuel'
        ? await createFuelExpense({ ...functionalPayload, route_plan_id: Number(fuelRouteId) })
        : await createExpense(derivedMode
          ? { ...derivedPayload, product_id: categoryId }
          : {
            ...functionalPayload,
            company_id: companyId,
            warehouse_id: warehouseId || undefined,
            sucursal_code: sucursal || undefined,
          })

      // Fallback legacy: si el evidence/upload no funcionó pero expense-attach
      // sí, intentamos adjuntar por separado. Solo para montos bajos donde
      // el attachment es opcional pero el usuario lo subió.
      const created = res?.data ?? res
      const expenseId = created?.id ?? created?.expense_id ?? created?.data?.id
      let attachedMsg = (uploadedAttachmentId || uploadedFuelEvidenceToken) ? ' (con comprobante)' : ''
      if (attachment && expenseMode !== 'fuel' && !uploadedAttachmentId && BACKEND_CAPS.expenseAttachments && expenseId) {
        try {
          const payload = await fileToPayload(attachment)
          await attachExpense({ expenseId, ...payload })
          attachedMsg = ' (con comprobante · legacy)'
        } catch (attachErr) {
          attachedMsg = ` (gasto creado, comprobante falló: ${attachErr.message || 'desconocido'})`
        }
      }

      setSuccess(`Gasto registrado en ${companyLabel}${attachedMsg}`)
      setName('')
      setAmount('')
      setReference('')
      setDescription('')
      setPaymentMode('company')
      setAnalyticDistribution(null)
      setCategoryId(null)
      setDimensions(null)
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

      {/* Grid responsive: dos columnas en escritorio, UNA en móvil.
          Antes la ruta bifurcaba por `window.innerWidth < 1024` y servía un
          formulario degradado en móvil —sin analítica, sin almacén, sin
          adjunto— que es de donde salen los gastos sin clasificar. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
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
            style={{ ...inputStyle, marginBottom: depositWarning ? 6 : 12 }}
          />
          {/* Guard SUAVE. Medido en producción: "DEPOSITO WALMART" por $10,010
              capturado como gasto. No bloquea a propósito — hasta que exista la
              pantalla de Depósitos, bloquear dejaría a la capturista sin ningún
              lugar donde registrarlo. */}
          {depositWarning && (
            <div style={{
              padding: '8px 12px', borderRadius: TOKENS.radius.sm, marginBottom: 12,
              background: TOKENS.colors.warningSoft ?? 'rgba(245,158,11,0.12)',
              border: `1px solid ${TOKENS.colors.warning}40`,
              fontSize: 11, fontWeight: 600, color: TOKENS.colors.warning,
            }}>
              Esto parece un depósito, no un gasto. Si lo es, no lo captures aquí:
              va en Depósitos de caja.
            </div>
          )}

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
                max={derivedMode ? today : undefined}
                min={derivedMode ? minCaptureDate(backdateDays, today) : undefined}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
              {dateError && (
                <p style={{ fontSize: 11, color: TOKENS.colors.error, margin: '4px 0 0' }}>
                  {dateError}
                </p>
              )}
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

          <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 6 }}>
            Modo de pago
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setPaymentMode('company')}
              style={{
                flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md,
                background: paymentMode === 'company' ? `${TOKENS.colors.blue2}22` : TOKENS.colors.surface,
                border: `1px solid ${paymentMode === 'company' ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
                fontSize: 12, fontWeight: 600,
                color: paymentMode === 'company' ? TOKENS.colors.blue3 : TOKENS.colors.textMuted,
              }}
            >
              Pagado por empresa
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('employee')}
              style={{
                flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md,
                background: paymentMode === 'employee' ? `${TOKENS.colors.warning}22` : TOKENS.colors.surface,
                border: `1px solid ${paymentMode === 'employee' ? TOKENS.colors.warning : TOKENS.colors.border}`,
                fontSize: 12, fontWeight: 600,
                color: paymentMode === 'employee' ? TOKENS.colors.warning : TOKENS.colors.textMuted,
              }}
            >
              Pagado por empleado
            </button>
          </div>

          {/* ── Clasificación ──────────────────────────────────────────
              Modo DERIVADO: la capturista elige UNA cosa —la categoría— y el
              servidor asienta Plaza × UN × CC. Los chips muestran lo que el
              servidor VA a escribir; no se pueden editar porque no son una
              opinión del cliente.
              Modo LEGACY (flag apagado): sigue el picker analítico de siempre. */}
          <div style={{
            padding: 14, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surfaceSoft,
            border: `1px solid ${TOKENS.colors.border}`,
            marginBottom: 14,
          }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
              color: TOKENS.colors.textLow, margin: '0 0 10px',
            }}>
              {derivedMode
                ? `CATEGORÍA DEL GASTO · ${companyLabel.toUpperCase()}`
                : `CLASIFICACIÓN ANALÍTICA · ${companyLabel.toUpperCase()}`}
            </p>

            {derivedMode ? (
              <>
                <select
                  value={categoryId || ''}
                  onChange={e => setCategoryId(Number(e.target.value) || null)}
                  style={{ ...inputStyle, marginBottom: 10, colorScheme: 'dark' }}
                >
                  <option value="">Selecciona una categoría…</option>
                  {(catalog?.categories || []).map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.code ? `${cat.code} · ${cat.name}` : cat.name}
                    </option>
                  ))}
                </select>

                {dimensionsLoading && (
                  <p style={{ fontSize: 11, color: TOKENS.colors.textMuted, margin: 0 }}>
                    Calculando dimensiones…
                  </p>
                )}
                {dimensionsError && (
                  <p style={{ fontSize: 11, color: TOKENS.colors.error, margin: 0 }}>
                    {dimensionsError}
                  </p>
                )}
                {chips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {chips.map(chip => (
                      <span
                        key={chip.key}
                        title={`${chip.label} — lo asigna el sistema`}
                        style={{
                          padding: '4px 10px', borderRadius: TOKENS.radius.pill,
                          background: TOKENS.colors.blueGlow,
                          border: `1px solid ${TOKENS.colors.borderBlue}`,
                          fontSize: 11, fontWeight: 600, color: TOKENS.colors.blue3,
                        }}
                      >
                        {chip.value}
                      </span>
                    ))}
                  </div>
                )}
                {chips.length > 0 && (
                  <p style={{ fontSize: 10, color: TOKENS.colors.textLow, margin: '8px 0 0' }}>
                    Plaza · Unidad · Centro de costo — los asigna el sistema a partir de tu
                    sucursal y de la categoría.
                  </p>
                )}
              </>
            ) : (
              <AnalyticAccountPicker
                value={analyticDistribution}
                onChange={setAnalyticDistribution}
                companyId={companyId}
                required={BACKEND_CAPS.expenseAnalytics}
              />
            )}
          </div>

          {BACKEND_CAPS.expenseAttachments && (
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
