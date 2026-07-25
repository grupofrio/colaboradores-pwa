# Supervisor de ventas: Operación de hoy

**Fecha:** 2026-07-24
**Estado:** diseño aprobado; listo para plan de implementación después de revisión
**PR frontend:** `grupofrio/colaboradores-pwa#80`
**Backend canónico:** `GrupoVeniu/GrupoFrio#220`, merge head
`0014dc512aa3329b719d9ef24fbd0c8e939c7c8d`

## Contexto

El PR #80 preparó el contrato, fixtures, reglas de presentación y documentación
del workspace operativo para `supervisor_ventas`. Ya se fusionaron sus
dependencias frontend #78 y #79, y el backend #220 también está fusionado.

La primera entrega ejecutable se limita a la superficie `/equipo`:
**Operación de hoy**. No intenta construir de una vez Mapa, Rutas, Clientes,
Pendientes y Más como superficies nuevas.

El backend sigue detrás de doble feature flag. La PWA debe conservar el Control
Comercial existente mientras los flags estén apagados y cambiar al nuevo home
solo cuando `day-control` responda correctamente.

## Objetivos

1. Convertir `/equipo` en un punto de entrada progresivo al nuevo home operativo.
2. Mostrar un día a la vez, con pestañas Hoy y Ayer.
3. Usar `day-control` como autoridad para jornada, rutas, venta diaria,
   prioridades, cierres, caja, freshness y capabilities.
4. Mantener intactas las rutas y funcionalidades actuales de `/equipo/*`.
5. Mostrar fallos, ausencias y datos parciales con semántica honesta.
6. Permitir rollback inmediato apagando los flags del backend.

## Fuera de alcance

- Radar, mapa, historial GPS o cualquier promesa de tiempo real.
- Crear nuevas superficies completas para Rutas, Clientes, Pendientes o Más.
- Acciones automáticas, dismiss de prioridades o escrituras al backend.
- Cambios de permisos, identidad o scope.
- Activar feature flags desde este repositorio.
- Inventar métricas de sin venta, recuperación, meta o venta mensual que
  `day-control/1` no entrega.
- Eliminar o reescribir `ScreenControlComercial`.

## Decisiones aprobadas

### Alcance

La primera entrega es únicamente `/equipo` → Operación de hoy. Radar queda para
un ciclo posterior con especificación y aprobación propias.

### Integración

Se usará un coordinador pequeño en `/equipo`:

- `FEATURE_DISABLED` monta `ScreenControlComercial` sin modificarlo.
- Una respuesta válida monta el nuevo home.
- Cualquier otro error se presenta explícitamente y no cae al panel anterior.

Esta separación mantiene un rollback simple y evita mezclar la semántica nueva
con el agregador legado.

### Hoy y Ayer

La primera consulta omite `date`, zona horaria, identidad y scope de cliente.
El backend resuelve la fecha operativa, la zona horaria, la sucursal y el
empleado desde su autoridad server-side.

Después de recibir y validar `payload.date`, la PWA obtiene la fecha civil
anterior mediante aritmética estricta sobre `YYYY-MM-DD` y solicita Ayer. No usa
`Date`, `Intl` ni la zona horaria del navegador para decidir las fechas.

Hoy y Ayer mantienen estados independientes. Se carga y presenta un solo día a
la vez; una falla de Ayer no inutiliza Hoy, ni viceversa.

## Arquitectura propuesta

### 1. Entrada de ruta

`ScreenSupervisorOperationsEntry` será el componente montado por la ruta
existente `/equipo`, dentro del mismo `ModuleRoleRoute` actual.

Responsabilidades:

- iniciar la consulta de Hoy;
- clasificar el envelope;
- elegir entre fallback legado, nuevo home o estado de error;
- coordinar recarga;
- iniciar la consulta de Ayer solo después de conocer la fecha operativa.

No contiene reglas de formato ni el markup de todas las secciones.

### 2. Cliente y clasificación de respuesta

Un módulo enfocado de `dayControl` encapsulará el transporte a:

`POST /gf/salesops/supervisor/v2/day-control`

La petición:

