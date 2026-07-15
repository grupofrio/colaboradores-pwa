# M2 — Limitaciones conocidas (v2, declaradas)

1. **Contrato agregado (limitación madre, del AUDITOR).** Las 13 queries no traen
   dimensión compañía/sucursal ni IDs de registro ⇒ `granularity:'aggregate'` con
   company/branch/entity **null por contrato** (la validación rechaza un aggregate con
   ids). Consecuencias honestas: "agregado del scope", sin "Detalle por registro", sin
   apertura en Odoo, filtros company/branch aceptados pero sin efecto hasta v1.1.
   Solución = extensión v1.1 del auditor (M2_DATA_CONTRACT §5), gate propio de Sebastián.

2. **La cadena de despliegue no está corrida.** PR #201 sin merge/deploy, flag OFF, cero
   runs ingeridos ⇒ producción mostraría hoy "Sin fuente de datos" (honesto). Los datos
   reales aparecen tras runbook §0 (deploy → ingesta → flag S/N). La UI jamás finge.

3. **Historial arranca en 1 corrida.** Persistencia/reincidencia/corregidos/tendencias
   aparecen con la 2ª ingesta real; la UI lo dice y no muestra conteos sintéticos.

4. **3 reglas NOT_EVALUABLE** (territorio inválido/inactivo, vehículo inactivo/fuera de
   compañía): sin dato en el contrato v1; gris con razón explícita.

5. **Umbrales v1 por ratificar** (salvo 90/70 heredado de RI D-A). Cambiarlos = editar el
   catálogo del BACKEND (una fuente), jamás la UI.

6. **"Incidencias detectadas" ≠ entidades únicas** — declarado en KPI, tooltip, resumen y
   contrato (`unique_records_available:false`). Dedupe real requiere IDs (v1.1).

7. **Roles "planeación/operativos" sin fuente autoritativa** ⇒ sin acceso y sin dueños
   nominales (`owner_status: unassigned`). Alta = S/N + una línea en ambas allowlists.

8. **SLA no documentado** ⇒ no se muestra; se muestra antigüedad (first/last_seen).

9. **Sin notificaciones/tareas** (fuera de alcance v1; cualquier automatización = fase
   aparte con gates).

10. **Timeout/abort del cliente**: el mecanismo canónico `api()` no acepta AbortSignal;
    M2 usa timeout duro (30 s) + descarte de resultados tardíos al desmontar (mismo
    patrón validado de Tower M1). Un AbortController de verdad exigiría tocar `api()`
    global (fuera de alcance de este PR).

## Riesgos

- **Rebase pendiente sobre main post-#67** (orden obligatorio): tocamos los mismos puntos
  session-aware que #67 (navModel/roleContext-o-navModel/ScreenHome/registry) con los
  MISMOS nombres de función a propósito — la resolución esperada es unión mecánica
  (tower + m2 en las mismas funciones; `getModuleEntryDecisionForSession` queda en un
  solo módulo y se reexporta). Plan detallado en el body del PR (Track F).
- **Deriva de contrato backend↔frontend**: mitigada con `schema_version` + capabilities +
  el fixture generado por el core real del backend como contract test compartido.
- **Doble catálogo eliminado**: el catálogo vive SOLO en el backend; la UI presenta lo
  que recibe (una fuente de verdad).
