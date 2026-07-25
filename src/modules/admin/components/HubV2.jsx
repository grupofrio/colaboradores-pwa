// ─── HubV2 — panel principal del Auxiliar Administrativo ───────────────────
// Vive dentro de <AdminShell> como children. Muestra:
//   - Tira de KPIs del día (filtrados por razón social activa)
//   - Actividad del día en el flujo principal
import { useEffect, useMemo, useState } from 'react'
import { TOKENS } from '../../../tokens'
import { useAdmin } from '../AdminContext'
import { getDashboardData } from '../adminService'
import { isAngelicaJaimesSession } from '../angyPosSalesBreakdown'
import ActivityFeed from './ActivityFeed'
import AngyPosProductBreakdown from './AngyPosProductBreakdown'

const POLL_MS = 60_000

const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export default function HubV2() {
  const { warehouseId, companyId, companyLabel, employeeName } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const showAngyBreakdown = isAngelicaJaimesSession({ name: employeeName })

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
  }, [warehouseId, companyId])

  const kpis = useMemo(() => {
    const k = data?.kpis || {}
    return [
      { id: 'caja',      label: 'Caja del día',     value: fmt(k.caja?.total),          sub: `${k.caja?.count || 0} ventas`,    tone: TOKENS.colors.success },
      { id: 'ventas',    label: 'Venta mostrador',  value: fmt(k.ventasHoy?.total),     sub: `${k.ventasHoy?.count || 0} tickets`, tone: TOKENS.colors.blue3 },
      { id: 'gastos',    label: 'Gastos',           value: fmt(k.gastosHoy?.total),     sub: `${k.gastosHoy?.count || 0} registros`, tone: TOKENS.colors.warning },
      { id: 'liquid',    label: 'Liquidaciones',    value: k.liquidaciones?.pendingBackend ? '—' : fmt(k.liquidaciones?.total), sub: k.liquidaciones?.pendingBackend ? 'pendiente backend' : `${k.liquidaciones?.count || 0}`, tone: TOKENS.colors.textMuted, pending: k.liquidaciones?.pendingBackend },
      { id: 'req',       label: 'Requisiciones',    value: `${k.requisiciones?.count || 0}`, sub: 'activas',                    tone: TOKENS.colors.blue2 },
      { id: 'alertas',   label: 'Alertas',          value: `${k.alertas?.count || 0}`,  sub: 'sin resolver',                    tone: TOKENS.colors.error },
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

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 28,
      }}>
        {kpis.map(k => (
          <div key={k.id} style={{
            padding: '16px 18px', borderRadius: TOKENS.radius.lg,
            background: TOKENS.glass.panel,
            border: `1px solid ${TOKENS.colors.border}`,
            opacity: k.pending ? 0.6 : 1,
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

      {showAngyBreakdown && (
        <AngyPosProductBreakdown warehouseId={warehouseId} companyId={companyId} />
      )}

      <ActivityFeed moduleId="hub" variant="embedded" />

      <div style={{ height: 40 }} />
    </div>
  )
}
