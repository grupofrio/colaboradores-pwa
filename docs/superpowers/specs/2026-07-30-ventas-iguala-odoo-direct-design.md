# Ventas Iguala: Odoo directo y allowlist

## Objetivo

Corregir la PWA para que el historial de Ventas Iguala consulte el controlador
de Odoo ya mergeado, sin caer al webhook de n8n. Limitar el acceso en Odoo a
Angélica Jaimes Domínguez (`hr.employee` 717) y Aida Sugey Landa Jaimes
(`hr.employee` 718).

## Alcance

- Registrar únicamente `GET /pwa-admin/iguala-sales-history` como ruta directa
  en `src/lib/api.js`.
- Reenviar exclusivamente los parámetros que admite el contrato: `date_from`,
  `date_to`, `search`, `page` y `page_size`.
- Usar `odooHttp`, que conserva `Api-Key` y `X-GF-Employee-Token`; no llamar a
  n8n ni inferir alcance desde el cliente.
- Crear el parámetro Odoo `gf_pwa_admin.iguala_sales_employee_ids=717,718`.

## Fuera de alcance

- No registrar todavía `POST /pwa-admin/iguala-sales-tickets`: ese controlador
  no forma parte del backend mergeado.
- No modificar compañía, almacén, analítica ni empleados. Los dos perfiles ya
  están activos en GLACIEM, CEDIS Iguala y la analítica `IGU34`.

## Flujo

1. `ScreenVentasIguala` llama `api('GET', ...)`.
2. El handler directo identifica la ruta exacta y ejecuta `odooHttp` contra
   `/odoo-api/pwa-admin/iguala-sales-history`.
3. Odoo valida API key, token móvil y la allowlist; construye el alcance desde
   el empleado autenticado.
4. Si no hay órdenes válidas, la UI muestra el estado vacío. Si Odoo falla o
   niega acceso, la UI muestra el error correspondiente; nunca interpreta un
   fallback de n8n como lista vacía.

## Pruebas y validación

- Prueba unitaria que cubra la ruta directa y confirme que preserva los filtros
  permitidos.
- Ejecutar la suite Node de Ventas Iguala y la suite completa.
- Tras desplegar, revisar en Fetch/XHR que la URL sea
  `/odoo-api/pwa-admin/iguala-sales-history` y que el JSON tenga `orders`.
