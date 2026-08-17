// ─── Gerente V2 · pestaña Producción (read-only, nueva visibilidad) ──────────
// La planta de la sucursal era invisible para la gerente. Aquí tiene visibilidad
// SOLO lectura: resumen del día (kg producido/empacado, merma, paros) de los
// turnos de sus almacenes. NO son las pantallas de captura del jefe de planta.
//
// v1 honesta: si el endpoint nativo no tiene fuente/dato limpio en este ambiente,
// se ofrece el brief de producción existente (con selector de día) como respaldo,
// en vez de una tarjeta vacía.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { getGerenteProduction } from '../../api'

const C = TOKENS.colors
const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 }))

function Metric({ label, value, unit, tone }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: tone }} />
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '6px 0 0' }}>
        {num(value)} <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{unit}</span>
      </p>
    </div>
  )
}

export default function ProduccionGerenteTab() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const res = await getGerenteProduction()
      if (!res.ok) { setState({ status: 'error', data: null, error: res.error }); return }
      setState({ status: 'live', data: res.data, error: '' })
    } catch (e) {
      setState({ status: 'error', data: null, error: e?.message || 'No se pudo cargar producción.' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (state.status === 'loading') {
    return <StateScreen title="Cargando producción…" tokens={TOKENS} />
  }
  if (state.status === 'error') {
    return <StateScreen title="No se pudo cargar producción" detail={state.error} tone="error"
      actionLabel="Reintentar" onAction={load} tokens={TOKENS} />
  }

  const d = state.data
  // Sin fuente nativa limpia → v1 honesta con el brief de producción.
  if (!d || !d.available) {
    return (
      <StateScreen
        title="Producción del día — vista en preparación"
        detail="El resumen nativo de producción de tu planta todavía no tiene fuente cableada en este ambiente. Mientras tanto, puedes ver el brief de producción con selector de día."
        tone="warning"
        actionLabel="Abrir brief de producción"
        onAction={() => navigate('/brief-produccion')}
        tokens={TOKENS}
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
          MI SUCURSAL · PRODUCCIÓN
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>
          Resumen del día <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>al {d.date}</span>
        </h1>
      </div>

      {!d.has_data ? (
        <StateScreen title="Sin turnos de producción hoy"
          detail="No hay turnos registrados en las plantas de tu sucursal para la fecha operativa." tokens={TOKENS} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Metric label="KG PRODUCIDO" value={d.kg_produced} unit="kg" tone={C.blue3} />
            <Metric label="KG EMPACADO" value={d.kg_packed} unit="kg" tone={C.blue2} />
            <Metric label="MERMA" value={d.scrap_kg} unit="kg" tone={C.warning} />
            <Metric label="PAROS" value={d.downtime_min} unit="min" tone={C.error} />
          </div>

          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: '20px 0 8px' }}>
            TURNOS ({num(d.shift_count)})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(d.shifts || []).map((sh) => (
              <div key={sh.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 13, color: C.text }}>
                  {sh.warehouse} <span style={{ color: C.textMuted }}>· turno {sh.shift_code || '—'} · {sh.state || '—'}</span>
                </span>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  {num(sh.kg_produced)} kg · merma {num(sh.scrap_kg)} · paros {num(sh.downtime_min)}′
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p style={{ fontSize: 11, color: C.textLow, marginTop: 14 }}>
        Solo lectura. La captura de producción la hace el jefe de planta.
      </p>
    </div>
  )
}
