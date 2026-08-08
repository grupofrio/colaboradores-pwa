// ─── ScreenClientesRecuperacion — Inactivos + por recuperar (escopado a sucursal)
// Fuente: endpoint V2 token-only `/pwa-supv/customers-recovery` (backend #275).
// Reemplaza al listado viejo `/pwa-supv/customers/{recovery,inactive}`, que era
// de COMPAÑÍA (el cliente mandaba la razón social) y mostraba clientes de TODAS
// las plazas — 128/225 vs 14/15 reales de Iguala. Aquí el alcance sale del TOKEN.
//
// ACCIÓN: "Agregar a mañana" abre un selector con los planes de mañana que YA
// existen (routes-week → tomorrow.plan_id) y agrega el cliente al que elija la
// supervisora (route_plan/add_customer). La escritura está tras write-flags: si
// están OFF, el server responde y el modal lo dice sin fingir éxito.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { getTypo } from '../../tokens'
// Tema CLARO (rebranding tanda 3): estas pantallas solo se montan bajo rutas
// moduleId="supervisor_ventas"; el invariante lo verifica brandTokensScope.
import { BRAND_TOKENS as TOKENS } from '../../theme/brandTokens'
import { Loader, EmptyState, ErrorState } from '../../components/Loader'
import { useToast } from '../../components/Toast'
import { getBranchRecovery, getRoutesWeek, addCustomerToRoutePlan } from './api'
import {
  KIND_RECOVERY, KIND_INACTIVE, unwrapRecovery, recoveryUnavailable, recoveryCustomers,
  daysLabel, tomorrowPlanOptions, planOptionSubtitle, addResultMessage,
} from './recuperacionModel'
import { logScreenError } from '../shared/logScreenError'

const PAGE_SIZE = 20

const UNAVAILABLE_TEXT = {
  sin_fuente: 'Esta sucursal aún no tiene el tablero de puntaje de clientes, así que no hay lista que mostrar.',
}

