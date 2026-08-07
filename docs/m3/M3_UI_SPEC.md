# M3 — Especificación de UI · "Ejecución de rutas" (/ejecucion)

## Navegación (Fase 11)
Tarjeta home + nav móvil (directa o en "Más") + rail desktop + estado activo,
todo derivado del registry (`id: ejecucion`, `navPriority: 14`, icono `ruta`,
tono `blueDeep`). `/ejecucion` NO está en la política nav-hidden (conserva la
nav global). Guard session-aware: tarjeta/nav/clic = `readM3Access`; URL
directa = `M3EjecucionRoute` (sin sesión → /login; sin permiso → /). No se
mezcla con Tower M1 (/torre) ni Planeación M2 (/planeacion — PR #68).

## Encabezado (Fase 12)
Título · badges READ-ONLY + `AUDITOR: <técnico>` + `DATOS: <operativo>` +
DEMO (si aplica) · corte, ventana, compañías, # consultas, fuente · hashes
truncados (run/manifest/evidencia/auditor) al pie de exports.

## KPIs (cada tarjeta cuenta UNA sola entidad)
Rutas operativas · publicadas nunca iniciadas · cerradas · **iniciadas sin
cerrar (vencidas)** · paradas planeadas activas · paradas visitadas ·
**cumplimiento de visita %** · ventas · no-ventas (tooltip: sin motivo) ·
conciliaciones pendientes · **cortes de caja abiertos** · **visitas fuera de
plan** · **Incidencias detectadas** (tooltip: NO entidades únicas) · eventos
offline pendientes = "—" con nota honesta (sin telemetría server v1).

## Bloques (Fase 13) — 8, en orden canónico
Asignación y arranque · Ejecución de paradas · Resultado comercial · Carga e
inventario · Incidentes · Cierre · Offline y sincronización · Plan vs real.
Cada uno: semáforo (peor regla), incidencias, conteos por estado, reglas con
valor observado, tendencia (solo con ≥2 corridas), **sucursales afectadas
cuando la dimensión es real** (hoy: bloque A → #1, #29), acceso al detalle.

## Detalle (Fase 14) — "Detalle de regla"
Filtros: categoría, **sucursal**, severidad, estado, ciclo de vida (deshabilitado
sin historial), **granularidad**, área responsable, búsqueda (+fechas vía
contrato). Tabla: estado · regla · hallazgo · **granularidad (badge)** ·
**sucursal** · entidad · observado · ciclo · área · última detección; paginada
server-side. Panel: explicación, observado vs esperado, incidencias,
sucursal/ruta (honesto por granularidad), ciclo de vida con corridas, primera/
última detección, área + owner_status, acción sugerida, fuente (modelo/query/
corte), evidencia (hashes/campos), detalle por registro (solo con entity_id),
"Copiar referencia". **Cero botones de corrección/cierre/cambio de estado.**

## Mapa y secuencia (Fase 15) — FUERA de v1 (decisión de privacidad)
El contrato no expone coordenadas individuales (solo conteos GPS) y
`capabilities.features.map_view=false`. Mostrar recorridos/paradas en mapa
exige decisión explícita de privacidad (rutas cerradas, precisión agregada,
autorización) — documentado aquí y en M3_SECURITY del backend; no construido.

## Exports (Fase 16)
CSV de hallazgos (anti formula-injection) · JSON de evidencia (con
export_meta stale/técnico) · resumen ejecutivo imprimible · **comparación plan
vs real** (KPIs + reglas H, honesto sobre NOT_EVALUABLE). Nombres con
`_DEMO`/`_STALE`; `revokeObjectURL`; sin PII (el contrato no la trae).

## Accesibilidad / responsive
Selects e input con `aria-label`; STALE con `role="alert"`; tabla con
`overflow-x: auto` (móvil); KPIs y bloques en flex/grid `auto-fill` (misma
base validada de M2); botón cerrar del panel con `aria-label`.
