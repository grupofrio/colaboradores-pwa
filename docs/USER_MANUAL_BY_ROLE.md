# Manual de Uso por Puesto — PWA Colaboradores Grupo Frío

> Guía operativa para usuarios internos de Grupo Frío. Actualizada al
> **2026-07-28**. La sección de asistencias describe el flujo preparado; su
> habilitación productiva requiere un despliegue autorizado por separado.
> Este manual NO es para desarrolladores — para eso ver [`docs/CODE_MANUAL.md`](CODE_MANUAL.md).

---

## 1. Propósito del manual

Este manual responde a tres preguntas por cada puesto:

1. **¿Qué pantallas tengo disponibles?**
2. **¿Qué hago en cada una, paso a paso?**
3. **¿Qué hago si algo falla?**

No documenta funcionalidades planeadas ni decisiones de roadmap. Si una operación está parcial, dice "parcial". Si depende de backend pendiente, lo dice. Si fue validada por QA reciente, también.

URL pública del PWA: [`https://colaboradores-pwa.vercel.app/login`](https://colaboradores-pwa.vercel.app/login).

---

## 2. Reglas generales de uso

### 2.1 Inicio de sesión

- Entrar a [`https://colaboradores-pwa.vercel.app/login`](https://colaboradores-pwa.vercel.app/login).
- Capturar **PIN** de empleado y **barcode** (puede teclearse o escanearse).
- Presionar **"Entrar"**.
- El sistema valida contra Odoo y, si todo está bien, lleva al **Inicio** (Home) con los módulos visibles según tu puesto.
- La sesión dura **7 días**. Después se cierra automáticamente y hay que volver a entrar.

> **Importante:** la PWA **NO usa contraseñas**. Tu identidad la dan tu PIN + barcode. Si no recuerdas tu PIN, pide a Auxiliar Admin o Gerente que lo consulte en RRHH; si tu barcode no funciona, repórtalo a Sebastián.

### 2.2 Buenas prácticas

- **Una sola sesión activa por dispositivo.** Si abres tu sesión en otro celular, la primera se cierra.
- **No compartas tu PIN.** Toda acción queda registrada con tu nombre.
- **Cuando entregues el turno, cierra la sesión.** Salir desde el ícono de perfil → "Salir".
- **Si la pantalla queda en blanco**, recargar (deslizar hacia abajo o pulsar el ícono de actualizar del navegador).
- **Trabaja con conexión.** La app actualmente no opera bien sin red — los datos no se sincronizan offline.

### 2.3 Qué hacer si aparece un error

Tres tipos de error común:

1. **"No tienes acceso a este plan/recurso"** → no es tu turno, ruta o sucursal. Verificar con tu jefe.
2. **"Backend rechazó la operación"** → falta stock, producto inválido, etc. Lee el mensaje exacto, corrige y reintenta. **No insistas con el mismo dato**, vuelves a obtener el mismo error.
3. **"Error 500"/"Algo salió mal"** → reportar capturando una foto de la pantalla. NO seguir intentando.

Para cada error que aparezca con el botón "Volver al inicio", úsalo. El sistema captura el detalle del error automáticamente.

### 2.4 Qué NO hacer

- No usar el modo **"Bypass"** del login (5 taps en "COLABORADORES") en operación real. Es solo para pruebas; las acciones no se registran correctamente.
- No tomar capturas de pantalla con datos sensibles (PINs ajenos, números de cuenta, RFC) y pegarlas en chats abiertos.
- No abrir varias pestañas del navegador con el PWA al mismo tiempo. La sesión se desincroniza y puede perder datos no guardados.
- No tocar URLs directamente con planes de otra sucursal — el sistema te rechaza pero genera ruido en logs.

---

## 3. Estado operativo por puesto

| Rol | Estado general | Notas |
|-----|----------------|-------|
| Gerente | Parcial (3 pantallas live + acceso a Admin) | Forecast unlock parcial; KPIs degradan a mock si Metabase no está. |
| Auxiliar Admin | Operativo (POS, gastos, requisiciones, cierre) | Liquidaciones desktop-only. |
| Operador Rolito | Parcial | Hub `ScreenTurnoRolito` operativo; PIN de cierre pendiente. |
| Operador Barra | Parcial | Hub `ScreenMiTurno` con ciclos, empaque, tanques operativos. |
| Jefe de Producción | Parcial | Supervisión con paros, energía, mantenimiento, merma. |
| Almacenista PT | Operativo | Recepción, inventario, traspasos, handover, materiales. |
| **Almacenista Entregas** | **Operativo (validado por QA)** | Carga por forecast, devoluciones, merma, inventario vivo — todos validados PR #21–#27. |
| **Jefe de Ruta** | **Operativo (validado por QA)** | Acepta carga, vehicle checklist, control, corte, liquidación. Corte y liquidación persisten parcialmente en localStorage. |
| **Supervisor de Ventas** | **Operativo (validado por QA)** | Forecast, dashboard, control comercial, sin visitar, score semanal. Tareas y notas en almacenamiento temporal local. |

Detalle por rol abajo.

---

## 4. Gerente

### 4.1 Objetivo del puesto

Vista ejecutiva de la sucursal: ver alertas operativas del día, autorizar acciones por encima de umbrales (cierres, requisiciones, gastos altos), revisar KPIs, desbloquear forecasts cuando aplique.

### 4.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Hub Gerente | `/gerente` | live | Punto de entrada con accesos a las 5 áreas del puesto. |
| Dashboard | `/gerente/dashboard` | live | Indicadores generales (ventas, mermas, paros, costos). Algunos paneles dependen de Metabase. |
| Alertas | `/gerente/alertas` | live | Eventos del día que requieren atención del gerente. |
| Gastos | `/gerente/gastos` | live | Registrar gastos del día (mismo módulo que Auxiliar Admin con permisos elevados). |
| Forecast Unlock | `/gerente/forecast` | parcial | Permite desbloquear forecasts confirmados. No fue ejercitado E2E en QA reciente. |
| Admin Sucursal | `/admin/*` | live | Acceso completo al módulo de Auxiliar Admin (POS, requisiciones, cierre, materia prima, liquidaciones, validar materiales). |
| KPIs | `/kpis` | parcial | Iframe a Metabase. Hoy degrada a "Mock Dashboard" si el endpoint backend no está disponible (gap G001). |

### 4.3 Flujo diario recomendado

1. Entrar y revisar **Alertas** primero. Si hay alertas, atenderlas o delegar.
2. Revisar **Dashboard** para ver el estado general de ventas, mermas y paros del día.
3. Aprobar requisiciones pendientes (entrar a `/admin/requisiciones`).
4. Aprobar gastos altos (entrar a `/admin/gastos/aprobar`).
5. Si hay cierres de caja con diferencia mayor a $1,000, autorizar desde Admin Sucursal → Cierre.
6. Cierre del día: revisar KPIs y tomar acciones para mañana.

### 4.4 Operaciones paso a paso

#### Operación: Aprobar requisición de compra

**Cuándo se usa:** alguien (Auxiliar Admin típicamente) creó una requisición que requiere autorización gerencial.
**Ruta:** `/admin/requisiciones`.
**Pasos:**
1. Entrar al hub Gerente o directo a Admin Sucursal.
2. Tocar "Requisiciones".
3. Filtrar por estado "Pendiente de aprobación".
4. Tocar la requisición para ver detalle (productos, cantidades, precio).
5. Tocar **"Aprobar"** o **"Rechazar"** (con motivo obligatorio si rechazas).

**Resultado esperado:** la requisición pasa a estado `confirmed` (aprobada) o `cancelled` (rechazada). El solicitante recibe notificación en su propio módulo.

**Errores comunes:** "Sin requisiciones pendientes" — no hay nada por aprobar hoy.

**Cuándo escalar:** si la requisición es por monto inusualmente alto y no estás seguro, llama a Dirección antes de aprobar.

#### Operación: Autorizar un corte POS pendiente

**Cuándo se usa:** Angy preparó el corte y el backend determinó que la diferencia
requiere autorización gerencial o de dirección.
**Ruta:** `/admin/cierre`.
**Pasos:**
1. Abrir la solicitud pendiente desde **Cortes de caja**.
2. Revisar el turno y versión, diferencia, nota y nivel solicitado. Si se trata
   de una versión histórica que ya tenía evidencia, esa referencia permanece
   visible; los cierres nuevos no requieren foto. La vista de autorización
   muestra solo el detalle mínimo permitido.
3. Si está justificada, autorizar con el nivel que la pantalla permite.
4. Si no está justificada, no autorizar: dejar la versión pendiente, pedir a
   Angy que verifique el conteo y escalar el caso. No intentar un segundo cierre
   ni crear otro turno; un pendiente ya guardado no se reabre directamente.

> **Importante:** la autorización de cortes por turno se valida en backend. El
> gap G018 documentado más adelante corresponde al cierre diario Legacy, no a
> este flujo Noche/Día.

#### Operación: Desbloquear forecast confirmado

**Cuándo se usa:** un Supervisor de Ventas confirmó un forecast por error o quiere editarlo.
**Ruta:** `/gerente/forecast`.
**Pasos:**
1. Buscar el forecast bloqueado.
2. Revisar contexto (quién lo confirmó, fecha objetivo, líneas).
3. Pulsar "Desbloquear".
4. El forecast vuelve a estado `draft` y el supervisor puede editarlo.

> **Estado:** parcial. No validado en QA reciente. Si la pantalla muestra error, reporta a Sebastián.

### 4.5 Errores comunes

- "**Mock Dashboard**" en KPIs: Metabase aún no expone tokens reales. Es esperado hoy. Los datos del Dashboard sí son reales (no Metabase). Gap G001.
- "**Sin alertas**" en pantalla de alertas: nada por hacer hoy en ese frente.

### 4.6 Pendientes conocidos

- Forecast Unlock no fue validado E2E en QA reciente.
- KPIs reales (Metabase) bloqueados hasta que backend exponga `/pwa-metabase-token` (G001).
- Validación server-side de umbrales del cierre diario Legacy pendiente (G018).

---

## 5. Auxiliar Admin

### 5.1 Objetivo del puesto

Operación administrativa diaria de la sucursal: vender en mostrador, registrar gastos, levantar requisiciones, traspasar materia prima entre almacenes internos, cerrar caja al final del día.

### 5.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Hub Admin | `/admin` | live | Punto de entrada con accesos a todas las funciones del puesto. |
| POS Mostrador | `/admin/pos` | live | Punto de venta para clientes que llegan al mostrador. |
| Ticket | `/admin/ticket/:id` | live | Detalle de un ticket vendido (consulta o reimpresión). |
| Gastos | `/admin/gastos` | live | Registrar gasto del día con foto y categoría. |
| Historial Gastos | `/admin/gastos-historial` | live | Consultar gastos previos. |
| Aprobar Gastos | `/admin/gastos/aprobar` | live (sólo Gerente/Dirección) | Aprobar gastos altos. Auxiliar Admin NO ve esta pantalla. |
| Requisiciones | `/admin/requisiciones` | live | Crear y consultar solicitudes de compra. |
| Liquidaciones | `/admin/liquidaciones` | live (desktop-only) | Validar liquidaciones de Jefes de Ruta. **Solo Gerente.** |
| Materia Prima | `/admin/materia-prima` | live (desktop-only, solo Gerente) | Stock real de materia prima. |
| Traspaso Materia Prima | `/admin/traspaso-materia-prima` | live | Enviar material a Rolito o PT. |
| Validación Bolsas | `/admin/bolsas/validar` | live | Validar declaración de bolsas. |
| Cortes de caja | `/admin/cierre` | live | Apertura, arqueo, cierre e historial de turnos POS día/noche. |
| Validar Materiales | `/admin/materiales/validar` | live (solo Gerente) | Validar entregas de materiales del Almacenista PT. |
| Resolver Rechazo | `/admin/materiales/resolver-rechazo` | live | Resolver materiales rechazados. |

### 5.3 Flujo diario recomendado

1. Abrir **POS** y atender clientes que lleguen al mostrador.
2. Registrar **Gastos** del día conforme ocurren (papelería, viáticos, mantenimiento menor, etc.).
3. Crear **Requisiciones** cuando se necesite comprar algo (productos, insumos).
4. Si hay materia prima a traspasar dentro del día, hacerlo desde **Traspaso MP**.
5. Al final del día: **Validación de bolsas** + **Cierre de caja**.

### 5.4 Operaciones paso a paso

#### Operación: Vender en mostrador

**Cuándo se usa:** un cliente llega al mostrador a comprar producto.
**Ruta:** `/admin/pos`.
**Pasos:**
1. Buscar el cliente. Si es público general, usa "Público Mostrador" por defecto.
2. Agregar productos uno por uno (escanear código o buscar por nombre). Verifica precio y cantidad.
3. Seleccionar **método de pago** (efectivo, tarjeta, transferencia).
4. Si es **tarjeta**, capturar el **folio del terminal** (mínimo 4 caracteres). Es obligatorio.
5. Si la venta es **mayor a $5,000**, aparece banner "requiere autorización gerente". Pídelo antes de continuar.
6. Si es **mayor a $50,000**, requiere autorización de dirección.
7. Cobrar y confirmar.
8. El sistema crea el ticket y lo agrega al pendiente de despacho.

**Resultado esperado:** ticket creado, stock listo para despachar (Almacenista Entregas confirma despacho luego).

**Errores comunes:**
- "Folio obligatorio en tarjeta": faltó capturar folio del terminal.
- "Autorización requerida": se pasó del umbral, espera al gerente.

**Cuándo escalar:** si el cliente quiere cancelar un ticket ya cobrado, llama al gerente.

#### Operación: Registrar un gasto del día

**Cuándo se usa:** se hizo un pago en efectivo o con tarjeta corporativa que necesita comprobarse.
**Ruta:** `/admin/gastos`.
**Pasos:**
1. Tocar "Nuevo gasto".
2. Capturar concepto, monto, categoría, cuenta analítica (si aplica).
3. Adjuntar foto del recibo (la cámara abre directo).
4. Agregar nota si el monto es alto o el motivo no es obvio.
5. Guardar.

**Resultado esperado:** el gasto aparece en historial del día con estado "Por aprobar" si supera el umbral, o "Aprobado" si es menor.

**Errores comunes:** "No se pudo subir foto" — repetir; si persiste, tomarla con cámara externa y reintentar.

#### Operación: Administrar cortes POS por turno (Angy)

**Cuándo se usa:** al entregar la caja nocturna o diurna, normalmente cerca de
las 06:00 y 18:00, y al consultar o corregir un corte anterior.

**Ruta:** `/admin/cierre`, menú **Cortes de caja**.

**Permiso y preparación previa:** esta función es para Angy como administradora
del corte. Antes de usarla, el backend debe estar actualizado, la sucursal debe
tener su configuración de turnos preparada y su empleado debe tener el permiso
**Puede administrar cortes POS por turno**. El permiso se asigna al perfil, no
al nombre escrito en el sistema. Después de asignarlo, Angy debe cerrar sesión y
volver a entrar para recibir capacidades nuevas con un token fresco. Héctor, el
POS diurno y cualquier auxiliar sin ese permiso no pueden ver ni administrar
los cortes. El backend identifica a Angy por su token de empleado y no exige que
su ficha esté vinculada a un usuario `res.users`; el responsable del corte es el
empleado autenticado.

Después de liberar una nueva versión de backend/PWA, Angy debe cerrar sesión,
recargar la aplicación instalada y volver a iniciar sesión antes de probar el
cierre. Esto renueva el token y evita conservar capacidades o recursos de la
versión anterior.

##### Primera apertura manual

La primera apertura se hace una sola vez por sucursal. No cierres ni actives la
configuración hasta que Angy esté lista y haya conciliado los movimientos que
aparecen en la vista previa.

1. Elegir **Noche** o **Día**.
2. Capturar la **fecha operativa**, el inicio real y el fondo de apertura.
3. Revisar la vista previa del servidor: periodo, tickets, gastos elegibles y
   totales. Si se cambia cualquier dato, generar una vista previa nueva antes
   de confirmar. El servidor vuelve a evaluar y bloquear los movimientos al
   abrir, por lo que el resultado final puede incluir un movimiento creado
   mientras se revisaba.
4. Conciliar los folios mostrados contra los movimientos existentes y confirmar
   **Abrir primer turno**.

Las 06:00 y 18:00 son referencias normales, no cierres automáticos. La hora
real que Angy confirma es la frontera entre turnos. Los periodos son
semiabiertos: incluyen el inicio y excluyen el final (`inicio <= movimiento <
fin`), así ninguna venta se cuenta dos veces.

**Ejemplo indispensable:** si el turno nocturno comienza el día 26 a las 18:00,
se abre como **Noche 27**. Todo movimiento desde ese inicio hasta el cierre
manual de la mañana pertenece a la fecha operativa 27, aunque parte del periodo
haya ocurrido el 26.

##### Cerrar Noche o Día con arqueo

1. Abrir el turno activo y pulsar **Hacer corte**. La pantalla trae de nuevo
   el resumen autoritativo del servidor.
2. Revisar el desglose completo: tickets y ventas, productos y cantidades,
   efectivo, terminal, gastos, cancelaciones y ajustes.
3. Confirmar la conciliación: las ventas en efectivo aumentan el efectivo
   esperado y los gastos de caja lo disminuyen. Los cobros por terminal se
   reportan por separado y no incrementan el efectivo físico esperado.
4. Contar la caja y capturar la cantidad de cada denominación de billetes y
   monedas. Si hubo un ingreso o egreso excepcional que no es una venta ni un
   gasto ya registrado, agregar un ajuste con tipo, monto y concepto. No uses un
   ajuste para ocultar una diferencia.
5. Revisar **esperado**, **efectivo físico** y **diferencia**. Toda diferencia,
   sin importar el monto, exige una nota clara. El cierre móvil nuevo no pide ni
   permite adjuntar una foto del arqueo.
6. En un cierre normal, capturar el **fondo del turno siguiente**. Ese campo no
   aparece en un recierre. Confirmar una sola vez.
7. Si no requiere autorización, el sistema guarda una versión inmutable del
   corte y abre el turno siguiente en la misma operación. Al cerrar Noche 27,
   normalmente se abre Día 27; al cerrar Día 27, normalmente se abre Noche 28.

Si aparece `pending_auth`, el corte espera autorización de gerente o dirección
según el nivel indicado. El turno sucesor ya fue abierto una sola vez como parte
del cierre; no repitas el cierre ni abras otro turno manualmente. La persona
autorizadora debe revisar la diferencia, nota y los importes mínimos mostrados.
Autorizar completa la revisión de la misma versión, sin crear otro sucesor.

##### Respuesta incierta, reapertura y recierre

- Si la red se corta después de confirmar y aparece **respuesta incierta**, no
  cambies datos ni inicies otra operación. Usa **Consultar estado** o reintenta
  la acción pendiente desde la misma pantalla: el sistema conserva la misma
  clave. Nunca generes una clave nueva para “destrabarlo”, porque podrías perder
  la capacidad de reconciliar el resultado real.
- Un turno cerrado es inmutable: sus ventas y gastos no se modifican ni se
  cancelan directamente. Para corregirlo, abre **Historial**, selecciona la
  versión y pulsa **Reabrir**; la razón es obligatoria.
- Ya reabierto, realiza la corrección permitida —por ejemplo cancelar una venta
  con su motivo auditado—, vuelve a contar, captura de nuevo la nota si existe
  diferencia y usa **Volver a cerrar**. El recierre tampoco solicita foto;
  genera una versión nueva ligada a la anterior y **no crea otro turno sucesor
  ni pide un nuevo fondo siguiente**.
- Si sales del formulario después de reabrir, el turno histórico permanece
  `reopened`; vuelve a entrar y termina el recierre. El botón **Cancelar** solo
  descarta el borrador local, no revierte una reapertura ya confirmada.

##### Historial, Consolidado e impresión

En **Historial** se consulta por fecha operativa, no por fecha calendario. Cada
tarjeta muestra Noche/Día y permite abrir una versión exacta. **Consolidado**
suma ambos turnos de la fecha sin duplicar fondos, arqueos ni versiones
anteriores. Desde el detalle se puede imprimir el corte con folio, periodo,
responsable, ventas, productos, pagos, gastos, cancelaciones, ajustes,
denominaciones, diferencia y autorizaciones. Las versiones históricas que ya
tenían evidencia conservan y muestran su referencia, digest y archivo al
imprimir. Una versión nueva sin foto sigue siendo imprimible y muestra
**Sin evidencia adjunta**.

Los cierres diarios anteriores aparecen en una sección **Legacy** separada. Son
históricos de solo lectura después de activar los cortes por turno; no deben
mezclarse con Noche/Día ni usarse para registrar un cierre nuevo. Sus reglas y
comprobantes no cambiaron con esta liberación. Tampoco cambió la foto de recibo
que se solicita al registrar un gasto: solo se eliminó la foto del cierre y
recierre POS por turno.

**Resultado esperado:** turno en `closed` con versión imprimible, o
`pending_auth` hasta completar la autorización; el siguiente turno solo se crea
una vez en un cierre normal exitoso.

**Cuándo escalar:** si faltan tickets/gastos en la vista previa, hay más de un
turno abierto, el estado de una operación no puede recuperarse o la sucursal
aparece fuera del alcance. No sigas operando el corte hasta reconciliarlo.

#### Operación: Crear una requisición de compra

**Cuándo se usa:** se necesita comprar algo (insumos, papelería, refacciones).
**Ruta:** `/admin/requisiciones`.
**Pasos:**
1. Pulsar "Nueva requisición".
2. Buscar y agregar productos. Capturar cantidad y precio estimado.
3. Asignar **cuenta analítica** (sucursal/centro de costo).
4. Agregar comentarios si hace falta.
5. Guardar.

**Resultado esperado:** requisición en estado `draft`. Si supera umbral, queda "Pendiente de aprobación gerencial".

### 5.5 Qué NO debe hacer este puesto

- NO acceder a `/admin/liquidaciones`, `/admin/materia-prima` ni `/admin/materiales/validar` — esas son funciones del Gerente. Si te aparecen ocultas en tu menú, es correcto.
- NO modificar ventas ya confirmadas. Cancelarlas requiere autorización del gerente.

### 5.6 Errores comunes

- "Folio obligatorio cuando es tarjeta": faltó capturar referencia del terminal.
- "Falta nota": cualquier diferencia del corte por turno exige explicación;
  no intentes adjuntar una foto para resolverla.

### 5.7 Pendientes conocidos

- Liquidaciones y Materia Prima son **desktop-only** (no funcionan bien en celular).
- G018 continúa referido al cierre diario **Legacy**; los cortes POS por turno
  validan nota y autorizaciones en backend. La evidencia solo se conserva en
  versiones históricas que ya la tenían.

---

## 6. Operador Rolito

### 6.1 Objetivo del puesto

Operar la línea de **Rolito** (producción de hielo bolsa). Registrar ciclos de producción, empaque, incidencias y entregar el turno al siguiente operador.

### 6.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Mi Turno (hub Rolito) | `/produccion` | live | Punto de entrada al turno con timeline guiado. |
| Checklist | `/produccion/checklist` | live | Checklist HACCP de inicio de turno. |
| Ciclo Rolito | `/produccion/ciclo` | live | Registrar ciclos de producción. |
| Empaque Rolito | `/produccion/empaque` | live | Registrar empaque de bolsas. |
| Corte | `/produccion/corte` | parcial | Cortar la producción cuando termina el turno. |
| Transformación | `/produccion/transformacion` | parcial | Transformar producto entre presentaciones. |
| Incidencia Rolito | `/produccion/incidencia` | live | Reportar paro o incidencia. |
| Cierre Rolito | `/produccion/cierre` | live | Cerrar el turno. |
| Declaración Bolsas | `/produccion/declaracion-bolsas` | live | Declarar bolsas usadas en el turno (cadena de custodia). |
| Handover Turno | `/produccion/handover` | live | Entregar turno al siguiente operador. |
| Reconciliación PT | `/produccion/reconciliacion` | live | Verificar inventario al cierre. |

### 6.3 Flujo diario recomendado

1. Entrar y abrir **Mi Turno** (hub).
2. Hacer **Checklist HACCP** (obligatorio para iniciar).
3. Iniciar **ciclos** conforme arranca producción.
4. Registrar **empaque** de bolsas.
5. Si hay paro o incidencia, abrir **Incidencia** y reportar.
6. Al fin del turno: **Declarar bolsas** → **Corte** → **Cierre** → **Handover**.

### 6.4 Operaciones paso a paso

#### Operación: Iniciar ciclo de producción

**Ruta:** `/produccion/ciclo`.
**Pasos:**
1. Tocar "Nuevo ciclo".
2. Seleccionar máquina (si hay varias).
3. Capturar producto a producir.
4. Iniciar.
5. El sistema lleva el cronómetro y la cantidad esperada.

**Resultado esperado:** ciclo activo en `gf.production.cycle`.

#### Operación: Reportar incidencia / paro

**Ruta:** `/produccion/incidencia`.
**Pasos:**
1. Seleccionar tipo de paro (mecánico, eléctrico, materia prima, etc.).
2. Capturar duración estimada.
3. Agregar foto si es relevante.
4. Guardar.

**Resultado esperado:** paro registrado, supervisor de producción puede consolidar.

#### Operación: Cierre de turno + handover

**Pasos:**
1. Declarar bolsas usadas.
2. Hacer corte de producción.
3. Cerrar turno.
4. Entregar al siguiente operador.

> **Pendiente:** la verificación de PIN antes del cierre está como TODO (gap G012). Hoy cualquier sesión puede cerrar el turno sin reto extra de PIN.

### 6.5 Errores comunes

- "Checklist no completo": no se puede iniciar producción sin checklist HACCP terminado.
- "Sin máquina disponible": el supervisor debe asignarte una máquina.

### 6.6 Pendientes conocidos

- PIN verification al cierre del turno está pendiente (gap G012).
- `action_close_shift` con fallback legacy (algunas instancias todavía no migran al método final).
- Validación end-to-end del flujo Rolito completo no fue ejercitada en QA reciente.

---

## 7. Operador Barra

### 7.1 Objetivo del puesto

Operar la línea de **Barras** (producción de hielo en barra). Manejar tanques de salmuera, evaporadores, harvest (cosecha), y entregar producto a Almacén PT.

### 7.2 Pantallas disponibles

Comparte las pantallas con Operador Rolito (módulo `/produccion/*`) más:

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Tanques (lista) | `/produccion/tanque` | live | Lista de tanques de salmuera con su estado. |
| Tanque (detalle) | `/produccion/tanque/:id` | live | Detalle del tanque, lecturas, incidentes. |
| Mi Turno V1 | `/produccion` | live | Hub de operador Barra (variante V1 con detalle de salmuera). |

### 7.3 Flujo diario recomendado

1. **Checklist HACCP**.
2. Verificar estado de tanques (`/produccion/tanque`) y registrar lecturas de salmuera.
3. Iniciar **ciclo** de producción.
4. Cuando se cosecha (harvest), registrar y opcionalmente entregar a PT en una sola operación (`/pwa-prod/harvest-with-pt-reception`).
5. **Empaque** y **corte** al cierre.
6. Handover.

### 7.4 Operaciones paso a paso

#### Operación: Lectura de salmuera

**Ruta:** `/produccion/tanque/:id`.
**Pasos:**
1. Tocar el tanque correspondiente.
2. Capturar la lectura (densidad, temperatura, nivel).
3. Si hay un incidente (fuga, contaminación), abrir reporte de incidencia.

**Resultado esperado:** lectura registrada en `gf.production.brine_reading`.

#### Operación: Harvest con recepción PT

**Cuándo se usa:** se cosecha producto del evaporador y se entrega directo a Almacén PT en la misma transacción.
**Pasos:**
1. Iniciar harvest desde el ciclo activo.
2. Capturar cantidad cosechada.
3. Confirmar entrega a PT.
4. El sistema crea el `gf.production.harvest` y la `gf.pt.reception` en una sola llamada.

**Resultado esperado:** producto contabilizado en PT.

### 7.5 Errores comunes

- "Tanque no disponible": el supervisor no asignó tanques al turno.
- "Sin ciclo activo": iniciar ciclo antes de hacer harvest.

### 7.6 Pendientes conocidos

- Mismos pendientes que Rolito (PIN al cierre, action_close legacy).
- Algunos fallbacks defensivos de máquinas siguen activos hasta que el controller canónico llegue al 100%.

---

## 8. Jefe de Producción

### 8.1 Objetivo del puesto

Supervisar la planta turno a turno: dashboard de paros y mermas, energía, mantenimiento, control de turno (apertura, cierre, validación de PIN para cerrar turnos de operadores).

### 8.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Hub Supervisión | `/supervision` | live | Vista del turno con bloqueadores y atajos a las áreas. |
| Control de Turno | `/supervision/turno` | live | Apertura/cierre del turno general. |
| Paros | `/supervision/paros` | live | Lista de paros del turno con estado. |
| Merma | `/supervision/merma` | live | Mermas registradas y balance vs umbrales. |
| Energía | `/supervision/energia` | live | Lectura inicial y final de medidor. |
| Mantenimiento | `/supervision/mantenimiento` | live | Solicitudes de mantenimiento del turno. |

### 8.3 Flujo diario recomendado

1. Abrir el turno (`/supervision/turno`) — captura energía inicial.
2. Monitorear ciclos abiertos, paros y mermas durante el turno.
3. Si la merma supera umbral, revisar y tomar acción.
4. Si hay solicitudes de mantenimiento, atenderlas o escalarlas.
5. Al cierre del turno: validar que todos los ciclos están cerrados, capturar energía final, cerrar turno general.

### 8.4 Operaciones paso a paso

#### Operación: Abrir turno general

**Ruta:** `/supervision/turno`.
**Pasos:**
1. Capturar energía inicial (lectura del medidor).
2. Confirmar inicio.
3. Operadores pueden ahora abrir sus turnos individuales.

#### Operación: Cerrar turno general (con PIN)

**Pasos:**
1. Validar que no hay ciclos abiertos.
2. Validar que no hay paros sin cerrar.
3. Capturar energía final.
4. Capturar tu **PIN** para confirmar (validación supervisor).
5. Cerrar.

**Resultado esperado:** turno general en estado cerrado.

**Errores comunes:** "Hay ciclos abiertos" — cerrar primero los ciclos. "Hay paros abiertos" — cerrarlos. "Balance de merma fuera de rango" — revisar.

### 8.5 Errores comunes

- Bloqueadores listados al entrar a `/supervision`: cada uno tiene un atajo directo a la pantalla correctiva.

### 8.6 Pendientes conocidos

- Brine readings tiene PoC voice (entrada de datos por voz) — funcional pero no obligatorio.
- Dashboards no validados E2E en QA reciente.

---

## 9. Almacenista PT

### 9.1 Objetivo del puesto

Custodiar el **Producto Terminado**: recibir desde producción, transferir a Entregas/CEDIS, hacer transformaciones de empaque, gestionar materiales del turno, declarar bolsas, entregar el turno al siguiente almacenista.

### 9.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Hub Almacén PT | `/almacen-pt` | live | Punto de entrada con accesos a todas las áreas. |
| Recepción | `/almacen-pt/recepcion` | live | Recibir producto desde Producción. |
| Inventario PT | `/almacen-pt/inventario` | live | Stock actual del almacén PT. |
| Transformación PT | `/almacen-pt/transformacion` | live | Transformar producto entre presentaciones. |
| Traspaso a Entregas | `/almacen-pt/traspaso` | live | Enviar producto a CEDIS de Entregas. |
| Handover PT | `/almacen-pt/handover` | live | Entregar turno al siguiente almacenista. |
| Merma PT | `/almacen-pt/merma` | live | Registrar merma de PT. |
| Materiales (issues) | `/almacen-pt/materiales` | live | Lista de entregas de materiales del turno. |
| Crear Issue | `/almacen-pt/materiales/crear` | live | Entregar material a operador. |
| Reporte Issue | `/almacen-pt/materiales/report/:id` | live | Detalle de una entrega. |
| Reconciliar | `/almacen-pt/materiales/reconciliar` | live | Reconciliar materiales al cierre. |
| Declaración Bolsas PT | `/almacen-pt/declaracion-bolsas` | live | Declarar bolsas custodiadas. |

### 9.3 Flujo diario recomendado

1. Entrar al hub. Si hay handover pendiente del turno anterior, **resolverlo primero** (te redirige automáticamente).
2. Recibir producto que va llegando de producción (`Recepción`).
3. Atender solicitudes de materiales de operadores.
4. Cuando Almacén Entregas necesite producto, hacer **Traspaso a Entregas**.
5. Si hay producto dañado, **registrar merma**.
6. Al cierre: declarar bolsas, reconciliar, hacer handover.

### 9.4 Operaciones paso a paso

#### Operación: Recibir producto de producción

**Ruta:** `/almacen-pt/recepcion`.
**Pasos:**
1. Ver pendientes de recepción (lo que producción cosechó/empacó).
2. Para cada pendiente, validar producto y cantidad físicamente.
3. Confirmar recepción.

**Resultado esperado:** stock incrementado en almacén PT. Backend hace posting de inventario automáticamente.

> **Nota técnica:** este flujo tuvo bug grave hasta el 2026-04-27 (G013, 56% de recepciones quedaban en error por configuración cross-company). Está resuelto. Si vuelve a aparecer "error" en una recepción, escalar a Sebastián con el ID del registro.

**Errores comunes:**
- "Sin pendientes": no hay nada que recibir hoy.
- "Producto rechazado": el sistema detectó incongruencia (cantidad fuera de rango, producto no esperado). Verificar físicamente.

#### Operación: Transferir a Entregas

**Ruta:** `/almacen-pt/traspaso`.
**Pasos:**
1. Seleccionar destino (CEDIS de Entregas configurado para tu sucursal).
2. Agregar productos y cantidades.
3. Confirmar.

**Resultado esperado:** stock baja en PT, sube en Entregas. Almacenista Entregas recibe el pallet.

#### Operación: Entregar turno (handover)

**Cuándo se usa:** al cierre de tu turno.
**Ruta:** `/almacen-pt/handover`.
**Pasos:**
1. Seleccionar al **almacenista entrante** (el siguiente turno).
2. Capturar cualquier nota relevante (pendientes, alertas).
3. Confirmar.
4. El entrante debe **aceptar** el handover desde su sesión al iniciar.

**Resultado esperado:** turno cerrado, siguiente almacenista habilitado.

### 9.5 Errores comunes

- "Handover pendiente del turno anterior": el almacenista anterior dejó pendiente el handover. Hay que resolverlo antes de operar.
- "Empleado sin warehouse_id": tu perfil no tiene almacén asignado. Pedir a Sebastián que lo configure en RRHH.

### 9.6 Pendientes conocidos

- Reconcile y Reporte de issues tienen TODO para validación avanzada.
- Validación de inventario físico tras G013: pendiente durante rollout de capacitación con conteo aleatorio coordinado por Auxiliar Admin de Iguala.

---

## 10. Almacenista Entregas

> **Estado:** este puesto fue el más trabajado entre 2026-04-26 y 2026-04-27. Todo el flujo principal está validado por QA.

### 10.1 Objetivo del puesto

Operar el **CEDIS de logística**: aceptar el turno, recibir producto desde Almacén PT, cargar las unidades de los Jefes de Ruta según el forecast del día, atender devoluciones cuando regresen las rutas, registrar mermas reales, cerrar el turno.

### 10.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Hub Día (timeline) | `/entregas` | live | Punto de entrada con los 7 pasos del día en orden. |
| Aceptar Turno | `/entregas/cierre-turno` (alias `/entregas/aceptar-turno`) | live | Aceptar el turno entregado por el almacenista anterior. |
| Recibir PT | `/entregas/recibir-pt` | live | Recibir traspasos del Almacén PT. |
| Transformación | `/entregas/transformacion` | live | Transformar producto entre presentaciones (poco usado). |
| **Carga de Unidades** | `/entregas/carga` | **live (QA PASS PR #25)** | Confirmar carga de cada camioneta según forecast. |
| Operación del Día | `/entregas/operacion` | live | Tickets pendientes de despacho del mostrador. |
| **Devoluciones** | `/entregas/devoluciones` | **live (QA PASS PR #24)** | Recibir producto devuelto por las rutas. |
| **Merma** | `/entregas/merma` | **live (QA PASS PR #23)** | Registrar merma con stock real. |
| Cierre de Turno | `/entregas/cierre-turno` | live | Entregar el turno al siguiente almacenista. |
| **Inventario Vivo** | `/entregas/inventario` | **live (QA PASS PR #27)** | Stock físico, reservado y libre del CEDIS. |

### 10.3 Flujo diario recomendado

El hub (`/entregas`) muestra los 7 pasos en orden. Cada paso bloquea al siguiente hasta que esté completo:

1. **Aceptar turno** (te llega el handover del turno anterior).
2. **Recibir PT** (pallets que vienen de Almacén PT).
3. **Cargar unidades** (cada camioneta según forecast del Supervisor de Ventas).
4. **Operación del día** (despachar tickets de mostrador conforme aparezcan).
5. **Devoluciones** (cuando las rutas regresan).
6. **Merma** (si hay producto dañado).
7. **Entregar turno** al cierre.

Adicional: **Inventario Vivo** disponible en cualquier momento como referencia.

### 10.4 Operaciones paso a paso

#### Operación: Aceptar turno

**Ruta:** `/entregas/cierre-turno` (también accesible como `/entregas/aceptar-turno` redirigido).
**Pasos:**
1. Ver el handover pendiente con notas del turno anterior.
2. Tocar "Aceptar".
3. Confirmar.

**Resultado esperado:** turno tuyo, los demás módulos se desbloquean.

#### Operación: Recibir PT (intercompany)

**Ruta:** `/entregas/recibir-pt`.
**Pasos:**
1. Ver pallets pendientes de aceptar.
2. Para cada pallet, validar físicamente que el producto y cantidad coinciden.
3. Aceptar o rechazar (con motivo).

**Resultado esperado:** producto añadido al stock del CEDIS.

> **Nota:** rechazar pallet hoy NO registra al responsable del rechazo (gap G019). Se registra el motivo, pero no el `rejected_by_id`.

#### Operación: Confirmar carga de camioneta (carga por forecast)

> **Esta es la operación más sensible del día.** Validada por QA con Héctor + Manuel el 2026-04-26 (PR #25).

**Quién lo hace:** Almacenista Entregas.
**Ruta:** `/entregas/carga`.
**Cuándo se usa:** cuando el Supervisor ya generó el pronóstico y existe una carga asignada a una unidad.

**Pasos:**
1. Entrar al hub Entregas → Cargar Unidades.
2. Buscar la ruta correspondiente.
3. Verificar productos y cantidades del forecast contra el físico que tienes preparado.
4. Pulsar **"Confirmar carga"**.
5. Confirmar en el modal.
6. Esperar el mensaje de éxito.

**Resultado esperado:**
- El picking pasa a `done`.
- El stock baja del CEDIS.
- El stock sube en la unidad.
- El Jefe de Ruta puede ahora **aceptar** la carga desde su PWA.

**Errores comunes:**
- **"X-GF-Token inválido"**: falta variable `VITE_GF_SALESOPS_TOKEN` en Vercel. Reportar a Sebastián. Sebastián confirmó configuración 2026-04-26; si vuelve a aparecer, fue rotada.
- **"Sin carga asignada"**: no existe carga para hoy o ya fue aceptada por el Jefe de Ruta. Verificar con el Supervisor.
- **"Operación temporalmente bloqueada"**: otro almacenista está ejecutando la misma carga simultáneamente. Esperar y reintentar.

**Cuándo escalar:** si la carga ya fue ejecutada (`already_done:true`) pero la camioneta no salió, llamar al Supervisor de Ventas — algo está descuadrado entre forecast y físico.

#### Operación: Atender devolución de ruta

**Ruta:** `/entregas/devoluciones`.
**Pasos:**
1. Ver listado de devoluciones pendientes (rutas que regresaron con producto).
2. Para cada devolución, abrir y validar las líneas (producto y cantidad).
3. Pulsar **"Aceptar devolución"**.

**Resultado esperado:** se crea un **return picking** en estado pendiente. El stock NO se actualiza automáticamente — el picking necesita validación posterior (típicamente lo hace el sistema o un proceso administrativo).

> **Importante:** el endpoint NO valida automáticamente el picking. Ese paso queda pendiente de un proceso aparte. Si necesitas que el stock baje al instante, escalar a Sebastián.

**Errores comunes:** "Líneas inválidas" — alguna línea tiene producto mal capturado por la ruta.

#### Operación: Registrar merma

> Validada en QA PR #23. Ya no muestra falso éxito.

**Ruta:** `/entregas/merma`.
**Pasos:**
1. Buscar producto.
2. Capturar cantidad mermada.
3. Seleccionar motivo (caducado, dañado en transporte, etc.).
4. Agregar nota opcional.
5. Confirmar en el modal.

**Resultado esperado:** merma registrada en `stock.scrap`. El stock baja del inventario.

**Errores comunes:**
- "Sin stock libre suficiente": el producto está reservado para una carga o ticket. Liberar primero o ajustar cantidad.
- "Producto inválido": el producto seleccionado no es mermable.
- **"Backend rechazó la merma"**: lee el mensaje específico, corrige y reintenta. **El sistema no se quedó con el dato malo** — está bien insistir cambiando el dato.

#### Operación: Consultar inventario vivo

> Validada en QA PR #27 con producto 760.

**Ruta:** `/entregas/inventario`.
**Pasos:**
1. Entrar.
2. Filtrar por: `Todos`, `Libre > 0`, `Agotados`, `Negativos`.
3. Buscar por nombre de producto si necesitas algo específico.

**Qué muestra cada producto:**
- **`on_hand_qty`** → stock físico que está en el almacén.
- **`reserved_qty`** → stock comprometido (reservado para cargas o tickets).
- **`available_qty`** → libre = `on_hand_qty - reserved_qty`. **Este es el que puedes usar para mermas, ventas y traspasos.**

**Resultado esperado:** la pantalla refleja el stock real de Odoo. Si ves negativos, hay un descuadre — escalar.

**Cuándo escalar:** producto con `on_hand_qty < 0` (negativo) — algo se contabilizó mal. Reportar al Supervisor o a Sebastián.

#### Operación: Cierre de turno / handover

**Ruta:** `/entregas/cierre-turno`.
**Pasos:**
1. Validar que todos los pasos del día están completos (el timeline lo muestra).
2. Seleccionar al almacenista entrante.
3. Agregar notas relevantes para el turno siguiente.
4. Confirmar.

**Resultado esperado:** turno cerrado, siguiente almacenista habilitado.

### 10.5 Qué NO debe hacer este puesto

- NO confirmar cargas sin validar físicamente que el producto está en la unidad.
- NO aceptar devoluciones sin contar el producto. Una vez aceptado, el descuadre lo asumes tú.
- NO usar el bypass de admin para "saltarte" un paso del timeline. Los pasos están en orden por una razón.

### 10.6 Errores comunes

- **"Turno bloqueado por otro almacenista"** (`shift ownership`): otro almacenista ya tiene el turno activo. Coordinar con él para liberar.
- **"Sesión drift detectado"**: alguien más entró con tu mismo PIN/barcode en otro dispositivo. La sesión se recarga automáticamente.

### 10.7 Pendientes conocidos

- **Pallet reject sin log de responsable** (G019): rechazar un pallet no registra quién lo hizo. Se registra el motivo pero no el responsable.
- **Foto en evidencia** se envía como base64 inline. Pesa más en cada request. Pendiente endpoint `/pwa/evidence/upload` (G008).
- **Merma positiva con stock libre real** no validada en QA específico. Si aparece comportamiento extraño con cantidades positivas grandes, reportar.

---

## 11. Jefe de Ruta

> **Importante:** "Jefe de Ruta" en GFSC es el **VENDEDOR** que opera UNA ruta. NO es supervisor multi-ruta (eso es el Supervisor de Ventas).

> **Estado:** validado por QA en cuanto a **aceptación de carga por forecast** (PR #25, 2026-04-26).

### 11.1 Objetivo del puesto

Disciplina operativa de UNA ruta: checklist de unidad, aceptar carga, control de la ruta (las visitas reales suceden en **Kold Field**, app aparte), inventario, corte (cuadre forzoso a 0), liquidación, cierre.

### 11.2 Pantallas disponibles

Las 6 estaciones del flujo + atajos:

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Mi Ruta V2 (hub) | `/ruta` | live | Punto de entrada con timeline de 6 estaciones. |
| Checklist Unidad | `/ruta/checklist` | live | Checklist físico de la camioneta antes de salir. |
| Aceptar Carga | `/ruta/carga` | **live (QA PASS PR #25)** | Aceptar la carga lista en CEDIS. |
| Control de Ruta | `/ruta/control` | live | Estado de la ruta durante el día (las visitas reales están en Kold Field). |
| Conciliación | `/ruta/conciliacion` | live | Reconciliar entregas vs lo cargado. |
| Inventario Ruta | `/ruta/inventario` | live | Stock actual en la unidad. |
| Corte | `/ruta/corte` | parcial | Cuadre forzoso a 0 al final del día (el sistema bloquea cualquier diferencia). |
| Liquidación | `/ruta/liquidacion` | parcial | Cuadre de dinero. |
| Cierre | `/ruta/cierre` | parcial | Cierre formal de la ruta. |
| Incidencias | `/ruta/incidencias` | live | Reportar incidencias durante la ruta. |
| KPIs Ruta | `/ruta/kpis` | live | KPIs propios del día (ventas, visitas, cumplimiento). |

### 11.3 Flujo diario recomendado

El hub muestra las 6 estaciones en orden:

1. **Checklist** de unidad + aceptar carga + KM salida.
2. **Control de ruta** (las visitas reales están en Kold Field).
3. **Inventario** de lo cargado vs entregado.
4. **Corte** (cuadre forzoso a 0).
5. **Liquidación** (cuadre de dinero).
6. **Cierre** de ruta.

### 11.4 Operaciones paso a paso

#### Operación: Hacer checklist de unidad

**Ruta:** `/ruta/checklist`.
**Pasos:**
1. Verificar puntos físicos de la camioneta (frenos, llantas, fuga, herramienta, etc.) según el template.
2. Marcar cada punto como OK o con observación.
3. Capturar foto si hay observación.
4. Confirmar checklist.

**Resultado esperado:** checklist completo, queda registrado y se marca el paso como hecho en el hub.

#### Operación: Aceptar carga (después del CEDIS)

> Validada en QA con carga por forecast PR #25.

**Cuándo se usa:** el Almacenista Entregas confirmó la carga (`load_picking` en `done`) y el Supervisor generó el forecast del día.
**Ruta:** `/ruta/carga`.
**Pasos:**
1. Ver la carga preparada para tu unidad.
2. Validar productos y cantidades físicamente.
3. Pulsar **"Aceptar carga"**.
4. Capturar **KM de salida**.
5. Confirmar.

**Resultado esperado:**
- El plan queda con `load_sealed=true`.
- Tu inventario de ruta queda fijado.
- Puedes salir a Kold Field a hacer las visitas.

**Errores comunes:**
- **"Sin carga asignada"**: el almacenista no ha confirmado la carga aún, o el supervisor no generó forecast para hoy.
- **"No tienes acceso a este plan"**: el plan que estás viendo no es el tuyo. Backend filtra por empleado.

**Cuándo escalar:** si esperabas carga y no aparece, llamar al Supervisor de Ventas (puede no haber forecast) o al Almacenista Entregas (puede no haber confirmado carga).

#### Operación: Control de ruta durante el día

**Ruta:** `/ruta/control`.
**Pasos:**
1. Ver el estado de la ruta (visitas realizadas, ventas, cobros).
2. Las acciones reales (registrar visita, cobrar, no visitada) **suceden en Kold Field**, no aquí.
3. Esta pantalla **muestra y valida**, no captura.

#### Operación: Reportar incidencia en ruta

**Ruta:** `/ruta/incidencias`.
**Pasos:**
1. Tipo de incidencia (problema mecánico, accidente, etc.).
2. Descripción.
3. Foto si aplica.
4. Confirmar.

**Resultado esperado:** incidencia visible en `/ruta/incidencias` y para el Supervisor de Ventas en `/equipo/team-incidents`.

#### Operación: Corte de ruta

**Ruta:** `/ruta/corte`.
**Pasos:**
1. Capturar el inventario físico que regresas.
2. El sistema compara con el remanente esperado.
3. **Cualquier diferencia bloquea el corte** (no permite cerrar con sobrantes ni faltantes).
4. Si hay diferencia, justificarla con devolución o merma antes de cortar.

**Resultado esperado:** corte registrado a 0.

> **Estado:** parcial. Hoy el corte persiste en `localStorage` además del backend (gap G016). Si cierras la app antes del cierre final, puedes perder estado local.

#### Operación: Liquidación

**Ruta:** `/ruta/liquidacion`.
**Pasos:**
1. Capturar dinero recibido (efectivo, transferencias confirmadas).
2. Sistema compara contra ventas reportadas.
3. Si hay diferencia, justificarla con notas.

> **Estado:** parcial. Mismo riesgo de localStorage que el corte.

#### Operación: Cierre de ruta

**Ruta:** `/ruta/cierre`.
**Pasos:**
1. Validar que checklist, control, inventario, corte y liquidación están todos hechos.
2. Capturar **KM de regreso**.
3. Confirmar cierre.

**Resultado esperado:** ruta cerrada formalmente.

### 11.5 Qué NO debe hacer este puesto

- NO usar la PWA para registrar **visitas o ventas reales**. Eso se hace en Kold Field.
- NO aceptar carga sin validar físicamente.
- NO cerrar ruta con corte o liquidación incompletos.

### 11.6 Errores comunes

- **"No tienes acceso a este plan"**: el plan no es tuyo. Verificar con tu jefe que el plan esté asignado a tu empleado en Odoo.
- **Sesión drift**: cerrar y volver a entrar.
- **"Tenancy split van + CEDIS"** ya no debe aparecer (resuelto en backend 2026-04-26 por Sebastián).

### 11.7 Pendientes conocidos

- **Corte y liquidación persisten en localStorage** (gap G016). Si cierras la app antes del cierre final, puedes perder estado. Recomendación: cerrar la ruta el mismo día en que la abres.
- **Auxiliar de Ruta** (rol secundario): puede entrar a `/ruta/*`, pero no fue probado un escenario donde el auxiliar ve los planes del titular vs los suyos. Reportar comportamiento si aparece.

---

## 12. Supervisor de Ventas

> **Estado:** validado por QA con Aida el 2026-04-27 para `forecast-create` (PR #26).

### 12.1 Objetivo del puesto

Centro de **control comercial** de la sucursal: ver el día y el día anterior, generar pronósticos de venta para que el CEDIS prepare cargas, dar seguimiento a vendedores (metas, score, clientes sin visitar, recuperación), gestionar tareas y notas de coaching.

### 12.2 Pantallas disponibles

| Pantalla | Ruta | Estado | Para qué sirve |
|----------|------|--------|----------------|
| Control Comercial (hub) | `/equipo` | live | Punto de entrada con accesos. |
| Detalle Vendedor | `/equipo/vendedor/:id` | live | Vista detallada de un vendedor. |
| Sin Visitar | `/equipo/sin-visitar` | live | Clientes que no fueron visitados hoy. |
| Score Semanal | `/equipo/score-semanal` | live | Score por vendedor de la semana. |
| Cierre del Día | `/equipo/cierre` | live | Resumen del día. |
| Dashboard Ventas | `/equipo/dashboard` | live | Indicadores comerciales. |
| **Pronóstico** | `/equipo/pronostico` | **live (QA PASS PR #26)** | Crear y consultar forecasts del día. |
| Metas | `/equipo/metas` | live | Metas mensuales por vendedor. |
| Tareas | `/equipo/tareas` | live (datos en localStorage temporal) | Asignar tareas a vendedores. |
| Notas | `/equipo/notas` | live (datos en localStorage temporal) | Notas de coaching por vendedor o cliente. |
| Recuperación | `/equipo/recuperacion` | live | Clientes inactivos a recuperar. |
| Nota Rápida | `/equipo/nota-rapida` | live | Atajo para nota rápida. |

### 12.3 Flujo diario recomendado

1. Por la mañana: revisar **Control Comercial** (hoy/ayer toggle) para ver cómo cerró el día anterior.
2. Crear **Pronóstico** del día por canal y por vendedor (idealmente antes de que el CEDIS empiece a cargar).
3. Durante el día: monitorear visitas en **Sin Visitar** y **Detalle Vendedor**.
4. Al cierre: revisar **Cierre del Día** y **Score Semanal**.
5. Asignar tareas o notas para mañana.

### 12.4 Operaciones paso a paso

#### Operación: Crear pronóstico (forecast)

> **Esta es la operación más importante del día — habilita la carga del CEDIS y de las rutas.** Validada en QA con Aida el 2026-04-27 (PR #26): forecast id=18, state=`draft`, analytic_account_id=820, channel=`van`.

**Ruta:** `/equipo/pronostico`.

**Pasos:**
1. Pulsar **"Nuevo pronóstico"**.
2. Capturar **fecha objetivo** (típicamente hoy).
3. Si el forecast es para un **vendedor específico**, seleccionarlo. Si es **global de sucursal**, dejarlo vacío.
4. Para cada línea:
   - Producto.
   - **Canal** (`Van` o `Mostrador`).
   - Cantidad.
5. Agregar más líneas con "+".
6. Pulsar **"Guardar"**.

**Resultado esperado:**
- El forecast queda en estado **`draft`**.
- Aparece listado en la pantalla.
- El sistema deriva automáticamente el `analytic_account_id` (sucursal) desde tu empleado en RRHH.
- El `channel` se normaliza a minúsculas internamente (`Van` → `van`).

**Importante:**
- **Guardar NO es lo mismo que confirmar.** Un forecast `draft` no se ha "lanzado" oficialmente. Si la UI separa los pasos, hay un botón posterior para confirmar.
- Una vez **confirmado**, el forecast se vuelve la base para la carga del CEDIS.

**Errores comunes:**
- **"Tu empleado no tiene sucursal asignada. Pide a administración que configure x_analytic_account_id en RRHH."** → tu empleado en `hr.employee` no tiene el campo `x_analytic_account_id` poblado. Contactar a Auxiliar Admin o RRHH para que lo configure. **Tu sucursal se deriva de ahí.**
- "Producto no válido": revisar que el producto seleccionado esté activo y sea de tu canal.
- **Error 400 con código `missing_x_analytic_account_id`**: igual que el primero — datos en RRHH.

**Cuándo escalar:** si esperabas que tu empleado tuviera el `x_analytic_account_id` configurado y aparece error, escalar a Sebastián.

#### Operación: Confirmar pronóstico

**Cuándo se usa:** después de guardar como `draft`, cuando estás seguro de los números.

**Pasos:**
1. Buscar el forecast en `draft` en la lista.
2. Tocar para abrir.
3. Pulsar **"Confirmar"**.

**Resultado esperado:** el forecast pasa a `confirmed`. El CEDIS puede ya prepararle carga a la unidad.

> **Nota:** `forecast-confirm` no fue ejercitado en el QA del 2026-04-27. Si tienes problemas, reportar.

#### Operación: Ver detalle de un vendedor

**Ruta:** `/equipo/vendedor/:id`.
**Pasos:**
1. Desde Control Comercial, tocar al vendedor.
2. Ver visitas, ventas, score, clientes sin visitar.
3. Tomar acción: asignar tarea, dejar nota, ver detalle de visita.

#### Operación: Asignar una tarea a un vendedor

**Ruta:** `/equipo/tareas`.
**Pasos:**
1. Pulsar "Nueva tarea".
2. Asignar a vendedor, capturar título, descripción, prioridad, fecha de vencimiento.
3. Guardar.

**Resultado esperado:** tarea visible en el módulo del vendedor.

> **Estado actual:** las tareas viven en **localStorage** (modo temporal). **No se sincronizan entre dispositivos.** Si limpias caché del navegador, se pierden. Hay un banner visible "modo temporal" para no confundir. Migración a backend pendiente (gap G006).

#### Operación: Dejar nota de coaching

**Ruta:** `/equipo/notas` o `/equipo/nota-rapida`.
**Pasos:**
1. Seleccionar sujeto (vendedor o cliente).
2. Escribir la nota.
3. Guardar.

> **Estado actual:** mismo que tareas — viven en localStorage. Pendiente backend (G006).

### 12.5 Qué NO debe hacer este puesto

- NO confirmar forecasts sin revisar números. Después de confirmado, requiere desbloqueo del Gerente.
- NO depender de tareas/notas como persistencia única **hasta que migre a backend**. Anota lo crítico en otro medio.

### 12.6 Errores comunes

- **`missing_x_analytic_account_id`**: empleado sin sucursal en RRHH (ver arriba).
- **Tareas/notas que "desaparecen"**: cambiaste de dispositivo o limpiaste caché. Es esperado hoy.

### 12.7 Pendientes conocidos

- **Tareas y notas en localStorage** (gap G006): no sincronizan entre dispositivos. Migración pendiente.
- **`forecast-confirm`** no ejercitado en QA reciente.
- Búsqueda de clientes para notas requiere copiar manualmente el ID hoy (gap conocido).
- Latencia inicial al crear forecast tras login (~200ms extra) por RPC fallback de `x_analytic_account_id` hasta que el JWT incluya el campo (gap G033).

---

## 13. Angélica — Administración de asistencias de Iguala

### 13.1 Alcance y entrada

El módulo **Asistencias** (`/asistencias`) es exclusivo para Angélica. Muestra
empleados activos asignados a las cuentas `IGU` e `IGU34`. Odoo valida tu
sesión en cada consulta y cambio; si el módulo aparece pero Odoo niega acceso,
no se mostrará información parcial.

### 13.2 Consultar y filtrar

1. En Inicio, abre **Asistencias**.
2. Elige **Día**, **Semana** o **Rango** y confirma fecha inicial/final.
3. Elige **Todas**, **IGU** o **IGU34**.
4. Si hace falta, busca por nombre/número y filtra por estado.
5. Revisa jornadas esperadas, presentes, faltas, incompletos y horas. Cada
   renglón representa un empleado-día y puede contener múltiples tramos.

Los filtros permanecen seleccionados después de guardar, recargar o fallar una
exportación. `Sin registro` es una alerta operativa: nunca crea una falta por sí
sola.

### 13.3 Registrar, corregir y cerrar asistencias

- **Registrar asistencia:** abre un empleado-día sin registro, confirma
  empleado/fecha, captura entrada, salida opcional y motivo administrativo.
- **Agregar tramo:** úsalo para comida o reingreso cuando todos los tramos
  anteriores estén cerrados. No captures horarios traslapados.
- **Corregir horario:** abre el tramo correcto, ajusta entrada/salida y explica
  el motivo. La versión evita sobrescribir un cambio de otra persona.
- **Registrar salida:** cierra un tramo abierto con la hora real y un motivo.

Si aparece un traslape o rango inválido, el formulario conserva lo capturado y
enfoca el horario a corregir. Si el registro cambió (`stale_record`) o el
empleado salió de alcance, el sistema recarga primero; abre de nuevo el registro
actualizado antes de reintentar.

### 13.4 Registrar y justificar faltas

1. En un empleado-día sin asistencia, pulsa **Registrar falta**.
2. Selecciona motivo, agrega notas y escribe el motivo administrativo.
3. Si aparece **Falta no programada**, verifica el calendario y activa la
   confirmación explícita antes de reenviar. Sin esa confirmación no se guarda.
4. Para una falta pendiente, pulsa **Justificar falta**, elige el tipo, agrega
   notas y, opcionalmente, un PDF, JPG o PNG de hasta **5 MiB**.

No es posible registrar una falta si ya hay asistencia. Si ya existe una falta
o asistencia para esa fecha, el formulario se cierra, el listado se recarga y
se abre el historial del registro existente cuando Odoo entrega su ID. Una
falta procesada ya no puede justificarse desde esta pantalla.

Si aparece que el administrador no tiene usuario Odoo, no reintentes la
justificación: soporte debe vincular primero al empleado 717 con una cuenta
`res.users` activa. Un comprobante inválido conserva el formulario; reemplázalo
por un archivo permitido de hasta 5 MiB.

### 13.5 Historial y Excel

- **Ver historial** muestra quién creó, corrigió, cerró o justificó el registro,
  cuándo ocurrió, el motivo y valores anteriores/posteriores. No muestra
  tokens ni el contenido binario de comprobantes.
- **Exportar Excel** descarga exactamente el rango, cuenta, empleado y estado
  activos. El archivo contiene `Resumen`, `Asistencias` y `Faltas`. Espera a que
  termine; el botón queda bloqueado para evitar doble descarga.
- Si la exportación falla, no se descarga un archivo parcial ni se pierden los
  filtros. Corrige la conexión/configuración indicada y vuelve a pulsar
  **Exportar Excel**.

### 13.6 Errores y recuperación

- **Sesión vencida:** vuelve a iniciar sesión.
- **Acceso denegado:** vuelve al inicio y pide que revisen ambas allowlists; no
  intentes entrar por URL directa.
- **Falta configurar IGU o IGU34:** reporta exactamente el código indicado para
  que lo creen/corrijan en Odoo.
- **Registro cambió / empleado cambió de cuenta:** espera la recarga y vuelve a
  abrir el registro vigente.
- **Traslape o salida anterior a entrada:** corrige el campo enfocado; no se
  pierde el formulario.
- **Falta/asistencia existente:** revisa el historial que se abre y evita crear
  un duplicado.
- **Día no programado:** confirma solo después de verificar que realmente debe
  contabilizarse como falta.
- **Comprobante inválido:** usa PDF, JPG o PNG, no vacío y máximo 5 MiB.
- **Error de Excel:** conserva los filtros y reintenta desde el mismo botón; si
  persiste, reporta rango y hora sin adjuntar datos sensibles.

---

## 14. Glosario operativo

| Término | Significado |
|---------|-------------|
| PWA | Aplicación web progresiva — esta app que puedes instalar en el celular. |
| Hub | Pantalla principal de un módulo, con accesos a las áreas. |
| Timeline | Lista visual de pasos en orden. Cada paso bloquea al siguiente. |
| Handover | Entrega formal de turno entre dos personas. |
| Forecast / Pronóstico | Proyección de venta del día por vendedor o sucursal. Habilita la carga del CEDIS. |
| Carga | El producto preparado en CEDIS para una unidad, basado en forecast. |
| Picking | Movimiento de inventario en Odoo (recepción, traspaso, retorno). |
| `done` | Estado "completado" de un picking. Inventario ya se actualizó. |
| Stock libre / `available_qty` | `on_hand_qty` − `reserved_qty`. Lo que sí puedes usar. |
| Reservado / `reserved_qty` | Stock comprometido para una carga, ticket o reserva pendiente. |
| Físico / `on_hand_qty` | Stock contable en el almacén. Incluye lo reservado. |
| CEDIS | Centro de distribución (Almacén de Entregas en cada plaza). |
| PT | Producto Terminado. |
| MP | Materia Prima. |
| Plaza | Ciudad donde opera la sucursal (Iguala, Morelia, Guadalajara, Toluca, Zihuatanejo, Manzanillo). |
| Sucursal | Operación específica dentro de una plaza. |
| Canal `Van` | Venta a ruta — el vendedor sale en camioneta. |
| Canal `Mostrador` | Venta directa al público que llega al CEDIS. |
| Liquidación | Conciliación final de la ruta: cuánto vendió, cobró, devolvió. |
| Corte | Conciliación intermedia de inventario antes de cerrar la ruta. |
| Cierre de Caja | Arqueo del POS de mostrador con denominaciones físicas. |
| Bypass admin | Modo de prueba — NO usar en operación real. |
| Kold Field | App externa donde se hacen visitas y ventas reales. La PWA solo controla, no captura visitas. |

---

## 15. Errores frecuentes y solución rápida

| Mensaje | Significado | Qué hacer |
|---------|-------------|-----------|
| "Algo salió mal" | Error JS no manejado | Pulsar "Volver al inicio". Si se repite, capturar pantalla y reportar. |
| "Sin sesión" / vuelve a login | Sesión expiró (7 días) o cerraste en otra pestaña | Volver a entrar con PIN + barcode. |
| "X-GF-Token inválido" | Falta `VITE_GF_SALESOPS_TOKEN` en Vercel | Reportar a Sebastián. |
| "No tienes acceso a este plan" | Plan/recurso no es tuyo | Verificar con jefe que el recurso esté asignado a tu empleado. |
| "Backend rechazó la operación" | Falla de negocio (sin stock, dato inválido) | Leer el mensaje, corregir el dato y reintentar. |
| "Sesión drift detectado" | Otra sesión activa con tu PIN | Esperar el reload automático. |
| "Tu empleado no tiene sucursal asignada" | Falta `x_analytic_account_id` en RRHH | Contactar Auxiliar Admin o RRHH. |
| "Sin carga asignada" | No hay carga lista para tu unidad | Verificar con Supervisor (forecast) o Almacenista Entregas (carga). |
| "Hay ciclos abiertos" / "paros sin cerrar" | No puedes cerrar turno con cosas abiertas | Cerrar lo abierto antes de cerrar el turno. |
| "Mock Dashboard" en KPIs | Metabase no expone tokens reales aún | Esperado hoy (gap G001). Datos del Dashboard sí son reales. |

---

## 16. Escalamiento y soporte

### Niveles de escalamiento

1. **Operativo (mismo turno):** llamar a tu supervisor inmediato (Jefe de Producción, Gerente, Supervisor de Ventas según rol).
2. **Funcional (mismo día):** Auxiliar Admin o Gerente de Sucursal.
3. **Técnico:** Sebastián (Director de TI) — para errores de backend, tokens, configuración Odoo, gaps documentados.
4. **Crítico (sistema caído):** Yamil (Dirección General).

### Qué incluir al reportar un error

- **Tu nombre** y **rol**.
- **Hora exacta** del error.
- **Captura de pantalla** del error.
- **Qué estabas haciendo** justo antes (qué pantalla, qué acción).
- **Qué dato específico** capturaste.
- Si tienes acceso a la consola del navegador, el contenido de `window.__gfLastError`.

### Lo que está en gaps conocidos NO es bug

Algunas cosas son pendientes documentados (no fallas nuevas):

- KPIs Mock (G001).
- Tareas y notas que se borran al cambiar de dispositivo (G006).
- Corte y liquidación que pueden perderse si cierras la app antes del cierre (G016).
- Foto base64 pesa más en cada request (G008).

Lista completa: ver [`docs/GAPS_BACKLOG.md`](GAPS_BACKLOG.md).

---

## 17. Changelog

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-04-27 | v1.0 | Generación inicial. Cubre los 11 roles operativos (9 primarios + 2 secundarios documentados dentro del primario que cubren). Refleja estado real al commit `2476ea3`. Validaciones de QA recientes (PR #21–#27) incluidas. Necesita review humano antes de capacitación masiva. |
