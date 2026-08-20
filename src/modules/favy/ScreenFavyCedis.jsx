import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS, getTypo } from '../../tokens'
import { 
  createBagRequisition,
  getBagRequisitions,
  createFavyCupProduction,
  getFavyAttendanceToday,
  checkInFavyAttendance,
  getFavyVanRoster,
  getFavyVanCatalog,
  executeFavyVanLoad,
  isDoctorVan,
  getFavyEntregasDestination,
} from './api'
import RequisitionReceiptModal from '../admin/components/RequisitionReceiptModal'
import { 
  readFileAsDataURL,
  validateChecklistPhotoFile,
} from '../shared/checklistPhoto'
import { validateAttendancePreflight, validateCupQuantity } from './favyGuards'

const REQUISITION_QUICK_PRODUCTS = ['Bolsas de hielo', 'Vasos', 'Tapas', 'Folio para sellar']
const REQUISITION_STATE_LABEL = {
  draft: 'Borrador',
  sent: 'Enviado',
  confirmed: 'Confirmado',
  done: 'Recibido',
  cancel: 'Cancelado',
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es-MX', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeProductId(productId) {
  if (productId === undefined || productId === null || productId === '') return ''
  const n = Number(productId)
  return Number.isFinite(n) ? String(n) : String(productId)
}

function normalizeLines(lines = []) {
  if (!Array.isArray(lines)) return []
  return lines.map((line, idx) => ({
    ...line,
    id: line.id || `line-${idx}`,
    product_id: normalizeProductId(line.product_id || line.id || ''),
    qty: String(line.qty || ''),
  }))
}

const FAVY_CUP_COMPONENTS = [
  '1 vaso KOLD CUP 24 OZ',
  '1 tapa KOLD CUP',
  '200 g de hielo rolito',
  '1 etiqueta bisagra',
  'Termosellado',
]

