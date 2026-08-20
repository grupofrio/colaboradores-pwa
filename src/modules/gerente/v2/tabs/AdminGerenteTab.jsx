// ─── Gerente V2 · pestaña Admin ──────────────────────────────────────────────
// DECISIÓN (la que menos código duplica): esta pestaña es un LANZADOR a las
// pantallas de /admin/*, que ya traen su propio AdminShell. NO se re-monta el hub
// admin dentro del shell de gerente porque eso anidaría dos shells (AdminProvider
// + AdminShell es una sub-app completa). Al tocar una acción se entra a la
// experiencia admin existente; el botón de volver de esa pantalla regresa aquí.
//
// CLEAN-02: el contrato de acceso es el MISMO que AdminShell — `NAV_ITEMS` +
// `filterAdminNavForGerentePilot`. No hay lista paralela de `access` que pueda
// divergir del deep-link guard (`adminRouteAllows`).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { useSession } from '../../../../App'
import {
  isGerentePilotReadOnly,
  resolveGerentePilotCapabilities,
} from '../../../admin/gerentePilotCaps.js'
import { BACKEND_CAPS, bootCapabilities } from '../../../admin/adminService.js'
import { buildGerenteAdminLauncherItems } from '../adminGerenteLauncher.js'

const C = TOKENS.colors

export default function AdminGerenteTab() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [capsReady, setCapsReady] = useState(false)

  useEffect(() => {
    let alive = true
    setCapsReady(false)
    bootCapabilities(session).finally(() => { if (alive) setCapsReady(true) })
    return () => { alive = false }
  }, [session])

  const effectiveCaps = useMemo(
    () => resolveGerentePilotCapabilities(session, BACKEND_CAPS, capsReady),
    [capsReady, session],
  )
  const readOnly = isGerentePilotReadOnly(session, effectiveCaps)

  const actions = useMemo(
    () => buildGerenteAdminLauncherItems(session, effectiveCaps),
    [effectiveCaps, session],
  )

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
          MI SUCURSAL · ADMINISTRACIÓN
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>Administración de la sucursal</h1>
        {readOnly && (
          <p style={{ fontSize: 12, color: C.textMuted, margin: '6px 0 0' }}>
            Piloto en solo lectura: las acciones de aprobar, registrar o validar están desactivadas.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(a.route)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '14px 16px',
              opacity: a.readOnlyPilot ? 0.85 : 1,
            }}
          >
            <span aria-hidden style={{
              width: 40, height: 40, borderRadius: TOKENS.radius.md, flexShrink: 0,
              background: C.surfaceStrong, color: C.blue3, fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{a.glyph}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.text }}>{a.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: C.textMuted }}>
                {a.readOnlyPilot ? `${a.desc} · solo lectura en el piloto` : a.desc}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
