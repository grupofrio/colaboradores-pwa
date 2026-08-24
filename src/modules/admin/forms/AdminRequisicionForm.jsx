// ─── AdminRequisicionForm — crear requisición V2 + Historial ─────────────────
// Backend: `gf_pwa_admin.requisition-*` (live desde 2026-04-10).
// Payload create:
//   { company_id, name, lines: [{product_id, quantity}],
//     analytic_distribution, warehouse_id, notes }
//
// Tabs:
//   Nueva — formulario de creación
//   Historial — lista paginada con filtros (estado, fecha) + recepción.
//   Aprobación inline eliminada (MGR-RES-010): no CTAs write muertos.
import { useEffect, useState, useCallback, useMemo } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'
import { useSession } from '../../../App'
import { useAdmin } from '../AdminContext'
import {
  createRequisition,
  BACKEND_CAPS,
  filterByCompany,
  bootOperatingScope,
  groupOperatingScopesByPlaza,
} from '../adminService'
import {
  getRequisitions,
} from '../api'
import {
  normalizeOperationalState,
  shouldShowReceiptAction,
  resolveReceiptActionLabel,
} from '../requisitionReceiptState'
import AnalyticAccountPicker from '../components/AnalyticAccountPicker'
import ProductPicker from '../components/ProductPicker'
import OperatingScopePicker from '../components/OperatingScopePicker'
import RequisitionDetailModal from '../components/RequisitionDetailModal'

const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : ''

const STATUS_MAP = {
  draft:      { label: 'Borrador',    tone: 'muted' },
  sent:       { label: 'Enviado',     tone: 'blue' },
  to_approve: { label: 'Por aprobar', tone: 'warning' },
  purchase:   { label: 'Confirmado',  tone: 'blue' },
  done:       { label: 'Completado',  tone: 'success' },
  cancel:     { label: 'Cancelado',   tone: 'error' },
}

function toneColor(tone) {
  switch (tone) {
    case 'success': return TOKENS.colors.success
    case 'error':   return TOKENS.colors.error
    case 'warning': return TOKENS.colors.warning ?? '#F59E0B'
    case 'blue':    return TOKENS.colors.blue3
    default:        return TOKENS.colors.textMuted
  }
}

