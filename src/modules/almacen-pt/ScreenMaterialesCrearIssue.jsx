// ScreenMaterialesCrearIssue.jsx — Bodeguero entrega material al turno
// ───────────────────────────────────────────────────────────────────────────
// POST /api/production/materials/issue/create
//   body: { shift_id, line_id, material_id, qty_issued, issued_by, op_tag_ids?, notes? }
//
// Flujo:
//   1. Turno activo lo obtiene el endpoint getActiveShift
//   2. Selector de línea (GET /api/production/lines?plant_id=X)
//   3. Selector de material (POST /materials/catalog con line_type derivado)
//   4. Cantidad y notas → enviar
//
// Backend transiciona: nada → draft issue + settlement draft.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS, getTypo } from '../../tokens'
import { BRAND_TOKENS as BRAND_TOKENS_LIGHT } from '../../theme/brandTokens'
import { api } from '../../lib/api'
import { getActiveShift } from '../supervision/api'
import { getMaterialCatalog, createMaterialIssue } from './materialsService'
import { fmtNum, DEFAULT_WAREHOUSE_ID } from './ptService'
import { resolveMaterialesBackTo, resolveMaterialesRouteBase, resolveMaterialesSurfaceTheme } from './materialsNavigation'
import { logScreenError } from '../shared/logScreenError'

const TOKENS_LIGHT = BRAND_TOKENS_LIGHT

function lineTypeFromName(name) {
  const raw = String(name || '').toUpperCase()
  if (raw.includes('BARRA')) return 'BARRA'
  if (raw.includes('ROLITO')) return 'ROLITO'
  return ''
}

