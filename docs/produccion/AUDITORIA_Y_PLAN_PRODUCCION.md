# Producción — Auditoría y plan de construcción (front + back)

**Fecha:** 11 de agosto de 2026 · v2 (incorpora la auditoría de Codex sobre el plan)
**Ámbito:** puesto de Supervisor de Producción (Miguel Morales) + Almacenista de PT en `grupofrio/colaboradores-pwa`, con backend Odoo (`gf.production.*`, `gf.energy.reading`, `gf.evaporator.cycle`, `maintenance.request`)
**Base:** auditoría del 9-ago (modelos Odoo por RPC, código del rol y recorrido en vivo con la sesión de Miguel) + verificación de código en esta revisión
**Complemento:** mockups navegables de 20 pantallas (`mockups_produccion.html`, artefacto "produccion-mockups-supervisor")
**Trabajo ya en vuelo:** el FE de la Fase 1 (energía 3 registros, compresores con estado inicial, esperado vs real con bitácora parcial) está avanzado en la rama `feat/plant-energy-compressors-fe` (PR #168), en pareja con el backend GrupoVeniu/GrupoFrio#284.

---

# PARTE 0 — RESOLUCIONES DE LA AUDITORÍA CODEX (previas a construir)

Codex auditó el plan v1; se aceptan sus 10 hallazgos. Resoluciones vinculantes:

1. **(P0) Ledger de inventario por lote/movimiento.** Estados: `declarado → en_transito_a_PT → recibido → en_disputa → recontado → ajustado`. Una diferencia de recepción NUNCA crea merma directa: queda **en disputa** y dispara recuento; solo una conciliación autorizada crea merma. "En piso / por recibir" es un estado visible que **no penaliza score ni inventario** — retrasos, recuentos y conversiones barra/bolsa dejan de convertirse en scrap falso.
2. **(P0) Energía confiable, no solo multiplicador.** Lecturas crudas **inmutables** con `meter_id`, unidad original (kWh/MWh), **multiplicador versionado con snapshot** por lectura, foto, hora del servidor y rango de delta plausible; manejo de reemplazo/reset del medidor y rollover. Hasta tener **dos lecturas comparables**, la pantalla dice "Eficiencia no disponible" — ni kg/kWh ni comparación 7d.
3. **(P0) Política offline y de autoridad.** Cola offline idempotente con estado "pendiente de confirmar" y conflicto visible al reconectar; los gates tienen camino de **excepción operativa** (causa + evidencia + vencimiento + responsable + alerta posterior) — una falla de wifi no detiene el turno físico, y nunca hay bypass silencioso. El cierre es solo server-side; el **PIN se verifica en backend** con rate limit, auditoría, identidad y timestamp, jamás almacenado en el dispositivo.
4. **(P1) Horas de compresor como modelo de estado, no como taps sueltos.** Eventos idempotentes con fuente y **hora efectiva separada de hora de captura** (permite captura tardía honesta), relación configurada máquina→línea→capacidad (una línea puede depender de varios equipos), y estado `no_confiable` cuando falta trazabilidad. Bitácora parcial o no confiable **no alimenta score ni marca "en meta"**.
5. **(P1) Score gateado por confianza del dato.** Antes de cualquier fórmula, el hub muestra los **componentes y su confianza** (producción · recepción PT · energía comparable · horas confiables). El score solo se calcula cuando los componentes mínimos cierran; si no: "Sin calificación: faltan datos de recepción/energía".
6. **(P1) Segregación de funciones con permisos backend.** Almacenista PT crea/captura/recuenta; Supervisor revisa, valida con causa o **solicita recuento** — nunca edita conteos ni ajusta stock; Gerencia ve. Matriz de permisos por rol y almacén en Odoo, no en la UI.
7. **(P1) Gates con excepción operativa** (ver punto 3) — aplicado en la pantalla de apertura.
8. **(P2) Toda alerta con acción primaria y secundaria** (registrar paro, crear mantenimiento, ver lote, conciliar) — aplicado en mockups.
9. **(P2) Deduplicación de mantenimientos:** clave `máquina + tipo + ventana temporal`, severidad, vínculo a evidencia y reapertura controlada.
10. **(P2) Primer corte angosto: 3 verticales completos, no 20 pantallas.** Ver Parte 5 v2: (a) apertura confiable + energía, (b) bitácora/paro de máquina, (c) producción → recepción PT → disputa. El resto (tendencias, alertas avanzadas, re-tema completo) va en segunda ola. Las 20 pantallas del mockup son la **visión objetivo**, no el alcance del piloto. El hub del piloto es una lista de **3 acciones prioritarias** ("qué hago ahora"), con lo demás como vistas secundarias.

---

# PARTE 1 — AUDITORÍA (versión final, con decisiones incorporadas)

## 1.1 Veredicto general

La base es sólida: el turno como columna vertebral con gates duros de apertura, cierre en cascada, tanques con mapa físico y gates de cosecha, 655 ciclos históricos de evaporador, paros con categorías, checklist HACCP con plantillas por línea, brief de planta accionable y energía con foto obligatoria. Los problemas cuestan dinero por tres vías: **la energía no sirve para costear** (una sola lectura, sin multiplicador del medidor — el consumo registrado es ~1000× menor que el real), **los compresores no registran horas** (imposible calcular producción esperada), y **el dato le miente al supervisor** (score 100 con desbalance 30%, merma "0.0 ✓" cuando el dato delata 530 kg escondidos).

## 1.2 Decisiones de producto tomadas en esta revisión

1. **El indicador del supervisor es kg/kWh, no dinero.** Kilos producidos capturados ÷ diferencial de lecturas (× multiplicador del medidor) — "cuántos kilos de hielo da cada kWh", mientras más alto mejor. Se compara contra su propio promedio de 7 días y su mejor turno. El $ (tarifa GDMTH por periodo) se calcula en Odoo con los mismos datos y lo ven gerencia y dirección, no el supervisor.
2. **La transformación (molido barra → bolsa) la captura el Almacenista de PT, pero depende del supervisor.** La ruta `/almacen-pt/transformacion` ya existe. Regla nueva: **la merma de molido se calcula (entrada − salida), nunca se teclea**; causa obligatoria al exceder el estándar de conversión; el lote fuera de estándar se vuelve pendiente de visto bueno del supervisor (validar con causa o rechazar para recuento). Causas repetidas generan solicitud de mantenimiento con un tap.
3. **El almacén de PT es parte del ciclo de producción.** Lo producido se **recibe en PT con conteo** (almacenista); la diferencia queda **en disputa** con motivo y evidencia (nunca merma directa — ver Parte 0.1). El supervisor ve el flujo completo (producido → recibido → surtido a rutas) y el desbalance aterriza con nombre: **"en piso / por recibir"**, con botón para reclamar la recepción. Las existencias de PT contra lo comprometido para rutas de mañana son el puente con el forecast de ventas.
4. **Bitácora de compresores por equipo.** Cada tarjeta ES un compresor (`gf.production.machine`); el tap registra arranque o paro **de ese equipo** con hora del servidor; la bitácora de eventos (equipo + evento + hora) es visible y de ahí se derivan las horas por compresor por turno. Día uno: declarar "está encendido / está apagado" (needs_seed). Bitácora parcial advertida en amarillo con palabra — el esperado se marca subestimado, nunca se tapa con "en meta".
5. **Checklist por equipo reusando el motor HACCP existente** (endpoints `/pwa-prod/checklist`, `/api/production/haccp/check`, `/pwa-prod/checklist-complete`, plantillas por línea, rangos numéricos ya soportados con `checklistNumericRange`). Lo que falta: ligar plantillas a máquina. Punto reprobado → foto obligatoria + `maintenance.request` con un tap.
6. **Navbar de 5 pestañas:** **Turno** (hub contextual: apertura → en curso → cierre) · **Producción** (operadores, tanques/cosecha, ciclos, molido, almacén PT) · **Máquinas** (compresores, checklists de equipo, paros, mantenimiento, esperado vs real) · **Energía** (lecturas 3 registros y kg/kWh) · **Más** (brief, alertas, merma conciliada, historial).
7. **Todo foco lleva botón.** El principio transversal de las 20 pantallas: operador sin captura → "Ver Tanque 1", foco del brief → "Ir a conciliar", checklist reprobado → "Crear mantenimiento", paro → justifica la brecha del esperado. Nada es un dato suelto.
8. **Identidad visual:** tema claro institucional (paridad con ventas: `brandTokens.js`, semáforo palabra + glifo, contrastes AA) y logo oficial de Grupo Frío. El rol hoy está en tema oscuro con logo viejo.

## 1.3 Hallazgos críticos (confirmados)

| # | Hallazgo | Evidencia | Consecuencia |
|---|---|---|---|
| B1.1 | Una sola lectura de energía por momento; no existen los 3 registros tarifarios en ningún modelo/pantalla | Recorrido en vivo + cero coincidencias en código y Odoo | No se puede costear con GDMTH ni mover producción a horas baratas |
| B1.2 | Lecturas 1290.0 → 1297.0 en una semana (~1 kWh/día) para una planta de 13,370 kg/día: falta el **multiplicador del medidor** (o el display está en MWh) | Serie de `gf.energy.reading` | El consumo registrado es ~1000× menor que el real; cualquier kg/kWh derivado es basura |
| B1.3 | `energy_kwh_per_kg` calculado en backend del dashboard pero nunca mostrado | Código del dashboard | El indicador estrella está a medias y tirado |
| B2 | Compresor 1 (Barras) y Compresor 2 (Rolito) existen como `gf.production.machine` tipo `compresor` pero **nadie registra encendido/apagado ni horas** | Cero referencias en código y datos | Sin producción esperada = nominal × horas; capacidades nominales YA capturadas (Tanque 1: 9.6 t/d · 25 h · 50 kg/barra; Evaporador 1: 30 t/d) |
| B3 | Datos sucios: 3 máquinas de prueba Codex activas; Tanque 3 con capacidad 0; "Condensador" clasificado como evaporador; ids de máquina hardcodeados e inconsistentes en código | Catálogo de máquinas en Odoo prod | Contaminan agregados; el esperado por línea no cierra |
| B4.1 | "Score 100" verde junto a "Desbalance 30.2%" rojo (1300 producidos vs 907.5 empacado+merma) | Hub en vivo | El score miente; 392.5 kg sin cuadrar no penalizan |
| B4.2 | Merma "0.0 kg ✓" en captura mientras el brief del mismo día detecta 530 kg escondidos en transformaciones | Recorrido en vivo | El supervisor ve "todo bien" donde dirección ve un foco |
| B4.3 | Botón de tarjeta de tanque navega a ruta no permitida → redirect al inicio | Recorrido en vivo | Navegación muerta |
| B5 | Cerrar turno sin PIN (la función existe y nadie la llama) · cierre de operadores en localStorage · handover 100 % en navegador · mantenimiento sin equipo/turno/almacén · merma por pieza en prefijo de texto · salmuera sin histórico (sobreescribe) · tests casi nulos · tema oscuro con logo viejo | Código del rol | Controles débiles y manipulables |

## 1.4 Lo que YA existe y se conserva

Gates duros de apertura (energía inicial + sal en todos los tanques) · cierre en cascada (no cierra sin las entregas de Rolito y Barra) · score y desbalance calculados server-side · mapa físico de tanques con slots, gates de cosecha y merma de barras · ciclos congelado/deshielo/vaciado con hora del servidor · paros con categorías (`gf.production.downtime`) · checklist HACCP con plantillas por línea (barras · rolito · transformación) y rangos numéricos · `maintenance.request` integrado (lectura) · brief de planta con selector de día y focos · foto obligatoria y validación fin ≥ inicio en energía · balance entrada = salida + merma en transformación (`validateTransformBalance`) · módulo `almacen-pt` con su transformación y `ScreenReconciliacionPT`.

---

# PARTE 2 — DISEÑO OBJETIVO (las 20 pantallas, en el orden del día)

**Apertura (Turno):** 1 Apertura de turno (gates por palabra: energía 3 registros ✓ · sal de tanques ⚠ falta T3 · estado de compresores ▢ · operadores ✓) · 2 Checklist de equipo (por máquina, rangos numéricos, punto reprobado → foto + mantenimiento) · 3 Hub honesto (score penalizado por desbalance, real vs esperado por línea, kg/kWh y rendimiento de molido como "Tu eficiencia", pendientes accionables).

**Operación (Producción):** 4 Operadores del turno (cascada visible del servidor, "sin captura desde 10:15" como foco con botón) · 5 Cosecha de tanque (slots que cumplieron su tiempo, gate de salmuera por palabra, barras quebradas con causa en el momento) · 6 Ciclos del evaporador (una fase un botón, tiempo vs promedio como señal temprana) · 7 Tanques y salmuera (mapa que ya existe + **historial** de sal/temperatura con tendencia, navegación arreglada) · 8 Molido · captura (Almacenista PT: entrada en barras, salida en bolsas, merma calculada, causa obligatoria al exceder estándar) · 9 Molido · supervisión (rendimiento por lote, visto bueno de lotes fuera de estándar, causas repetidas → mantenimiento) · 10 Almacén PT · recepción (Almacenista PT: conteo contra lo declarado, diferencia con motivo → merma con evidencia) · 11 Almacén PT · existencias y conciliación (producido → recibido → surtido; "en piso / por recibir" con botón de reclamo; existencias vs comprometido para rutas de mañana).

**Máquinas y energía:** 12 Paros de línea (equipo → categoría → confirmar; el paro justifica la brecha del esperado; tiempo parado acumulado) · 13 Bitácora de compresores (por equipo, log de eventos con hora del servidor, needs_seed día uno, bitácora parcial advertida) · 14 Esperado vs real (nominal × horas de compresor por línea, kg por hora-compresor, tendencia 7 días con mejor/peor turno) · 15 Mantenimiento (solicitudes con **origen**: checklist · molido · paro · manual; filtro por equipo; métricas de cierre) · 16 Energía · 3 registros (base/intermedia/punta + foto en inicio y fin; multiplicador server-side; consumo por periodo en kWh; **kg/kWh como indicador del turno** comparado contra su 7d; sin $).

**Cierre (Turno/Más):** 17 Merma conciliada (capturada vs detectada lado a lado; la de molido y la de recepción PT llegan solas; por pieza con campos propios; límite 1 % por palabra) · 18 Brief de planta (ya existe; re-estilizado; **cada foco con su botón** de ir a resolver) · 19 Alertas de eficiencia (en su idioma: kWh, horas y kilos — compresor sin producción, punta arriba de umbral, esperado incumplido N turnos, merma de molido arriba de estándar, merma escondida recurrente; la versión en $ la ve gerencia) · 20 Cierre de turno (cascada del servidor, lectura fin, handover a Odoo como registro oficial, **PIN del supervisor**).

**Sistema visual transversal:** tokens del tema claro institucional + logo Grupo Frío; palabra + glifo en todo estado; null ≠ 0 ("Sin dato", nunca "--"); todo foco con botón; touch targets ≥ 44 px; hora del servidor en todo evento; captura en el punto de acción (steppers grandes), no formularios de memoria al final del turno.

---

# PARTE 3 — PLAN DE CONSTRUCCIÓN · FRONTEND (PWA)

> Mismas convenciones que ventas: vista pura + contenedor + modelo puro; estados honestos como criterio de aceptación; tests de contrato con fixtures golden; `npm run lint --max-warnings 0`.

## PF0 — Datos y quick wins (semana 1; PF0.1-0.3 son de Odoo, sin código PWA)

* **PF0.1** Multiplicador del medidor: campo de configuración en Odoo + corrección de la serie histórica si aplica. **Sin esto, todo lo de energía nace muerto.**
* **PF0.2** Limpiar catálogo de máquinas: desactivar las 3 de Codex, capturar nominal del Tanque 3, reclasificar el Condensador, capturar nominal de cada compresor.
* **PF0.3** Tarifa GDMTH por periodo desde el recibo de CFE (para el $ de gerencia; el supervisor no la ve).
* **PF0.4** Quick wins de PWA: arreglar navegación muerta del tanque; llamar la función de PIN al cerrar turno; historial de salmuera (crear registro en vez de sobreescribir); voz en energía; matar los ids de máquina hardcodeados (catálogo desde el backend).

## PF1 — Aterrizar la rama del PR #168 (semanas 1-2; backend #284)

* **PF1.1** Energía 3 registros (ya construido en la rama): validación espejo, foto, compatibilidad con turnos de lectura única. Ajuste nuevo: el indicador mostrado es **kg/kWh** (kilos capturados ÷ diferencial × multiplicador), comparado contra 7d propio; retirar cualquier $ de la vista del supervisor.
* **PF1.2** Compresores (ya construido): toggle por equipo, needs_seed día uno, bitácora parcial. Ajuste nuevo: **log de eventos visible** (equipo + evento + hora del servidor).
* **PF1.3** Esperado vs real (ya construido): panel por línea con bitácora parcial en amarillo. Ajuste nuevo: kg por hora-compresor y tendencia 7 días.

## PF2 — Las pantallas nuevas del flujo (semanas 2-4)

* **PF2.1** Hub honesto: componentes con confianza del dato y score **solo cuando cierran** ("Sin calificación: falta X" mientras no); en piloto, el hub es una lista de 3 acciones prioritarias. "Tu eficiencia" (kg/kWh + rendimiento molido) con "Eficiencia no disponible" sin lecturas comparables.
* **PF2.2** Operadores del turno: cascada desde backend (sustituye localStorage), última captura, focos con botón.
* **PF2.3** Cosecha guiada: slots con gate por palabra, merma de barras con causa en el momento (los modelos ya existen).
* **PF2.4** Ciclos: fase única con botón grande, tiempo vs promedio.
* **PF2.5** Molido: captura PT con merma calculada + supervisión con visto bueno (reusar `validateTransformBalance`; el cambio es que scrap deja de ser input y pasa a derivado + causa).
* **PF2.6** Almacén PT: recepción con conteo y diferencia con motivo; existencias y conciliación con "en piso / por recibir" (conectar `ScreenReconciliacionPT` a este flujo).
* **PF2.7** Paros: 3 taps (equipo → categoría → confirmar), paro activo con reanudar, acumulado del turno.
* **PF2.8** Checklist de equipo: plantillas del motor HACCP ligadas a máquina; reprobado → foto + mantenimiento.
* **PF2.9** Mantenimiento: lista con origen (checklist/molido/paro/manual), filtro por equipo.
* **PF2.10** Merma conciliada: capturada vs detectada, por pieza con campos propios, focos del brief aterrizados.
* **PF2.11** Cierre: cascada backend + handover a Odoo + PIN.
* **PF2.12** Brief re-estilizado con botones por foco. Alertas de eficiencia (kWh/horas/kilos).

## PF3 — Re-tema y paridad con ventas (paralelo, semanas 2-5)

* Tema claro institucional + logo (el rol está en oscuro con logo viejo) · shell con navbar de 5 pestañas (Turno · Producción · Máquinas · Energía · Más) · vista pura + modelo puro por pantalla · tests (hoy casi nulos vs ~40 del rol de ventas): contrato golden por endpoint nuevo + render real de vistas puras · accesibilidad AA verificada por test de tokens.

---

# PARTE 4 — PLAN DE CONSTRUCCIÓN · BACKEND (Odoo)

## PB1 — Energía (pareja del PR #168 / #284, más el multiplicador)

* **PB1.1** `gf.energy.reading` gana columnas base/intermedia/punta (inicio y fin) — en vuelo en #284.
* **PB1.2** **Lecturas crudas inmutables** (`meter_id`, unidad original, foto, hora servidor, rango de delta plausible) + **multiplicador versionado con snapshot por lectura**; manejo de reset/reemplazo del medidor y rollover; corrección de la serie histórica o fecha de corte declarada. Regla dura: sin dos lecturas comparables → "Eficiencia no disponible".
* **PB1.3** Endpoint del indicador: kg/kWh del turno (kilos declarados del turno ÷ consumo) + promedio 7d + mejor turno propio. El valorizado $ por periodo (tarifa GDMTH configurada) va a los endpoints de gerencia, no a los del supervisor.

## PB2 — Compresores y esperado

* **PB2.1** Bitácora como **modelo de estado por máquina** con eventos idempotentes: `machine_id` + turno + fuente + **hora efectiva ≠ hora de captura** + `seed` inicial; estado `no_confiable` sin trazabilidad; relación configurada máquina→línea→capacidad — extiende lo en vuelo en #284.
* **PB2.2** Horas por compresor por turno derivadas; flag `bitacora_parcial` con horas sin registro.
* **PB2.3** Esperado por línea = nominal × horas (tanques por Barras; evaporador por Rolito); brecha %; kg por hora-compresor; serie 7/30 días.

## PB3 — Molido y almacén PT

* **PB3.1** Transformación: `scrap_kg` pasa a **derivado** (entrada − salida) con causa de catálogo obligatoria sobre umbral; estándar de conversión configurable por producto.
* **PB3.2** Visto bueno del supervisor: estado del lote (`en_estandar` / `por_validar` / `validado` / `rechazado`), con quién y cuándo.
* **PB3.3** Recepción en PT sobre el **ledger por lote** (Parte 0.1): declarado → en tránsito → recibido → en disputa → recontado → ajustado; diferencia → disputa + recuento; solo conciliación autorizada crea merma; "por recibir" consultable y sin efecto en score/inventario.
* **PB3.4** Existencias de PT con comprometido (ligado al forecast de rutas de ventas).

## PB4 — Controles

* **PB4.1** PIN al cerrar turno **verificado en backend** (rate limit, auditoría, identidad, timestamp; nunca almacenado en dispositivo); cierre solo server-side.
* **PB4.2** Cierre de operadores y handover como registros del turno en Odoo (matar localStorage y el handover de navegador).
* **PB4.3** Checklist de equipo: `machine_id` en plantillas HACCP; reprobado crea `maintenance.request` con equipo, turno y origen.
* **PB4.4** `maintenance.request`: campos equipo/turno/origen + filtro por almacén.
* **PB4.5** Salmuera como serie histórica (nuevo registro por lectura) + merma por pieza con columnas propias.
* **PB4.6** Paros ligados a máquina y al cálculo del esperado (paro registrado descuenta horas esperadas).
* **PB4.7** Excepción operativa de gates (causa/evidencia/vencimiento/responsable) + cola offline idempotente con "pendiente de confirmar" y resolución de conflictos.
* **PB4.8** Alertas (compresor sin producción, punta > umbral, esperado incumplido N turnos, molido fuera de estándar recurrente, merma escondida) — mismos endpoints alimentan la pestaña Producción del rol Gerente; mantenimientos autogenerados deduplicados por máquina + tipo + ventana.

---

# PARTE 5 — SECUENCIA, VERIFICACIÓN Y RIESGOS

## Secuencia v2 (re-alcance tras Codex: 3 verticales + captura sombra)

```
Semana 1   Contratos de datos congelados (turno, medidor, máquina, lote,
           recepción PT, disputa, merma, mantenimiento) + PF0 (multiplicador,
           catálogo, quick wins) + PB4.1 PIN
Semana 2-3 VERTICAL A: apertura confiable + energía (lecturas crudas,
           "eficiencia no disponible" hasta comparables, excepción de gates)
           VERTICAL B: bitácora/paro de máquina (modelo de estado, no_confiable)
Semana 3-4 VERTICAL C: producción → recepción PT → disputa (ledger por lote)
           Hub piloto = 3 acciones prioritarias
Semana 4-5 PILOTO SOMBRA en Iguala: captura en paralelo SIN bloquear la
           operación real, comparando contra lo físico una semana completa
Semana 6   Activar gates SOLO donde completitud y reconciliación ya son
           confiables · decidir segunda ola (tendencias, alertas avanzadas,
           esperado vs real alimentando score, re-tema completo)
```

Reglas duras: los gates no se activan hasta que las métricas de completitud del piloto sombra lo justifiquen; nada de energía sale sin lecturas comparables; el score no aparece hasta que sus componentes cierren.

## Verificación

* Contratos golden + test de drift por cada endpoint de PB1-PB4 (mecanismo ya probado en ventas).
* Guion de día completo en staging: abrir turno → checklist equipo → cosecha → ciclos → molido (PT captura, supervisor valida) → recepción PT → paro → lecturas fin → conciliación → cierre con PIN. El corte debe cuadrar: producido = recibido en PT + en piso + merma (toda con causa).
* El kg/kWh del turno debe coincidir con el cálculo manual desde las lecturas del medidor físico (validación en el piloto).
* Estados honestos: ninguna pantalla pasa revisión con color-sin-palabra, "--", o `bitacora_parcial` tapada.
* Casos críticos (lista de Codex): offline/reintento, doble captura, eventos fuera de orden, cambio de turno con bitácora abierta, recuento PT, reset/reemplazo de medidor, permisos cruzados entre roles.
* Validación manual pendiente que Codex señaló: recorrido real en móvil 390 px, tablet, y con los usuarios reales (Miguel y el almacenista PT) — programada dentro del piloto sombra.

## Riesgos

1. **El multiplicador y la corrección del histórico** — si el histórico no se puede corregir, declarar la fecha de corte ("datos comparables desde X") en vez de mezclar series.
2. **Doble captura en la transición del molido** (pantalla vieja teclea merma, nueva la deriva): cortar por versión, no convivir.
3. **Recepción PT agrega un paso al almacenista** — el piloto debe medir que el conteo no cuelle la operación; si estorba, recepción rápida "conforme" con conteo solo en excepción.
4. **El score re-calibrado** (penalizar desbalance) cambia un número que la gente ya conoce — comunicarlo antes del piloto para que un 84 no se lea como "empeoramos".

## Decisiones pendientes (de la auditoría, siguen abiertas)

1. ¿El medidor es uno solo para toda la planta o hay medidor por línea/compresor? — define si el kg/kWh se puede partir por línea o solo global.
2. Horario tarifario GDMTH vigente (del recibo de CFE) — solo para el $ de gerencia.
3. ¿La bitácora de compresores la captura Miguel, el operador de línea, o ambos con validación del supervisor? — el mockup asume supervisor con validación; se ajusta sin cambiar el modelo.

---

*Anexos: mockups de referencia (`mockups_produccion.html` / artefacto "produccion-mockups-supervisor", 20 pantallas) · documento hermano de ventas (`auditoria_y_plan_koldfield.md`) · rama FE en vuelo `feat/plant-energy-compressors-fe` (PR #168) y backend GrupoVeniu/GrupoFrio#284 · patrones de referencia en `src/modules/supervisor-ventas/v2/` y `src/theme/brandTokens.js`.*
