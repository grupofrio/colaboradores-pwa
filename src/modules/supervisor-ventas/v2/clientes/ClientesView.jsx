// ─── Supervisor V2 · Clientes (vista PURA — superficie segmentada) ────────────
// Fusiona en UNA sola superficie lo que hoy vive disperso (sin-visitar,
// recuperación, edición, planeados) usando la segmentación de route-stops del
// día (gf.route.stop) que produce segmentCustomers(). En V1 la fuente ÚNICA de
// segmentación es route-stops agregado de las rutas del día.
//
// Reglas duras (heredadas del contrato #220/#80):
//   · SOLO lectura — sin edición de cliente inline (la edición irá por un
//     controller protegido en otra fase; aquí solo "abrir");
//   · saldo / finanzas NO se muestran (V1 sin permiso ni fuente para ello);
//   · ausencia se NOMBRA (Sin resultado / Sin check-in), jamás se pinta como 0;
//   · segmento vacío ⇒ vacío honesto, no una lista fantasma.
// Sin window/fetch/hooks ⇒ SSR-testeable con props directas.
import { TOKENS } from '../../../../tokens'
import { CUSTOMER_SEGMENT_LABELS } from '../presentation.js'

const C = TOKENS.colors
const S = TOKENS.state

// Verde reutilizable (no existe token de estado "éxito"; se compone del color).
const GREEN = { fg: C.success, bg: C.successSoft, border: 'rgba(34,197,94,0.34)' }

// Segmentos visibles y su orden en la fila de chips. Coincide con las claves que
// segmentCustomers() realmente puebla; 'fuera_secuencia' se declara aunque hoy
// quede en 0 (honestidad: no se oculta un segmento por estar vacío).
const SEGMENT_ORDER = Object.freeze([
  'planeados', 'visitados', 'pendientes', 'no_venta', 'con_venta', 'incidencia', 'fuera_secuencia',
])
const SEGMENT_TONES = {
  planeados: S.info,
  visitados: S.signal,
  pendientes: S.risk,
  no_venta: S.risk,
  con_venta: GREEN,
  incidencia: S.incumplimiento,
  fuera_secuencia: S.no_evaluable,
}

const RESULT_LABELS = { con_venta: 'Con venta', no_venta: 'No venta' }

const BANNER_STYLE = {
  fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)',
  border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md,
  padding: '9px 12px', marginBottom: 13,
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

// no_venta espejando la lógica de segmentCustomers (resultado con 'no' + 'vent').
function isNoVenta(stop) {
  const r = String(stop?.result_status || '').toLowerCase()
  return r.includes('no') && r.includes('vent')
}
function resultLabel(stop) {
  const raw = String(stop?.result_status || '')
  if (!raw) return null
  return RESULT_LABELS[raw.toLowerCase()] || raw
}
function resultTone(stop) {
  if (isNoVenta(stop)) return S.risk
  if (String(stop?.result_status || '').toLowerCase() === 'con_venta') return GREEN
  return S.no_evaluable
}

