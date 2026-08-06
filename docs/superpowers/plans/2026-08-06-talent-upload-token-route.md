# Ruta pública `/talent/upload/:token` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla pública (sin login) donde un candidato de Talento GF sube un documento sensible desde el link de un solo uso que le llega por WhatsApp.

**Architecture:** Nueva ruta fuera de `PrivateRoute` en la SPA existente. `talentUploadApi.js` son helpers puros (path building, mapeo de errores) sin depender de `lib/api.js` (god-object de 6500+ líneas — no le agregamos más). `ScreenTalentUpload.jsx` reusa `compressPhotoToBase64` de `vehiclePhotoCompressor.js` para fotos; NO reusa el componente `<PhotoCapture>` porque su upload interno apunta a `/pwa/evidence/upload` (endpoint autenticado, no aplica aquí).

**Tech Stack:** React 18 + React Router v6, `node --test` (Node 24, `node:test`/`node:assert/strict`) para los tests de lógica pura — igual que el resto del repo (`tests/*.test.mjs`, sin renderizar componentes).

**Spec:** `docs/superpowers/specs/2026-08-06-talent-upload-token-route-design.md` (commit `7ae9179`). Este plan cubre §4 (Frontend) del spec.

**Dependencia con el backend:** el endpoint `GET/POST /talent_bot/upload/<token>` que este plan consume se construye en el plan hermano `GrupoFrio/docs/superpowers/plans/2026-08-06-talent-upload-token-endpoint.md`. Los tests de este plan (Task 1) son lógica pura y no lo necesitan corriendo. La verificación manual end-to-end (Task 4) sí lo necesita desplegado en Odoo.sh DEV — hasta entonces, `npm run dev` proxea `/odoo-api/*` contra `grupofrio.odoo.com` real (ver `vite.config.js`), donde la ruta nueva todavía no existe, así que solo se puede confirmar el manejo de error (`server_error`), no el flujo feliz completo.

---

### Task 1: `talentUploadApi.js` — helpers puros (path, mapeo de errores, request)

**Files:**
- Create: `src/modules/talent/talentUploadApi.js`
- Test: `tests/talentUploadApi.test.mjs`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/talentUploadApi.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildUploadPath,
  mapUploadError,
  stripBase64Prefix,
} from '../src/modules/talent/talentUploadApi.js'

test('buildUploadPath arma /odoo-api/talent_bot/upload/:token', () => {
  assert.equal(buildUploadPath('abc123'), '/odoo-api/talent_bot/upload/abc123')
})

test('buildUploadPath url-encodes caracteres especiales del token', () => {
  assert.equal(buildUploadPath('a b/c'), '/odoo-api/talent_bot/upload/a%20b%2Fc')
})

test('mapUploadError mapea cada codigo del backend a un mensaje para el candidato', () => {
  assert.equal(mapUploadError('not_found'), 'Este link no es válido.')
  assert.equal(mapUploadError('already_received'), 'Ya recibimos este documento, gracias.')
  assert.equal(mapUploadError('expired'), 'Este link venció. Pide uno nuevo por WhatsApp.')
  assert.equal(mapUploadError('bad_file_type'), 'Solo fotos o PDF.')
  assert.equal(mapUploadError('file_too_large'), 'El archivo es muy grande. Intenta de nuevo.')
})

test('mapUploadError cae a un mensaje generico para codigos desconocidos', () => {
  assert.equal(mapUploadError('server_error'), 'Tuvimos un detalle técnico, intenta de nuevo.')
  assert.equal(mapUploadError('codigo_que_no_existe'), 'Tuvimos un detalle técnico, intenta de nuevo.')
})

test('stripBase64Prefix quita el prefijo data:...;base64, cuando esta presente', () => {
  assert.equal(stripBase64Prefix('data:application/pdf;base64,JVBERi0x'), 'JVBERi0x')
})

