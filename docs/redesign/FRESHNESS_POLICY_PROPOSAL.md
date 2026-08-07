# Propuesta de política de frescura por módulo (SOLO PROPUESTA)

> **En Etapa 0A la UI es DESCRIPTIVA y NEUTRAL**: sólo *"Datos medidos hace N horas"*.
> **NO se activa** ningún estado evaluativo — ni `stale`, ni `current`, ni `warning`,
> ni rojo/ámbar/verde. El canal de frescura es propio (reloj/neutro), **nunca** el rojo
> de riesgo de negocio. Esta tabla es **propuesta documental**; el estado evaluativo
> sólo se habilita tras **aprobación expresa y trazable** de las cadencias por Yamil.
> **Ningún dato aquí está aprobado.**

`DataFreshness` acepta `{ data_as_of, expected_refresh_cadence, stale_after,
measurement_method, source }`. Mientras `stale_after` sea `null` (estado de 0A), sólo
rinde la edad descriptiva. `freshness.js` NO evalúa sin `staleAfterHours`.

## Campos que cada cadencia DEBE declarar antes de aprobarse

Por módulo: **evento operativo** que genera nueva medición · **frecuencia esperada** ·
**tolerancia** (`stale_after`) · **responsable** · **comportamiento si no hubo
operación** · **comportamiento si la corrida falló** · **evidencia de que la política
fue aprobada** (quién/cuándo/dónde).

## Propuesta (a validar con Operación — NADA aprobado)

| Módulo | Evento operativo que genera medición | Frecuencia esperada | Tolerancia (`stale_after`) | Responsable | Si NO hubo operación | Si la corrida FALLÓ | Evidencia de aprobación |
|--------|--------------------------------------|---------------------|----------------------------|-------------|----------------------|---------------------|-------------------------|
| M1 Rutas pendientes | cierre de rutas en calle | intradía (varias/día) | 12 h (propuesto) | Operación | mostrar edad + "sin corrida por jornada sin cierres" | conservar corte previo + "sin actualizar (corrida fallida)" | **pendiente** |
| M2 Planeación | publicación del plan del día | diaria (mañana) | 30 h | Planeación | "sin plan publicado hoy" | idem | **pendiente** |
| M3 Ejecución | fin de jornada de reparto | diaria (post-jornada) | 30 h | Operación de campo | "sin jornada registrada" | idem | **pendiente** |
| M4 Clientes y ventas | corte comercial | diaria | 36 h | Comercial | edad descriptiva | idem | **pendiente** |
| M5 Flujo de producto | despacho/recepción | diaria | 36 h | Almacén | edad descriptiva | idem | **pendiente** |
| M6 Dinero y cobranza | corte administrativo/caja | diaria | 30 h | Administración | edad descriptiva | idem | **pendiente** |

## Reglas propuestas (para cuando se apruebe)

- El estado evaluativo **sólo** se muestra si existe cadencia **aprobada y trazable**.
- `stale_after` supera la cadencia con holgura (tolera una corrida saltada).
- Corrida **manual**: se declara como tal; **no** cuenta como cadencia cumplida.
- Corrida **fallida**: se conserva el último corte válido con aviso "sin actualizar".
- **Sin operación** (p. ej. domingo sin reparto): no es "atraso"; se declara el motivo.
- Canal visual **distinto** del rojo de riesgo (reloj/neutro).

## Decisión pendiente de Yamil

Aprobar (o ajustar) cada fila —incluyendo la **evidencia de aprobación**— antes de
activar cualquier estado evaluativo. Hasta entonces: **sólo edad descriptiva**.
