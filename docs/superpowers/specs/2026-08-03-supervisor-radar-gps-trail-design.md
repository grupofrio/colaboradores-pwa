# Supervisor Ventas V2 — rastro GPS y mapa ampliado

**Fecha:** 2026-08-03
**Estado:** diseño aprobado por el usuario

## Objetivo

En Radar, complementar el plan diario seleccionado con el rastro GPS real de
la unidad durante la jornada de hoy y permitir ampliar el mismo mapa en una
capa sobre Radar.

## Alcance

- Reutilizar `getUnitTrack(planId, date)` y su contrato ya integrado en la PWA;
  no se modifica Odoo ni el payload base de Radar.
- Cargar el rastro sólo para el plan activo, al entrar o cambiar de selector.
- Dibujar una polilínea únicamente con dos o más puntos GPS válidos de `trail`.
  La copia visible será «Rastro GPS de hoy», no ruta planeada ni seguimiento en
  vivo.
- Conservar unidad actual y paradas planeadas como referencias secundarias.
- Agregar un botón «Ampliar mapa» que abre una capa modal accesible sobre Radar,
  con el mismo plan, rastro, mapa y control para cerrar. No navega fuera de Radar.
  Usa `role="dialog"`, `aria-modal="true"`, nombre accesible, foco inicial,
  contención de foco, cierre por Escape/botón y devolución de foco al botón.
- Si tracking no entrega rastro, conservar el mapa de posición/paradas y
  declarar «Sin recorrido GPS disponible para esta jornada.» No inventar línea.
- Respuestas deshabilitadas, prohibidas o con error de tracking no bloquean
  Radar ni cambian su estado principal.

## Diseño técnico

La fecha de tracking será siempre `dayControl.date` del Radar (fecha operativa
`YYYY-MM-DD`); nunca la fecha del dispositivo ni el valor por defecto del API.
`RadarTab` conserva el plan elegido. Un estado acotado se asocia a `(plan_id,
dayControl.date)` y descarta respuestas tardías al cambiarlo o desmontar. Un
error limpia sólo el rastro anterior, nunca la posición/paradas base. La
normalización y validación existentes de `unitTrackState` se reutilizan, evitando
persistir GPS en almacenamiento local.

`PositionMap` conserva sus `points` base y recibe opcionalmente un `trail`
normalizado. Leaflet sólo lo dibuja con al menos dos puntos válidos, los suma al
viewport y evita duplicar el último punto con la posición actual.
El panel ampliado reutiliza el mismo componente Leaflet y datos, no una segunda
consulta ni una segunda implementación del mapa.

## Pruebas

- Estado puro: puntos inválidos/cero, rastro ausente, respuesta tardía y errores
  de tracking no publican geometría de un plan anterior.
- Radar: al cambiar plan solicita tracking del nuevo `plan_id`; no toca el API
  si no hay plan válido; falla de tracking conserva Radar.
- Mapa: polilínea sólo con dos puntos, leyenda/copia de rastro GPS y sin
  afirmación de tiempo real.
- Modal: botón, foco atrapado, cierre por Escape y foco restaurado; datos y
  selector se conservan al ampliar/cerrar sin una segunda solicitud.
- Ejecutar suite completa, lint y build.