test('stripBase64Prefix deja el valor igual si no hay prefijo', () => {
  assert.equal(stripBase64Prefix('JVBERi0x'), 'JVBERi0x')
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/talentUploadApi.test.mjs`
Expected: falla — `Cannot find module '../src/modules/talent/talentUploadApi.js'`.

- [ ] **Step 3: Implementar**

Crear `src/modules/talent/talentUploadApi.js`:

```js
// ─── talentUploadApi — helpers puros para /talent_bot/upload/:token ───────
//
// Endpoint público (sin sesión, sin X-Talent-Bot-Key) del bot de Talento GF
// (P2.8B.1). Deliberadamente NO usa lib/api.js: ese helper está pensado para
// las familias autenticadas /pwa-*/ con headers de sesión, y es un
// god-object de 6500+ líneas al que el CLAUDE.md del repo pide no seguir
// agregando funcionalidad. Esta ruta es pública y no necesita nada de eso.

const ODOO_BASE = '/odoo-api' // mismo prefijo que lib/api.js — Vercel/vite proxean /odoo-api/* -> Odoo sin prefijo /api/

const ERROR_MESSAGES = {
  not_found: 'Este link no es válido.',
  already_received: 'Ya recibimos este documento, gracias.',
  expired: 'Este link venció. Pide uno nuevo por WhatsApp.',
  bad_file_type: 'Solo fotos o PDF.',
  file_too_large: 'El archivo es muy grande. Intenta de nuevo.',
  server_error: 'Tuvimos un detalle técnico, intenta de nuevo.',
}

export function buildUploadPath(token) {
  return `${ODOO_BASE}/talent_bot/upload/${encodeURIComponent(token)}`
}

export function mapUploadError(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.server_error
}

export function stripBase64Prefix(dataUrl) {
  if (typeof dataUrl === 'string' && dataUrl.includes(',')) {
    return dataUrl.split(',', 2)[1]
  }
  return dataUrl
}

export async function fetchUploadStatus(token) {
  const res = await fetch(buildUploadPath(token))
  return res.json()
}

export async function submitUploadFile(token, { base64, filename, mimeType }) {
  const res = await fetch(buildUploadPath(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_base64: base64,
      filename,
      mime_type: mimeType,
    }),
  })
  return res.json()
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node --test tests/talentUploadApi.test.mjs`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/talent/talentUploadApi.js tests/talentUploadApi.test.mjs
git commit -m "feat(talent): helpers puros para /talent_bot/upload/:token"
```

---

### Task 2: `ScreenTalentUpload.jsx` — pantalla pública (layout aprobado: cámara primero)

**Files:**
- Create: `src/modules/talent/ScreenTalentUpload.jsx`

- [ ] **Step 1: Implementar**

Crear `src/modules/talent/ScreenTalentUpload.jsx`:

```jsx
// ─── ScreenTalentUpload — carga pública de documento (Talento GF) ─────────
//
// Pantalla SIN sesión: el candidato la abre desde un link de WhatsApp de un
// solo uso. No usa PrivateRoute. Layout "cámara primero" (aprobado en el
// spec 2026-08-06-talent-upload-token-route-design.md): botón grande para
// tomar foto + opción secundaria para PDF/imagen desde el celular.
//
// No reusa <PhotoCapture> — ese componente sube directo a
// /pwa/evidence/upload (endpoint autenticado de colaborador), que no aplica
// a un candidato anónimo. Sí reusa compressPhotoToBase64 (función pura, sin
// acoplarse a nada de sesión).

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { compressPhotoToBase64 } from '../ruta/vehiclePhotoCompressor'
import {
  fetchUploadStatus,
  submitUploadFile,
  mapUploadError,
  stripBase64Prefix,
} from './talentUploadApi'

export default function ScreenTalentUpload() {
  const { token } = useParams()
  const [phase, setPhase] = useState('loading') // loading | error | ready | uploading | success
  const [docInfo, setDocInfo] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typo = getTypo(typeof window !== 'undefined' ? window.innerWidth : 375)

  useEffect(() => {
    let active = true
    async function loadStatus() {
      try {
        const out = await fetchUploadStatus(token)
        if (!active) return
        if (out?.ok) {
          setDocInfo({ label: out.doc_label, code: out.doc_code })
          setPhase('ready')
        } else {
          setErrorMessage(mapUploadError(out?.error))
          setPhase('error')
        }
      } catch {
        if (!active) return
        setErrorMessage(mapUploadError('server_error'))
        setPhase('error')
      }
    }
    loadStatus()
    return () => { active = false }
  }, [token])

  async function submit(base64, filename, mimeType) {
    try {
      const out = await submitUploadFile(token, { base64, filename, mimeType })
      if (out?.ok) {
        setPhase('success')
      } else {
        setErrorMessage(mapUploadError(out?.error))
        setPhase('ready')
      }
    } catch {
      setErrorMessage(mapUploadError('server_error'))
      setPhase('ready')
    }
  }

  async function handleImageFile(file) {
    setPhase('uploading')
    try {
      const { base64, filename } = await compressPhotoToBase64(file)
      await submit(base64, filename, 'image/jpeg')
    } catch (err) {
      setErrorMessage(err?.message || mapUploadError('bad_file_type'))
      setPhase('ready')
    }
  }

  function handlePdfOrImageFile(file) {
    if (!file) return
    if (file.type === 'application/pdf') {
      setPhase('uploading')
      const reader = new FileReader()
      reader.onload = () => submit(
        stripBase64Prefix(reader.result), file.name || 'documento.pdf', 'application/pdf')
      reader.onerror = () => {
        setErrorMessage(mapUploadError('bad_file_type'))
        setPhase('ready')
      }
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('image/')) {
      handleImageFile(file)
    } else {
      setErrorMessage(mapUploadError('bad_file_type'))
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: TOKENS.colors.bg0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 20px', fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ ...typo.overline, color: TOKENS.colors.textLow, marginBottom: 18 }}>
        GRUPO FRÍO · TALENTO
      </div>

      {phase === 'loading' && (
        <p style={{ ...typo.body, color: TOKENS.colors.textMuted }}>Cargando...</p>
      )}

      {phase === 'error' && (
        <div style={{
          background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}`,
          borderRadius: TOKENS.radius.md, padding: 16, textAlign: 'center', maxWidth: 320,
        }}>
          <p style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {phase === 'success' && (
        <div style={{
          background: TOKENS.colors.successSoft, border: `1px solid ${TOKENS.colors.success}`,
          borderRadius: TOKENS.radius.md, padding: 20, textAlign: 'center', maxWidth: 320,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <p style={{ ...typo.title, color: TOKENS.colors.textSoft, margin: 0 }}>Recibido</p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 6 }}>
            RH va a validar tu documento. Ya puedes cerrar esta página.
          </p>
        </div>
      )}

      {(phase === 'ready' || phase === 'uploading') && docInfo && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{
            background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
            borderRadius: TOKENS.radius.lg, padding: 16, marginBottom: 14,
          }}>
            <div style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginBottom: 4 }}>
              Documento requerido
            </div>
            <div style={{ ...typo.title, color: TOKENS.colors.text }}>{docInfo.label}</div>
          </div>

          {errorMessage && (
            <p style={{ ...typo.caption, color: TOKENS.colors.error, marginBottom: 10 }}>
              {errorMessage}
            </p>
          )}

          <input
            ref={cameraInputRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) handleImageFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={phase === 'uploading'}
            style={{
              width: '100%', padding: '22px 16px', borderRadius: TOKENS.radius.md,
              background: 'linear-gradient(90deg,#15499B,#2B8FE0)', border: 'none',
              color: TOKENS.colors.text, fontSize: 15, fontWeight: 700, marginBottom: 10,
              opacity: phase === 'uploading' ? 0.6 : 1,
            }}
          >
            {phase === 'uploading' ? 'Subiendo...' : '📷 Tomar foto'}
          </button>

          <input
            ref={fileInputRef} type="file" accept="application/pdf,image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              handlePdfOrImageFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === 'uploading'}
            style={{
              width: '100%', padding: '14px', borderRadius: TOKENS.radius.md,
              background: 'transparent', border: `1px dashed ${TOKENS.colors.border}`,
              color: TOKENS.colors.textMuted, fontSize: 13,
            }}
          >
            o subir PDF / imagen desde el celular
          </button>

          <p style={{
            ...typo.caption, color: TOKENS.colors.textLow, textAlign: 'center', marginTop: 16,
          }}>
            Este link es de un solo uso.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que el proyecto sigue compilando**

