// ─── Mi Brief del día — superficie embebida (Fase B) ─────────────────────────
// El brief NO se re-estiliza ni se re-implementa: n8n devuelve un documento HTML
// completo y autocontenido (dark dashboard, CSS y JS inline, sin dependencias
// externas) y aquí solo se monta.
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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../../App'
import { TOKENS } from '../../tokens'
import { Loader } from '../../components/Loader'
import StateScreen from '../../components/kold/StateScreen'
import { logScreenError } from '../shared/logScreenError'
import { fetchBriefHtml, BRIEF_STATE } from './briefApi'

const C = TOKENS.colors

// Copy por estado: qué pasó y qué puede hacer quien lo lee. Sin jerga, sin
// stack traces, sin "Unexpected token".
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
    title: 'Este brief no es para tu puesto',
    detail: 'Tu acceso es válido, pero el brief está reservado a supervisión de ventas y dirección.',
    tone: 'warning',
  },
  [BRIEF_STATE.UNAVAILABLE]: {
    title: 'No pudimos cargar tu brief',
    detail: 'Puede ser la conexión o que el servicio esté momentáneamente fuera. Vuelve a intentar en un momento.',
    tone: 'error',
  },
}

export default function ScreenBriefDia() {
  const { session } = useSession()
  const [status, setStatus] = useState('loading') // loading | ok | <BRIEF_STATE>
  const [html, setHtml] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const abortRef = useRef(null)

  useEffect(() => {
    let alive = true
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    abortRef.current = controller
    setStatus('loading')

    fetchBriefHtml({ session, signal: controller?.signal })
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
        logScreenError('ScreenBriefDia', 'fetchBriefHtml', `${result.state}/${result.reason}/${result.status}`)
      })
      .catch((err) => {
        if (!alive) return
        setHtml('')
        setStatus(BRIEF_STATE.UNAVAILABLE)
        logScreenError('ScreenBriefDia', 'fetchBriefHtml', err)
      })

    return () => {
      alive = false
      controller?.abort()
    }
  }, [session, reloadKey])

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  return (
    <div style={{ padding: '16px 14px 24px', maxWidth: 1180, margin: '0 auto' }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>
            Mi Brief del día
          </h1>
          <div style={{ fontSize: 12, color: C.textLow, marginTop: 3 }}>
            Rutas y ventas de tu sucursal
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          data-testid="brief-reload"
          style={{
            cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: '8px 16px',
            borderRadius: TOKENS.radius.pill, background: 'transparent',
            color: C.blue3, border: `1px solid ${C.borderBlue}`,
          }}
        >
          Actualizar
        </button>
      </header>

      {status === 'loading' && <Loader label="Preparando tu brief…" />}

      {status === 'ok' && (
        <iframe
          key={reloadKey}
          data-testid="brief-frame"
          title="Brief del día"
          srcDoc={html}
          sandbox="allow-scripts"
          style={{
            width: '100%', height: 'calc(100dvh - 210px)', minHeight: 460,
            border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md,
            background: C.bg0, display: 'block',
          }}
        />
      )}

      {status !== 'loading' && status !== 'ok' && (
        <StateScreen
          testid="brief-state"
          title={(STATE_COPY[status] || STATE_COPY[BRIEF_STATE.UNAVAILABLE]).title}
          detail={(STATE_COPY[status] || STATE_COPY[BRIEF_STATE.UNAVAILABLE]).detail}
          tone={(STATE_COPY[status] || STATE_COPY[BRIEF_STATE.UNAVAILABLE]).tone}
          actionLabel={status === BRIEF_STATE.UNAVAILABLE ? 'Reintentar' : null}
          onAction={status === BRIEF_STATE.UNAVAILABLE ? reload : null}
        />
      )}
    </div>
  )
}