export default function ScreenClientesRecuperacion() {
  useSession() // mantiene la pantalla bajo sesión; el alcance lo pone el token
  const navigate = useNavigate()
  const toast = useToast()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const typo = useMemo(() => getTypo(sw), [sw])

  const [kind, setKind] = useState(KIND_RECOVERY)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('loading') // loading | ready | unavailable | error
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null) // cliente elegido para "agregar a mañana"

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const load = useCallback(() => {
    let cancelled = false
    setPhase('loading'); setError(''); setReason('')
    getBranchRecovery({ kind, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (cancelled) return
        const payload = unwrapRecovery(res)
        if (!payload) { setPhase('error'); setError(String((res && res.code) || 'RESPUESTA_INVALIDA')); return }
        const un = recoveryUnavailable(payload)
        if (un) { setPhase('unavailable'); setReason(un); return }
        setItems(recoveryCustomers(payload))
        setTotal(Number(payload.total || 0))
        setPhase('ready')
      })
      .catch((e) => {
        if (cancelled) return
        logScreenError('ScreenClientesRecuperacion', 'load', e)
        setPhase('error'); setError(e?.message || 'Error al cargar clientes')
      })
    return () => { cancelled = true }
  }, [kind, offset])

  useEffect(() => load(), [load])
  useEffect(() => { setOffset(0) }, [kind])

  const hasMore = (offset + items.length) < total
  const hasPrev = offset > 0

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`button { border: none; background: none; cursor: pointer; }`}</style>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button onClick={() => navigate('/equipo')} aria-label="Volver" style={{
            width: 38, height: 38, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TOKENS.colors.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ ...typo.title, color: TOKENS.colors.textSoft, flex: 1 }}>Gestión comercial</span>
        </div>

        {/* Tabs = kind del endpoint */}
        <div style={{
          display: 'inline-flex', gap: 4, padding: 4, borderRadius: TOKENS.radius.md,
          background: TOKENS.colors.surfaceSoft, border: `1px solid ${TOKENS.colors.border}`, marginBottom: 12,
        }}>
          {[
            { id: KIND_RECOVERY, label: 'Por recuperar' },
            { id: KIND_INACTIVE, label: 'Inactivos (+60d)' },
          ].map((t) => {
            const active = kind === t.id
            return (
              <button key={t.id} data-testid="rec-tab" data-active={active ? '1' : undefined}
                onClick={() => setKind(t.id)} style={{
                  padding: '8px 14px', borderRadius: TOKENS.radius.sm,
                  background: active ? `${TOKENS.colors.blue2}22` : 'transparent',
                  border: `1px solid ${active ? TOKENS.colors.blue2 : 'transparent'}`,
                  fontSize: 12, fontWeight: 700,
                  color: active ? TOKENS.colors.text : TOKENS.colors.textMuted,
                }}>{t.label}</button>
            )
          })}
        </div>

        {phase === 'loading' ? (
          <Loader tokens={TOKENS} label="Cargando clientes…" />
        ) : phase === 'error' ? (
          <ErrorState tokens={TOKENS} message={`El servidor respondió ${error}.`} onRetry={load} />
        ) : phase === 'unavailable' ? (
          <EmptyState tokens={TOKENS} icon="🗂️" title="Aún no disponible"
            subtitle={UNAVAILABLE_TEXT[reason] || `No se puede calcular ahora (${reason}).`} />
        ) : items.length === 0 ? (
          <EmptyState tokens={TOKENS}
            icon={kind === KIND_INACTIVE ? '🗓️' : '🔄'}
            title={kind === KIND_INACTIVE ? 'Sin clientes inactivos' : 'Sin clientes por recuperar'}
            subtitle={kind === KIND_INACTIVE
              ? 'Ningún cliente de tu sucursal supera 60 días sin comprar.'
              : 'No hay clientes marcados para recuperación en tu sucursal.'} />
        ) : (
          <>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '0 0 10px' }}>
              {total} {total === 1 ? 'cliente' : 'clientes'} de tu sucursal · página {Math.floor(offset / PAGE_SIZE) + 1}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((c, i) => (
                <CustomerCard key={c.partner_id ?? i} customer={c} typo={typo}
                  onAdd={() => setTarget(c)} />
              ))}
            </div>

            {(hasPrev || hasMore) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <PagerButton label="← Anterior" enabled={hasPrev} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} />
                <PagerButton label="Siguiente →" enabled={hasMore} onClick={() => setOffset(offset + PAGE_SIZE)} />
              </div>
            )}
          </>
        )}

        <div style={{ height: 40 }} />
      </div>

      {target && (
        <AddToPlanModal
          customer={target}
          onClose={() => setTarget(null)}
          onDone={(msg) => {
            setTarget(null)
            if (msg.tone === 'ok') { toast.success(msg.text); load() } else { toast.error(msg.text) }
          }}
        />
      )}
    </div>
  )
}

function PagerButton({ label, enabled, onClick }) {
  return (
    <button onClick={onClick} disabled={!enabled} style={{
      flex: 1, padding: '10px 0', borderRadius: TOKENS.radius.md,
      background: enabled ? TOKENS.colors.surface : TOKENS.colors.surfaceSoft,
      border: `1px solid ${TOKENS.colors.border}`,
      color: enabled ? TOKENS.colors.textSoft : TOKENS.colors.textMuted,
      fontSize: 12, fontWeight: 600, cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.5,
    }}>{label}</button>
  )
}

