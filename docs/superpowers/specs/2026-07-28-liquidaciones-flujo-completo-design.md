# Flujo completo de liquidaciones de ruta

**Fecha:** 2026-07-28
**Estado:** Aprobado para revisión técnica
**Ámbito:** PWA Colaboradores y backend GrupoFrio (`gf_logistics_ops`, `gf_pwa_admin`)

## Problema

La PWA y Odoo hoy determinan el avance de una ruta usando señales que no son
equivalentes:

- El frontend infiere que una ruta `closed` o `reconciled` implica que la
  liquidación del vendedor está confirmada.
- Odoo permite que una ruta se cierre y se reconcilie aunque
  `liquidacion_done_at` sea falso.
- La lista de Angélica mezcla la conciliación de inventario con la recepción
  física de efectivo.
- El endpoint de validación revisa un `return_receipt_state` que puede estar
  desactualizado respecto de pickings ya terminados.

El resultado depende del orden de clics y puede ocultar una liquidación sin
confirmar, mantener planes ya reconciliados en Pendientes o bloquear una
conciliación que ya tiene sus movimientos físicos hechos.

## Objetivo

Dejar un flujo único, auditable y determinista donde Angélica solo deba pulsar
**Validar** después de que Almacén haya hecho los movimientos físicos de
devolución y merma.

## Principios y decisiones aprobadas

1. Odoo es la única fuente de verdad. `localStorage` no puede declarar una
   etapa de negocio terminada.
2. Solo `liquidacion_done_at` prueba que el vendedor confirmó su liquidación.
3. Los movimientos físicos ocurren antes de la validación administrativa; el
   botón de Angélica no crea, recibe ni inventa inventario.
4. El cierre de ruta y la conciliación administrativa son etapas distintas.
5. La recepción de efectivo es un flujo aparte y no determina qué aparece en
   **Pendientes por validar**.
6. Toda validación debe ser idempotente y transaccional.

## Flujo operativo

```text
Vendedor termina visitas
  → valida corte
  → Odoo crea pickings de devolución/merma si aplican (pendientes)
  → Almacén recibe y valida los pickings físicos
  → Vendedor confirma liquidación (liquidacion_done_at)
  → Vendedor cierra ruta (state=closed)
  → Angélica ve el plan en Pendientes por validar
  → Angélica pulsa Validar
  → Odoo recalcula, verifica y deja reconciliation=done / plan=reconciled
```

Un plan sin devolución sigue el mismo flujo: queda `closed` tras el cierre de
ruta y espera el clic explícito de Angélica; no se reconcilia automáticamente.

## Responsabilidades por etapa

| Actor | Acción | Evidencia persistida |
|---|---|---|
| Vendedor | Validar corte | `corte_validated`, líneas y pickings de retorno declarados |
| Almacén | Recibir devolución o merma | Picking `done`, cantidades recibidas exactas |
| Vendedor | Confirmar liquidación | `liquidacion_done_at`, empleado y notas |
| Vendedor | Cerrar ruta | `state=closed`, cierre y kilometraje |
| Angélica | Validar conciliación | Reconciliación `done`, plan `reconciled` |

La recepción de efectivo conserva sus campos y endpoints actuales, pero no
altera esta secuencia ni hace reaparecer un plan reconciliado en la pantalla de
validación.

## Cambios de backend

### Cierre de ruta

`action_close_route` debe exigir:

- corte validado;
- `liquidacion_done_at` presente;
- conciliación calculable y diferencia de inventario en cero;
- kilometraje válido cuando aplique.

Cuando estas condiciones se cumplen, el plan pasa de `in_progress` a `closed`.
No debe llamar a `_try_finalize_reconciliation`; ese método no debe finalizar
automáticamente una conciliación como efecto secundario del cierre de ruta.

### Validación administrativa

`/pwa-admin/liquidaciones/validate` primero evalúa la rama idempotente: si el
plan ya está `reconciled` y su conciliación está `done`, responde éxito
`already_validated` sin recalcular ni escribir datos.

Fuera de esa rama, debe aceptar únicamente un plan con:

- `state == closed`;
- corte validado;
- liquidación confirmada;
- conciliación existente.

Antes de llamar al método canónico `action_mark_done`, el endpoint debe:

1. recalcular las líneas de conciliación;
2. recalcular `return_receipt_state` desde los pickings reales;
3. validar que cada picking requerido está `done` y que por producto la
   cantidad recibida coincide exactamente con la declarada;
4. devolver errores accionables sin escribir cambios si alguna precondición
   falla.

Con las precondiciones satisfechas, `action_mark_done` será la única operación
que lleve la conciliación a `done` y el plan a `reconciled`.

La rama idempotente no altera inventario ni efectivo.

### Listas administrativas

