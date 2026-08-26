# Autenticación `/pwa-admin/*` — qué protege Vercel y qué protege Odoo

Contrato canónico: `gf_pwa_admin/docs/PWA_ADMIN_AUTH.md` en el repo `grupofrio/gf`.

## Vercel (`api/_odooPwaProxy.js`)

- Exige que `X-GF-Employee-Token` exista (cadena no vacía).
- Inyecta la API key de servicio hacia Odoo.
- **No** resuelve `hr.employee` ni aplica capacidad, plaza, almacén o monto.

Presencia del encabezado no es autenticación.

## Odoo (`gf_pwa_admin`)

Cada ruta sensible `/pwa-admin/*` valida el token, resuelve al empleado y aplica
autorización de negocio. 401 si falta o es inválida la identidad; 403 si la
identidad es válida pero no tiene capacidad/scope.

El usuario técnico de la API key se registra aparte y no sustituye al
`hr.employee` que ejecutó la operación.

## Cliente PWA

Menú, tarjeta del hub y deep-link de Traspaso MP leen `BACKEND_CAPS.traspasoMp`
publicado por `GET /pwa-admin/capabilities`. Sin capacidades cargadas o con
`traspasoMp !== true`, la superficie no aparece. Eso anticipa al servidor; no
concede autoridad.
