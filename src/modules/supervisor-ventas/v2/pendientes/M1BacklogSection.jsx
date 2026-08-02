// ─── Backlog M1 acomodado (vista PURA) ───────────────────────────────────────
// De lo accionable a lo informativo: veredicto → listas para cerrar → requieren
// gestión → riesgo → rezago plegado. Recibe el acomodo YA construido
// (m1Accommodation.js); aquí no se calcula ni se pide nada.
//
// SOLO LECTURA (`supervisor_writes_enabled` = false): ningún control ejecuta
// cierres ni acciones — darían 403. Los CTA NAVEGAN al detalle de la ruta.
//
// MONEDA: el scope de una supervisora es UNA sucursal ⇒ una sola moneda, así que
// el total es seguro de sumar. La etiqueta es NEUTRA a propósito: "caja
// pendiente", sin afirmar si es por recibir o por conciliar — eso está sin
// confirmar con backend y la UI no puede inventarlo.
//
// Tema CLARO de marca; solo se monta bajo rutas moduleId="supervisor_ventas".
import { useState } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { fmtInt, fmtMoney } from '../../../torre/m1/m1BacklogModel'

const C = TOKENS.colors
const S = TOKENS.state

const RISK_META = {
  high: { label: 'Alto', tone: S.incumplimiento },
  medium: { label: 'Medio', tone: S.risk },
  low: { label: 'Bajo', tone: S.info },
}

// El backend recomienda "Validar cierre con gerente", pero el gerente NO tiene
// tower_status (PWA_TOWER_ROLE_STATUS_MAP solo mapea supervisor_ventas y
// direccion_general) ⇒ hoy no puede ver este backlog. Se DICE, no se esconde.
const ACCION_SIN_DESTINATARIO = 'Validar cierre con gerente'

function Card({ children, testid, style }) {
  return (
    <section
      data-testid={testid}
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: TOKENS.radius.lg, padding: '14px 16px', marginBottom: 12, ...style,
      }}
    >
      {children}
    </section>
  )
}

function SectionTitle({ children, hint }) {
  return (
    <header style={{ marginBottom: 10 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{children}</h3>
      {hint && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>{hint}</div>}
    </header>
  )
}

function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: TOKENS.radius.pill,
      color: t.fg, background: t.bg, border: `1px solid ${t.border}`, whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

// ── 1 · Veredicto ───────────────────────────────────────────────────────────
function Verdict({ verdict }) {
  const n = verdict.closeCandidates
  const titular = n === null
    ? 'No pudimos contar las rutas listas para cerrar.'
    : n === 0
      ? 'Hoy no hay rutas listas para cerrar.'
      : `Tienes ${fmtInt(n)} ${n === 1 ? 'ruta lista' : 'rutas listas'} para cerrar.`

  return (
    <div
      data-testid="m1-verdict"
      style={{
        background: TOKENS.glass.hero, color: C.onPrimary || '#FFFFFF',
        borderRadius: TOKENS.radius.lg, padding: '16px 18px', marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800 }}>{titular}</div>
      <div style={{ fontSize: 12.5, marginTop: 6, opacity: 0.92 }}>
        {fmtInt(verdict.openRoutes)} rutas abiertas · caja pendiente {fmtMoney(verdict.cashPending)}
      </div>
      {verdict.dataAsOf && (
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.78 }}>
          Registrado por el servidor: {verdict.dataAsOf}
        </div>
      )}
    </div>
  )
}

