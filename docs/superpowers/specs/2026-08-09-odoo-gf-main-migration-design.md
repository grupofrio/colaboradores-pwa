# Migración completa a Odoo GF Main

## Objetivo

Mover todos los destinos configurables de la PWA desde la instancia Odoo anterior a:

- URL: `https://grupofrio-gf.odoo.com`
- Base de datos: `grupofrio-gf-main-34980678`

La migración es directa: no se conservará un fallback automático al destino anterior.

## Alcance

### PWA y despliegue

- Actualizar `VITE_ODOO_URL` en las plantillas de entorno y en la configuración local activa.
- Actualizar los rewrites de Vercel para que `/odoo-api/*` y `/api-odoo/*` lleguen al nuevo dominio.
- Actualizar documentación y valores por defecto de scripts que todavía nombren el dominio anterior.

### Flujos con XML-RPC

El frontend no usa el identificador de base directamente. Los scripts y workflows de n8n sí usan `ODOO_DB`; se documentará el valor nuevo y se actualizarán las configuraciones versionadas que correspondan.

Las instalaciones ya desplegadas de n8n no son administradas por este repositorio. Después del cambio de código, sus variables reales deben quedar así:

```text
ODOO_URL=https://grupofrio-gf.odoo.com
ODOO_DB=grupofrio-gf-main-34980678
```

## Fuera de alcance

- No se copian datos ni se modifica PostgreSQL directamente.
- No se cambian, muestran ni registran credenciales.
- No se crea un modo de doble escritura ni fallback al Odoo anterior.
- No se cambia la lógica de autenticación, los tokens ni los contratos de API.

## Flujo resultante

```text
PWA local  -> Vite proxy   -> grupofrio-gf.odoo.com
PWA Vercel -> /odoo-api/*  -> grupofrio-gf.odoo.com
n8n        -> XML-RPC      -> grupofrio-gf.odoo.com (db: grupofrio-gf-main-34980678)
```

## Manejo de errores y reversión

- Si el nuevo Odoo no expone un endpoint, la PWA mostrará el error existente; no hará solicitudes al destino anterior.
- La reversión, si fuese indispensable, consiste en restaurar la URL y la base anteriores en los mismos puntos de configuración y volver a desplegar. No se hará automáticamente.

## Validación

1. Buscar que no queden referencias operativas a `grupofrio.odoo.com` o a la base anterior en configuración activa.
2. Ejecutar la suite de pruebas y el build de producción.
3. Revisar que los rewrites de Vercel generados apunten al dominio nuevo.
4. Tras desplegar, validar manualmente inicio de sesión y una lectura/escritura no crítica en la nueva instancia.
5. Cambiar `ODOO_URL` y `ODOO_DB` en los entornos reales de n8n, y ejecutar su preflight con credenciales autorizadas.
