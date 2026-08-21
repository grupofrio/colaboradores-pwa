import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from '../../App'
import { TOKENS as DARK_TOKENS, getTypo } from '../../tokens'
import { BRAND_TOKENS as BRAND_TOKENS_LIGHT } from '../../theme/brandTokens'
import { isBrandLightSession } from '../../theme/useBrandPalette'
import { softWarehouse } from '../../lib/sessionGuards'
import { getPendingTransfers, acceptTransfer, rejectTransfer } from './entregasService'
import { getPtTransferActionTarget } from './ptTransferGuards'
import { getEntregasDestination, resolveLocalTransferByPicking } from '../almacen-pt/ptService'
import { ScreenShell, EmptyState } from './components'
import SessionErrorState from '../../components/SessionErrorState'

const TOKENS_LIGHT = BRAND_TOKENS_LIGHT

export default function ScreenRecibirPT() {
  const { session } = useSession()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const isLightSurface = session?.role === 'almacenista_entregas' || isBrandLightSession(session)
  const TOKENS = isLightSurface ? TOKENS_LIGHT : DARK_TOKENS

  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionStates, setActionStates] = useState({})
  const [dialog, setDialog] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState(null)
  const [fixedDestination, setFixedDestination] = useState(null)

  const sessionWarehouseId = softWarehouse(session)
  const warehouseId = fixedDestination?.id || sessionWarehouseId

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    let active = true
    getEntregasDestination()
      .then((dest) => { if (active && dest?.id) setFixedDestination(dest) })
      .catch(() => { if (active) setFixedDestination(null) })
    return () => { active = false }
  }, [])

  const loadData = useCallback(async () => {
    if (!warehouseId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await getPendingTransfers(warehouseId)
      setTransfers(Array.isArray(response) ? response : [])
    } catch (e) {
      if (e.message !== 'no_session') setError('Error al cargar transferencias')
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  useEffect(() => { loadData() }, [loadData])

  if (!warehouseId) {
    return <SessionErrorState error={{ missing: 'warehouse_id' }} backTo="/entregas" />
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function friendlyError(raw) {
    const text = typeof raw === 'string'
      ? raw
      : raw?.error_message || raw?.message || raw?.error || ''
    const normalized = String(text || '').toLowerCase()
    if (normalized.includes('stock') || normalized.includes('insuficien') || normalized.includes('disponib')) {
      return 'No hay stock suficiente en Planta para validar'
    }
    return text || 'Error al procesar transferencia'
  }

  async function handleAccept(picking) {
    const target = getPtTransferActionTarget(picking)
    const actionKey = target.action_id || target.picking_id || target.picking_name || picking?.id
    if (!target.action_id) {
      showToast('La transferencia no tiene un id valido para aceptar.', 'error')
      return
    }

    setActionStates((current) => ({ ...current, [actionKey]: 'accepting' }))
    try {
      const response = await acceptTransfer(target)
      if (response && response.ok === false) {
        showToast(`Error: ${friendlyError(response.data || response.error || response.message)}`, 'error')
        await loadData()
        return
      }

      if (target.picking_id) resolveLocalTransferByPicking(target.picking_id, 'accepted')
      const transferState = String(response?.data?.transfer_state || '').toLowerCase()
      const retryAfterSeconds = Number(response?.data?.retry_after || 0) || 0
      if (transferState === 'processing' || retryAfterSeconds > 0) {
        showToast(response?.message || 'Transferencia enviada a proceso')
        await loadData()
        if (retryAfterSeconds > 0) {
          window.setTimeout(() => {
            loadData().catch(() => {})
          }, retryAfterSeconds * 1000)
        }
        return
      }

      showToast(response?.message || 'Transferencia aceptada y picking validado')
      await loadData()
    } catch (e) {
      if (e.message === 'no_session') return
      showToast(`Error: ${friendlyError(e)}`, 'error')
    } finally {
      setActionStates((current) => {
        const next = { ...current }
        delete next[actionKey]
        return next
      })
    }
  }

  function openRejectDialog(picking) {
    setRejectReason('')
    setDialog({ type: 'reject', picking })
  }

  function closeDialog() {
    setDialog(null)
    setRejectReason('')
  }

  async function handleRejectConfirm() {
    if (!dialog || dialog.type !== 'reject') return
    const reason = rejectReason.trim()
    if (!reason) return

    const target = getPtTransferActionTarget(dialog.picking)
    const actionKey = target.action_id || target.picking_id || target.picking_name || dialog?.picking?.id
    if (!target.action_id) {
      showToast('La transferencia no tiene un id valido para rechazar.', 'error')
      return
    }

    closeDialog()
    setActionStates((current) => ({ ...current, [actionKey]: 'rejecting' }))
    try {
      const response = await rejectTransfer(target, reason)
      if (response && response.ok === false) {
        showToast(`Error: ${friendlyError(response.data || response.error || response.message)}`, 'error')
        await loadData()
        return
      }
      if (target.picking_id) resolveLocalTransferByPicking(target.picking_id, 'rejected')
      showToast(response?.message || 'Transferencia rechazada')
      await loadData()
    } catch (e) {
      if (e.message === 'no_session') return
      showToast(`Error: ${friendlyError(e)}`, 'error')
    } finally {
      setActionStates((current) => {
        const next = { ...current }
        delete next[actionKey]
        return next
      })
    }
  }

  function formatScheduled(value) {
    if (!value) return ''
    try {
      const date = new Date(value.replace(' ', 'T') + 'Z')
      return date.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return value
    }
  }

  return (
    <ScreenShell title="Recibir de PT" backTo="/entregas" tokens={TOKENS}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toast-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {!loading && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            padding: '10px 14px',
            borderRadius: TOKENS.radius.md,
            background: transfers.length > 0 ? TOKENS.colors.warningSoft : TOKENS.colors.surfaceSoft,
            border: `1px solid ${transfers.length > 0 ? 'rgba(245,158,11,0.2)' : TOKENS.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0 }}>Transferencias pendientes</p>
            <p style={{ ...typo.h2, color: transfers.length > 0 ? TOKENS.colors.warning : TOKENS.colors.textMuted, margin: 0 }}>{transfers.length}</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          margin: '0 0 12px',
          padding: 12,
          borderRadius: TOKENS.radius.sm,
          background: TOKENS.colors.errorSoft,
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <p style={{ ...typo.caption, color: TOKENS.colors.error, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{
            width: 32,
            height: 32,
            border: `2px solid ${TOKENS.colors.border}`,
            borderTop: `2px solid ${TOKENS.colors.blue}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : transfers.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Sin transferencias pendientes"
          subtitle="Las transferencias de Planta apareceran aqui cuando esten listas para recibir."
          typo={typo}
          tokens={TOKENS}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {transfers.map((picking) => {
            const target = getPtTransferActionTarget(picking)
            const actionKey = target.picking_id || target.picking_name || picking.id
            const state = actionStates[actionKey]
            const isBusy = !!state
            const moves = Array.isArray(picking.moves) ? picking.moves : []

            return (
              <div key={picking.id} style={{
                padding: 14,
                borderRadius: TOKENS.radius.xl,
                background: TOKENS.glass.panel,
                border: `1px solid ${TOKENS.colors.border}`,
                boxShadow: TOKENS.shadow.soft,
                opacity: isBusy ? 0.6 : 1,
                transition: `opacity ${TOKENS.motion.fast}`,
              }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0 }}>
                        {picking.name || `Picking #${picking.id}`}
                      </p>
                      {picking.origin && (
                        <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>
                          Origen: {picking.origin}
                        </p>
                      )}
                    </div>
                    {picking.state && (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: TOKENS.radius.pill,
                        background: TOKENS.colors.surface,
                        border: `1px solid ${TOKENS.colors.border}`,
                        fontSize: 10,
                        fontWeight: 700,
                        color: TOKENS.colors.textSoft,
                      }}>
                        {String(picking.state).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {picking.scheduled_date && (
                    <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '4px 0 0' }}>
                      Programado: {formatScheduled(picking.scheduled_date)}
                    </p>
                  )}
                  {(picking.location_src || picking.location_dest) && (
                    <p style={{ ...typo.caption, color: TOKENS.colors.textLow, margin: '2px 0 0' }}>
                      {picking.location_src || '?'} {'->'} {picking.location_dest || '?'}
                    </p>
                  )}
                </div>

                {moves.length > 0 && (
                  <div style={{
                    marginBottom: 10,
                    padding: 8,
                    borderRadius: TOKENS.radius.md,
                    background: TOKENS.colors.surfaceSoft,
                    border: `1px solid ${TOKENS.colors.border}`,
                  }}>
                    {moves.map((move, index) => (
                      <div key={move.id || index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 6px',
                        borderTop: index > 0 ? `1px solid ${TOKENS.colors.border}` : 'none',
                      }}>
                        <span style={{
                          ...typo.caption,
                          color: TOKENS.colors.textSoft,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {move.product_name || (Array.isArray(move.product_id) ? move.product_id[1] : `Producto ${move.product_id || index + 1}`)}
                        </span>
                        <span style={{ ...typo.caption, color: TOKENS.colors.text, fontWeight: 700, marginLeft: 8 }}>
                          {move.qty_demand ?? move.product_uom_qty ?? move.qty ?? '--'} {move.uom || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAccept(picking)}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: TOKENS.radius.md,
                      background: 'linear-gradient(90deg, rgba(34,197,94,0.18), rgba(34,197,94,0.10))',
                      border: '1px solid rgba(34,197,94,0.35)',
                      color: TOKENS.colors.success,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isBusy ? 'default' : 'pointer',
                    }}
                  >
                    {state === 'accepting' ? 'Aceptando...' : 'Aceptar'}
                  </button>
                  <button
                    onClick={() => openRejectDialog(picking)}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: TOKENS.radius.md,
                      background: 'linear-gradient(90deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))',
                      border: '1px solid rgba(239,68,68,0.30)',
                      color: TOKENS.colors.error,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isBusy ? 'default' : 'pointer',
                    }}
                  >
                    {state === 'rejecting' ? 'Rechazando...' : 'Rechazar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ height: 32 }} />

      {dialog?.type === 'reject' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={closeDialog}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 380,
              padding: 20,
              borderRadius: TOKENS.radius.xl,
              background: TOKENS.colors.surface,
              border: `1px solid ${TOKENS.colors.border}`,
              boxShadow: TOKENS.shadow.md,
            }}
          >
            <p style={{ ...typo.h2, color: TOKENS.colors.text, margin: '0 0 6px' }}>Rechazar transferencia</p>
            <p style={{ ...typo.body, color: TOKENS.colors.textMuted, margin: '0 0 14px' }}>
              {dialog.picking.name || `Picking #${dialog.picking.id}`}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo del rechazo (obligatorio)..."
              rows={3}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: TOKENS.radius.sm,
                background: TOKENS.colors.surface,
                border: `1px solid ${TOKENS.colors.border}`,
                color: TOKENS.colors.text,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={closeDialog}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: TOKENS.radius.md,
                  background: TOKENS.colors.surface,
                  border: `1px solid ${TOKENS.colors.border}`,
                  color: TOKENS.colors.textMuted,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim()}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: TOKENS.radius.md,
                  background: !rejectReason.trim()
                    ? 'rgba(239,68,68,0.08)'
                    : 'linear-gradient(90deg, rgba(239,68,68,0.25), rgba(239,68,68,0.15))',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: TOKENS.colors.error,
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: !rejectReason.trim() ? 0.4 : 1,
                  cursor: !rejectReason.trim() ? 'default' : 'pointer',
                }}
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1100,
          padding: '10px 20px',
          borderRadius: TOKENS.radius.pill,
          background: toast.type === 'error' ? 'rgba(239,68,68,0.92)' : 'rgba(34,197,94,0.92)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: TOKENS.shadow.md,
          animation: 'toast-in 0.25s ease',
          maxWidth: '90vw',
          textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}
    </ScreenShell>
  )
}