// ── 2 · Listas para cerrar hoy ──────────────────────────────────────────────
function Candidates({ rows, onOpenRoute }) {
  return (
    <Card testid="m1-candidatas">
      <SectionTitle hint="Caja ya validada por el sistema. El cierre se hace fuera de esta pantalla.">
        Listas para cerrar
      </SectionTitle>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted }}>Ninguna ruta cumple hoy las condiciones de cierre.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.plan_id} data-testid="m1-candidata-row" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '10px 0', borderTop: `1px solid ${C.border}`,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{r.route_name || `Plan ${r.plan_id}`}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                  {fmtInt(r.age_days)} días · caja pendiente {fmtMoney(r.cash_pending_amount)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenRoute?.(r.plan_id)}
                data-testid="m1-candidata-cta"
                style={{
                  flexShrink: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  padding: '7px 14px', borderRadius: TOKENS.radius.pill,
                  color: C.blue3, background: 'transparent', border: `1px solid ${C.borderBlue}`,
                }}
              >
                Ver ruta
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── 3 · Requieren gestión ───────────────────────────────────────────────────
function ActionGroups({ groups, onOpenRoute }) {
  const sinDestinatario = groups.find((g) => g.action === ACCION_SIN_DESTINATARIO)
  return (
    <Card testid="m1-gestion">
      <SectionTitle hint="Agrupado por la acción que recomienda el sistema.">Requieren gestión</SectionTitle>
      {groups.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted }}>Sin rutas que requieran gestión en el alcance cargado.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {groups.map((g) => (
            <li key={g.action} data-testid="m1-gestion-bucket" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '9px 0', borderTop: `1px solid ${C.border}`,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{g.action}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                  caja pendiente {fmtMoney(g.cash)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Chip text={`${fmtInt(g.count)} rutas`} tone={S.no_evaluable} />
                {g.planIds[0] != null && (
                  <button
                    type="button"
                    onClick={() => onOpenRoute?.(g.planIds[0])}
                    data-testid="m1-gestion-cta"
                    style={{
                      cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '6px 12px',
                      borderRadius: TOKENS.radius.pill, color: C.blue3,
                      background: 'transparent', border: `1px solid ${C.borderBlue}`,
                    }}
                  >
                    Ver primera
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sinDestinatario && sinDestinatario.count > 0 && (
        <div data-testid="m1-nota-gerente" style={{
          marginTop: 12, fontSize: 11.5, padding: '9px 11px', borderRadius: TOKENS.radius.md,
          color: S.no_evaluable.fg, background: S.no_evaluable.bg, border: `1px solid ${S.no_evaluable.border}`,
        }}>
          ▢ {fmtInt(sinDestinatario.count)} de estas rutas recomiendan validar el cierre con
          gerencia, pero ese puesto todavía no tiene acceso a esta información. Dato informativo:
          no depende de ti.
        </div>
      )}
    </Card>
  )
}

// ── 4 · Nivel de riesgo ─────────────────────────────────────────────────────
function RiskBar({ risk }) {
  const order = ['high', 'medium', 'low']
  const total = order.reduce((a, k) => a + risk.counts[k], 0)
  return (
    <Card testid="m1-riesgo">
      <SectionTitle
        hint={risk.partial
          ? `Sobre las ${fmtInt(risk.rowsCounted)} rutas cargadas de ${fmtInt(risk.total)}: el contrato no entrega el conteo total por riesgo.`
          : `Sobre las ${fmtInt(risk.rowsCounted)} rutas abiertas.`}
      >
        Nivel de riesgo
      </SectionTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {order.map((key) => {
          const meta = RISK_META[key]
          return (
            <div key={key} data-testid={`m1-riesgo-${key}`} style={{
              flex: '1 1 90px', padding: '10px 12px', borderRadius: TOKENS.radius.md,
              background: meta.tone.bg, border: `1px solid ${meta.tone.border}`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: meta.tone.fg }}>{fmtInt(risk.counts[key])}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: meta.tone.fg }}>{meta.label}</div>
            </div>
          )
        })}
      </div>
      {total === 0 && (
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Sin filas cargadas para clasificar.</div>
      )}
    </Card>
  )
}

// ── 5 · Rezago histórico (plegado) ──────────────────────────────────────────
function Rezago({ rezago }) {
  const [open, setOpen] = useState(false)
  return (
    <Card testid="m1-rezago">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="m1-rezago-toggle"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, cursor: 'pointer', background: 'transparent', padding: 0, textAlign: 'left',
        }}
      >
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: C.text }}>
            Rezago histórico
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
            No es de hoy: {fmtInt(rezago.count)} rutas de más de {fmtInt(rezago.minDays)} días ·
            caja pendiente {fmtMoney(rezago.cash)}
          </span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.blue3, flexShrink: 0 }}>
          {open ? 'Ocultar' : 'Ver'}
        </span>
      </button>

      {open && (
        <div data-testid="m1-rezago-detalle" style={{ marginTop: 12 }}>
          {rezago.bands.every((b) => b.count === 0) ? (
            <div style={{ fontSize: 13, color: C.textMuted }}>Sin rutas en este rango.</div>
          ) : rezago.bands.map((b) => (
            <div key={b.key} style={{
              display: 'flex', justifyContent: 'space-between', gap: 10,
              padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 12.5,
            }}>
              <span style={{ color: C.textMuted }}>{b.label}</span>
              <span style={{ color: C.text, fontWeight: 700 }}>
                {fmtInt(b.count)} rutas · {fmtMoney(b.cash)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function M1BacklogSection({ accommodation, onOpenRoute, testid = 'm1-backlog-section' }) {
  if (!accommodation) return null
  return (
    <div data-testid={testid}>
      <Verdict verdict={accommodation.verdict} />
      <Candidates rows={accommodation.candidates} onOpenRoute={onOpenRoute} />
      <ActionGroups groups={accommodation.actionGroups} onOpenRoute={onOpenRoute} />
      <RiskBar risk={accommodation.risk} />
      <Rezago rezago={accommodation.rezago} />
    </div>
  )
}
