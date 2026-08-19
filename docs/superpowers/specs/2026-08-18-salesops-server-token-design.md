# SalesOps token en proxy de Vercel

## Objetivo

Permitir que las operaciones SalesOps de la PWA se autentiquen sin exponer ni
depender de `VITE_GF_SALESOPS_TOKEN` en el navegador.

## Problema confirmado

`/gf/salesops/warehouse/van_load/create_execute` exige `X-GF-Token`. La PWA
actual sólo puede enviarlo si el bundle contiene una variable `VITE_*` o si el
login guarda una copia de ese token. En producción el request no incluye ese
header, por lo que Odoo responde `UNAUTHORIZED` antes de validar el empleado.

## Diseño aprobado

1. Vercel reescribe exclusivamente `/odoo-api/gf/salesops/:proxyPath*` a una
   función interna `api/salesops.js`.
   La ruta de login `/api-odoo/employee-sign-in` se reescribe antes de la ruta
   genérica a `api/employee-sign-in.js`.
2. La función es un handler SalesOps dedicado; no reutiliza sin adaptar el
   proxy de `pwa-admin`, cuyo contrato es diferente. Sólo acepta
   `gf/salesops/<endpoint...>` y construye la URL desde
   `https://grupofrio-gf.odoo.com` con segmentos seguros y query serializado.
3. Sólo reenvía `Authorization`, `X-GF-Employee-Token`, `Accept` y un
   `Content-Type` JSON controlado. Nunca propaga por spread los headers del
   request, ni reenvía `X-GF-Token`, `Api-Key`, `Cookie`, `Host` o
   `X-Forwarded-*`. Añade siempre `X-GF-Token` desde
   `process.env.GF_SALESOPS_TOKEN`, sustituyendo cualquier valor del cliente.
4. Exige un `X-GF-Employee-Token` no vacío (401) y un secreto de servidor no
   vacío (503) antes de contactar Odoo. Las rutas inválidas, vacías o fuera de
   SalesOps son 404 y los métodos no permitidos son 405.
5. La PWA deja de crear o requerir `X-GF-Token` en `src/lib/api.js`, y el login
   deja de proyectar `gf_salesops_token`/`salesops_api_token` a `localStorage`.
   El navegador conserva `Authorization` y `X-GF-Employee-Token`.
6. Se eliminan `getSessionSalesOpsToken`, `getSalesOpsTokenMeta`,
   `selectSalesOpsToken` y la prevalidación de token de
   `pt/transfer/orchestrate`.
7. `VITE_GF_SALESOPS_TOKEN` y referencias de sesión se eliminan de
   `.env.example`, pruebas y manuales. En Vercel se configura
   `GF_SALESOPS_TOKEN` sólo para Production (y Preview sólo si se requiere
   probar contra una instancia no productiva compatible).
8. El relay de login permite sólo POST JSON hacia el endpoint fijo
   `/api/employee-sign-in` de Odoo. Para respuestas JSON elimina
   `gf_salesops_token`, `salesops_api_token` y `x_gf_token` tanto del objeto
   de resultado como de su posible envelope JSON-RPC. Sólo reenvía respuestas
   JSON válidas; para content type inesperado o JSON inválido falla cerrado con
   un 502 genérico, sin body ni headers upstream. Siempre responde con
   `Cache-Control: no-store` y sólo un `Content-Type: application/json`
   controlado. Así el secreto tampoco se serializa en la respuesta de login,
   aun si Odoo continúa enviándolo.

## Seguridad

- El secreto nunca se serializa en el bundle, respuesta, logs ni error.
- La función sólo es ruta de paso para SalesOps, no un proxy abierto, y
  requiere identidad de empleado antes de usar el secreto compartido.
- El cliente no puede reemplazar el token inyectado con su propio header.
- Los tokens de empleado siguen siendo responsabilidad del backend.

## Verificación

- Prueba unitaria: el handler reenvía `Authorization` y
  `X-GF-Employee-Token`, inyecta el secreto server-side y elimina/reemplaza
  `X-GF-Token` y `Api-Key` enviados por cliente.
- Prueba unitaria: rechaza token de empleado o secreto faltantes, método no
  permitido, y rutas vacías, inválidas, con path traversal o fuera de
  `gf/salesops`.
- Prueba unitaria: preserva query, body JSON, status y content type upstream,
  añade `Cache-Control: no-store` y no filtra el secreto a headers, body o
  errores.
- Prueba de configuración: la reescritura precede a la reescritura genérica de
  `/odoo-api` y la de login a la genérica `/api-odoo`.
- Pruebas de cliente: toda llamada actual de `/odoo-api/gf/salesops/*`, incluida
  carga manual y PT, conserva su payload/identidad pero ya no contiene
  `X-GF-Token`.
- Prueba de relay: la respuesta de `employee-sign-in` visible para el navegador
  no contiene ninguna de las variantes de token SalesOps.
- Prueba de relay: body no JSON o JSON malformado upstream que contenga un
  marcador de token produce 502 genérico y el marcador no llega al navegador.
- Prueba de relay: las respuestas exitosas y de error incluyen
  `Cache-Control: no-store` y un content type controlado.
- Build de Vite y pruebas focalizadas del proxy.
