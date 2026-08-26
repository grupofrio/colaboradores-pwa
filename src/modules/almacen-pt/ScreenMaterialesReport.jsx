// ScreenMaterialesReport.jsx — Operador reporta consumo de un material
// ───────────────────────────────────────────────────────────────────────────
// Backend real: POST /api/production/materials/settlement/report
// Lookup dual aceptado: (settlement_id) o (shift_id, line_id, material_id).
//
// Contrato definitivo (2026-04-16):
//   - El operador SOLO hace report (confirma que usó el material).
//   - NO captura sobrante, merma ni consumo — eso lo registra auxiliar admin.
//   - Payload: lookup + employee_id + notes (opcional).
//   - Backend transiciona settlement: draft → reported.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS, getTypo } from '../../tokens'
import { BRAND_TOKENS as BRAND_TOKENS_LIGHT } from '../../theme/brandTokens'
import { getActiveShift } from '../supervision/api'
import { getMaterialIssues, reportMaterial, stateLabel, lineOf } from './materialsService'
import { resolveMaterialesRouteBase, resolveMaterialesSurfaceTheme } from './materialsNavigation'
import { fmtNum } from './ptService'
import { logScreenError } from '../shared/logScreenError'

const TOKENS_LIGHT = BRAND_TOKENS_LIGHT

export default function ScreenMaterialesReport() {
  const { session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { issueId } = useParams()
  const [sw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])

  const [issue, setIssue] = useState(location.state?.issue || null)
  const [shiftId, setShiftId] = useState(null)
  const [loading, setLoading] = useState(!issue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const materialesBasePath = resolveMaterialesRouteBase(location.state, '/almacen-pt/materiales', session?.role)
  const surfaceTheme = resolveMaterialesSurfaceTheme(location.state, session?.role)
  const UI = surfaceTheme === 'light' ? TOKENS_LIGHT : TOKENS
  const backTo = materialesBasePath
  const plantId = session?.warehouse_id || 76

  const [notes, setNotes] = useState('')
  const submittingRef = useRef(false)

  // Siempre obtenemos el turno activo — el issue list no incluye shift_id,
  // y settlement_id puede ser null para issues nuevos. Necesitamos shift_id
  // como parte del lookup triple que acepta el endpoint de report.
  useEffect(() => {
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function bootstrap() {
    if (!issue && !issueId) return
    setLoading(true)
    setError('')
    try {
      const s = await getActiveShift(plantId)
      if (!s?.id) { setError('Sin turno activo.'); setLoading(false); return }
      setShiftId(s.id)
      if (!issue && issueId) {
        const res = await getMaterialIssues({ shiftId: s.id })
        const found = res.items.find(i => String(i.id || i.issue_id) === String(issueId))
        if (!found) {
          setError('Material no encontrado en el turno.')
        } else {
          setIssue(found)
        }
      }
    } catch (e) {
      logScreenError('ScreenMaterialesReport', 'bootstrap', e)
      setError(e?.message || 'Error cargando el material.')
    }
    setLoading(false)
  }

  // Operador solo confirma — no requiere cantidades.
  const canSave = !!issue && !saving

  async function handleSave() {
    if (!canSave) return
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    setError('')
    try {
      const settlementId = issue.settlement_id || null
      // El issue list NO devuelve shift_id; usamos el del turno activo.
      const activeShiftId = issue.shift_id || shiftId || null
      const lineId  = issue.line_id  || null
      const materialId = issue.material_id || null
      await reportMaterial({
        settlementId,
        shiftId: activeShiftId, lineId, materialId,
        employeeId: session?.employee_id || 0,
        notes: notes.trim(),
      })
      setSuccess('Reporte enviado. Auxiliar admin validará.')
      setTimeout(() => navigate(backTo, { replace: true }), 900)
    } catch (e) {
      logScreenError('ScreenMaterialesReport', 'handleSave', e)
      setError(e?.message || 'No se pudo enviar el reporte.')
      submittingRef.current = false
    } finally {
      setSaving(false)
    }
  }

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
            <span style={{ ...typo.title, color: UI.colors.textSoft }}>Reportar consumo</span>
            <p style={{ ...typo.caption, color: UI.colors.textMuted, margin: 0, marginTop: 2 }}>
              Confirma que usaste el material
            </p>
          </div>
        </div>

        {error && <div style={errorBox(UI)}><p style={{ ...typo.caption, color: UI.colors.error, margin: 0 }}>{error}</p></div>}
        {success && <div style={successBox(UI)}><p style={{ ...typo.body, color: UI.colors.success, margin: 0, fontWeight: 600 }}>{success}</p></div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 32, height: 32, border: `2px solid ${UI.colors.border}`, borderTop: `2px solid ${UI.colors.blue}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : !issue ? null : (
          <>
            {/* Ficha del material entregado */}
            <div style={{
              padding: 14, borderRadius: UI.radius.lg,
              background: UI.glass.hero, border: `1px solid ${UI.colors.borderBlue}`,
            }}>
              <p style={{ ...typo.overline, color: 'rgba(255,255,255,0.82)', margin: 0 }}>
                {lineOf(issue)} · {stateLabel(issue.settlement_state || issue.state)}
              </p>
              <p style={{ ...typo.title, color: UI.colors.onPrimary, margin: 0, marginTop: 4 }}>
                {issue.product_name || issue.material_name || '—'}
              </p>
              <p style={{ ...typo.body, color: UI.colors.onPrimary, margin: 0, marginTop: 6 }}>
                Entregado: <b>{fmtNum(issue.qty_issued)}</b> {issue.uom || ''}
              </p>
            </div>

            {/* Instrucción clara para el operador */}
            <div style={{
              marginTop: 14, padding: 12, borderRadius: UI.radius.md,
              background: 'rgba(43,143,224,0.06)', border: '1px solid rgba(43,143,224,0.15)',
            }}>
              <p style={{ ...typo.caption, color: UI.colors.textSoft, margin: 0 }}>
                Al confirmar, el auxiliar admin registrará sobrante y merma.
                Tú solo confirmas que recibiste y usaste el material.
              </p>
            </div>

            {/* Nota opcional */}
            <div style={{ marginTop: 14 }}>
              <label style={{ ...typo.caption, color: UI.colors.textMuted, display: 'block', marginBottom: 6 }}>
                Notas (opcional)
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones del turno..."
                rows={2}
                style={{ ...inputStyle(UI), resize: 'vertical', minHeight: 56 }}
              />
            </div>

            <button onClick={handleSave} disabled={!canSave}
              style={{
                width: '100%', marginTop: 16, padding: '16px', borderRadius: UI.radius.lg,
                background: canSave ? 'linear-gradient(90deg, #15499B, #2B8FE0)' : UI.colors.surface,
                color: canSave ? 'white' : UI.colors.textLow,
                fontSize: 15, fontWeight: 700, opacity: saving ? 0.6 : 1,
                boxShadow: canSave ? '0 10px 24px rgba(21,73,155,0.30)' : 'none',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}>
              {saving ? 'Enviando...' : 'CONFIRMAR REPORTE'}
            </button>
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
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
      input, textarea { font-family: 'DM Sans', sans-serif; }
      input::placeholder, textarea::placeholder { color: ${isLight ? '#5B7285' : 'rgba(255,255,255,0.6)'}; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
  )
}