function Chip({ text, tone, muted }) {
  const t = tone || S.no_evaluable
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: TOKENS.radius.pill,
      color: muted ? C.textMuted : t.fg, background: muted ? 'transparent' : t.bg,
      border: `1px solid ${muted ? C.border : t.border}`, whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

function SegmentChips({ activeSegment, onSelectSegment, countFor }) {
  return (
    <div role="tablist" aria-label="Segmentos de clientes" data-testid="clientes-segment-chips" style={{
      display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14,
    }}>
      {SEGMENT_ORDER.map((seg) => {
        const on = seg === activeSegment
        const tone = SEGMENT_TONES[seg] || S.no_evaluable
        const label = CUSTOMER_SEGMENT_LABELS[seg] || seg
        return (
          <button
            key={seg}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`clientes-chip-${seg}`}
            onClick={onSelectSegment ? () => onSelectSegment(seg) : undefined}
            style={{
              display: 'flex', gap: 6, alignItems: 'center', flex: '0 0 auto',
              cursor: onSelectSegment ? 'pointer' : 'default',
              fontSize: 12, fontWeight: on ? 800 : 600, padding: '7px 12px', borderRadius: TOKENS.radius.pill,
              color: on ? tone.fg : C.textSoft,
              background: on ? tone.bg : C.surfaceSoft,
              border: `1px solid ${on ? tone.border : C.border}`, whiteSpace: 'nowrap',
            }}
          >
            <span>{label}</span>
            <span aria-hidden style={{
              fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: TOKENS.radius.pill,
              color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`,
            }}>{countFor(seg)}</span>
          </button>
        )
      })}
    </div>
  )
}

function CustomerRow({ stop, onOpenCustomer }) {
  const customerId = stop?.customer_id ?? null
  const clickable = !!onOpenCustomer && customerId != null
  const result = resultLabel(stop)
  const sales = num(stop?.sale_order_count)
  const noVenta = isNoVenta(stop)
  const reason = noVenta && stop?.not_visited_reason ? String(stop.not_visited_reason) : null

  return (
    <div
      data-testid="clientes-row"
      data-customer-id={customerId ?? undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpenCustomer(customerId) : undefined}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, padding: '11px 0',
        borderTop: `1px solid ${C.border}`, cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{stop?.name || 'Cliente sin nombre'}</span>
        {clickable && <span aria-hidden style={{ color: C.blue3, fontSize: 14 }}>›</span>}
      </div>
      <div style={{ fontSize: 12, color: C.textMuted }}>{stop?.route_name || 'Ruta sin nombre'}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {result
          ? <Chip text={`Resultado: ${result}`} tone={resultTone(stop)} />
          : <Chip text="Sin resultado" muted />}
        {sales != null && sales > 0 && <Chip text={`Con venta · ${sales}`} tone={GREEN} />}
        {reason && <Chip text={`Motivo: ${reason}`} tone={S.no_evaluable} />}
        {stop?.has_checkin ? <Chip text="Check-in" tone={S.signal} /> : <Chip text="Sin check-in" muted />}
      </div>
    </div>
  )
}

export default function ClientesView({
  segments = {}, activeSegment = 'pendientes', onSelectSegment, source = 'live',
  onOpenCustomer, counts = null, testid = 'supervisor-v2-clientes',
}) {
  const isDemo = source === 'demo'
  const seg = segments && typeof segments === 'object' ? segments : {}
  const active = SEGMENT_ORDER.includes(activeSegment) ? activeSegment : 'pendientes'
  const countFor = (k) => {
    if (counts && Number.isFinite(Number(counts[k]))) return Number(counts[k])
    return Array.isArray(seg[k]) ? seg[k].length : 0
  }
  const list = Array.isArray(seg[active]) ? seg[active] : []
  const activeLabel = CUSTOMER_SEGMENT_LABELS[active] || active

  return (
    <div data-testid={testid} data-source={source} data-active-segment={active}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={BANNER_STYLE}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.
        </div>
      )}

      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Clientes</h1>
        <p style={{ fontSize: 12.5, color: C.textMuted, marginTop: 5, lineHeight: 1.5 }}>
          Segmentación de las paradas de hoy (gf.route.stop). Vista de solo lectura del resultado de cada visita.
        </p>
      </header>

      <SegmentChips activeSegment={active} onSelectSegment={onSelectSegment} countFor={countFor} />

      <section data-testid="clientes-list" aria-label={`Clientes — ${activeLabel}`} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '4px 16px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0 4px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: 0 }}>{activeLabel}</h2>
          <span data-testid="clientes-count" style={{ fontSize: 12, color: C.textMuted }}>
            {list.length} cliente{list.length === 1 ? '' : 's'}
          </span>
        </div>
        {list.length === 0 ? (
          <div data-testid="clientes-empty" style={{ fontSize: 13, color: C.textMuted, padding: '14px 0' }}>
            Sin clientes en el segmento «{activeLabel}» con los datos de hoy.
          </div>
        ) : (
          list.map((stop, i) => (
            <CustomerRow
              key={stop?.stop_id ?? stop?.customer_id ?? i}
              stop={stop}
              onOpenCustomer={onOpenCustomer}
            />
          ))
        )}
      </section>
    </div>
  )
}
