# Diseño: ruta pública `/talent/upload/:token` (Talento GF — P2.8B/P2.8C)

**Fecha:** 2026-08-06
**Repos afectados:** `GrupoVeniu/GrupoFrio` (backend Odoo, módulo `grupofrio_jobs`) y `sebascm0906/colaboradores-pwa` (frontend).

## 1. Contexto y propósito

El bot de Talento GF (P2.8B, `grupofrio_jobs/models/talent_bot.py`) ya emite, vía
`documents_upload_link`, un token de un solo uso (`gf_upload_token` /
`gf_upload_token_expiry` en `gf.recruitment.applicant.document`) y una URL
`https://<base>/talent/upload/<token>` para que el candidato suba un documento
sensible (INE, NSS, comprobante, etc.) sin que el archivo pase por WhatsApp.

Esa ruta **no existe todavía en ningún lado** (documentado como riesgo residual
R-12 en `grupofrio_jobs/docs/talent_bot_api_p2_8b/RESIDUAL_RISKS.md`) y tampoco
existe ningún endpoint público que resuelva el token — los 22 endpoints de
`/api/talent_bot/*` requieren el header `X-Talent-Bot-Key`, inútil para un
candidato anónimo abriendo un link desde su celular.

Este documento diseña las dos piezas que faltan: el endpoint público en Odoo
y la pantalla pública en la PWA. **No activa nada de P2.8D** (proveedor
WhatsApp, número, plantillas Meta) ni cambia el flag `talent_bot_enabled`
(sigue OFF en producción); es plomería adicional detrás de flags, igual que
el resto de P2.8B/C.

## 2. Arquitectura

```
n8n (autenticado)  ──►  POST /api/talent_bot/documents/upload_link
                         (ya existe)                    │
                         genera token + URL usando       ▼
                         gf_recruitment.talent_bot_pwa_base_url
                         (nuevo parámetro, cae a web.base.url si vacío)
                                                          │
Candidato (WhatsApp) ──► abre URL en su celular          ▼
                         https://<pwa>/talent/upload/<token>
                                                          │
                         PWA: ScreenTalentUpload (pública)▼
                         GET  /talent_bot/upload/<token>  (nuevo, público)
                         POST /talent_bot/upload/<token>  (nuevo, público)
                                                          │
                         Odoo: gf.recruitment.applicant.document
                         attachment + state='recibido' + actividad RH
```

La página vive **dentro de la misma SPA** de `colaboradores-pwa` (nueva ruta
sin `PrivateRoute`, primera pública del repo) — reutiliza `TOKENS`, el helper
`api()`/proxy de Vercel y el pipeline de build existente. Los listeners
globales de sesión en `App.jsx` (`gf:session-expired`, drift entre pestañas)
son no-ops cuando `session` es `null`, así que conviven sin conflicto.

## 3. Backend (Odoo, `grupofrio_jobs`)

### 3.1 Nuevo parámetro de configuración

`gf_recruitment.talent_bot_pwa_base_url` (Char, vacío por defecto) en
`data/config_parameters.xml`. Si está vacío, `documents_upload_link` sigue
usando `web.base.url` exactamente como hoy (no rompe nada en producción hasta
que alguien lo configure con la URL pública de la PWA).

### 3.2 Cambio en `models/talent_bot.py`

`documents_upload_link` resuelve la base así:

```python
base = (self.env['ir.config_parameter'].sudo()
        .get_param('gf_recruitment.talent_bot_pwa_base_url', '').strip()
        or self.env['ir.config_parameter'].sudo().get_param('web.base.url'))
```

### 3.3 Nuevo endpoint público en `controllers/talent_bot.py`

Sección nueva y claramente separada de las 22 rutas del bot (comentario
explícito: "sin API key — protegido solo por el token de un solo uso").

- **`GET /talent_bot/upload/<token>`** (`auth='public'`, `csrf=False`) —
  resuelve `token` contra `gf_upload_token`. No expone el nombre del
  candidato, solo el documento requerido:
  - No existe → `{ok:false, error:"not_found", safe_message}`
  - Línea con `state` en `('recibido','validado')` → `{ok:false,
    error:"already_received", safe_message}`
  - `gf_upload_token_expiry` pasado → `{ok:false, error:"expired",
    safe_message}`
  - Válido → `{ok:true, doc_label, doc_code, expires_at}`