function emptyLine() {
  return { product: null, qty: 1, notes: '' }
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, tone }) {
  const c = toneColor(tone)
  return (
    <div style={{
      padding: '3px 8px', borderRadius: TOKENS.radius.pill,
      background: `${c}18`, border: `1px solid ${c}35`,
      display: 'inline-flex', alignItems: 'center',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{label}</span>
    </div>
  )
}

// ── Historial ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

function HistorialTab({ companyId }) {
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(false)
  const [filterState, setFilterState] = useState('')
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo, setFilterTo]       = useState('')

  const [detailId, setDetailId]   = useState(null)

  const load = useCallback(async (pg = 0) => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await getRequisitions({
        companyId,
        operationalState: filterState || undefined,
        dateFrom: filterFrom || undefined,
        dateTo: filterTo || undefined,
        limit: PAGE_SIZE,
        offset: pg * PAGE_SIZE,
      })
      const data = res?.data ?? res
      const list = Array.isArray(data?.requisitions)
        ? data.requisitions
        : Array.isArray(data)
          ? data
          : []
      setRows(list)
      setTotal(data?.total_count ?? list.length)
      setPage(pg)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [companyId, filterState, filterFrom, filterTo])

  useEffect(() => { load(0) }, [load])


  const inputStyle = {
    padding: '8px 12px', borderRadius: TOKENS.radius.md,
    background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
    color: TOKENS.colors.text, fontSize: 12, outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          style={{ ...inputStyle }}
        >
          <option value="">Todos los estados</option>
          <option value="approval_pending">Aprobación pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="received">Recibido</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <input
          type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          style={{ ...inputStyle }}
          placeholder="Desde"
        />
        <input
          type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          style={{ ...inputStyle }}
          placeholder="Hasta"
        />
        <button
          onClick={() => { setFilterState(''); setFilterFrom(''); setFilterTo(''); }}
          style={{
            ...inputStyle, cursor: 'pointer',
            color: TOKENS.colors.textMuted, border: `1px solid ${TOKENS.colors.border}`,
          }}
        >
          Limpiar
        </button>
      </div>



      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div style={{
            width: 22, height: 22, border: '2px solid rgba(15,42,61,0.12)',
            borderTop: '2px solid #2B8FE0', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          padding: '28px 20px', borderRadius: TOKENS.radius.lg, textAlign: 'center',
          background: TOKENS.glass.panelSoft, border: `1px dashed ${TOKENS.colors.border}`,
        }}>
          <p style={{ fontSize: 13, color: TOKENS.colors.textMuted, margin: 0 }}>
            Sin requisiciones con los filtros aplicados
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((req, i) => {
            const operational = normalizeOperationalState(req)
            const isPending = operational.key === 'approval_pending'
            // Recibido SÍ es clickable — abre el detalle en modo solo-lectura
            // (el modal oculta acciones cuando receipt_state='received').
            const clickable = !isPending && req.purchase_order_id != null && BACKEND_CAPS.requisitionDetail
            const showReceive = BACKEND_CAPS.requisitionReceipt && shouldShowReceiptAction({
              ...req,
              can_receive: req.can_receive_ui ?? req.can_receive,
            }) && !isPending

            return (
              <div
                key={req.purchase_order_id || req.id || i}
                style={{
                  padding: '12px 14px', borderRadius: TOKENS.radius.md,
                  background: TOKENS.glass.panel, border: `1px solid ${
                    isPending ? `${toneColor('warning')}50` : TOKENS.colors.border
                  }`,
                }}
              >
                {/* Fila principal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={() => clickable && setDetailId(req.purchase_order_id ?? req.id)}
                    onKeyDown={e => {
                      if (!clickable) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetailId(req.purchase_order_id ?? req.id)
                      }
                    }}
                    style={{ flex: 1, minWidth: 0, cursor: clickable ? 'pointer' : 'default' }}
                  >
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: TOKENS.colors.text,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {req.name || `Requisición #${req.purchase_order_id ?? req.id}`}
                    </p>
                    <p style={{ fontSize: 11, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2 }}>
                      {fmtDate(req.date_order || req.date)}
                      {req.line_count != null && ` · ${req.line_count} líneas`}
                      {req.approved_by && operational.key === 'confirmed' && ` · Confirmó: ${req.approved_by}`}
                    </p>
                  </div>

                  {req.amount_total != null && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: TOKENS.colors.blue3, flexShrink: 0 }}>
                      {fmt(req.amount_total)}
                    </span>
                  )}
                  <Badge label={req.operational_label || operational.label} tone={operational.tone} />
                </div>

                {/* Acción de recepción — solo cuando hay picking pendiente */}
                {showReceive && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => setDetailId(req.purchase_order_id ?? req.id)}
                      style={{
                        width: '100%', padding: '8px 0', borderRadius: TOKENS.radius.md,
                        background: `linear-gradient(135deg, ${TOKENS.colors.blue3}, #1a70cc)`,
                        fontSize: 12, fontWeight: 700, color: 'white', border: 'none',
                        fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                      }}
                    >
                      {resolveReceiptActionLabel({
                        ...req,
                        can_receive: req.can_receive_ui ?? req.can_receive,
                      })}
                    </button>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            style={{
              padding: '6px 14px', borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
              color: TOKENS.colors.textSoft, fontSize: 12, fontWeight: 600,
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              opacity: page === 0 ? 0.4 : 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 12, color: TOKENS.colors.textMuted }}>
            Pág. {page + 1} / {totalPages} · {total} registros
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= totalPages - 1 || loading}
            style={{
              padding: '6px 14px', borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
              color: TOKENS.colors.textSoft, fontSize: 12, fontWeight: 600,
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages - 1 ? 0.4 : 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {detailId && (
        <RequisitionDetailModal
          requisitionId={detailId}
          onClose={() => setDetailId(null)}
          onCancelled={() => load(page)}
          onReceived={() => load(page)}
        />
      )}
    </div>
  )
}

// ── Form de creación ──────────────────────────────────────────────────────────
export default function AdminRequisicionForm() {
  const { companyId, companyLabel, warehouseId, sucursal } = useAdmin()
  const { session } = useSession()

  // Alcance de operación (Plaza × Empresa) para actores multi-compañía v2 —
  // se resuelve aquí, no en AdminContext, para no disparar esta llamada en
  // otras pantallas admin (POS, gastos) que también usan AdminProvider.
  const [operatingScope, setOperatingScope] = useState({ enabled: false, scopes: [], defaultPlazaId: null })
  const [operatingPlazaId, setOperatingPlazaId] = useState(null)
  const [operatingCompanyId, setOperatingCompanyId] = useState(null)
  const operatingScopeGroups = useMemo(
    () => groupOperatingScopesByPlaza(operatingScope.scopes),
    [operatingScope.scopes],
  )
  const setOperatingScopeSelection = useCallback(({ plazaId, companyId: opCompanyId }) => {
    setOperatingPlazaId(plazaId)
    setOperatingCompanyId(opCompanyId)
  }, [])

  useEffect(() => {
    let alive = true
    bootOperatingScope(session).then(scope => { if (alive) setOperatingScope(scope) })
    return () => { alive = false }
  }, [session])

  // Para actores multi-compañía v2, la compañía real de la operación es la
  // elegida en OperatingScopePicker, no la del selector de razón social viejo
  // (ese company_id se descarta antes de llegar a Odoo — ver src/lib/api.js).
  const resolvedCompanyId = operatingScope.enabled ? operatingCompanyId : companyId
  const resolvedCompanyLabel = operatingScope.enabled
    ? (operatingScopeGroups
        .find(g => g.plazaId === operatingPlazaId)?.companies
        .find(c => c.companyId === operatingCompanyId)?.companyName || 'la Plaza y empresa seleccionadas')
    : companyLabel

  const [activeTab, setActiveTab] = useState('nueva') // 'nueva' | 'historial'
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [analyticDistribution, setAnalyticDistribution] = useState(null)

  // Resultado de creación (para mostrar alerta de aprobación)
  const [createdResult, setCreatedResult] = useState(null)

  function addLine() {
    setLines(prev => [...prev, emptyLine()])
  }
  function updateLine(i, patch) {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeLine(i) {
    if (lines.length <= 1) return
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }

  function validate() {
    if (!title.trim()) return 'Ingresa un título para la requisición'
    if (operatingScope.enabled) {
      if (!operatingPlazaId || !operatingCompanyId) return 'Selecciona la Plaza y empresa operativa'
    } else if (!companyId) {
      return 'Selecciona una razón social'
    }
    const validLines = lines.filter(l => l.product && Number(l.qty) > 0)
    if (validLines.length === 0) return 'Agrega al menos un producto con cantidad'
    if (BACKEND_CAPS.requisitionAnalytics && !analyticDistribution) {
      return 'Selecciona la cuenta analítica'
    }
    return null
  }

  async function handleSubmit() {
    const errMsg = validate()
    if (errMsg) { setError(errMsg); return }

    setSubmitting(true)
    setError('')
    setSuccess('')
    setCreatedResult(null)
    try {
      const validLines = lines
        .filter(l => l.product && Number(l.qty) > 0)
        .map(l => ({
          product_id: l.product.id,
          quantity: Number(l.qty),
          notes: l.notes?.trim() || undefined,
        }))

      const res = await createRequisition({
        name: title.trim(),
        company_id: companyId,
        warehouse_id: warehouseId || undefined,
        sucursal_code: sucursal || undefined,
        notes: notes.trim() || undefined,
        lines: validLines,
        analytic_distribution: analyticDistribution,
        ...(operatingScope.enabled
          ? { operating_plaza_id: operatingPlazaId, operating_company_id: operatingCompanyId }
          : {}),
      })

      const data = res?.data ?? res
      setCreatedResult(data)
      setSuccess(`Requisición creada en ${resolvedCompanyLabel}`)
      setTitle('')
      setNotes('')
      setLines([emptyLine()])
      setAnalyticDistribution(null)
      setTimeout(() => { setSuccess(''); setCreatedResult(null) }, 5000)
    } catch (e) {
      setError(e?.message || 'Error al crear requisición')
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

  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: TOKENS.radius.md,
    background: active ? `${TOKENS.colors.blue2}1f` : 'transparent',
    border: `1px solid ${active ? TOKENS.colors.blue2 : 'transparent'}`,
    color: active ? TOKENS.colors.text : TOKENS.colors.textMuted,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.15s ease',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          color: TOKENS.colors.textLow, margin: 0,
        }}>
          REQUISICIONES · {companyLabel.toUpperCase()}
        </p>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          color: TOKENS.colors.text, margin: '4px 0 0',
        }}>
          Requisiciones
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button style={tabStyle(activeTab === 'nueva')} onClick={() => setActiveTab('nueva')}>
          + Nueva
        </button>
        <button style={tabStyle(activeTab === 'historial')} onClick={() => setActiveTab('historial')}>
          Historial
        </button>
      </div>

      {/* ── Tab: Nueva ─────────────────────────────────────────────────── */}
      {activeTab === 'nueva' && (
        <>
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
              {createdResult?.needs_approval && (
                <span style={{ marginLeft: 8, color: TOKENS.colors.warning ?? '#F59E0B' }}>
                  ⚠ Requiere aprobación (monto {'>'} {fmt(createdResult.approval_threshold)})
                </span>
              )}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
            gap: 20,
          }}>
            {/* Form */}
            <div style={{
              padding: 22, borderRadius: TOKENS.radius.xl,
              background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
            }}>
              <p style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                color: TOKENS.colors.textLow, marginTop: 0, marginBottom: 16,
              }}>
                NUEVA REQUISICIÓN
              </p>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.blueGlow,
                border: `1px solid ${TOKENS.colors.borderBlue}`,
                marginBottom: 16,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TOKENS.colors.blue3 }} />
                <span style={{ fontSize: 12, color: TOKENS.colors.textSoft }}>
                  Se creará como <strong style={{ color: TOKENS.colors.text }}>borrador</strong> en {resolvedCompanyLabel}
                  {sucursal && <> · {sucursal}</>}
                  {BACKEND_CAPS.requisitionApproval && (
                    <> · montos &gt; {fmt(BACKEND_CAPS.requisitionApprovalThreshold)} requieren aprobación</>
                  )}
                </span>
              </div>

              {operatingScope.enabled && (
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
                    PLAZA Y EMPRESA OPERATIVA
                  </p>
                  <OperatingScopePicker
                    groups={operatingScopeGroups}
                    plazaId={operatingPlazaId}
                    companyId={operatingCompanyId}
                    onChange={setOperatingScopeSelection}
                    required
                  />
                </div>
              )}

              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Título *
              </label>
              <input
                type="text" placeholder="Ej: Material de limpieza semanal"
                value={title} onChange={e => setTitle(e.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 6 }}>
                Productos *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {lines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <ProductPicker
                      value={line.product}
                      onChange={(p) => updateLine(i, { product: p })}
                      warehouseId={warehouseId}
                      companyId={resolvedCompanyId}
                      scope="requisition"
                      placeholder={`Producto ${i + 1}`}
                    />
                    <input
                      type="number" min="0.01" step="0.01"
                      value={line.qty}
                      onChange={e => updateLine(i, { qty: e.target.value })}
                      style={{ ...inputStyle, width: 90, textAlign: 'center', padding: '9px 8px' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={lines.length <= 1}
                      style={{
                        width: 38, height: 38, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: TOKENS.radius.md,
                        background: 'transparent',
                        border: `1px solid ${TOKENS.colors.border}`,
                        color: lines.length <= 1 ? TOKENS.colors.textLow : TOKENS.colors.error,
                        cursor: lines.length <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button" onClick={addLine}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: TOKENS.radius.md,
                  background: `${TOKENS.colors.blue2}12`, border: `1px dashed ${TOKENS.colors.blue2}40`,
                  marginBottom: 14, fontSize: 12, fontWeight: 600,
                  color: TOKENS.colors.blue3, fontFamily: "'DM Sans', sans-serif",
                }}
              >
                + Agregar producto
              </button>

              {/* Analítica */}
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
                  CLASIFICACIÓN ANALÍTICA · {resolvedCompanyLabel.toUpperCase?.() || resolvedCompanyLabel}
                </p>
                <AnalyticAccountPicker
                  value={analyticDistribution}
                  onChange={setAnalyticDistribution}
                  companyId={resolvedCompanyId}
                  required={BACKEND_CAPS.requisitionAnalytics}
                  label="Cuenta analítica (aplica a todas las líneas)"
                />
              </div>

              <label style={{ fontSize: 12, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Notas (opcional)
              </label>
              <textarea
                placeholder="Urgencia, justificación, proveedor sugerido…"
                rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
              />

              <button
                type="button" onClick={handleSubmit} disabled={submitting}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: TOKENS.radius.md,
                  background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                  opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                  color: 'white', fontSize: 14, fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {submitting ? 'Creando…' : 'Crear requisición'}
              </button>
            </div>

            {/* Preview recientes */}
            <RecentList companyId={resolvedCompanyId} />
          </div>
        </>
      )}

      {/* ── Tab: Historial ─────────────────────────────────────────────── */}
      {activeTab === 'historial' && (
        <HistorialTab companyId={resolvedCompanyId} />
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}

// ── Sidebar: últimas 10 requisiciones en tab "Nueva" ─────────────────────────
function RecentList({ companyId }) {
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    getRequisitions({ companyId, limit: 10 })
      .then(res => {
        const data = res?.data ?? res
        const rows = Array.isArray(data?.requisitions)
          ? data.requisitions
          : Array.isArray(data) ? data : []
        setList(rows)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
        color: TOKENS.colors.textLow, margin: '0 0 12px',
      }}>
        RECIENTES · ÚLTIMAS 10
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div style={{
            width: 22, height: 22, border: '2px solid rgba(15,42,61,0.12)',
            borderTop: '2px solid #2B8FE0', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : list.length === 0 ? (
        <div style={{
          padding: '24px 20px', borderRadius: TOKENS.radius.lg, textAlign: 'center',
          background: TOKENS.glass.panelSoft, border: `1px dashed ${TOKENS.colors.border}`,
        }}>
          <p style={{ fontSize: 13, color: TOKENS.colors.textMuted, margin: 0 }}>
            Sin requisiciones en esta razón social
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((req, i) => {
            const operational = normalizeOperationalState(req)
            const clickable = operational.key !== 'approval_pending'
              && (req.purchase_order_id ?? req.id) != null
              && BACKEND_CAPS.requisitionDetail

            return (
              <div
                key={req.purchase_order_id || req.id || i}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => clickable && setDetailId(req.purchase_order_id ?? req.id)}
                onKeyDown={e => {
                  if (!clickable) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setDetailId(req.purchase_order_id ?? req.id)
                  }
                }}
                style={{
                  padding: '12px 14px', borderRadius: TOKENS.radius.md,
                  background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = TOKENS.colors.blue2 }}
                onMouseLeave={e => { if (clickable) e.currentTarget.style.borderColor = TOKENS.colors.border }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13, fontWeight: 600, color: TOKENS.colors.text,
                    margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {req.name || `Requisición #${req.purchase_order_id ?? req.id}`}
                  </p>
                  <p style={{ fontSize: 11, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2 }}>
                    {fmtDate(req.date_order || req.date)}
                    {req.line_count != null && ` · ${req.line_count} líneas`}
                  </p>
                </div>
                {req.amount_total != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: TOKENS.colors.blue3, flexShrink: 0 }}>
                    {fmt(req.amount_total)}
                  </span>
                )}
                <Badge label={req.operational_label || operational.label} tone={operational.tone} />
              </div>
            )
          })}
        </div>
      )}

      {detailId && (
        <RequisitionDetailModal
          requisitionId={detailId}
          onClose={() => setDetailId(null)}
          onCancelled={() => {
            setLoading(true)
            getRequisitions({ companyId: list[0]?.company_id, limit: 10 })
              .then(res => {
                const data = res?.data ?? res
                setList(Array.isArray(data?.requisitions) ? data.requisitions : Array.isArray(data) ? data : [])
              })
              .catch(() => {})
              .finally(() => setLoading(false))
          }}
        />
      )}
    </div>
  )
}
