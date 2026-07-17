# Propuesta de política de frescura por módulo (SOLO PROPUESTA)

> **En Etapa 0A la UI permanece DESCRIPTIVA y NEUTRAL**: muestra únicamente
> *"Datos medidos hace N horas"* (o la fecha), **sin** etiquetar vigente/desactualizado
> y **sin** reutilizar el rojo de riesgo de negocio. Esta tabla es una **propuesta
> documental**; el estado evaluativo (vigente/atrasado) solo se activa tras tu
> aprobación expresa de las cadencias. Ningún dato de esta tabla está aprobado aún.

`DataFreshness` ya acepta `{ data_as_of, expected_refresh_cadence, stale_after,
measurement_method, source }`. Mientras `expected_refresh_cadence`/`stale_after` sean
`null` (estado en 0A), rinde solo la edad descriptiva.

## Propuesta (a validar con Operación)

| Módulo | expected_refresh_cadence | stale_after (propuesto) | Origen operativo de la cadencia | Responsable | Ante corrida manual / fallida |
|--------|--------------------------|-------------------------|---------------------------------|-------------|-------------------------------|
| M1 Rutas pendientes | intradía (varias/día) | 12 h | cierre de rutas en calle | Operación | manual: marcar "medición manual"; fallida: conservar corte previo + aviso |
| M2 Planeación | diaria (mañana) | 30 h | publicación del plan del día | Planeación | idem |
| M3 Ejecución | diaria (post-jornada) | 30 h | fin de jornada de reparto | Operación de campo | idem |
| M4 Clientes y ventas | diaria | 36 h | corte comercial | Comercial | idem |
| M5 Flujo de producto | diaria | 36 h | despacho/recepción | Almacén | idem |
| M6 Dinero y cobranza | diaria | 30 h | corte administrativo/caja | Administración | idem |

## Reglas propuestas (para cuando se apruebe)

- El estado evaluativo solo se muestra si existe cadencia **aprobada y trazable**.
- `stale_after` supera la cadencia con holgura (tolera una corrida saltada).
- Corrida **manual**: se declara como tal; no cuenta como cadencia cumplida.
- Corrida **fallida**: se conserva el último corte válido con aviso "sin actualizar".
- Canal visual de frescura **distinto** del rojo de riesgo (reloj/neutro), para no
  confundir "dato viejo" con "problema de negocio".

## Decisión pendiente de Yamil

Aprobar (o ajustar) las cadencias/`stale_after` por módulo, y su origen operativo y
responsable. Hasta entonces: **solo edad descriptiva**.
