// Read-only Equipo surfaces mounted under /gerente/equipo/* (moduleId=gerente).
// Reuses supervisor V2 tab bodies without SupervisorV2Gate / write registry roles.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'

const C = TOKENS.colors

/** Honesty panel for supervisor write flows (planear) during Gerente RO pilot. */
export function EquipoPlanearReadOnly() {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
        MI SUCURSAL · EQUIPO · SOLO LECTURA
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>
        Planear mañana
      </h1>
      <p style={{ fontSize: 13, color: C.textMuted, margin: '10px 0 0', lineHeight: 1.45 }}>
        La planeación de rutas es escritura del supervisor. En el piloto Gerente
        esta superficie queda en solo lectura: no se montan CTAs ni endpoints de
        escritura del módulo Equipo.
      </p>
    </div>
  )
}

export function EquipoHoyReadOnlyBanner({ children }) {
  return (
    <div>
      <p style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.textMuted,
        margin: '0 0 10px',
        padding: '8px 12px',
        border: `1px solid ${C.border}`,
        borderRadius: TOKENS.radius.md,
        background: C.surface,
      }}>
        Modo gerente · solo lectura · alcance de tu sucursal
      </p>
      {children}
    </div>
  )
}
