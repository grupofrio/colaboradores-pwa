// ─── Gerente V2 · pestaña Admin ──────────────────────────────────────────────
// DECISIÓN (la que menos código duplica): esta pestaña es un LANZADOR a las
// pantallas de /admin/*, que ya traen su propio AdminShell. NO se re-monta el hub
// admin dentro del shell de gerente porque eso anidaría dos shells (AdminProvider
// + AdminShell es una sub-app completa). Al tocar una acción se entra a la
// experiencia admin existente; el botón de volver de esa pantalla regresa aquí.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { useSession } from '../../../../App'
import {
  ADMIN_NAV_ACCESS,
  isGerentePilotReadOnly,
} from '../../../admin/gerentePilotCaps.js'
import { BACKEND_CAPS } from '../../../admin/adminService.js'

const C = TOKENS.colors

const ACTIONS = [
  { key: 'hub', label: 'Panorama del día', desc: 'Ventas, gastos y caja de la sucursal', route: '/admin', glyph: '▤', access: ADMIN_NAV_ACCESS.READ },
  { key: 'gastos', label: 'Gastos', desc: 'Consultar gastos de la sucursal', route: '/admin/gastos', glyph: '$', access: ADMIN_NAV_ACCESS.MIXED },
  { key: 'requisiciones', label: 'Requisiciones', desc: 'Consultar solicitudes de compra', route: '/admin/requisiciones', glyph: '⊞', access: ADMIN_NAV_ACCESS.MIXED },
  { key: 'cierre', label: 'Cortes de caja', desc: 'Consultar turnos y cortes', route: '/admin/cierre', glyph: '▣', access: ADMIN_NAV_ACCESS.MIXED },
  { key: 'liquidaciones', label: 'Liquidaciones', desc: 'Consultar liquidación de rutas', route: '/admin/liquidaciones', glyph: '≣', access: ADMIN_NAV_ACCESS.MIXED },
  { key: 'mp', label: 'Materia prima', desc: 'Existencias de MP', route: '/admin/materia-prima', glyph: '◨', access: ADMIN_NAV_ACCESS.READ },
]

export default function AdminGerenteTab() {
  const navigate = useNavigate()
  const { session } = useSession()
  const readOnly = isGerentePilotReadOnly(session, BACKEND_CAPS)

  const actions = useMemo(() => {
    if (!readOnly) return ACTIONS
    return ACTIONS
      .filter((a) => a.access !== ADMIN_NAV_ACCESS.WRITE)
      .map((a) => (
        a.access === ADMIN_NAV_ACCESS.MIXED
          ? { ...a, desc: `${a.desc} · solo lectura en el piloto`, locked: true }
          : a
      ))
  }, [readOnly])

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
            key={a.key}
            onClick={() => navigate(a.route)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '14px 16px',
              opacity: a.locked ? 0.85 : 1,
            }}
          >
            <span aria-hidden style={{
              width: 40, height: 40, borderRadius: TOKENS.radius.md, flexShrink: 0,
              background: C.surfaceStrong, color: C.blue3, fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{a.glyph}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.text }}>{a.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: C.textMuted }}>{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
