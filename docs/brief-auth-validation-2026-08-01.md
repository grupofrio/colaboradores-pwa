# Validación de autorización — Briefs n8n

Fecha: 2026-08-01  
Ámbito: `brief-aida`, `brief-produccion`, `brief-gerencia`

## Diseño activo

Los tres webhooks usan el workflow interno reutilizable `W_BRIEF_AUTH_GATE — Odoo employee token [SHARED]`.

- La única credencial aceptada es `X-GF-Employee-Token`.
- El guard valida la sesión activa en Odoo y deriva del servidor el empleado y `hr.job.x_job_key`.
- No se aceptan como autoridad `employee_id`, rol, compañía ni sucursal enviados por el cliente.
- El token se elimina del objeto de trabajo antes de continuar.
- Los workflows no guardan ejecuciones exitosas ni fallidas.
- El guard solo permite llamadas desde los tres workflows de brief configurados.

| Endpoint | Roles autorizados | Scope operativo |
| --- | --- | --- |
| `brief-aida` | `supervisor_ventas`, `direccion_general` | Branch 29 |
| `brief-produccion` | `supervisor_produccion`, `direccion_general` | Branch 26 |
| `brief-gerencia` | Ninguno por ahora | Deny-all hasta mapeo explícito aprobado |

## Matriz ejecutada

No se registraron PINs, barcodes ni tokens durante la prueba.

| Caso | Resultado esperado | Resultado |
| --- | --- | --- |
| Aida (`supervisor_ventas`) → `brief-aida` | `200 text/html` | `200 text/html`, 32,283 bytes |
| Miguel (`supervisor_produccion`) → `brief-produccion` | `200 text/html` | `200 text/html`, 10,766 bytes |
| Aida → `brief-produccion` | `403` | `403 role not allowed` |
| Miguel → `brief-aida` | `403` | `403 role not allowed` |
| Aida → `brief-gerencia` | `403` | `403 role not allowed` |
| Miguel → `brief-gerencia` | `403` | `403 role not allowed` |
| Aida → producción con `employee_id`, rol y sucursal falsos en query | `403` | `403 role not allowed` |
| Sin `X-GF-Employee-Token` | `401` | `401 missing employee token` |
| Token inválido | `401` | `401 invalid or expired token` |

## Criterios de liberación

- HTML únicamente después de una autorización válida.
- `401` para token ausente, vencido, revocado o inválido.
- `403` para una sesión válida sin allowlist del endpoint.
- Gerencia permanece cerrada hasta que exista un mapeo aprobado.
