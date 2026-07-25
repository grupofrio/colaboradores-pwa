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

1. Backend PR GrupoVeniu/GrupoFrio#220 fusionado. Todos los flags permanecen
   **OFF por default** (global y por sucursal; sin backfill).
2. Staging: tests Odoo (core+full registry) + **paridad de venta diaria**
   (receta exacta en el contrato: fecha+branch+plan_ids congelados, total
   esperado por moneda, tolerancia 0, evidencia reproducible, SIN credenciales
   embebidas) + **performance** (p95 < 1.5 s objetivo — PERFORMANCE_PENDING
   hasta medir).
3. #78 y #79 fusionados a `main` de colaboradores-pwa.
4. Fase 1 frontend implementada en PR #80 sobre esa línea base. La publicación
   no implica exposición: el fallback legado sigue gobernado por flags backend.
5. **S/N doble de exposición**: flag GLOBAL
   (`gf_salesops.supervisor_day_control.enabled`) **y** flag de LA sucursal
   piloto (`gf.ops.branch_config.supervisor_day_control_enabled`). "Solo la
   sucursal piloto" es realizable únicamente cuando AMBOS se enciendan con S/N
   posterior — este repo no activa ninguno.
6. QA autenticada obligatoria en ambos modos: **flags OFF** debe montar Control
   Comercial legado; **flags ON** debe montar Operación de hoy. Repetir en
   Preview, móvil real y desktop, incluyendo Hoy/Ayer, error/retry, empty,
   sin posición, multi-moneda y fecha no permitida.
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

## Estado de exposición

Este documento no afirma que staging o producción tengan flags activos. La
activación global y por sucursal requiere un S/N posterior y evidencia QA
OFF/ON. El repositorio frontend no cambia esos flags.

## Rollback

Apagar flags (default OFF/false) · el perfil PWA conserva las rutas actuales
(`/equipo/*`) intactas debajo de la nueva navegación.