export default function ScreenMaterialesCrearIssue() {
  const { session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [sw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const plantId = session?.warehouse_id || DEFAULT_WAREHOUSE_ID
  const materialesBasePath = resolveMaterialesRouteBase(location.state, '/almacen-pt/materiales', session?.role)
  const surfaceTheme = resolveMaterialesSurfaceTheme(location.state, session?.role)
  const UI = surfaceTheme === 'light' ? TOKENS_LIGHT : TOKENS
  const backTo = resolveMaterialesBackTo(location.state, materialesBasePath, session?.role)

  const [shift, setShift] = useState(null)
  const [lines, setLines] = useState([])
  const [lineId, setLineId] = useState('')
  const [catalog, setCatalog] = useState([])
  const [loadingBoot, setLoadingBoot] = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  // Ref guard contra double-submit: setSaving() es async (proxima render), por
  // lo que ~3 clicks sincronicos pasan el check canSave antes de que React
  // marque saving=true. El ref bloquea en el tick actual.
  const submittingRef = useRef(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline preexistente: efecto run-once on mount; refactor (useCallback) en PR aparte
  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    setLoadingBoot(true)
    setError('')
    try {
      const s = await getActiveShift(plantId)
      setShift(s)
      if (!s?.id) { setError('Sin turno activo.'); setLoadingBoot(false); return }
      const ls = await api('GET', `/api/production/lines?plant_id=${plantId}`)
      // Backend real: { ok, message, data: { count, lines: [...] } } → api() devuelve ya unwrap del result.
      // Aceptamos varias formas para robustez.
      const items = Array.isArray(ls)
        ? ls
        : Array.isArray(ls?.lines)
          ? ls.lines
          : Array.isArray(ls?.data?.lines)
            ? ls.data.lines
            : Array.isArray(ls?.items)
              ? ls.items
              : []
      setLines(items)
    } catch (e) {
      logScreenError('ScreenMaterialesCrearIssue', 'bootstrap', e)
      setError(e?.message || 'Error inicializando.')
    }
    setLoadingBoot(false)
  }

  const selectedLine = useMemo(
    () => lines.find(l => String(l.id) === String(lineId)) || null,
    [lines, lineId]
  )
  const derivedLineType = useMemo(
    () => lineTypeFromName(selectedLine?.type || selectedLine?.name),
    [selectedLine]
  )

  useEffect(() => {
    if (!lineId) { setCatalog([]); setMaterialId(''); return }
    loadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId])

  async function loadCatalog() {
    setLoadingCatalog(true)
    setError('')
    try {
      // El backend requiere plant_id para devolver el catálogo.
      // Seguimos filtrando en cliente por la familia operativa de la línea.
      const res = await getMaterialCatalog({ plantId, activeOnly: true })
      const all = Array.isArray(res.items) ? res.items : []
      const fam = derivedLineType // 'BARRA' | 'ROLITO' | ''
      const filtered = all.filter(m => {
        if (fam === 'ROLITO') return m.applies_to_rolito === true
        if (fam === 'BARRA')  return m.applies_to_barras === true
        // Sin familia detectable: mostrar todos
        return true
      })
      setCatalog(filtered)
      setMaterialId('')
    } catch (e) {
      logScreenError('ScreenMaterialesCrearIssue', 'loadCatalog', e)
      setError(e?.message || 'Error cargando catálogo.')
    }
    setLoadingCatalog(false)
  }

  const qtyParsed = qty === '' ? null : Number(qty)
  const canSave =
    !!shift?.id && !!lineId && !!materialId && qtyParsed != null && qtyParsed > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    if (submittingRef.current) return // guard contra spam click (setSaving async)
    submittingRef.current = true
    setSaving(true)
    setError('')
    try {
      await createMaterialIssue({
        shiftId: shift.id,
        lineId: Number(lineId),
        materialId: Number(materialId),
        qtyIssued: qtyParsed,
        issuedBy: session?.employee_id || 0,
        notes: notes.trim(),
      })
      setSuccess('Material entregado al turno.')
      setTimeout(() => navigate(backTo, { replace: true }), 900)
    } catch (e) {
      logScreenError('ScreenMaterialesCrearIssue', 'handleSave', e)
      setError(e?.message || 'No se pudo entregar el material.')
      submittingRef.current = false // permitir reintento tras error
    } finally {
      setSaving(false)
    }
  }

  const selectedMaterial = useMemo(
    () => catalog.find(m => String(m.id) === String(materialId)) || null,
    [catalog, materialId]
  )

  return (
    <div style={pageStyle(UI)}>
      <GlobalStyles isLight={surfaceTheme === 'light'} />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button onClick={() => navigate(backTo)} style={iconBtn(UI)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={UI.colors.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <span style={{ ...typo.title, color: UI.colors.textSoft }}>Entregar material</span>
            <p style={{ ...typo.caption, color: UI.colors.textMuted, margin: 0, marginTop: 2 }}>
              {shift?.id ? `Turno #${shift.id}` : 'Sin turno activo'}
            </p>
          </div>
        </div>

        {error && <div style={errorBox(UI)}><p style={{ ...typo.caption, color: UI.colors.error, margin: 0 }}>{error}</p></div>}
        {success && <div style={successBox(UI)}><p style={{ ...typo.body, color: UI.colors.success, margin: 0, fontWeight: 600 }}>{success}</p></div>}

        {loadingBoot ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 32, height: 32, border: `2px solid ${UI.colors.border}`, borderTop: `2px solid ${UI.colors.blue}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : !shift?.id ? null : (
          <>
            {/* Selector de linea */}
            <div>
              <label style={labelStyle(UI, typo)}>Línea</label>
              <select value={lineId} onChange={e => setLineId(e.target.value)} style={inputStyle(UI)}>
                <option value="">Selecciona línea...</option>
                {lines.filter(l => {
                  // Excluir lineas de test/Codex de la UI de producción
                  const nm = String(l.name || '').toLowerCase()
                  return !nm.includes('codex') && !nm.includes('test')
                }).map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.type ? ` · ${l.type}` : ''}
                  </option>
                ))}
              </select>
              {selectedLine && derivedLineType && (
                <p style={{ ...typo.caption, color: UI.colors.textMuted, margin: '6px 0 0' }}>
                  Familia detectada: <b style={{ color: UI.colors.textSoft }}>{derivedLineType}</b>
                </p>
              )}
            </div>

            {/* Selector de material */}
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle(UI, typo)}>Material</label>
              {loadingCatalog ? (
                <div style={{ ...inputStyle(UI), display: 'flex', alignItems: 'center', color: UI.colors.textMuted }}>
                  Cargando catálogo...
                </div>
              ) : (
                <select value={materialId} onChange={e => setMaterialId(e.target.value)}
                  disabled={!lineId || catalog.length === 0}
                  style={{ ...inputStyle(UI), opacity: !lineId || catalog.length === 0 ? 0.6 : 1 }}>
                  <option value="">
                    {!lineId ? 'Elige línea primero...' : catalog.length === 0 ? 'Sin materiales disponibles' : 'Selecciona material...'}
                  </option>
                  {catalog.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.default_code ? ` · ${m.default_code}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedMaterial?.uom && (
                <p style={{ ...typo.caption, color: UI.colors.textMuted, margin: '6px 0 0' }}>
                  Unidad: <b style={{ color: UI.colors.textSoft }}>{selectedMaterial.uom}</b>
                </p>
              )}
            </div>

            {/* Cantidad */}
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle(UI, typo)}>Cantidad entregada</label>
              <input type="number" inputMode="decimal" value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle(UI), textAlign: 'center', fontSize: 22, fontWeight: 700 }}
              />
              {qtyParsed != null && qtyParsed <= 0 && (
                <p style={{ ...typo.caption, color: UI.colors.error, margin: '6px 0 0' }}>
                  La cantidad debe ser mayor a 0.
                </p>
              )}
            </div>

            {/* Notas */}
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle(UI, typo, true)}>Notas (opcional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones de la entrega..."
                rows={2}
                style={{ ...inputStyle(UI), resize: 'vertical', minHeight: 56 }}
              />
            </div>

            {/* Resumen */}
            {selectedLine && selectedMaterial && qtyParsed > 0 && (
              <div style={{
                marginTop: 14, padding: 12, borderRadius: UI.radius.lg,
                background: UI.glass.hero, border: `1px solid ${UI.colors.borderBlue}`,
              }}>
                <p style={{ ...typo.overline, color: UI.colors.textLow, margin: 0 }}>RESUMEN</p>
                <p style={{ ...typo.body, color: UI.colors.text, margin: '4px 0 0' }}>
                  Entregar <b>{fmtNum(qtyParsed)}</b>{selectedMaterial.uom ? ` ${selectedMaterial.uom}` : ''} de
                  {' '}<b>{selectedMaterial.name}</b> a la línea <b>{selectedLine.name}</b>.
                </p>
              </div>
            )}

            <button onClick={handleSave} disabled={!canSave}
              style={{
                width: '100%', marginTop: 16, padding: '16px', borderRadius: UI.radius.lg,
                background: canSave ? 'linear-gradient(90deg, #15499B, #2B8FE0)' : UI.colors.surface,
                color: canSave ? 'white' : UI.colors.textLow,
                fontSize: 15, fontWeight: 700, opacity: saving ? 0.6 : 1,
                boxShadow: canSave ? '0 10px 24px rgba(21,73,155,0.30)' : 'none',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}>
              {saving ? 'Entregando...' : 'CONFIRMAR ENTREGA'}
            </button>
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

function labelStyle(ui, typo, muted = false) {
  return {
    ...typo.caption,
    color: muted ? ui.colors.textMuted : ui.colors.text,
    display: 'block', marginBottom: 6, fontWeight: muted ? 500 : 700,
  }
}

function pageStyle(ui) {
  return {
    minHeight: '100dvh',
    background: `linear-gradient(160deg, ${ui.colors.bg0} 0%, ${ui.colors.bg1} 50%, ${ui.colors.bg2} 100%)`,
    paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
  }
}
function errorBox(ui) {
  return {
    padding: 10, borderRadius: ui.radius.md, marginBottom: 12,
    background: ui.colors.errorSoft, border: `1px solid ${ui.colors.error}40`,
  }
}
function successBox(ui) {
  return {
    padding: 10, borderRadius: ui.radius.md, marginBottom: 12,
    background: ui.colors.successSoft, border: '1px solid rgba(34,197,94,0.25)',
    textAlign: 'center',
  }
}
function inputStyle(ui) {
  return {
    width: '100%', padding: '10px 12px', borderRadius: 14,
    background: ui.colors.surface, border: `1px solid ${ui.colors.border}`,
    color: ui.colors.text, fontSize: 15, fontWeight: 600, outline: 'none',
    appearance: 'none',
  }
}
function iconBtn(ui) {
  return {
    width: 38, height: 38, borderRadius: ui.radius.md,
    background: ui.colors.surface, border: `1px solid ${ui.colors.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }
}

function GlobalStyles({ isLight = false }) {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
      * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
      button { border: none; background: none; cursor: pointer; }
      input, textarea, select { font-family: 'DM Sans', sans-serif; }
      select option { background: ${isLight ? '#FFFFFF' : '#0a1a2f'}; color: ${isLight ? '#0F2A3D' : 'white'}; }
      input::placeholder, textarea::placeholder { color: ${isLight ? '#5B7285' : 'rgba(255,255,255,0.6)'}; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
  )
}
