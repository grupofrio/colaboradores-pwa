// ─── BriefEmbedScreen — pantalla REUTILIZABLE de briefs embebidos ────────────
// Una sola pantalla para todas las variantes (ventas, producción, y las que
// vengan). Lo que cambia por variante vive en briefCatalog.js; aquí no hay nada
// específico de un rol ni de un endpoint.
//
// El brief NO se re-estiliza ni se re-implementa: n8n devuelve un documento HTML
// completo y autocontenido (CSS y JS inline, sin dependencias externas) y aquí
// solo se monta.
//
// POR QUÉ srcDoc Y NO <iframe src>:
//   1. Un `src` es una navegación del navegador: NO puede llevar el header
//      X-GF-Employee-Token, y sin ese header el endpoint (ya con candado) no
//      sabe quién pregunta. El fetch sí puede llevarlo.
//   2. vercel.json manda `X-Frame-Options: DENY` sobre `/(.*)`, así que un
//      iframe hacia /api-n8n/... se bloquearía a sí mismo. srcDoc no es una
//      navegación, así que no pasa por esa verificación.
//
// AISLAMIENTO: sandbox="allow-scripts" SIN allow-same-origin. El documento corre
// su JS (lo necesita para pintarse) pero queda en un origen opaco: no puede leer
// el localStorage de la PWA, ni su sesión, ni tocar el DOM de la app.
// NO agregar allow-same-origin: junto con allow-scripts anula el sandbox.
import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../App'
import { TOKENS } from '../../tokens'
import { Loader } from '../../components/Loader'
import StateScreen from '../../components/kold/StateScreen'
import { logScreenError } from '../shared/logScreenError'
import { fetchBriefHtml, isValidBriefDate, BRIEF_STATE } from './briefApi'
import { getBriefById, briefSupportsDate } from './briefCatalog'
import { BRAND_TOKENS } from '../../theme/brandTokens'
import { isGerenteBrandSurface } from '../../theme/gerenteBrandSurface.js'

// Copy por estado: qué pasó y qué puede hacer quien lo lee. Sin jerga, sin
// stack traces, sin "Unexpected token".
//
// 401 y 403 se mantienen SEPARADOS a propósito. Los dos son un "no" del backend,
// pero se resuelven distinto: el 401 se arregla volviendo a entrar; el 403 no se
// arregla con nada que la persona pueda hacer. Decirle "no tienes acceso" a quien
// solo se le venció la sesión la manda a pedir permisos que ya tiene.
//
// NINGUNO de los dos ofrece reintentar: el botón de reintento existe solo para
// UNAVAILABLE (red/5xx). Un 401/403 no se reintenta en bucle.
const STATE_COPY = {
  [BRIEF_STATE.BYPASS]: {
    title: 'Entra con tu PIN para ver el brief',
    detail: 'Estás en una sesión de acceso rápido (bypass), que no lleva credencial de empleado. El brief solo se abre con el acceso normal: tu PIN y tu código.',
    tone: 'warning',
  },
  [BRIEF_STATE.NO_SESSION]: {
    title: 'Tu sesión no tiene credencial de empleado',
    detail: 'Vuelve a entrar con tu PIN y tu código para que el sistema pueda confirmar quién eres.',
    tone: 'warning',
  },
  [BRIEF_STATE.UNAUTHORIZED]: {
    title: 'Tu sesión venció',
    detail: 'Por seguridad las sesiones caducan. Vuelve a entrar con tu PIN y tu código.',
    tone: 'warning',
  },
  [BRIEF_STATE.FORBIDDEN]: {
    title: 'No tienes acceso a este brief',
    detail: 'Tu sesión es válida, pero este brief está reservado a otros puestos. Si crees que sí te corresponde, repórtalo.',
    tone: 'warning',
  },
  [BRIEF_STATE.UNAVAILABLE]: {
    title: 'No pudimos cargar tu brief',
    detail: 'Puede ser la conexión o que el servicio esté momentáneamente fuera. Vuelve a intentar en un momento.',
    tone: 'error',
  },
}

