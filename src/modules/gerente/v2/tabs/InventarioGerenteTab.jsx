// ─── Gerente V2 · pestaña Inventario (read-only, solo almacenes propios) ─────
// Existencias por almacén de la sucursal → productos con cantidad (buscable).
// Nada de writes ni ajustes: es una vista operativa simple, no el observatorio
// M5 de dirección.
import { useCallback, useEffect, useMemo, useState } from 'react'
import StateScreen from '../../../../components/kold/StateScreen'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { getGerenteInventory } from '../../api'

const C = TOKENS.colors
const num = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

export default function InventarioGerenteTab() {
  const [state, setState] = useState({ status: 'loading', warehouses: [], error: '' })
  const [q, setQ] = useState('')
  const [openWh, setOpenWh] = useState(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const res = await getGerenteInventory()
      if (!res.ok) { setState({ status: 'error', warehouses: [], error: res.error }); return }
      setState({ status: 'live', warehouses: res.warehouses, error: '' })
      setOpenWh((prev) => prev ?? res.warehouses[0]?.warehouse_id ?? null)
    } catch (e) {
      setState({ status: 'error', warehouses: [], error: e?.message || 'No se pudo cargar el inventario.' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.warehouses.map((wh) => ({
      ...wh,
      products: needle
        ? wh.products.filter((p) =>
            p.product_name.toLowerCase().includes(needle) ||
            (p.default_code || '').toLowerCase().includes(needle))
        : wh.products,
    }))
  }, [state.warehouses, q])

  if (state.status === 'loading') {
    return <StateScreen title="Cargando existencias…" tokens={TOKENS} />
  }
  if (state.status === 'error') {
    return <StateScreen title="No se pudo cargar el inventario" detail={state.error} tone="error"
      actionLabel="Reintentar" onAction={load} tokens={TOKENS} />
  }
  if (!state.warehouses.length) {
    return <StateScreen title="Sin almacenes en tu sucursal"
      detail="No hay almacenes con existencias asociados a tu sucursal." tokens={TOKENS} />
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
          MI SUCURSAL · INVENTARIO
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 10px' }}>Existencias por almacén</h1>
        <input
          type="search" placeholder="Buscar producto o código…" value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: TOKENS.radius.md,
            background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((wh) => {
          const open = openWh === wh.warehouse_id
          return (
            <div key={wh.warehouse_id} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, overflow: 'hidden',
            }}>
              <button
                onClick={() => setOpenWh(open ? null : wh.warehouse_id)}
                aria-expanded={open}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  {wh.warehouse_name} <span style={{ color: C.textMuted, fontWeight: 500 }}>{wh.warehouse_code}</span>
                </span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{wh.products.length} SKU {open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {wh.products.length === 0 ? (
                    <p style={{ fontSize: 13, color: C.textMuted, padding: '12px 14px', margin: 0 }}>
                      {q ? 'Sin coincidencias en este almacén.' : 'Sin existencias.'}
                    </p>
                  ) : wh.products.map((p) => (
                    <div key={p.product_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      padding: '9px 14px', borderTop: `1px solid ${C.border}22`,
                    }}>
                      <span style={{ fontSize: 13, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.default_code ? <b style={{ color: C.textMuted }}>{p.default_code} </b> : null}{p.product_name}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>
                        {num(p.quantity)} {p.uom}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 11, color: C.textLow, marginTop: 12 }}>
        Solo lectura. Los ajustes de inventario no se hacen desde aquí.
      </p>
    </div>
  )
}
