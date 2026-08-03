# Supervisor Ventas V2 — mapa vial filtrado por plan diario

**Fecha:** 2026-08-03  
**Estado:** diseño aprobado por el usuario

## Objetivo

Hacer legible el panel **Mapa de posiciones** de Radar. Al abrirlo, la PWA
seleccionará el primer plan diario disponible y mostrará en un mapa con calles
únicamente la posición de la unidad y las paradas de ese plan. El usuario podrá
cambiar el plan desde un selector y al pulsar una unidad de la lista.

## Alcance y límites

- Aplica únicamente a Supervisor Ventas V2, pestaña Radar.
- El selector se ubica dentro de la tarjeta del mapa y conserva la lista actual
  de unidades y su ordenamiento.
- Se usa la cartografía pública de OpenStreetMap mediante el paquete Leaflet y
  `react-leaflet`, ya presentes en la PWA. Se mostrará la atribución requerida.
- No se agrega una llave, geocodificación, cálculo de rutas ni una nueva llamada
  al backend.
- La fuente actual entrega posición de unidad y paradas planificadas, no una
  polilínea GPS. Por tanto no se dibuja un recorrido inferido ni se presenta la
  información como seguimiento en vivo.
- No se muestran puntos de los otros planes ni el CEDIS: la tarjeta representa
  estrictamente el plan seleccionado.

## Arquitectura y responsabilidades

| Pieza | Responsabilidad | Cambio |
| --- | --- | --- |
| `tabs/RadarTab.jsx` | Mantiene interacción de pestaña y navegación. | Guarda el `selectedId` solicitado por el usuario y lo actualiza desde selector, lista o marcador. |
| `radar/RadarView.jsx` | Vista pura de Radar y adaptación del contrato de datos. | Deriva el plan activo efectivo sin mutar estado, renderiza el selector y genera puntos sólo de ese plan. |
| `radar/PositionMap.jsx` | Presentación geoespacial. | Sustituye el SVG/retícula por Leaflet con teselas OpenStreetMap, marcadores y ajuste de límites. |
| Pruebas Radar existentes | Protegen contratos y render. | Cubren selección, filtrado, estados sin coordenadas y contrato de mapa vial. |

La selección usa exclusivamente `plan_id` numérico válido. `RadarTab` conserva
la preferencia opcional del usuario; `RadarView` obtiene el plan activo efectivo
usando esa preferencia sólo si sigue presente y, de otro modo, el primer plan
válido. La lista ordenada no define la selección inicial: ésta sale del arreglo
original del radar para que cambiar el orden visual no cambie la ruta consultada.

## Flujo de datos e interacción

1. `useOperationalDay` entrega `radar.units` como hoy; no cambia el contrato.
2. RadarView resuelve el plan activo efectivo: usa el `selectedId` de RadarTab
   si sigue presente; de lo contrario usa el primer `plan_id` válido de
   `radar.units`; si no hay ninguno, no hay selección. Esta resolución es pura:
   no dispara una escritura de estado durante el render.
3. El selector ofrece cada plan con una etiqueta entendible: nombre de ruta,
   responsable y unidad cuando existan. Cambiarlo actualiza el `selectedId`.
4. `buildPoints` recibe el plan activo y sólo transforma sus coordenadas
   válidas: marcador de unidad y paradas hechas/pendientes. No crea CEDIS ni
   puntos de otros planes.
5. La pulsación de una fila de Unidad conserva el comportamiento actual y
   actualiza la misma selección; la pulsación del marcador de unidad también
   selecciona ese plan. «Abrir ruta» sigue navegando al detalle existente.
6. El mapa calcula sus límites con los puntos filtrados y se centra/ajusta al
   plan al cargar o cambiar la selección. La cartografía queda debajo de los
   marcadores, con zoom y desplazamiento propios de Leaflet.

## Estados y manejo de errores

- Sin unidades o sin `plan_id` válido: no se muestra selector útil y el mapa
  conserva un estado vacío explícito.
- Plan seleccionado que desaparece en una actualización: se sustituye por el
  primer plan válido disponible; no queda un selector apuntando a datos ajenos.
- Plan existente sin coordenadas válidas: se conserva el selector y se muestra
  el aviso actual de que no hay posiciones válidas; la lista continúa siendo la
  fuente operativa.
- Una sola coordenada válida: se centra a un zoom seguro, sin intentar un
  `fitBounds` degenerado.
- Varias coordenadas: se aplica `fitBounds` con margen para que los marcadores
  no queden pegados al borde.
- Fallo de carga de las teselas: no altera datos ni inventa calles; los
  marcadores y el aviso de «última posición conocida» permanecen honestos.
- El texto que advierte que la posición puede tener retraso se conserva.

## Accesibilidad y presentación

- El selector tendrá una etiqueta visible «Plan diario».
- Los marcadores relevantes conservan nombre accesible y activación por teclado.
- El mapa tendrá una etiqueta accesible que indique que corresponde al plan
  seleccionado y que representa la última posición conocida.
- Los colores de unidad, señal atrasada y paradas se conservan con forma y
  contorno distinguibles; no dependerán únicamente del color.
- Se cargará el CSS de Leaflet de forma acotada al componente/entrada ya usada
  por Radar, sin modificar el tema global de la PWA.

## Pruebas y verificación

1. Añadir pruebas unitarias para resolver la selección inicial y conservar o
   reemplazar una selección inválida sin depender del orden visual.
2. Extender las pruebas de `RadarView` para comprobar que el selector existe,
   que usa el primer plan por defecto y que los puntos pertenecen sólo a ese
   `plan_id`.
3. Probar interacción: cambio de selector, clic de fila y clic de marcador
   actualizan la misma selección; «Abrir ruta» no se modifica.
4. Probar mapas vacío, con una coordenada y con puntos de varias rutas, sin
   fabricar posiciones ni ruta calculada.
5. Verificar que el mapa usa una capa OpenStreetMap con atribución y que no
   agrega solicitudes al API de Odoo.
6. Ejecutar `npm test`, `npm run lint` y `npm run build` en el worktree limpio.

## Criterios de aceptación

- Al entrar a Radar con planes válidos, el primer plan de la respuesta queda
  seleccionado sin intervención.
- El usuario puede elegir cualquier plan diario disponible desde el selector.
- Al cambiar de plan, mapa, marcador de unidad y paradas dejan de mezclar datos
  de las demás rutas.
- Se ven calles y colonias de OpenStreetMap detrás de los datos operativos.
- La lista de unidades, sus datos de señal y la navegación al detalle conservan
  su comportamiento actual.
- Sin coordenadas o sin datos, la pantalla informa la limitación sin mostrar
  información inventada.
