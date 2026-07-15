# M2 — Limitaciones conocidas (v1, declaradas)

1. **Contrato agregado (la limitación madre).** El auditor v1 emite counts globales del scope
   (sin GROUP BY compañía/sucursal, sin IDs de registro). Consecuencias directas y honestas en la
   UI: "Sucursales: agregado global", `branches_affected: null`, `drilldown_route: null`, sin
   botón "Abrir registro en Odoo". Solución: extensión v1.1 del contrato
   (M2_DATA_CONTRACT §5) — lado auditor/Odoo, gate propio.

2. **Sin fuente publicada del run.** La base `/m2` no tiene nada desplegado (deliberado: publicar
   el run real como estático sin auth sería fuga de datos). Default = UNAVAILABLE honesto;
   revisión visual vía `?demo=1` (reconstrucción sanitizada). Publicación real = runbook §3 con
   autorización propia.

3. **Fixture = reconstrucción, no evidencia.** Reproduce exactamente los agregados REPORTADOS del
   run real; los desgloses internos (por estado/fuente) son reconstruidos y así se declara en
   `M2_FIXTURE_PROVENANCE` (con test que impide suplantar el hash de evidencia real).

4. **Historial de 1 corrida.** Lifecycle real (persistente/corregido/reincidente) y tendencias por
   bloque aparecen a partir de la 2ª corrida publicada. El motor ya lo soporta (testeado con
   historias sintéticas); falta el índice de corridas (v1.1 §5.4).

5. **3 reglas NOT_EVALUABLE** (territorio inválido/inactivo, vehículo inactivo/fuera de compañía):
   el contrato v1 no trae esos datos. Se muestran en gris con razón explícita — no se inventan.

6. **Umbrales v1 por ratificar.** 90/70 cobertura viene de la decisión D-A (RI); el resto
   (confianza 0.85/0.70, actual_kg 80/50, final 95/80, 7d solver, 3d snapshot) son defaults
   declarados pendientes de ratificación por dirección/planeación.

7. **Asimetría tarjeta/ruta para admin_plataforma puro.** La tarjeta es visible por x_job_key
   (`direccion_general`); un `admin_plataforma` sin ese x_job_key entra por URL pero no ve tarjeta.
   Unificación session-aware = después de que #67 (que introduce esa mecánica) esté en main.

8. **"Responsables de planeación/operativos" sin fuente autoritativa de rol** ⇒ no tienen acceso
   ni aparecen como dueños nominales (`owner_status=unassigned`). Alta de roles = decisión S/N.

9. **SLA no mostrado**: no existe SLA documentado por área; se muestra antigüedad
   (first_seen/last_seen) y quedará el hueco listo cuando se documente.

10. **Sin notificaciones/tareas** (explícitamente fuera de alcance v1): M2 no envía nada ni crea
    actividades. Cualquier automatización futura = fase aparte con gates.

## Riesgos

- **Conflicto trivial esperado en `registry.js` al convivir con #67** (ambos agregan un módulo).
  Mitigado: secciones no adyacentes; resolución = conservar ambas entradas. Regla de orden:
  **este PR se mergea DESPUÉS de #67**.
- **Deriva del contrato del auditor**: si Sebas cambia el shape del run, la PWA lo rechaza
  fail-closed (UNAVAILABLE) — comportamiento correcto pero visible; coordinar versiones vía
  `M2_DATA_CONTRACT` y el manifest_sha256.
- **Lectura del demo como dato vivo**: mitigado con banner DEMO permanente + procedencia + hash
  sintético distinto del real.