Run: `npm run build`
Expected: build exitoso (`dist/` generado), sin errores de import/sintaxis. (Todavía no hay ninguna ruta que importe este archivo, así que Vite no lo incluye en el bundle — este build solo confirma que el JSX es válido si algo lo llegara a importar; el wiring real es el Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/modules/talent/ScreenTalentUpload.jsx
git commit -m "feat(talent): pantalla publica de carga de documento (layout camara primero)"
```

---

### Task 3: Ruta pública en `App.jsx`

**Files:**
- Modify: `src/App.jsx:21` (bloque de lazy imports)
- Modify: `src/App.jsx:414` (bloque de rutas, justo después de `/login`)

- [ ] **Step 1: Agregar el lazy import**

En `src/App.jsx`, después de la línea 21 (`const ScreenModuloPendiente = lazy(() => import('./screens/ScreenModuloPendiente'))`), agregar:

```js
// Talento GF — ruta pública, sin sesión (P2.8B.1)
const ScreenTalentUpload = lazy(() => import('./modules/talent/ScreenTalentUpload'))
```

- [ ] **Step 2: Agregar la ruta, fuera de `PrivateRoute`**

En `src/App.jsx:414`, la línea actual es:

```jsx
            <Route path="/login" element={session ? <Navigate to="/" replace /> : <ScreenLogin />} />
```

Agregar justo después (antes del comentario `{/* Generales */}`):

```jsx

            {/* Talento GF — pública, sin sesión (candidato anónimo vía WhatsApp) */}
            <Route path="/talent/upload/:token" element={<ScreenTalentUpload />} />
```

- [ ] **Step 3: Verificar que arranca y la ruta responde**

Run: `npm run dev` (en background o en otra terminal)

Abrir `http://localhost:5173/talent/upload/token-de-prueba` en el navegador.

Expected: la pantalla carga (fondo azul oscuro, "GRUPO FRÍO · TALENTO"), pasa a fase `error` con el mensaje "Tuvimos un detalle técnico, intenta de nuevo." — es lo correcto en este punto: el backend de `/talent_bot/upload/<token>` todavía no existe en `grupofrio.odoo.com` (ese es el plan hermano en `GrupoFrio`), así que el `fetch` real (vía el proxy de `vite.config.js`) recibe un 404 y cae al `catch`. Esto confirma que el manejo de error funciona sin crashear la pantalla.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(talent): wire /talent/upload/:token como ruta publica"
```

---

### Task 4: Verificación final local + nota de integración pendiente

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Suite completa de tests puros**

Run: `node --test tests/talentUploadApi.test.mjs`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 2: Build de producción completo**

Run: `npm run build`
Expected: build exitoso, sin warnings de import roto.

- [ ] **Step 3: Lint**

Run: `npm run lint` (revisar el script exacto en `package.json` si el nombre difiere)
Expected: sin errores nuevos en `src/modules/talent/` ni en `src/App.jsx`.

- [ ] **Step 4: Nota de integración pendiente (no es parte de este plan)**

El flujo feliz completo (token real emitido por `documents_upload_link`, subida real, `state='recibido'` en Odoo) solo se puede probar una vez que el plan hermano del backend (`GrupoFrio/docs/superpowers/plans/2026-08-06-talent-upload-token-endpoint.md`) esté desplegado en Odoo.sh DEV y `gf_recruitment.talent_bot_pwa_base_url` apunte al dominio de esta PWA. Hasta entonces, esta pantalla queda verificada en su manejo de errores y su build, no en su camino feliz.
