# Supervisor Ventas V2 — tablero de escritorio: mapa y pendientes

**Fecha:** 2026-08-03  
**Estado:** diseño aprobado por el usuario; pendiente de revisión de la especificación

## Objetivo

Reordenar el tablero de escritorio del Supervisor de Ventas para que conserve
una columna de **Rutas de hoy** y concentre el trabajo operativo en una segunda
columna: mapa del plan seleccionado arriba y **Clientes sin visitar** debajo.
El mapa de escritorio también mostrará el rastro GPS real de la jornada para el
plan elegido.

## Alcance

- Aplica sólo a `SupervisorDesktopBoard`; la experiencia móvil de `HoyTab` y
  `RadarTab` no cambia de acomodo.
- Eliminar la lista de unidades que `RadarView` muestra debajo del mapa dentro
  del tablero de escritorio. No eliminarla de Radar móvil ni de otros callers.
- Mantener **Rutas de hoy** como columna izquierda y fuente única de selección.
- Fusionar las antiguas columnas de Radar y Clientes por visitar en un panel
  derecho vertical: mapa primero, pendientes después.
- Incluir en el mapa escritorio la misma polilínea GPS real y el mismo modal de
  ampliación disponibles en Radar, sin convertir el mapa en seguimiento en vivo.

## Diseño de interfaz

En escritorio ancho, el tablero usa dos columnas: una columna izquierda fija
para rutas (`minmax(320px, 0.9fr)`) y una columna derecha dominante
(`minmax(520px, 1.8fr)`). Ambas conservan scroll propio dentro de la altura
operativa actual.

El panel derecho contiene, en este orden:

1. `RadarView` en modo de sólo mapa: selector Plan diario, leyenda honesta de
   rastro GPS, mapa y botón **Ampliar mapa**; no lista de unidades.
2. `PendingStopsColumn`, titulada **Clientes sin visitar**, que conserva el
   filtro del plan seleccionado y su estado honesto si Radar no llegó.

En un escritorio estrecho se apilan las dos columnas; no se modifica el punto
de corte ni la variante móvil existente.

## Arquitectura y flujo de datos

Se extrae de `RadarTab` un hook de rastro reutilizable. Recibe el plan activo y
`dayControl.date`, llama `getUnitTrack(planId, date)` sólo con una pareja
válida, y expone `trail` y `trailStatus` normalizados mediante las funciones de
`radarTrailState`.

El hook preserva los invariantes actuales:

- estado solicitado y respuesta publicados exclusivamente para la llave
  `(plan_id, fecha_operativa)`;
- reinicio síncrono al cambiar cualquiera de esas claves;
- cancelación/ignoración de respuestas tardías al cambiar la selección o
  desmontar;
- errores, denegaciones o menos de dos puntos no borran Radar, rutas ni
  pendientes base.

`RadarTab` y `SupervisorDesktopBoard` consumen el hook por separado, porque
ambos se montan en superficies distintas y comparten los mismos datos de día.
No se duplica la lógica de petición. Tampoco se mueve tracking a
`useOperationalDay`: así no se consulta GPS para rutas no seleccionadas ni para
superficies que no muestran mapa.

`SupervisorDesktopBoard` conserva `selectedPlanId` como única fuente de
selección para `RutasView`, `RadarView` y `PendingStopsColumn`. Pasa el rastro
normalizado a `RadarView`. Un prop explícito de presentación controla la lista
de unidades, con valor por defecto que conserva todos los callers actuales;
el tablero de escritorio lo desactiva.

## Estados y accesibilidad

- Sin rastro válido se conserva exactamente la copia de ausencia aprobada y
  el mapa de unidad/paradas sigue utilizable.
- El modal conserva sus semánticas `dialog`, foco inicial, trampa Tab,
  Escape y retorno al botón invocador. Reutiliza datos y no hace otra consulta.
- La selección de ruta mantiene sus controles por clic y teclado. El botón de
  limpiar pendientes sigue disponible cuando hay filtro.
- Los controles nuevos o reubicados respetan el mínimo de 44 px táctiles.

## Pruebas

- Estado/hook: petición con plan y fecha operativa, reinicio, rechazo de
  respuesta tardía y error sin geometría.
- Tablero desktop: dos columnas, ausencia de lista de unidades en el panel de
  mapa, mapa/pendientes/ruta sincronizados por el mismo plan, y rastro pasado al
  mapa sólo para el plan seleccionado.
- Regresión: móvil mantiene la lista y sus flujos existentes; polilínea,
  límites, antimeridiano y diálogo accesible continúan cubiertos.
- Verificación final: `npm test`, `npm run lint`, `npm run build` y
  `git diff --check origin/main...HEAD`.
