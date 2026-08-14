# Opción Ninguno para segmento operativo

## Objetivo

Evitar que la opción vacía del selector de segmento se interprete como "todos los
segmentos". Debe comunicar que no se aplica ningún filtro de segmento.

## Comportamiento

- La primera opción del selector pasa de `Todos` a `Ninguno (sin filtro de segmento)`.
- Conserva el valor vacío existente (`segment_id` ausente o nulo).
- Con Tuxpan u otra zona seleccionada, una elección vacía propone todos los clientes
  de esa zona; no intersecta con Mercado, Pozolerías u otro segmento.
- No cambia la zona, subzona, clientes manuales ni el contrato backend.

## Implementación y prueba

- Cambio localizado en `PlanearMananaTab.jsx`.
- La prueba de planeación verificará el texto y que la opción conserva `value=""`.