- omite `date` para Hoy;
- envía únicamente la fecha civil validada para Ayer;
- nunca envía `employee_id`, `company_id`, `branch_id`, `analytic_account_id`,
  `tz` ni `timezone`;
- conserva el código funcional y el mensaje seguro del backend;
- no convierte errores en arreglos vacíos.

La clasificación produce estados explícitos:

- `disabled`
- `unauthorized`
- `forbidden`
- `no_scope`
- `ambiguous_scope`
- `date_unavailable`
- `invalid_contract`
- `error`
- `valid`

Solo `FEATURE_DISABLED` se convierte en `disabled`.

Mapeo de códigos:

- `UNAUTHORIZED` → `unauthorized`;
- `FORBIDDEN` → `forbidden`;
- `NO_BRANCH_SCOPE` → `no_scope`;
- `MULTI_BRANCH` → `ambiguous_scope`;
- `DATE_NOT_ALLOWED` → `date_unavailable`;
- `SERVER_MISCONFIG` → `error`;
- `VALIDATION_ERROR` → `invalid_contract`, porque una petición construida por
  este cliente no debe ser inválida.

El guard runtime exige como mínimo un envelope de éxito, el identificador
`gf.salesops.supervisor.day_control/1`, fecha civil estricta y las estructuras
`summary`, `capabilities`, `routes` y `priorities` con sus tipos raíz correctos.
Si falla esa frontera, no se renderiza el payload. Una vez superada, los campos
contractualmente anulables o las capabilities apagadas se tratan como datos
parciales, no como contrato inválido. El JSON Schema completo continúa
verificándose en pruebas de drift.

### 3. Fecha civil

Un helper puro tendrá dos operaciones:

- validar estrictamente una fecha civil `YYYY-MM-DD`;
- obtener el día civil anterior, incluidos cambio de mes, cambio de año y año
  bisiesto.

No depende del reloj, locale o timezone del dispositivo.

### 4. Modelo de presentación

`dayControl/presentation.js` seguirá siendo la frontera para reglas puras de
texto, tono y valores faltantes. Se ampliará con helpers pequeños cuando haga
falta, sin poner lógica de negocio dentro de componentes.

Un view model por día transformará el payload válido en propiedades de UI para:

- encabezado y freshness;
- buckets de jornada;
- prioridades;
- rutas;
- resultado comercial;
- cierre y caja;
- acciones internas permitidas.

El view model conserva `null` y capabilities. Solo un cero real del contrato se
presenta como cero.

### 5. Pantalla y secciones

`ScreenSupervisorToday` recibe estados de Hoy y Ayer y renderiza componentes
enfocados:

1. `SupervisorDayHeader`
2. `SupervisorDayTabs`
3. `JourneySummary`
4. `PriorityList`
5. `RouteList`
6. `CommercialSummary`
7. `ClosureSummary`
8. `SupervisorQuickActions`

Los nombres finales pueden adaptarse a las convenciones del repositorio, pero
se conservarán estas fronteras de responsabilidad. La pantalla no será un solo
archivo con transporte, fechas, estado y presentación mezclados.

## Flujo de datos

### Carga inicial

1. `/equipo` monta el coordinador.
2. El coordinador solicita Hoy sin fecha.
3. Si recibe `FEATURE_DISABLED`, monta el Control Comercial legado y no solicita
   Ayer.
4. Si recibe un error de autorización, scope, red o contrato, muestra su estado
   correspondiente.
5. Si recibe un payload válido, lo muestra como Hoy.
6. Valida `payload.date`, calcula el día civil anterior y solicita Ayer en
   segundo plano.
7. Ayer se habilita como pestaña con loading, valid, empty o error propio.

### Recarga

Recargar vuelve a resolver Hoy desde el servidor. Ayer se recalcula desde la
nueva fecha operativa devuelta; no se reutiliza una fecha derivada de una
sesión previa.

### Comparación

La interfaz presenta un solo día como contenido principal. Cuando ambos payloads
son válidos, puede mostrar una referencia compacta únicamente para campos
diarios realmente comparables:

- venta del día, solo si ambos valores están disponibles, consolidados y en la
  misma moneda;