export default function ScreenFavyCedis() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])

  useEffect(() => {
    const onResize = () => setSw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Requisiciones ───────────────────────────────────────────────────────
  const [requisitionProduct, setRequisitionProduct] = useState('Bolsas de hielo')
  const [requisitionQty, setRequisitionQty] = useState('20')
  const [requisitionNotes, setRequisitionNotes] = useState('')
  const [requisitions, setRequisitions] = useState([])
  const [requisitionLoading, setRequisitionLoading] = useState(false)
  const [requisitionSubmitting, setRequisitionSubmitting] = useState(false)
  const [requisitionError, setRequisitionError] = useState('')
  const [requisitionSuccess, setRequisitionSuccess] = useState('')
  const [receivingReqId, setReceivingReqId] = useState(null)

  // ── Producción: vasos ────────────────────────────────────────────────
  const [packingQty, setPackingQty] = useState('')
  const [packingSubmitting, setPackingSubmitting] = useState(false)
  const [packingError, setPackingError] = useState('')
  const [packingSuccess, setPackingSuccess] = useState('')

  // ── Carga a camionetas ────────────────────────────────────────────────
  const [destination, setDestination] = useState(null)
  const [vans, setVans] = useState([])
  const [selectedVanId, setSelectedVanId] = useState(null)
  const [vanCatalog, setVanCatalog] = useState({}) // { [employee_id]: items[] }
  const [vanLines, setVanLines] = useState({}) // { [employee_id]: [{product_id, qty}] }
  const [vanLoading, setVanLoading] = useState(false)
  const [vanExecId, setVanExecId] = useState(null)
  const [vanError, setVanError] = useState('')
  const [vanSuccess, setVanSuccess] = useState('')

  // ── Checklist asistencia diaria ────────────────────────────────────────
  const [attendanceSelfie, setAttendanceSelfie] = useState('')
  const [attendanceFacade, setAttendanceFacade] = useState('')
  const [attendanceBusy, setAttendanceBusy] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceSuccess, setAttendanceSuccess] = useState('')
  const [todayAttendance, setTodayAttendance] = useState(null)
  const attendanceSelfieRef = useRef(null)
  const attendanceFacadeRef = useRef(null)

  const warehouseId = Number(session?.warehouse_id || 0) || null

  useEffect(() => {
    loadRequisitions()
    loadVans()
    loadAttendance()
  }, [session?.company_id, session?.employee_id])

  const doctorsOnlyVans = useMemo(() => {
    const filtered = vans.filter(isDoctorVan)
    if (filtered.length === 0) return vans
    return filtered
  }, [vans])

  function loadRequisitions() {
    setRequisitionLoading(true)
    setRequisitionError('')
    return getBagRequisitions({
      companyId: session?.company_id,
      limit: 30,
      sort: 'date_desc',
    })
      .then((rows) => {
        const normalized = Array.isArray(rows) ? rows : []
        setRequisitions(normalized)
      })
      .catch((e) => {
        setRequisitionError(e?.message || 'No se pudieron cargar las requisiciones')
      })
      .finally(() => setRequisitionLoading(false))
  }

  async function handleCreateRequisition() {
    const product = requisitionProduct.trim()
    const qty = toNumber(requisitionQty)

    if (!product) {
      setRequisitionError('Escribe el producto')
      return
    }
    if (!qty || qty <= 0) {
      setRequisitionError('La cantidad debe ser mayor a 0')
      return
    }

    setRequisitionSubmitting(true)
    setRequisitionError('')
    setRequisitionSuccess('')

    try {
      await createBagRequisition({
        name: `FAVY CDMX: ${product}`,
        description: requisitionNotes.trim() || `Requisición diaria de ${product}`,
        company_id: session?.company_id || null,
        sucursal: session?.sucursal || '',
        capturista: session?.name || '',
        lines: [{ product_name: product, qty }],
      })
      setRequisitionSuccess('Requisición creada')
      setRequisitionQty('20')
      setRequisitionNotes('')
      setTimeout(() => setRequisitionSuccess(''), 2500)
      await loadRequisitions()
    } catch (e) {
      setRequisitionError(e?.message || 'No se pudo crear la requisición')
    } finally {
      setRequisitionSubmitting(false)
    }
  }

  async function handleRecordGlasses() {
    const validation = validateCupQuantity(packingQty)
    if (!validation.ok) {
      setPackingError(validation.message)
      return
    }

    setPackingSubmitting(true)
    setPackingError('')
    setPackingSuccess('')

    try {
      const result = await createFavyCupProduction(validation.qty)
      const data = result?.data || result || {}
      setPackingQty('')
      setPackingSuccess(`Producción confirmada en Odoo${data?.name ? `: ${data.name}` : ''}`)
      setTimeout(() => setPackingSuccess(''), 2200)
    } catch (e) {
      setPackingError(e?.message || 'No se pudo guardar el registro')
    } finally {
      setPackingSubmitting(false)
    }
  }

  async function loadVans() {
    setVanLoading(true)
    setVanError('')
    try {
      const [vanRows, dest] = await Promise.all([
        warehouseId ? getFavyVanRoster(warehouseId).catch(() => []) : Promise.resolve([]),
        getFavyEntregasDestination().catch(() => null),
      ])
      setVans(Array.isArray(vanRows) ? vanRows : [])
      setDestination(dest || null)
      if (!selectedVanId) {
        const rows = Array.isArray(vanRows) && vanRows.length ? vanRows : []
        const doctorsRows = rows.filter(isDoctorVan)
        const fallback = (doctorsRows.length ? doctorsRows : rows)[0] || null
        if (fallback?.employee_id) setSelectedVanId(fallback.employee_id)
      }
      if (Array.isArray(vanRows) && vanRows.length) {
        const first = vanRows[0]
        if (first?.employee_id && !vanLines[first.employee_id]) {
          setVanLines((prev) => ({ ...prev, [first.employee_id]: [{ product_id: '', qty: '' }] }))
        }
      }
    } catch (e) {
      setVanError(e?.message || 'No se pudo cargar inventario/camionetas')
    } finally {
      setVanLoading(false)
    }
  }

  async function loadVanCatalog(van) {
    if (!van?.employee_id) return
    if (Array.isArray(vanCatalog[van.employee_id])) return

    try {
      const locationId = Number(van.cedis_location_id || 0)
      if (!locationId) {
        setVanCatalog((prev) => ({ ...prev, [van.employee_id]: [] }))
        return
      }
      const items = await getFavyVanCatalog(locationId)
      setVanCatalog((prev) => ({ ...prev, [van.employee_id]: normalizeLines(items) }))
    } catch {
      setVanCatalog((prev) => ({ ...prev, [van.employee_id]: [] }))
    }
  }

  function ensureVanLines(van) {
    const lines = vanLines[van.employee_id]
    if (!Array.isArray(lines) || lines.length === 0) {
      setVanLines((prev) => ({ ...prev, [van.employee_id]: [{ product_id: '', qty: '' }] }))
    }
  }

  function updateVanLine(vanId, index, field, value) {
    setVanLines((prev) => {
      const current = Array.isArray(prev[vanId]) && prev[vanId].length
        ? [...prev[vanId]]
        : [{ product_id: '', qty: '' }]
      current[index] = { ...(current[index] || { product_id: '', qty: '' }), [field]: value }
      return { ...prev, [vanId]: current }
    })
  }

  function addVanLine(vanId) {
    setVanLines((prev) => {
      const current = Array.isArray(prev[vanId]) ? prev[vanId] : [{ product_id: '', qty: '' }]
      return { ...prev, [vanId]: [...current, { product_id: '', qty: '' }] }
    })
  }

  function removeVanLine(vanId, index) {
    setVanLines((prev) => {
      const current = Array.isArray(prev[vanId]) ? [...prev[vanId]] : [{ product_id: '', qty: '' }]
      const next = current.filter((_, i) => i !== index)
      return { ...prev, [vanId]: next.length ? next : [{ product_id: '', qty: '' }] }
    })
  }

  async function handleExecuteVanLoad(van) {
    const vanId = van.employee_id
    const lines = normalizeLines(vanLines[vanId]).filter((l) => toNumber(l.product_id) > 0 && toNumber(l.qty) > 0)
    if (!Array.isArray(lines) || lines.length === 0) {
      setVanError('Agrega al menos un producto con cantidad')
      return
    }

    const mobileLocationId = toNumber(van.mobile_location_id)
    if (!mobileLocationId) {
      setVanError('Esta camioneta no tiene ubicación destino configurada')
      return
    }

    setVanError('')
    setVanSuccess('')
    setVanExecId(vanId)

    try {
      const payload = lines.map((l) => ({
        product_id: toNumber(l.product_id),
        qty: toNumber(l.qty),
      }))
      const res = await executeFavyVanLoad(mobileLocationId, payload, van.employee_id)
      if (res?.ok) {
        const pick = res.data?.picking_name || ''
        setVanSuccess(`Carga enviada para ${van.employee_name || 'camioneta'}${pick ? ` (${pick})` : ''}`)
        setVanLines((prev) => ({ ...prev, [vanId]: [{ product_id: '', qty: '' }] }))
        setVanCatalog((prev) => ({ ...prev }))
        setTimeout(() => setVanSuccess(''), 2800)
      } else {
        setVanError(res?.error || res?.message || 'No se pudo ejecutar la carga')
      }
    } catch (e) {
      setVanError(e?.message || 'No se pudo ejecutar la carga')
    } finally {
      setVanExecId(null)
    }
  }

  async function loadAttendance() {
    try {
      const result = await getFavyAttendanceToday()
      const data = result?.data || result || {}
      setTodayAttendance(data?.attendance || null)
    } catch (e) {
      setAttendanceError(e?.message || 'No se pudo consultar la asistencia de hoy')
    }
  }

  async function handleAttendancePhotoCapture(kind, e) {
    const file = e.target.files?.[0]
    if (!file) return

    const fileErr = validateChecklistPhotoFile(file)
    if (fileErr) {
      setAttendanceError(fileErr)
      e.target.value = ''
      return
    }

    try {
      const dataUrl = await readFileAsDataURL(file)
      if (kind === 'selfie') setAttendanceSelfie(dataUrl)
      else setAttendanceFacade(dataUrl)
      setAttendanceError('')
    } catch {
      setAttendanceError('No se pudo leer la foto')
    } finally {
      e.target.value = ''
    }
  }

  function getAttendancePosition() {
    if (!window.navigator?.geolocation) {
      return Promise.reject(new Error('Este dispositivo no permite obtener la ubicacion.'))
    }
    return new Promise((resolve, reject) => {
      window.navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      })
    })
  }

  async function saveAttendance() {
    setAttendanceBusy(true)
    setAttendanceError('')
    setAttendanceSuccess('')

    try {
      const position = await getAttendancePosition()
      const validation = validateAttendancePreflight({
        selfie: attendanceSelfie,
        facade: attendanceFacade,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      })
      if (!validation.ok) {
        setAttendanceError(validation.message)
        return
      }

      const result = await checkInFavyAttendance({
        selfie: attendanceSelfie,
        facade: attendanceFacade,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      })
      const data = result?.data || result || {}
      setTodayAttendance(data?.attendance || data)
      setAttendanceSuccess('Asistencia registrada y validada en Odoo')
      setTimeout(() => setAttendanceSuccess(''), 2200)
    } catch (e) {
      setAttendanceError(e?.message || 'No se pudo registrar la asistencia')
    } finally {
      setAttendanceBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
        input, textarea, select { font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              width: 38,
              height: 38,
              borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.surface,
              border: `1px solid ${TOKENS.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <span style={{ ...typo.title, color: TOKENS.colors.textSoft }}>FAVY CEDIS</span>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>Producción y Almacén CDMX</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>

          {/* ── Requisición bolsa de hielo ───────────────────────────── */}
          <section style={{ borderRadius: TOKENS.radius.xl, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`, padding: 16 }}>
            <h2 style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0, marginBottom: 6 }}>Requisición de bolsas de hielo</h2>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 0, marginBottom: 12 }}>Registra compra para vasos, tapas y folio para sellar desde almacén.</p>

            {requisitionError && (
              <p style={{ ...typo.caption, color: TOKENS.colors.error, marginBottom: 10 }}>{requisitionError}</p>
            )}
            {requisitionSuccess && (
              <p style={{ ...typo.caption, color: TOKENS.colors.success, marginBottom: 10 }}>{requisitionSuccess}</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {REQUISITION_QUICK_PRODUCTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRequisitionProduct(item)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: TOKENS.radius.pill,
                    background: requisitionProduct === item ? `${TOKENS.colors.blue2}24` : TOKENS.colors.surface,
                    border: `1px solid ${requisitionProduct === item ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
                    color: requisitionProduct === item ? TOKENS.colors.blue3 : TOKENS.colors.textMuted,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>Producto</label>
            <input
              type="text"
              value={requisitionProduct}
              onChange={(e) => setRequisitionProduct(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.surface,
                border: `1px solid ${TOKENS.colors.border}`,
                color: TOKENS.colors.text,
                marginBottom: 10,
              }}
            />

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={requisitionQty}
                  onChange={(e) => setRequisitionQty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: TOKENS.radius.md,
                    background: TOKENS.colors.surface,
                    border: `1px solid ${TOKENS.colors.border}`,
                    color: TOKENS.colors.text,
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>

            <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>Notas</label>
            <textarea
              value={requisitionNotes}
              onChange={(e) => setRequisitionNotes(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.surface,
                border: `1px solid ${TOKENS.colors.border}`,
                color: TOKENS.colors.text,
                resize: 'vertical',
                marginBottom: 12,
              }}
            />

            <button
              type="button"
              onClick={handleCreateRequisition}
              disabled={requisitionSubmitting}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: TOKENS.radius.md,
                background: requisitionSubmitting ? TOKENS.colors.surface : `linear-gradient(90deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                color: requisitionSubmitting ? TOKENS.colors.textMuted : 'white',
                fontWeight: 700,
              }}
            >
              {requisitionSubmitting ? 'Guardando...' : 'Crear requisición'}
            </button>

            <div style={{ marginTop: 16 }}>
              <p style={{ ...typo.overline, color: TOKENS.colors.textLow, marginBottom: 8 }}>Requisiciones recientes</p>
              {requisitionLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                  <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.12)', borderTop: '2px solid #2B8FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {requisitions.length === 0 ? (
                    <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>Sin requisiciones recientes.</p>
                  ) : (
                    requisitions.slice(0, 6).map((row, idx) => {
                      const st = REQUISITION_STATE_LABEL[row.state] || row.state || 'Sin estado'
                      return (
                        <div key={row.id || idx} style={{
                          border: `1px solid ${TOKENS.colors.border}`,
                          borderRadius: TOKENS.radius.md,
                          padding: '10px 12px',
                          background: TOKENS.colors.surface,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ ...typo.body, color: TOKENS.colors.text, margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.name || `Req #${row.id || idx + 1}`}
                            </p>
                            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>
                              {formatDateTime(row.date)} · {toNumber(row.qty || row.lines_qty) || row.lines?.length || ''}
                            </p>
                          </div>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: TOKENS.radius.pill,
                            background: row.state === 'done' ? TOKENS.colors.successSoft : TOKENS.colors.surfaceSoft,
                            color: row.state === 'done' ? TOKENS.colors.success : TOKENS.colors.textMuted,
                            fontSize: 11,
                            fontWeight: 700,
                            minWidth: 90,
                            textAlign: 'center',
                          }}>
                            {st}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReceivingReqId(Number(row.id))}
                            style={{
                              padding: '7px 10px',
                              borderRadius: TOKENS.radius.md,
                              background: TOKENS.colors.blue2,
                              color: 'white',
                              fontWeight: 600,
                              fontSize: 11,
                            }}
                          >
                            Recibir
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Checklist de asistencia diaria ───────────────────────── */}
          <section style={{ borderRadius: TOKENS.radius.xl, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`, padding: 16 }}>
            <h2 style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0, marginBottom: 6 }}>Checklist de inicio · Asistencia diaria</h2>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 0, marginBottom: 12 }}>
              Foto personal, fachada del CEDIS y GPS a 50 m o menos. La precision debe ser de 25 m o menor.
            </p>

            {attendanceError && <p style={{ ...typo.caption, color: TOKENS.colors.error }}>{attendanceError}</p>}
            {attendanceSuccess && <p style={{ ...typo.caption, color: TOKENS.colors.success }}>{attendanceSuccess}</p>}

            <input
              ref={attendanceSelfieRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={(e) => handleAttendancePhotoCapture('selfie', e)}
              style={{ display: 'none' }}
            />

            <input
              ref={attendanceFacadeRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleAttendancePhotoCapture('facade', e)}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => attendanceSelfieRef.current?.click()}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: TOKENS.radius.md,
                border: `1px dashed ${TOKENS.colors.blue2}`,
                background: `${TOKENS.colors.blue2}12`,
                color: TOKENS.colors.blue3,
                marginBottom: 10,
              }}
            >
              {attendanceSelfie ? 'Cambiar foto de Faviola' : 'Tomar foto de Faviola'}
            </button>

            {attendanceSelfie && (
              <div style={{ borderRadius: TOKENS.radius.md, overflow: 'hidden', border: `1px solid ${TOKENS.colors.border}`, marginBottom: 10 }}>
                <img src={attendanceSelfie} alt="Foto de Faviola" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
              </div>
            )}

            <button
              type="button"
              onClick={() => attendanceFacadeRef.current?.click()}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: TOKENS.radius.md,
                border: `1px dashed ${TOKENS.colors.blue2}`,
                background: `${TOKENS.colors.blue2}12`,
                color: TOKENS.colors.blue3,
                marginBottom: 10,
              }}
            >
              {attendanceFacade ? 'Cambiar foto de fachada' : 'Tomar foto de fachada del CEDIS'}
            </button>

            {attendanceFacade && (
              <div style={{ borderRadius: TOKENS.radius.md, overflow: 'hidden', border: `1px solid ${TOKENS.colors.border}`, marginBottom: 10 }}>
                <img src={attendanceFacade} alt="Fachada del CEDIS" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
              </div>
            )}

            <button
              type="button"
              onClick={saveAttendance}
              disabled={attendanceBusy}
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: TOKENS.radius.md,
                background: attendanceBusy ? TOKENS.colors.surface : `linear-gradient(90deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                color: attendanceBusy ? TOKENS.colors.textMuted : 'white',
                fontWeight: 700,
              }}
            >
              {attendanceBusy ? 'Validando ubicacion...' : 'Iniciar labores'}
            </button>

            {todayAttendance && (
              <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 10 }}>
                Hoy: {todayAttendance.employee_name || session?.name} · {todayAttendance.checkin_at ? formatDateTime(todayAttendance.checkin_at) : ''}
              </p>
            )}
          </section>

          {/* ── Producción: registro vasos ───────────────────────────── */}
          <section style={{ borderRadius: TOKENS.radius.xl, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`, padding: 16 }}>
            <h2 style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0, marginBottom: 6 }}>Registro de vasos producidos</h2>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 0, marginBottom: 12 }}>KOLD CUP 24OZ · fabricación de congelado · Odoo descuenta la materia prima oficial.</p>

            {packingError && <p style={{ ...typo.caption, color: TOKENS.colors.error, marginBottom: 10 }}>{packingError}</p>}
            {packingSuccess && <p style={{ ...typo.caption, color: TOKENS.colors.success, marginBottom: 10 }}>{packingSuccess}</p>}

            <div style={{ border: `1px solid ${TOKENS.colors.border}`, borderRadius: TOKENS.radius.md, background: TOKENS.colors.surface, padding: '10px 12px', marginBottom: 10 }}>
              <p style={{ ...typo.overline, color: TOKENS.colors.textLow, margin: '0 0 6px' }}>Materia prima por vaso</p>
              {FAVY_CUP_COMPONENTS.map((component) => (
                <p key={component} style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '3px 0' }}>{component}</p>
              ))}
            </div>

            <input
              type="number"
              min="1"
              step="1"
              value={packingQty}
              onChange={(e) => setPackingQty(e.target.value)}
              placeholder="Cantidad de vasos terminados"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: TOKENS.radius.md,
                background: TOKENS.colors.surface,
                border: `1px solid ${TOKENS.colors.border}`,
                color: TOKENS.colors.text,
                textAlign: 'center',
                marginBottom: 8,
              }}
            />

            <button
              type="button"
              onClick={handleRecordGlasses}
              disabled={packingSubmitting}
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: TOKENS.radius.md,
                background: packingSubmitting ? TOKENS.colors.surface : `linear-gradient(90deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                color: packingSubmitting ? TOKENS.colors.textMuted : 'white',
                fontWeight: 700,
              }}
            >
              {packingSubmitting ? 'Registrando en Odoo...' : 'Registrar producción de vasos'}
            </button>
          </section>

          {/* ── Carga a camionetas ───────────────────────────────────── */}
          <section style={{ borderRadius: TOKENS.radius.xl, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`, padding: 16 }}>
            <h2 style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0, marginBottom: 6 }}>Carga a camionetas (CEDIS CDMX · Doctores)</h2>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 0 }}>
              Carga manual de productos para la flotilla de entregas.
              {destination?.name ? ` Destino: ${destination.name}.` : ''}
            </p>

            {vanError && <p style={{ ...typo.caption, color: TOKENS.colors.error }}>{vanError}</p>}
            {vanSuccess && <p style={{ ...typo.caption, color: TOKENS.colors.success }}>{vanSuccess}</p>}

            {vanLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.12)', borderTop: '2px solid #2B8FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : doctorsOnlyVans.length === 0 ? (
              <p style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>No hay camionetas disponibles.</p>
            ) : (
              <>
                <label style={{ ...typo.caption, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>Camioneta</label>
                <select
                  value={selectedVanId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    setSelectedVanId(id)
                    const van = doctorsOnlyVans.find((item) => item.employee_id === id)
                    if (van) {
                      ensureVanLines(van)
                      loadVanCatalog(van)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: TOKENS.radius.md,
                    background: TOKENS.colors.surface,
                    border: `1px solid ${TOKENS.colors.border}`,
                    color: TOKENS.colors.text,
                    marginBottom: 10,
                  }}
                >
                  {doctorsOnlyVans.map((van) => (
                    <option key={van.employee_id} value={van.employee_id}>
                      {van.employee_name || `Camioneta ${van.employee_id}`}
                    </option>
                  ))}
                </select>

                {selectedVanId && (
                  <div>
                    {doctorsOnlyVans.filter((v) => v.employee_id === selectedVanId).map((van) => {
                      const cat = vanCatalog[van.employee_id] || []
                      const lines = normalizeLines(vanLines[van.employee_id] || [{ product_id: '', qty: '' }])

                      return (
                        <div key={van.employee_id} style={{
                          border: `1px solid ${TOKENS.colors.border}`,
                          background: TOKENS.colors.surface,
                          borderRadius: TOKENS.radius.md,
                          padding: 10,
                        }}>
                          <div style={{ marginBottom: 8, fontSize: 12, color: TOKENS.colors.textMuted }}>
                            {van.employee_name || `Camioneta ${van.employee_id}`} · {van.mobile_location_name || 'sin ubicación'}
                          </div>

                          {cat.length === 0 && (
                            <button
                              type="button"
                              onClick={() => loadVanCatalog(van)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: TOKENS.radius.md,
                                background: `${TOKENS.colors.blue2}12`,
                                color: TOKENS.colors.blue3,
                                marginBottom: 10,
                              }}
                            >
                              Cargar productos del CEDIS
                            </button>
                          )}

                          {lines.map((line, idx) => (
                            <div key={`${line.id}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                              <select
                                value={line.product_id}
                                onChange={(e) => updateVanLine(van.employee_id, idx, 'product_id', e.target.value)}
                                style={{
                                  padding: '10px',
                                  borderRadius: TOKENS.radius.md,
                                  border: `1px solid ${TOKENS.colors.border}`,
                                  background: TOKENS.colors.bg0,
                                  color: TOKENS.colors.text,
                                }}
                              >
                                <option value="">Producto</option>
                    {(cat || []).map((it, productIndex) => (
                      <option
                        key={it.product_id || it.id || `product-${productIndex}`}
                        value={normalizeProductId(it.product_id || it.id)}
                      >
                                    {it.product_name || it.name || `Producto ${it.product_id || it.id || ''}`}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="0"
                                value={line.qty}
                                onChange={(e) => updateVanLine(van.employee_id, idx, 'qty', e.target.value)}
                                placeholder="Qty"
                                style={{
                                  padding: '10px',
                                  borderRadius: TOKENS.radius.md,
                                  border: `1px solid ${TOKENS.colors.border}`,
                                  background: TOKENS.colors.bg0,
                                  color: TOKENS.colors.text,
                                  textAlign: 'center',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => removeVanLine(van.employee_id, idx)}
                                style={{
                                  minWidth: 36,
                                  borderRadius: TOKENS.radius.md,
                                  background: TOKENS.colors.error,
                                  color: 'white',
                                }}
                              >
                                x
                              </button>
                            </div>
                          ))}

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => addVanLine(van.employee_id)}
                              style={{
                                flex: 1,
                                borderRadius: TOKENS.radius.md,
                                background: `${TOKENS.colors.blue2}12`,
                                border: `1px dashed ${TOKENS.colors.blue2}`,
                                color: TOKENS.colors.blue3,
                                padding: '8px 10px',
                              }}
                            >
                              + agregar línea
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExecuteVanLoad(van)}
                              disabled={vanExecId === van.employee_id}
                              style={{
                                flex: 2,
                                borderRadius: TOKENS.radius.md,
                                background: vanExecId === van.employee_id ? TOKENS.colors.surface : TOKENS.colors.blue3,
                                color: vanExecId === van.employee_id ? TOKENS.colors.textMuted : 'white',
                                fontWeight: 700,
                                padding: '8px 10px',
                              }}
                            >
                              {vanExecId === van.employee_id ? 'Enviando...' : 'Enviar carga'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {receivingReqId && (
        <RequisitionReceiptModal
          requisitionId={receivingReqId}
          onClose={() => setReceivingReqId(null)}
          onSaved={() => {
            setReceivingReqId(null)
            loadRequisitions()
          }}
        />
      )}
    </div>
  )
}
