# SUPERVISOR_OPERATING_EXPERIENCE — perfil operativo de supervisor_ventas

**Estado: PREP.** La implementación de pantallas está **bloqueada por dependencia**:
#78 (Etapa 0A: StateScreen/DataFreshness/navModel) y #79 (hardening M4) deben
mergear a main antes de la rama ejecutable final. Este documento fija la
arquitectura para construirla sin re-decidir. Backend contrato: PR
GrupoVeniu/GrupoFrio#220 (canónico: `gf_saleops/docs/SUPERVISOR_DAY_CONTROL_CONTRACT.md`).

## Principio

KOLD OS para la supervisora de sucursal = **su sistema operativo del día**, no más dashboards. Integra lo
que ya existe (17 superficies de `/equipo` + backlog de cierres) alrededor de una
pregunta: *qué está pasando, qué importa, qué hago y dónde veo la evidencia*.
**Nunca** se muestran términos M1–M6 al usuario (etiquetas de negocio: "Cierres y
caja", "Ejecución", etc.).

## IA objetivo — 6 superficies

| # | Superficie | Contenido | Reutiliza |
|---|---|---|---|
| 1 | **Hoy** | home operativo (abajo) | ScreenControlComercial como base de datos/semántica corregida |
| 2 | **Mapa** | radar honesto (contrato radar/1) | — (nueva, fixtures listos) |
| 3 | **Rutas** | rutas de hoy → detalle; sub-pestaña Planeación/Pronóstico | ScreenDetalleVendedor, ScreenPronostico, ScreenPlanDiarioClientes |
| 4 | **Clientes** | editor, recuperación, sin visitar, bajas | ScreenClientesSupervisor, ScreenClientesRecuperacion, ScreenClientesSinVisitar, Bajas* |
| 5 | **Pendientes** | cierres/caja (vía capability closure_cash), marcadores de incidencia, sin salir, sin visitar, tareas | ScreenM1Backlog (datos), ScreenTareasSupervisor |
| 6 | **Más** | metas, score, KPIs, encuestas, premios, notas, perfil | ScreenMetasVendedores, ScreenScoreSemanal, genéricos |

Reglas: **no se elimina funcionalidad**; rutas actuales se conservan
(redirect/alias donde aplique). `/equipo/dashboard` deja de promoverse
(redirige a Hoy; no se borra sin análisis de enlaces). Las tarjetas genéricas del
home global quedan bajo "Más" para este rol.

## Home "Operación de hoy" — orden móvil

A. **Header**: Supervisora Demo · BR-DEMO Sucursal Demo · fecha · "actualizado hace X" · refresh (datos de sesión reales en runtime; aquí solo ejemplos sintéticos).
B. **Estado de jornada**: asignadas / salieron / tarde / sin salir / **sin dato**
   (los 5 buckets del contrato; `departure_unknown` JAMÁS se suma a tarde).
C. **Mini mapa**: N con señal / M sin señal + CTA "Ver mapa" (si radar OFF ⇒ no
   bloquear Hoy: chip "Mapa no disponible aún").
D. **Prioridades**: 3–5 del backend (`priorities[]`), con razón + CTA directo.
   Orden = severity del backend. Se muestra POR QUÉ está arriba. Sin descartes.
E. **Rutas de hoy**: ruta · chofer · unidad · salida (objetivo/real/desviación) ·
   avance · venta día (con su moneda) · ⚑marcadores de incidencia · señal · CTA detalle/mapa.
F. **Resultado comercial**: venta DÍA (cambia con la fecha) · venta mes · meta
   SOLO si existe ("Sin meta configurada" si no — nunca $0 rojo) · visitas ·
   no-venta · recuperación.
G. **Cierre**: abiertas / cerradas / cortes / liquidadas / validadas + caja
   pendiente $ (capability `closure_cash_available`; `closure_backlog_available=false`
   hasta encender tower M1 — no se pinta backlog vacío como "todo al día").
   **`validated` = conciliación DE SISTEMA, no recepción física** de
   devolución/merma (futuro `route_return_receipt`); no afirmar recepción.

**No duplicar Cumplimiento/Visitas**: una sola señal de avance
(`stops_done/total`), etiquetada "Visitas completadas".

## Correcciones de semántica que la rama ejecutable DEBE incluir (de la auditoría)

1. Meta ausente ⇒ "Sin meta configurada" (retirar fallback junio muerto).
2. Cumplimiento≡Visitas ⇒ una sola señal con fórmula visible.
3. `departure_on_time=null` ⇒ "sin dato", nunca tarde (espejo del contrato).
4. Liquidación ⇒ 5 etapas separadas del contrato (adiós unión pending+history).
5. Backend caído ⇒ StateScreen de error con Reintentar, nunca tablero en ceros.
6. Alertas clicables + wrapper corregido (sin condición huérfana `pending_stops>30`).
7. Freshness visible (`generated_at` → "hace X min") + stale + Reintentar.
8. Hoy/Ayer: comparar SOLO métricas comparables; la venta del día cambia con la
   fecha (la mensual no se presenta como comparación diaria).

## Estados (infra de #78 — razón de la dependencia)

`loading / unavailable / forbidden / no_scope / disabled(flag) / empty / stale /
partial / error / valid` con StateScreen + DataFreshness. Nunca raw JSON, nunca
TypeError, nunca ausencia-como-cero. EvidenceSection solo fuera de la capa
operativa principal.

## Mapa (superficie 2) — reglas duras

Banner permanente: **"Las posiciones pueden tener retraso. Consulta la hora de la
última señal."** Prohibido: "en vivo", "tiempo real", animación simulada,
interpolación. Pin: estados `recent/delayed/no_signal` de `thresholds` del
backend (política de presentación, configurable server-side). Tap → sheet (ruta,
responsable — "posición reportada por el dispositivo del responsable" —, unidad,
salida, avance, última señal, CTA Ver ruta). Sin mapa/API ⇒ lista de rutas +
mensaje honesto; Hoy nunca se bloquea.

## Horas de campo

Las horas de visitas/ventas son **de recepción en el servidor**
(`data_notes.times_are_server_received`): la UI las etiqueta "registrado HH:MM"
(no "ocurrió a las HH:MM"). Solo la señal GPS conserva hora de captura real.

## Cargas de ruta (autoridad stock.picking; van.* DESCARTADO)

El detalle de ruta y "Pendientes" muestran `loads` del contrato: almacén crea la
carga (initial/refill/manual) y el chofer la acepta; la PWA solo LEE. Estados
presentables: Refill preparado · Pendiente de aceptar · Aceptado · Cancelado ·
Estado no disponible. **Nunca** "solicitud de refill" ni "aprobación de
supervisor/inventario" (vocabulario van.* retirado). `manual`/`initial` no se
etiquetan como refill. `loads.available=false` ⇒ "Información de cargas no
disponible". Devolución/merma NO se presenta como recibida
(`route_return_receipt_available=false`; contrato futuro).

## Wireframes de referencia

Los 6 wireframes textuales (Home móvil, Mapa móvil, Lista rutas, Detalle ruta,
Pendientes, Desktop 3 columnas) quedaron en la auditoría del perfil (sesión
2026-07-18) y se trasladarán a especificación visual en la rama ejecutable.