- rutas totales;
- visitas completadas y totales.

No se consolidan monedas distintas. No se comparan venta mensual, meta,
freshness, posiciones ni capacidades.

## Contenido y orden

### Encabezado

Muestra sucursal, fecha operativa, fuente de zona horaria, freshness de
`generated_at` y acción de recarga. Reutiliza `ModuleHeader` y `DataFreshness`
de #78 donde correspondan.

### Estado de jornada

Muestra:

- rutas asignadas;
- salieron;
- salieron tarde;
- sin salir;
- salida desconocida.

`departure_unknown` es neutral y nunca se suma a tarde. La tolerancia y su
fuente vienen del payload.

### Prioridades

Muestra hasta 5 elementos ya ordenados por el backend. Puede no haber
prioridades. Conserva severidad, razón y `count`; no reordena, duplica ni
permite descartar.

Un resolver con allowlist decide la acción:

- una prioridad de ruta puede abrir el detalle existente si se logra asociar de
  forma segura con una ruta y su empleado;
- una prioridad de cierre puede abrir `/equipo/cierre`;
- tipos desconocidos quedan neutrales y sin navegación.

Nunca se ejecutan URLs o rutas arbitrarias provenientes del backend.

### Rutas

Cada fila muestra, según capabilities y datos disponibles:

- ruta;
- responsable;
- unidad;
- salida objetivo y real;
- desviación y estado;
- visitas completadas;
- venta diaria y moneda;
- marcadores de incidencia;
- estado de señal;
- estado de carga;
- etapa de cierre;
- acceso al detalle existente.

Las horas de visitas y ventas se etiquetan como registradas por el servidor.
Las posiciones pueden faltar y no se presentan como tiempo real.

### Resultado comercial

La primera entrega muestra como métricas:

- venta del día;
- visitas completadas sobre total.

“Sin venta” y “Recuperación” aparecen como accesos a las pantallas existentes,
sin conteos inventados porque `day-control/1` no los expone.

Venta mensual y meta no son requisitos de esta primera entrega. Si se incorporan
en un ciclo posterior deberán tener una autoridad explícita; meta ausente se
presentará como “Sin meta configurada” y la venta mensual nunca se comparará
contra Ayer.

### Cierre y caja

Muestra las cinco etapas contractuales:

- abierta;
- cerrada;
- corte hecho;
- liquidada;
- validada;

y conserva `unknown` como “Estado por confirmar”.

`validated` significa conciliación de sistema, no recepción física de
devolución o merma. Caja solo se presenta cuando
`closure_cash_available=true`; multi-moneda se desglosa y nunca se suma en el
cliente.

### Acciones rápidas

Solo usan rutas internas existentes y sus permisos actuales. Esta entrega no
elimina ni cambia contratos de las rutas bajo `/equipo/*`.

## Estados y errores

| Condición | Presentación |
|---|---|
| Carga inicial | Estado loading consistente con #78 |
| `FEATURE_DISABLED` | `ScreenControlComercial` legado |
| `UNAUTHORIZED` | Estado de sesión/autenticación; sin fallback |
| `FORBIDDEN` | Estado sin permiso; sin fallback |
| `NO_BRANCH_SCOPE` | Estado sin sucursal operativa; sin fallback |
| `MULTI_BRANCH` | Estado de scope ambiguo; sin fallback |
| `DATE_NOT_ALLOWED` | Día no disponible; el otro día conserva su estado |
| `SERVER_MISCONFIG` | Error seguro con Reintentar |
| `VALIDATION_ERROR` | Error de contrato/petición; sin fallback |
| Red, 5xx o envelope inválido | Error seguro con Reintentar |
| Contrato inválido | Error seguro; no intenta renderizar datos parciales no confiables |
| Payload válido sin rutas | Estado vacío, distinto de error |
| Capability apagada | Sección “Información no disponible”, nunca cero inventado |
| Payload parcial permitido | Secciones válidas visibles; ausencias explícitas |
| Información antigua | Conserva datos, muestra freshness/stale y permite recargar |

El componente `StateScreen` de #78 será la presentación común. No se muestran
JSON crudo, stack traces, tokens ni mensajes internos.