function CustomerCard({ customer, typo, onAdd }) {
  const name = customer.name || `Cliente #${customer.partner_id}`
  const days = Number(customer.days_since_last_order || 0)
  const dlabel = daysLabel(customer)
  return (
    <div data-testid="rec-card" style={{
      padding: 12, borderRadius: TOKENS.radius.md,
      background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
      display: 'grid', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ ...typo.body, margin: 0, fontWeight: 700, color: TOKENS.colors.text }}>{name}</p>
        {dlabel && (
          <span style={{
            padding: '2px 8px', borderRadius: TOKENS.radius.pill, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
            background: days > 90 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            color: days > 90 ? '#b91c1c' : '#b45309',
          }}>{days} días</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: TOKENS.colors.textMuted }}>
        {customer.city && <span>📍 {customer.city}</span>}
        {customer.last_order_date && <span>📅 Última: {String(customer.last_order_date).slice(0, 10)}</span>}
      </div>
      <button data-testid="rec-add" onClick={onAdd} style={{
        justifySelf: 'start', padding: '8px 14px', borderRadius: TOKENS.radius.md, minHeight: 38,
        background: TOKENS.colors.blue, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
      }}>Agregar a mañana</button>
    </div>
  )
}

function AddToPlanModal({ customer, onClose, onDone }) {
  const [state, setState] = useState({ status: 'loading', options: [], error: null })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRoutesWeek()
      .then((res) => {
        if (cancelled) return
        setState({ status: 'ready', options: tomorrowPlanOptions(res), error: null })
      })
      .catch((e) => {
        if (cancelled) return
        logScreenError('AddToPlanModal', 'getRoutesWeek', e)
        setState({ status: 'error', options: [], error: String(e?.code || e?.message || e) })
      })
    return () => { cancelled = true }
  }, [])

  const pick = async (option) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await addCustomerToRoutePlan(option.plan_id, customer.partner_id)
      onDone(addResultMessage(res, customer.name))
    } catch (e) {
      logScreenError('AddToPlanModal', 'addCustomer', e)
      onDone({ tone: 'error', text: `No se pudo agregar (${String(e?.code || e?.message || 'error')}).` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" data-testid="rec-modal" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,42,61,0.45)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, background: TOKENS.colors.surface,
        borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '18px 16px calc(env(safe-area-inset-bottom) + 18px)',
        display: 'grid', gap: 12, maxHeight: '80dvh', overflowY: 'auto',
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: TOKENS.colors.text, margin: 0 }}>
            Agregar a un plan de mañana
          </h2>
          <p style={{ fontSize: 12.5, color: TOKENS.colors.textMuted, margin: '3px 0 0' }}>
            {customer.name || `Cliente #${customer.partner_id}`} — elige a qué ruta de mañana entra.
          </p>
        </div>

        {state.status === 'loading' && (
          <div style={{ fontSize: 13, color: TOKENS.colors.textMuted }}>Cargando los planes de mañana…</div>
        )}
        {state.status === 'error' && (
          <div style={{ fontSize: 13, color: '#b91c1c' }}>No se pudieron cargar los planes ({state.error}).</div>
        )}
        {state.status === 'ready' && state.options.length === 0 && (
          <div data-testid="rec-modal-empty" style={{ fontSize: 13, color: TOKENS.colors.textMuted, lineHeight: 1.5 }}>
            Todavía no hay planes de mañana armados. Arma primero las rutas en “Mis planes de mañana”
            y vuelve para agregar al cliente.
          </div>
        )}
        {state.status === 'ready' && state.options.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {state.options.map((o) => (
              <button key={o.plan_id} data-testid="rec-plan-option" disabled={saving}
                onClick={() => pick(o)} style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: TOKENS.radius.md,
                  border: `1px solid ${TOKENS.colors.border}`, background: TOKENS.colors.surfaceSoft,
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1, display: 'grid', gap: 2,
                }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: TOKENS.colors.text }}>{o.label}</span>
                <span style={{ fontSize: 11, color: TOKENS.colors.textMuted }}>{planOptionSubtitle(o)}</span>
              </button>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{
          justifySelf: 'stretch', padding: '11px 0', borderRadius: TOKENS.radius.md,
          border: `1px solid ${TOKENS.colors.border}`, background: 'transparent',
          color: TOKENS.colors.textSoft, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </div>
  )
}
