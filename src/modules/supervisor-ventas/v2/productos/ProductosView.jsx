// ─── Supervisor V2 · Productos del CEDIS (F4.1) ──────────────────────────────
// La vista de productos vendidos + cobertura del portafolio YA existía dentro de
// PanelKpis (ProductsSection, endpoint products-sold), pero sin enlace desde el
// shell V2. F4.1 la ENLAZA: superficie propia bajo "Más", con selector de periodo.
// No reconstruye datos — reusa ProductsSection y su contrato.
import { useState } from 'react'

import { BRAND_TOKENS as T } from '../../../../theme/brandTokens'
import { ProductsSection } from '../../kpis/PanelKpis'

const C = T.colors
const R = T.radius

const PERIODS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

export default function ProductosView() {
  const [period, setPeriod] = useState('hoy')
  return (
    <div data-testid="productos-view" data-theme="brand-light" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>Productos del CEDIS</h1>
        <p style={{ fontSize: 12.5, color: C.textMuted, margin: '2px 0 0' }}>
          Qué se vendió y qué del portafolio vendible no se ofreció. Escopado a tu sucursal.
        </p>
      </div>
      <div role="tablist" aria-label="Periodo" style={{ display: 'flex', gap: 6 }}>
        {PERIODS.map((p) => {
          const on = p.id === period
          return (
            <button
              key={p.id} type="button" role="tab" aria-selected={on}
              data-testid={`productos-periodo-${p.id}`} onClick={() => setPeriod(p.id)}
              style={{
                minHeight: 36, padding: '0 14px', borderRadius: R.pill, cursor: 'pointer',
                border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue : C.surface,
                color: on ? '#fff' : C.blue3, fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
              }}
            >{p.label}</button>
          )
        })}
      </div>
      {/* key={period} fuerza el refetch al cambiar de periodo (ProductsSection
          depende de period en su effect). */}
      <ProductsSection key={period} period={period} />
    </div>
  )
}