## Contrato backend

Las copias JSON Schema y golden del PR #80 no cambiaron entre el head de
preparación `52308bb1` y el merge head del backend. Antes de implementar:

1. actualizar la procedencia local y el mirror al merge head
   `0014dc512aa3329b719d9ef24fbd0c8e939c7c8d`;
2. conservar y recalcular hashes solo si cambia el contenido de las copias;
3. verificar que el test de drift sigue mordiendo;
4. no reimplementar en frontend los hardenings server-side de scope, tolerancia,
   filtrado de devoluciones o thresholds de señal.

El frontend consume los valores finales del backend:

- scope de una sola sucursal operativa y compatible con la compañía;
- tolerancia cero explícita cuando la sucursal la configura;
- prioridades GPS usando thresholds del payload;
- cargas filtradas para no mezclar devoluciones.

## Seguridad y privacidad

- Identidad exclusivamente por token de sesión.
- Fail-closed para permiso y scope.
- Sin parámetros de scope controlados por cliente.
- Sin fixture productivo, PII, hostname, secreto o coordenada real.
- Sin navegación arbitraria desde datos remotos.
- Sin logs de payload completo en producción.
- Sin import runtime de fixtures o artefactos de radar.

## Estrategia de pruebas

La implementación seguirá TDD: cada comportamiento se expresa primero con una
prueba que falle por la razón esperada.

### Pruebas puras

- petición inicial sin fecha, timezone, identidad ni scope;
- petición de Ayer con una única fecha validada;
- día anterior en cambios de mes, año y bisiesto;
- clasificación de envelopes y códigos funcionales;
- `FEATURE_DISABLED` como único fallback;
- comparaciones limitadas a métricas diarias compatibles;
- moneda distinta, capability apagada y null sin suma ni cero falso;
- allowlist de acciones y tipo desconocido neutral;
- salida desconocida no tarde;
- cinco etapas de cierre;
- freshness, stale y partial.

### Pruebas de integración de componentes

- el coordinador monta legado con flags apagados;
- el coordinador monta el nuevo home con payload válido;
- autorización, scope, red y contrato inválido no montan legado;
- Hoy válido permanece visible si Ayer falla;
- Ayer válido puede seleccionarse sin mezclar sus totales con Hoy;
- recargar vuelve a resolver la fecha operativa;
- cada estado usa `StateScreen` y ofrece la acción correcta;
- navegación solo a rutas internas existentes.

### Regresión

- suite completa del repositorio;
- lint sin warnings;
- build de producción;
- checks de fuga de fixtures y artefactos;
- test de drift contractual.

### QA manual

- móvil real y desktop;
- sesión autenticada de supervisor con scope válido;
- flags global/sucursal apagados: Control Comercial legado;
- ambos flags encendidos: nuevo home;
- Hoy y Ayer;
- error, empty, partial y stale;
- venta en una moneda y multi-moneda;
- rutas sin posición;
- accesos al detalle y cierre;
- sin radar ni lenguaje de tiempo real.

## Criterios de aceptación

1. `/equipo` conserva el panel anterior cuando el backend está deshabilitado.
2. Con ambos flags activos, `/equipo` muestra Operación de hoy.
3. La fecha de Hoy siempre proviene del backend y Ayer se deriva de ella sin
   timezone del navegador.
4. Solo se muestra un día a la vez.
5. Ausencia no se representa como cero.
6. Hoy y Ayer fallan de forma independiente.
7. Jornada, prioridades, rutas, resultado comercial y cierre respetan contrato
   y capabilities.
8. Todas las rutas actuales bajo `/equipo/*` siguen disponibles.
9. Radar no forma parte del bundle o UI de esta entrega.
10. Suite, lint, build, checks de seguridad y CI del PR están verdes.
11. La QA con flags apagados y encendidos está documentada antes de marcar el PR
    listo para merge.

## Rollback

Apagar el flag global o el flag de la sucursal hace que el backend responda
`FEATURE_DISABLED`; la PWA vuelve al Control Comercial legado sin despliegue
adicional. Revertir el commit frontend sigue siendo una segunda opción.