// Hoy en la zona del dispositivo, como YYYY-MM-DD. Solo se usa como tope del
// selector: la semántica del día la decide el endpoint, no el cliente.
function localToday() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export default function BriefEmbedScreen({ briefId }) {
  const { session } = useSession()
  const brief = getBriefById(briefId)
  const withDate = briefSupportsDate(brief)
  // Contenedor brand-light para supervisor_ventas y gerente_sucursal (Mi Sucursal).
  // El documento del brief va dentro del iframe con su propio estilo y NO se toca.
  const brandLight = isGerenteBrandSurface(session)
  const light = brandLight
  const C = light ? BRAND_TOKENS.colors : TOKENS.colors
  // `StateScreen` ya acepta tokens y su default es el tema oscuro. Sin pasarlos,
  // en la cáscara clara el mensaje quedaba en blanco translúcido sobre fondo
  // claro: 1.07:1 medido, ilegible. Los demás roles no cambian.
  const stateTokens = light ? BRAND_TOKENS : TOKENS
  const [status, setStatus] = useState('loading') // loading | ok | <BRIEF_STATE>
  const [html, setHtml] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // '' = sin parámetro ⇒ el endpoint aplica su default ("ayer").
  const [date, setDate] = useState('')
  const [appliedDate, setAppliedDate] = useState('')

  useEffect(() => {
    let alive = true
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    setStatus('loading')

    fetchBriefHtml({ session, brief, date: appliedDate, signal: controller?.signal })
      .then((result) => {
        if (!alive) return
        if (result.state === BRIEF_STATE.OK) {
          setHtml(result.html)
          setStatus('ok')
          return
        }
        setHtml('')
        setStatus(result.state)
        // La razón técnica va a la consola, nunca a la cara del usuario.
        logScreenError('BriefEmbedScreen', `fetch:${briefId}`, `${result.state}/${result.reason}/${result.status}`)
      })
      .catch((err) => {
        if (!alive) return
        setHtml('')
        setStatus(BRIEF_STATE.UNAVAILABLE)
        logScreenError('BriefEmbedScreen', `fetch:${briefId}`, err)
      })

    return () => {
      alive = false
      controller?.abort()
    }
  }, [session, brief, briefId, appliedDate, reloadKey])

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  const onDateChange = useCallback((event) => {
    const value = event?.target?.value || ''
    setDate(value)
    // Solo se consulta con una fecha real; vaciar el campo vuelve al default.
    if (value === '' || isValidBriefDate(value)) setAppliedDate(value)
  }, [])

  if (!brief) {
    return (
      <div style={{ padding: '16px 14px 24px' }}>
        <StateScreen
          testid="brief-state"
          title={STATE_COPY[BRIEF_STATE.UNAVAILABLE].title}
          detail={STATE_COPY[BRIEF_STATE.UNAVAILABLE].detail}
          tone="error"
          tokens={stateTokens}
        />
      </div>
    )
  }

  const copy = STATE_COPY[status] || STATE_COPY[BRIEF_STATE.UNAVAILABLE]

  return (
    // FRANJAS NEGRAS EN ESCRITORIO: el fondo claro se pintaba en el MISMO nodo
    // que limita el ancho a 1180, así que en pantallas anchas solo llegaba hasta
    // ahí y a los lados asomaba el fondo oscuro de la app. Ahora el color va en
    // una capa exterior de ancho completo y el contenido sigue centrado dentro.
    <div
      data-theme={light ? 'brand-light' : undefined}
      data-testid="brief-surface"
      style={{
        width: '100%',
        ...(light ? { background: `linear-gradient(160deg, ${C.bg0} 0%, ${C.bg1} 55%, ${C.bg2} 100%)`, minHeight: '100dvh' } : null),
      }}
    >
    <div
      data-testid="brief-content"
      style={{ padding: '16px 14px 24px', maxWidth: 1180, margin: '0 auto' }}
    >
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>
            {brief.title}
          </h1>
          <div style={{ fontSize: 12, color: C.textLow, marginTop: 3 }}>
            {brief.subtitle}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {withDate && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
              Día
              <input
                type="date"
                value={date}
                max={localToday()}
                onChange={onDateChange}
                data-testid="brief-date"
                style={{
                  fontSize: 12.5, padding: '6px 10px', borderRadius: TOKENS.radius.sm,
                  background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                  colorScheme: light ? 'light' : 'dark',
                }}
              />
            </label>
          )}
          <button
            type="button"
            onClick={reload}
            data-testid="brief-reload"
            style={{
              cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: '8px 16px',
              borderRadius: TOKENS.radius.pill, background: 'transparent',
              color: light ? C.blue3 : C.blue3,
              border: `1px solid ${light ? C.borderBlue : C.borderBlue}`,
            }}
          >
            Actualizar
          </button>
        </div>
      </header>

      {status === 'loading' && <Loader label="Preparando tu brief…" />}

      {status === 'ok' && (
        <iframe
          key={`${briefId}:${appliedDate}:${reloadKey}`}
          data-testid="brief-frame"
          title={brief.title}
          srcDoc={html}
          sandbox="allow-scripts"
          style={{
            width: '100%', height: 'calc(100dvh - 210px)', minHeight: 460,
            border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md,
            // El documento del brief trae su propio fondo oscuro: el contenedor
            // solo aporta el color de reserva mientras pinta.
            background: light ? C.surface : C.bg0, display: 'block',
          }}
        />
      )}

      {status !== 'loading' && status !== 'ok' && (
        <StateScreen
          testid="brief-state"
          title={copy.title}
          detail={copy.detail}
          tone={copy.tone}
          actionLabel={status === BRIEF_STATE.UNAVAILABLE ? 'Reintentar' : null}
          onAction={status === BRIEF_STATE.UNAVAILABLE ? reload : null}
          tokens={stateTokens}
        />
      )}
    </div>
    </div>
  )
}