- **`POST /talent_bot/upload/<token>`** (`auth='public'`, `csrf=False`) —
  body `{file_base64, filename, mime_type}`:
  - Repite las validaciones de estado/expiración del GET.
  - Valida `mime_type` ∈ `{image/jpeg, image/png, application/pdf}` → si no,
    `bad_file_type`.
  - Valida tamaño decodificado ≤ 10MB (`TALENT_UPLOAD_MAX_BYTES`) → si no,
    `file_too_large`.
  - Escribe `attachment` + `attachment_filename` en la línea, `state =
    'recibido'`, crea actividad RH (reutiliza el helper de
    `documents_mark_received`), emite evento `whatsapp_document_uploaded`
    (nuevo en `EVENT_TYPES` de `recruitment_event.py`).
  - **No borra el token** — el bloqueo de reintento lo da el `state` de la
    línea (ver §5), no la ausencia del token. Esto permite distinguir
    "ya lo subiste" de "el link nunca existió".
  - Excepción no prevista → `{ok:false, error:"server_error",
    safe_message}` (200, mismo patrón que el resto de la API); el token
    sigue vivo porque el estado no cambió, el candidato puede reintentar.

Este endpoint **no** pasa por `_guard()` (ese método exige la API key del
bot) — tiene su propia validación basada en el token.

## 4. Frontend (`colaboradores-pwa`)

### 4.1 Ruta nueva

`App.jsx`: `<Route path="/talent/upload/:token" element={<ScreenTalentUpload />} />`,
fuera de `PrivateRoute`.

### 4.2 `ScreenTalentUpload.jsx` (nuevo)

Layout aprobado: **cámara primero** (Opción A del mockup) — botón principal
"Tomar foto", botón secundario "subir PDF/imagen desde el celular".

1. Al montar: `GET /talent_bot/upload/:token` vía proxy `/odoo-api/*` de
   Vercel (este endpoint no lleva prefijo `/api/`, por eso `/odoo-api/*` y no
   `/api-odoo/*`). Muestra el documento pedido, o el estado de error
   correspondiente (expirado / ya recibido / inválido) con su mensaje.
2. "Tomar foto" → reusa `compressPhotoToBase64` de
   `src/modules/ruta/vehiclePhotoCompressor.js` (ya tolera cualquier cámara,
   comprime a ~500KB tipo). "Subir PDF/imagen" → `<input type="file"
   accept="application/pdf,image/*">`; si es PDF se manda tal cual en
   base64, si es imagen se comprime igual que la foto.
3. `POST /talent_bot/upload/:token` con `{file_base64, filename, mime_type}`.
4. Pantalla de éxito ("Recibido, RH lo va a validar"), sin opción de repetir
   (el servidor ya bloqueó el reintento vía `state`).

### 4.3 Mapeo de errores → mensaje (UI)

| `error` del backend | Mensaje en pantalla |
|---|---|
| `not_found` | "Este link no es válido." |
| `already_received` | "Ya recibimos este documento, gracias." |
| `expired` | "Este link venció. Pide uno nuevo por WhatsApp." |
| `bad_file_type` | "Solo fotos o PDF." |
| `file_too_large` | "El archivo es muy grande. Intenta de nuevo." |
| `server_error` / fallo de red | "Tuvimos un detalle técnico, intenta de nuevo." + botón reintentar |

## 5. Reglas de invalidación (resumen)

El bloqueo de reintento lo decide el **estado de la línea de documento**, no
la presencia del token: si `state` ya es `recibido`/`validado`, cualquier
GET/POST posterior con el mismo token responde `already_received`. El token
en sí solo se invalida por expiración natural (`gf_upload_token_expiry`,
1 hora, ya definido en P2.8B). Esto evita un mensaje confuso de "link
inválido" cuando en realidad el candidato ya completó la subida.

## 6. Testing

### 6.1 Backend (`grupofrio_jobs/tests/test_talent_upload_public.py`, `TransactionCase`)

- GET con token válido → devuelve `doc_label`/`doc_code`.
- GET con token inexistente → `not_found`.
- GET con token expirado → `expired`.
- POST exitoso → `attachment` seteado, `state='recibido'`, actividad RH
  creada, evento `whatsapp_document_uploaded` registrado.
- POST repetido tras éxito → `already_received`.
- POST con `mime_type` inválido → `bad_file_type`.
- POST con payload que excede `TALENT_UPLOAD_MAX_BYTES` → `file_too_large`.
- Smoke estático (extensión de `_p2_8b_smoke.py`): nueva ruta registrada,
  `py_compile` OK, sin fuga de PII en logs.

### 6.2 Frontend (`tests/talentUploadApi.test.mjs`, sigue el patrón real del
repo: `node --test`, lógica pura sin renderizar componentes)

- Forma del request POST: `token` en la URL (no en el body), `file_base64`
  sin prefijo `data:...;base64,`.
- Mapeo completo de cada código de error del backend a su mensaje de UI
  (tabla §4.3).

## 7. Fuera de alcance

- P2.8D (número de WhatsApp, BSP, plantillas Meta, credenciales n8n) — sigue
  bloqueado por decisión de negocio de Yamil.
- Reemplazar `web.base.url` por defecto en producción — el nuevo parámetro
  `talent_bot_pwa_base_url` queda vacío hasta que alguien lo configure
  explícitamente.
- Validación de autenticidad del documento (OCR, etc.) — el archivo queda en
  `recibido`, RH sigue validando manualmente como en el resto de P2.8B.
