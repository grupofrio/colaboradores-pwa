// ─── HubV2 — panel principal del Auxiliar Administrativo ───────────────────
// Vive dentro de <AdminShell> como children. Muestra:
//   - Tira de KPIs del día (filtrados por razón social activa)
//   - Actividad del día en el flujo principal
import { useEffect, useMemo, useState } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'
import { useAdmin } from '../AdminContext'
import { getDashboardData } from '../adminService'
import { ODOO_UNAVAILABLE_MESSAGE } from '../../../lib/odooAvailability'
import { isPosBreakdownSession } from '../angyPosSalesBreakdown'
import ActivityFeed from './ActivityFeed'
import AngyPosProductBreakdown from './AngyPosProductBreakdown'

const POLL_MS = 60_000

const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export default function HubV2() {
  const { warehouseId, companyId, companyLabel, employeeId, capsRevision, odooUnavailable, odooMessage, retryOdoo } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  // Gate por employee_id (server-issued), no por nombre. Ver identityGates.js.
  const showPosBreakdown = isPosBreakdownSession({ employee_id: employeeId })

  useEffect(() => {
    let alive = true

    async function load() {
      setErr('')
      try {
        const result = await getDashboardData({ warehouseId, companyId })
        if (!alive) return
        setData(result)
      } catch (e) {
        if (!alive) return
        setErr(e?.message || 'No se pudo cargar el dashboard')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [warehouseId, companyId, capsRevision])

  const kpis = useMemo(() => {
    const k = data?.kpis || {}
    const fmtOrDash = (metric) => {
      if (!metric || metric.available === false) return '—'
      if (metric.total == null || !Number.isFinite(Number(metric.total))) return '—'
      return fmt(metric.total)
    }
    const subOrDash = (metric, suffix) => {
      if (!metric || metric.available === false) {
        return metric?.reason === 'cash_shift_hub_source_unavailable'
          ? 'sin fuente de caja'
          : 'no disponible'
      }
      if (metric.count == null) return '—'
      return `${metric.count} ${suffix}`
    }
    return [
      { id: 'caja',      label: 'Caja del día',     value: fmtOrDash(k.caja),          sub: subOrDash(k.caja, 'movimientos'), tone: TOKENS.colors.success, unavailable: k.caja?.available === false },
      { id: 'ventas',    label: 'Venta mostrador',  value: fmtOrDash(k.ventasHoy),     sub: subOrDash(k.ventasHoy, 'tickets'), tone: TOKENS.colors.blue3 },
      { id: 'gastos',    label: 'Gastos',           value: fmtOrDash(k.gastosHoy),     sub: subOrDash(k.gastosHoy, 'registros'), tone: TOKENS.colors.warning, unavailable: k.gastosHoy?.available === false },
      { id: 'liquid',    label: 'Liquidaciones',    value: fmtOrDash(k.liquidaciones), sub: subOrDash(k.liquidaciones, 'pendientes'), tone: TOKENS.colors.textMuted, unavailable: k.liquidaciones?.available === false },
      { id: 'req',       label: 'Requisiciones',    value: fmtOrDash(k.requisiciones), sub: subOrDash(k.requisiciones, 'activas'), tone: TOKENS.colors.blue2, unavailable: k.requisiciones?.available === false },
      { id: 'alertas',   label: 'Alertas',          value: k.alertas?.available === false ? '—' : `${k.alertas?.count || 0}`,  sub: k.alertas?.available === false ? 'no disponible' : 'sin resolver', tone: TOKENS.colors.error, unavailable: k.alertas?.available === false },
    ]
  }, [data])

  return (
    <div>
      {/* Encabezado */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          color: TOKENS.colors.textLow, margin: 0,
        }}>
          RESUMEN OPERATIVO · {companyLabel.toUpperCase()}
        </p>
        <h1 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
          color: TOKENS.colors.text, margin: '4px 0 0',
        }}>
          Panorama del día
        </h1>
      </div>

      {err && (
        <div style={{
          padding: '12px 16px', borderRadius: TOKENS.radius.md, marginBottom: 18,
          background: TOKENS.colors.errorSoft,
          border: `1px solid ${TOKENS.colors.error}40`,
          color: TOKENS.colors.error, fontSize: 12, fontWeight: 600,
        }}>
          {err}
        </div>
      )}

      {(odooUnavailable || data?.odooUnavailable) && (
        <div
          role="status"
          data-testid="hub-odoo-unavailable"
          style={{
            padding: '12px 16px', borderRadius: TOKENS.radius.md, marginBottom: 18,
            background: TOKENS.colors.warningSoft || 'rgba(245,158,11,0.12)',
            border: `1px solid ${TOKENS.colors.warning}40`,
            color: TOKENS.colors.warning, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <span>{odooMessage || data?.odooMessage || ODOO_UNAVAILABLE_MESSAGE}</span>
          <button
            type="button"
            onClick={() => retryOdoo?.()}
            style={{
              minHeight: 44, minWidth: 44, padding: '8px 12px',
              borderRadius: TOKENS.radius.sm, border: `1px solid ${TOKENS.colors.warning}60`,
              background: TOKENS.colors.surface, color: TOKENS.colors.text,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 28,
      }}>
        {kpis.map(k => (
          <div
            key={k.id}
            data-testid={`hub-kpi-${k.id}`}
            data-origin={k.unavailable ? 'hub-kpi-unavailable' : 'hub-kpi'}
            style={{
            padding: '16px 18px', borderRadius: TOKENS.radius.lg,
            background: TOKENS.glass.panel,
            border: `1px solid ${TOKENS.colors.border}`,
            opacity: k.pending || k.unavailable ? 0.6 : 1,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: k.tone,
            }} />
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
              color: TOKENS.colors.textLow, margin: 0,
            }}>
              {k.label.toUpperCase()}
            </p>
            <p style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
              color: TOKENS.colors.text, margin: '6px 0 2px',
            }}>
              {loading ? '—' : k.value}
            </p>
            <p style={{
              fontSize: 11, color: TOKENS.colors.textMuted, margin: 0,
            }}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      {showPosBreakdown && (
        <AngyPosProductBreakdown warehouseId={warehouseId} companyId={companyId} />
      )}

      <ActivityFeed moduleId="hub" variant="embedded" />

      <div style={{ height: 40 }} />
    </div>
  )
}
