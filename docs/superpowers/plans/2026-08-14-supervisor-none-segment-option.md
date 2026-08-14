# Plan: opción Ninguno para segmento operativo

> **Ejecución:** se implementará en esta misma rama aislada, con prueba antes del cambio.

**Objetivo:** dejar explícito que no seleccionar un segmento operativo no aplica filtro alguno.

## Alcance

- Cambiar la etiqueta de la opción vacía del selector de `Todos` a `Ninguno (sin filtro de segmento)`.
- Conservar el valor vacío para que el contrato existente envíe `segment_id` ausente o nulo.
- No alterar zona, subpolígono ni la selección manual de clientes.

## Pasos

1. Añadir una prueba estática que exija la nueva etiqueta y descarte `Todos`.
2. Ejecutar esa prueba y comprobar que falla antes del cambio.
3. Modificar únicamente el `option` vacío en `PlanearMananaTab.jsx`.
4. Ejecutar las pruebas de planificación y comprobaciones de diff.
5. Crear un commit local con el cambio verificado.

## Verificación

```bash
node --test tests/supervisorRoutePlanning.test.mjs tests/supervisorRouteTemplatesApi.test.mjs tests/supervisorRoutesWeek.test.mjs
git diff --check
```
