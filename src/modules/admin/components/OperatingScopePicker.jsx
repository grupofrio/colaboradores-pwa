// ─── OperatingScopePicker — selector Plaza → Empresa para actores multi-compañía ─
// Solo se renderiza cuando GET /pwa-admin/operating-scope responde enabled:true
// (ver bootOperatingScope/groupOperatingScopesByPlaza en adminService.js).
// Presentacional puro — no depende de contexto, solo de props (igual que
// ProductPicker) para poder usarse tanto en AdminRequisicionForm (escritorio,
// vía AdminContext) como en MobileRequisiciones (no envuelto en AdminProvider).
//
// El backend re-valida siempre el par (plaza_id, company_id) elegido contra
// los grants reales del actor — este componente solo debe ofrecer las
// combinaciones que ya vinieron en `groups` (nunca cruzar Plaza × Empresa
// libremente).
import { useEffect, useRef, useState } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'

export default function OperatingScopePicker({
  groups = [],
  plazaId = null,
  companyId = null,
  onChange,
  loading = false,
  label = 'Plaza y empresa operativa',
  required = true,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedPlaza = groups.find(g => g.plazaId === plazaId) || null
  const selectedCompany = selectedPlaza?.companies.find(c => c.companyId === companyId) || null

  function handleSelect(group, company) {
    onChange?.({ plazaId: group.plazaId, companyId: company.companyId })
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ marginBottom: 12, position: 'relative' }}>
      <label style={{
        fontSize: 12, color: TOKENS.colors.textMuted, fontWeight: 500,
        display: 'block', marginBottom: 4,
      }}>
        {label} {required && <span style={{ color: TOKENS.colors.blue3 }}>*</span>}
      </label>

      <button
        type="button"
        onClick={() => !loading && setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: TOKENS.radius.md,
          background: TOKENS.colors.surface,
          border: `1px solid ${selectedCompany ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
          color: selectedCompany ? TOKENS.colors.text : TOKENS.colors.textLow,
          fontSize: 13, fontFamily: "'DM Sans', sans-serif",
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left', cursor: loading ? 'wait' : 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
        </svg>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading
            ? 'Cargando Plazas…'
            : selectedPlaza && selectedCompany
              ? `${selectedPlaza.plazaName} · ${selectedCompany.companyName}`
              : 'Seleccionar Plaza y empresa…'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !loading && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: TOKENS.colors.bg1, border: `1px solid ${TOKENS.colors.border}`,
          borderRadius: TOKENS.radius.md,
          boxShadow: TOKENS.shadow?.lg || '0 12px 32px rgba(0,0,0,0.45)',
          zIndex: 50, maxHeight: 320, overflowY: 'auto',
        }}>
          {groups.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: TOKENS.colors.textLow, textAlign: 'center' }}>
              Sin Plazas autorizadas
            </div>
          ) : (
            groups.map(group => (
              <div key={group.plazaId} style={{ borderBottom: `1px solid ${TOKENS.colors.border}30` }}>
                <p style={{
                  margin: 0, padding: '8px 12px 4px',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  color: TOKENS.colors.textLow,
                }}>
                  {group.plazaName.toUpperCase()}
                </p>
                {group.companies.map(company => {
                  const active = group.plazaId === plazaId && company.companyId === companyId
                  return (
                    <button
                      key={`${group.plazaId}-${company.companyId}`}
                      type="button"
                      onClick={() => handleSelect(group, company)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 12px 10px 20px', border: 'none',
                        background: active ? TOKENS.colors.blueGlow : 'transparent',
                        color: TOKENS.colors.text, fontSize: 12, textAlign: 'left',
                        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      <span style={{ flex: 1 }}>{company.companyName}</span>
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TOKENS.colors.blue3} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
