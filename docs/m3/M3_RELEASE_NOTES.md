# M3 — Release notes v1 (superficie "Ejecución de rutas")

**PRs**: frontend `feat/kold-os-m3-route-execution` (este) + backend
**GrupoVeniu/GrupoFrio #202** (`gf_kold_os_m3`). Ambos DRAFT.

## ⚠️ ORDEN DE LIBERACIÓN

1. Backend **#202** (revisión Sebastián → merge → deploy con flag OFF).
2. Auditor real en odoo-shell + ingesta del run (runbook del backend).
3. Flag `gf_kold_os.m3.enabled` ON (S/N).
4. **Este PR** (después del rebase que corresponda — ver abajo).
Sin backend, la superficie muestra UNAVAILABLE honesto; jamás datos falsos.

**Convivencia con #67/#68 (NO mergeados):** este PR se desarrolló DESDE MAIN
(no se rebasa sobre ramas sin merge) y toca los mismos puntos session-aware
(registry/navModel/ScreenHome/App/api) con los MISMOS nombres de función que
#67/#68 a propósito ⇒ cuando esos PRs se integren, el rebase de éste es una
unión mecánica (tower + m2 + m3 en las mismas funciones; conservar las tres
entradas del registry y los tres handlers). Dependencia de ORDEN, no técnica.

## Nuevo
- Módulo **`ejecucion`** ("Ejecución de rutas", `/ejecucion`) con
  `accessPolicy:'m3'`: tarjeta+nav+clic+ruta con una sola autoridad
  (`readM3Access`: direccion_general / admin_plataforma; chofer/jefe_ruta/
  supervisor_ventas/gerente = sin acceso v1, Fase 10).
- Superficie ejecutiva con **14 KPIs de una-entidad-cada-uno** (incluye
  cumplimiento de visita 29.35% real y offline "—" honesto), **8 bloques**
  canónicos con sucursales afectadas cuando la dimensión es real, "Detalle de
  regla" con badges de granularidad (AGREGADO/SUCURSAL) y columna sucursal,
  panel con lifecycle real gateado (≥2 corridas), 4 exports endurecidos
  (CSV anti-inyección, JSON evidencia, resumen, **plan vs real**).
- Cliente autenticado sobre `api()` (GET-only, sin n8n, timeout, límite,
  401/403/404/409/503/5xx, cero persistencia) + contrato `kold.os.m3.api/1`
  con schema_version explícito y granularidad validada en ambas direcciones.
- Demo `?demo=1` SOLO DEV/`VITE_ENABLE_M3_DEMO` con fixture de código real y
  números REALES de producción (procedencia declarada).

## Estado real de los datos al liberar
Auditor **PASS** · ejecución **RED**: 20 reglas rojas · 7 ámbar · 22,030
incidencias (171/352 rutas sin cerrar, 204/204 cajas abiertas, 100% no-ventas
sin motivo, 71.7% visitas <1 min…). Resultado esperado del observatorio.

## Sin cambios
PR #67/#68/#201/#202 (intactos) · Tower/TowerRoute · Planeación M2 · Odoo
productivo (cero writes) · `public/`.