`/pwa-admin/liquidaciones/pending` representará solo conciliaciones pendientes
de Angélica:

- misma compañía;
- `liquidacion_done_at != false`;
- `state == closed`;
- conciliación existente y distinta de `done`.

No filtrará por `cash_reception_status`. Los planes `reconciled` se mostrarán
en historial de validadas, no en Pendientes.

El cierre de ruta garantiza que existe una conciliación antes de pasar a
`closed`. Un registro histórico cerrado sin conciliación es una excepción de
datos que no se mostrará como tarea de Angélica; se corrige por una remediación
administrativa separada.

La cola de efectivo usará sus endpoints y pantalla propios; queda fuera del
contrato de validación de inventario.

## Cambios de frontend

### Flujo de vendedor

- El estado visual de liquidación se deriva exclusivamente de
  `plan.liquidacion_done_at`.
- `getCierreState` no podrá marcar `liquidacionDone` por el estado
  `closed`/`reconciled`.
- La pantalla de cierre mostrará el bloqueo real si falta liquidación en Odoo.
- La pantalla de liquidación debe continuar permitiendo la confirmación cuando
  el plan esté `closed` o `reconciled` pero aún no tenga
  `liquidacion_done_at`, para recuperar registros anómalos sin simular éxito.

### Pantalla de Angélica

- El título y la lista se refieren a **Pendientes por validar**.
- Tras una validación exitosa, se recarga la lista y el plan desaparece.
- Los errores muestran el folio del picking, producto y cantidad cuando exista
  una devolución o merma pendiente, cancelada o con diferencia.
- Un plan ya reconciliado no se presenta como pendiente por efectivo.

## Contrato de errores

La API debe devolver mensajes de negocio claros y código estable cuando sea
posible:

| Condición | Mensaje esperado |
|---|---|
| Falta liquidación | `El vendedor aún no confirma la liquidación.` |
| Ruta abierta | `La ruta debe estar cerrada antes de validar la conciliación.` |
| Corte faltante | `El corte debe estar validado antes de validar la conciliación.` |
| Picking pendiente | Folio, producto, declarado y recibido pendiente |
| Picking cancelado | Folio cancelado y necesidad de reemplazo |
| Cantidad distinta | Producto, declarado y recibido |
| Diferencia de conciliación | Lista por producto y diferencia |

Los detalles no deben exponer empleados ajenos, tokens ni datos de efectivo.

Los recálculos de líneas y de recepción se ejecutan dentro de un `savepoint` de
Odoo. Si un gate falla, el endpoint lanza el error dentro de ese `savepoint`,
revierte cualquier escritura realizada por el recálculo y solo entonces
serializa el error para la PWA. Por tanto, un intento fallido no deja estados
de retorno ni líneas de conciliación parcialmente actualizados.

La comparación física se hace por cada picking requerido por separado. Dentro
de cada picking se agregan todos sus movimientos por producto en la UoM
canónica y se compara el total recibido contra el total declarado. No se
compensan sobrantes de un picking con faltantes de otro.

## Compatibilidad y remediación

Los planes históricos ya `reconciled` permanecen así; no se los revierte.

Un plan como `RPLAN/2026/00759` —reconciliado pero sin
`liquidacion_done_at`— se recupera por el flujo normal de confirmación de
liquidación, que debe estar disponible incluso en ese estado. La confirmación
no cambia inventario ni recepción de efectivo.

## Pruebas requeridas

Backend:

- no permitir cierre sin liquidación confirmada;
- cierre con corte y liquidación confirmada deja el plan `closed` y la
  conciliación pendiente;
- plan sin devoluciones requiere validación explícita de Angélica;
- validación recalcula un estado de retorno obsoleto antes de aplicar gates;
- pickings `pending`, `assigned`, `cancel` y con cantidad distinta fallan con
  detalle;
- devoluciones y mermas `done` con cantidad exacta permiten reconciliar;
- doble validación es idempotente;
- Pendientes excluye reconciliados aunque el efectivo esté pendiente.

Frontend:

- `closed` y `reconciled` no implican liquidación confirmada;
- la confirmación se habilita si falta `liquidacion_done_at`;
- Pendientes muestra solo planes cerrados por validar;
- mensajes de error de retorno se presentan sin perder el plan seleccionado.

Integración:

- reproducir el caso de Esteban: 230 cargadas, 230 entregadas, sin retorno;
  tras corte y liquidación, el plan se cierra, aparece para Angélica y solo se
  reconcilia al validar.

## Fuera de alcance

- Registrar efectivo automáticamente al validar inventario.
- Crear o validar pickings físicos desde el botón de Angélica.
- Revertir conciliaciones históricas.
- Cambiar la contabilidad de ventas, crédito o pagos.
