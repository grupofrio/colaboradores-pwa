# SUPERVISOR_PILOT — plan de piloto del workspace operativo (rol supervisor_ventas)

**Sin identidad personal en este repo** (P13 del RED de Codex): la supervisora
piloto y su sucursal se identifican aquí solo como "la supervisora piloto" /
"la sucursal piloto". La evidencia de runtime (empleado, sucursal, membresía
única verificadas read-only) vive en el repo backend
(`gf_saleops/docs/SUPERVISOR_ROLE_SOURCE_OF_TRUTH.md`, PR
GrupoVeniu/GrupoFrio#220), no en artefactos de frontend. Los fixtures/golden de
este repo son 100 % sintéticos (BR-DEMO, ids 1001/2001/3001/4001, moneda de
prueba XTS, coordenadas oceánicas).

## Cadena de gates (cada uno con S/N propio)

1. Backend PR GrupoVeniu/GrupoFrio#220 → Codex → merge (S/N). Todos los flags
   quedan OFF (global y por sucursal; sin backfill).
2. Staging: tests Odoo (core+full registry) + **paridad de venta diaria**
   (receta exacta en el contrato: fecha+branch+plan_ids congelados, total
   esperado por moneda, tolerancia 0, evidencia reproducible, SIN credenciales
   embebidas) + **performance** (p95 < 1.5 s objetivo — PERFORMANCE_PENDING
   hasta medir).
3. #78 y #79 mergean a main de colaboradores-pwa (gobernanza propia).
4. Rama frontend EJECUTABLE sobre el main nuevo, reconstruyendo sobre esta prep
   → PR DRAFT → Codex.
5. **S/N doble de exposición**: flag GLOBAL
   (`gf_salesops.supervisor_day_control.enabled`) **y** flag de LA sucursal
   piloto (`gf.ops.branch_config.supervisor_day_control_enabled`). "Solo la
   sucursal piloto" es realizable únicamente cuando AMBOS se enciendan con S/N
   posterior — este repo no activa ninguno.
6. QA autenticada con la sesión real de la supervisora piloto: Preview +
   dispositivo móvil real + desktop; estados error/stale/sin-GPS/backend OFF/
   fecha no permitida (radar).
7. Radar: S/N separado (flag global + branch de radar) + comunicación previa al
   equipo de campo (transparencia: la supervisión ve la última posición del
   dispositivo del responsable durante la jornada).
8. Piloto 2 semanas: feedback semanal; métrica de éxito = opera el día sin
   entrar a Odoo (rutas/salidas/avance/ventas/marcadores/cierres/caja).
9. Cierre de piloto → decisión de extensión a una segunda sucursal (validará
   multi-branch, hoy fail-closed a exactamente una).

## Qué NO hace el piloto

No enciende `gf_tower.m1.enabled` global · no activa acciones automáticas · no
muestra histórico GPS · no toca M2–M6 · no cambia permisos de otros roles · no
promete tiempo real.

## Rollback

Apagar flags (default OFF/false) · el perfil PWA conserva las rutas actuales
(`/equipo/*`) intactas debajo de la nueva navegación.
