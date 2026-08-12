# Gerente de Sucursal — Auditoría y plan de construcción (front + back) · v2 (post-auditoría YELLOW)

**Fecha:** 11 de agosto de 2026
**Ámbito:** puesto de Gerente de Sucursal (+ Auxiliar de Admin) en `grupofrio/colaboradores-pwa`, con backend Odoo (`grupofrio-gf.odoo.com`, gf_saleops / gf_hr_ops / gf_pwa_admin)
**Base:** auditoría del puesto (código completo + datos vivos de Odoo por RPC) · análisis dimensional de Codex (piloto Iguala) · barrido de omisiones de esta fecha (29 actividades) · **verificación en vivo contra Odoo productivo del 11-ago** (asistencias y fichas)
**Complemento:** mockups navegables de 17 pantallas (`docs/gerente/mockups_gerente.html`, artefacto "gerente-mockups-rediseno")
**Estado del trabajo:** esperando **Fase 0** (Odoo, con Sebas); **Fases 1, 2 y 3 ya construidas en PRs draft** (`feat/gerente-v2-shell`, `feat/gerente-controls-panel`: rail de 7 pestañas + panel de Controles de 15 reglas + editor read-only + cierres de deep-links).

---

# PARTE 0 — DECISIONES VINCULANTES

1. **La gerente es el superconjunto.** Es responsable de TODA la operación de la sucursal: ve y puede sustituir a sus tres puestos (supervisor de ventas, supervisor de producción, aux de admin). Su app **no duplica pantallas**: los botones "Ver rutas del equipo" y "Ver turno de producción" hacen deep-link a las apps de los supervisores con su scope por token y solo-lectura donde el puesto no escribe. Una sola fuente de verdad; cada mejora a un supervisor le llega gratis a la gerente.
2. **Gastos: arranque Plaza-primero** (recomendación de Codex aceptada). Plaza obligatoria y verificada server-side; UN y CC visibles como "Pendiente de Fase 0" hasta que exista el campo de UN y el catálogo CC curado — entonces se vuelven obligatorias. Ningún gasto se captura a medio-dimensionar sin declararlo; fail-closed explicado (si el almacén no deriva Plaza, la captura se bloquea diciendo por qué y a quién avisar).
3. **La matriz del artículo es la inteligencia; la captura son 4 datos.** El artículo (dato maestro, mantenido por **contabilidad central en Odoo**, jamás por la capturista) carga: cuenta contable, impuestos, UoM, regla de CC/UN y qué pide en captura (cantidad, activo destino, tipo de mantenimiento, evidencia). La captura: **artículo · cantidad · monto · "¿para qué es?"** + foto. El "para qué" (vehículo/máquina — planes analíticos que YA existen en Odoo) refina CC, UN y dimensión: combustible→unidad 265→CC Logística + dimensión Vehículo; pistón Mycom→Compresor 2→CC Producción L2 + UN Planta + historial de mantenimiento del equipo.
4. **"Otros (por clasificar)" nunca se asienta.** La captura no se bloquea por artículo faltante: existe "Otros" con nota y foto obligatorias, pero queda en cola de contabilidad para reclasificar (o crear el artículo) ANTES de generar póliza. La operación no se detiene; los libros no se ensucian.
5. **Depósitos y retiros son un flujo aparte** (hoy contaminan gastos: "DEPOSITO OXXO BBVA $7,034" capturado como gasto). No tocan el P&L; alimentan la conciliación venta ↔ corte ↔ depósitos.
6. **Rail de 7 pestañas (ya construido, se respeta):** Hoy · Equipo · Admin · Producción · Inventario · Controles · Más. El selector de razón social sube al shell (el puesto opera varias compañías). Controles (15 reglas en 5 categorías, semáforo por palabra) se conserva de Fase 3 + acción por hallazgo.
7. **El hub "Hoy" ES la ronda de la mañana** de la gerente: ¿salieron las unidades? → ¿producción trabajando? → ¿caja/mostrador operando? → pendientes de administración. Cada verificación con palabra y botón. Venta REAL del día (no snapshot), caja del corte real (no alias), null ≠ 0.
8. **Talento — checador verificado, higiene primero.** El kiosko de Odoo YA deposita en `hr.attendance` (verificado en vivo: 1,024 checadas, 295/30d). Asistencias pasa de captura manual a **gestión de excepciones**; la pre-nómina solo computa **horas saneadas** (tramo huérfano→cierre con motivo; jornada máxima; checada <1 min descartada; **ficha canónica** para personas duplicadas), con autorización de dos niveles como los cortes de caja.

---

# PARTE 0-BIS — RESOLUCIONES DE LA AUDITORÍA YELLOW (previas a cualquier write)

Se aceptan los 9 hallazgos. Resoluciones vinculantes:

1. **(P0) ScopeContext del token, nunca del selector.** El servidor entrega en el token el conjunto autorizado (compañías, sucursal, almacenes); **cada endpoint deriva su alcance server-side**. El selector de razón social del shell es un FILTRO sobre lo ya autorizado — jamás una autoridad. Un valor fuera del ScopeContext se rechaza aunque el cliente lo mande.
2. **(P0) Aprobar-y-asentar como transacción idempotente:** lock por reporte, clave única `reporte → póliza` (un reporte jamás genera dos pólizas, ni con doble toque ni con reintento tras timeout), validación de período contable abierto, y estados separados para aprobar / contabilizar / rechazar. El botón se deshabilita en vuelo y el resultado es consultable por operación.
3. **(P0) Depósitos con ciclo de custodia.** Registrar un depósito NO cierra caja: estados `declarado → contado → en tránsito → confirmado por banco → (disputado/revertido)`, con evidencia por transición y **segregación entre quien cuenta y quien autoriza**. La caja solo descuenta al confirmar el banco (o con autorización explícita de excepción, registrada).
4. **(P0) La pre-nómina PROPONE, nunca ejecuta.** Los registros crudos del checador son inmutables; el saneamiento es una **vista derivada explicable** (cada ajuste con motivo + evidencia + quién). El "descuento de día" es una PROPUESTA amparada en política laboral formal escrita — la gerente valida la propuesta, y **RH/nómina da la aprobación final**. Identidad canónica empleado-compañía resuelta antes de computar. La PWA nunca es nómina operable: es el paquete de revisión.
5. **(P1) Matriz del artículo versionada:** cada versión con vigencia, responsable y bitácora; ausencia o ambigüedad de regla = **rechazo duro** (nunca adivinar); las dimensiones jamás viajan armadas desde el cliente — el cliente manda ids, el server arma.
6. **(P1) Matriz de capacidades por acción + delegación temporal.** "La gerente hace lo de la aux cuando falta" se formaliza: delegación con vigencia y razón auditada, y **prohibición de autoaprobación** (quien captura un gasto no puede aprobárselo a sí mismo — sube al siguiente nivel).
7. **(P1) Cotejo → expediente de discrepancia.** Una observación no cierra un faltante: la diferencia abre expediente con responsable, vencimiento, recuento, resolución y reapertura controlada — mismo patrón que la disputa de recepción PT en producción.
8. **(P1) Requisiciones con etapas separadas** (solicitar / aprobar / ordenar / recibir / facturar / cerrar); la recepción parcial **impide sobre-recepción** (tope = pendiente) y duplicados (operación idempotente por entrega).
9. **(P1) Frescura por tarjeta, no global.** Cada KPI del hub declara fuente + corte temporal + estado de frescura propio (caja, producción y rutas tienen cadencias distintas — un "act. 07:42" global miente para alguna).
10. **(UX) Primer corte angosto, mismo criterio que producción:** las 17 pantallas son la visión objetivo; el primer corte entrega **Hoy + Controles en solo lectura** (con frescura por tarjeta), luego gastos E2E, luego caja/custodia, luego pre-nómina como paquete RH. El rail de 7 pestañas ya construido se conserva; la jerarquía interna prioriza excepciones y acciones seguras sobre el catálogo de módulos.
11. **(UX) El mockup es dirección, no spec implementable:** al construir — botones reales con semántica, nombres accesibles, foco de teclado, objetivos ≥44 px, contraste AA verificado por test de tokens, y pruebas visuales en 390×844 / 768×1024 / escritorio.

---

# PARTE 1 — AUDITORÍA (síntesis final con evidencia)

## 1.1 El hallazgo central (contable, urgente)

**1,296 reportes de gasto por ~$3.11M MXN, 100 % en borrador** — ni uno aprobado ni asentado; el P&L de hoy no incluye ninguno (GLACIEM 627/$2.33M · Vía Ágil 434/$425K · Fabricación 234/$355K). El flujo muere en "reported": la pantalla aprueba el gasto individual pero los reportes jamás avanzan. **Primera prioridad con Sebas: cerrar el ciclo captura → aprobación → asiento automático.**

## 1.2 Dimensiones: Odoo tiene 11 planes; la PWA captura 1

Plaza (17 cuentas), CC (19), UN (4: CEDIS/Planta/Hub/Center), canal, línea, **ruta, vehículo**, campaña, segmento, fuente — todo dado de alta. Pero: el picker permite UNA cuenta al 100 %; 88 % de los gastos históricos sin ninguna analítica; **todo cae en "Other overheads"**; el concepto es texto libre; hay depósitos capturados como gastos; el backend descarta `account_id`/`analytic_tag_ids`.

**Piloto Iguala medido (Codex):** Plaza parcial — la misma Iguala vive como DOS cuentas ([820] IGU cía 35 y [931] IGU34 cía 34) con los almacenes móviles repartidos inconsistente (WH103→931, WH105→820, WH107→931…), y los almacenes cía-1 (WH49-54) con `x_analytic_account_id = False` (la derivación fail-closed los bloquea). **UN: no existe fuente** (no hay campo en almacén/ubicación/branch_config). **CC: catálogo sin curar** (combustible en 6 cuentas, 3 sin código).

## 1.3 El rol hoy: la versión pobre de la casa

Hub de 5 botones vs las ~25 rutas del supervisor · Dashboard Metabase sin token ni filtro de sucursal · **fuga de alcance** (alertas/KPIs/forecasts por empresa con sudo; el gerente podría desbloquear forecasts ajenos) · "Venta Hoy" es un snapshot viejo rotulado como hoy · ceros indistinguibles de sin-dato · KPIs del hub admin parcialmente falsos (hardcodeados en 0; "Caja del día" = alias de venta mostrador) · gates por nombre de pila · subrutas de /admin sin revalidar rol · POS sin dimensiones, precio desde el navegador, total sin IVA, umbrales decorativos · requisiciones móviles con texto libre y botones de aprobar rotos · gasto del gerente en versión degradada con lista rota · cero tests.

**Lo que sí está bien y se conserva:** cortes de caja (fail-closed real, denominaciones, idempotencia, autorización de dos niveles, reapertura) — el estándar a imitar.

## 1.4 Las 29 omisiones del primer rediseño (barrido completo, resueltas en los mockups)

Historial de gastos (442 líneas) · gasto de combustible **por ruta** (absorbido en el "¿para qué es?") · aprobar gastos sin entrada en el menú móvil · aprobar/rechazar y **recepción parcial** de requisiciones · corte de caja completo (denominaciones, autorización 2 niveles, reapertura, arqueos pendientes, impresión) · **arqueos de ruta desktop-only** (6 formatos imprimibles) llevados a móvil · cancelación/reimpresión de tickets POS · cliente/lista de precios en POS · kardex por producto · recepciones/consumos · traspaso de MP · validación de materiales y bolsas (**pantallas vivas huérfanas del menú**) · historial de cargas (truena sin `warehouse_id`) · selector de razón social · alertas · forecast · brief · encuestas/premios · feed de actividad · bajas de clientes **rota para el puesto** (autorizada pero bloqueada por el gate) · asistencias gateadas a una allowlist de 1 persona · **nómina: hueco total del producto**.

## 1.5 Talento — verificación en vivo (11-ago, Odoo productivo)

| Dato | Valor |
|---|---|
| Checadas en `hr.attendance` | **1,024 históricas · 295 últimos 30 días · 25 desde el 9-ago** — el kiosko de Odoo SÍ se usa |
| Higiene | Tramo de **49 h** (entrada sábado 7:36, "salida" lunes) · 8 tramos abiertos sin salida · checada de **11 segundos** (prueba) |
| Empleados activos | **51** (Glaciem 20 · CSC GF 19 · Fabricación 10 · Vía Ágil 2) |
| Sin número de checador (barcode) | **25 (49 %)** |
| Sin puesto | **8** |
| Fichas duplicadas | **3 personas**: Angélica Jaimes ×3 (717 Glaciem · 2518 Fabricación · 2521 Vía Ágil) · Miguel Morales ×2 (577 Fabricación · 575 CSC) · "Dirección GF" ×2 (715 · 716) |
| Nómina | **Cero** referencias en todo el producto (modelo, endpoint, pantalla) |

El "0 presentes" de la pantalla se explica por la ventana UTC del filtro de día + alcance analítico — no por falta de checador.

---

# PARTE 2 — DISEÑO OBJETIVO (17 pantallas, por el día real)

**La ronda de la mañana:** 1 Hoy (¿salieron las unidades? → ¿producción trabajando? → ¿caja abierta? → pendientes; venta real, gastos, caja del corte; contador de Controles).

**Administración (sustituyendo o supervisando a la aux):** 2 Captura de gasto (artículo·cantidad·monto·para qué + dimensiones derivadas visibles) · 3 Matriz del artículo (el alta única: contabilidad, regla de dimensiones, qué pide en captura) · 4 Historial de gastos · 5 Aprobar y asentar (backlog histórico separado; sin comprobante = bloqueado) · 6 Depósitos y retiros · 7 POS mostrador (IVA, re-precio server, dimensiones) · 8 Corte de sucursal (denominaciones, esperado vs contado, autorización 2 niveles, reapertura) · 9 Arqueo de vendedores (liquidaciones de ruta en móvil, 6 formatos, diferencia con nota/recuento) · 10 Requisiciones ciclo completo (Nueva · Por autorizar · Por recibir con recepción parcial y pendiente declarado · Historial).

**Supervisión:** 11 Controles (construida — 15 reglas, semáforo por palabra + acción por hallazgo) · 12 Equipo (resumen + deep-link a la app del supervisor de ventas, solo lectura) · 13 Producción (resumen con kg/kWh **y $/kg** — el costo sí es idioma de la gerente + deep-link al hub del supervisor) · 14 **Cotejo físico vs sistema** (bitácoras de producción y almacenistas vs lo capturado; diferencia con observación registrada; alimenta Controles) · 15 Inventarios de todos los almacenes (selector PT/MP/entregas/camionetas, kardex, movimientos del día, traspasos y validaciones rescatadas).

**Talento:** 16 Asistencias (gestión de excepciones del checador: tramos automáticos, anomalías con palabra, manual solo con motivo auditado) · 17 Pre-nómina semanal (horas crudas vs **saneadas**, por empresa y puesto, casos a decisión, autorización de la gerente → RH/contabilidad procesa en Odoo).

**Decisiones de limpieza explícitas:** las 3 pantallas huérfanas se rescatan al menú de Inventarios (no se borran en silencio) · las 2 desktop-only (Liquidaciones, Materia prima) se llevan a móvil · muere la dependencia de `warehouse_id` (el alcance es la sucursal) · el gate de asistencias pasa de allowlist a rol · se repara el gate de bajas de clientes.

---

# PARTE 3 — PLAN FRONTEND (PWA)

## GF1 — Ya construido en PRs draft (aterrizar, no reconstruir)
Shell V2 de 7 pestañas (`gerenteV2Tabs.js`) · panel de Controles con 15 reglas y categoría "cruce" · editor de clientes read-only para el gerente · cierre de deep-links legacy de escritura · tests (`gerenteV2Shell`, `controlsPanel`, `gerenteRotos`, `adminSubRouteAccess`). **Acción: mergear tras Fase 0, no duplicar.**

## GF2 — Gastos con matriz (contra B2/B3)
Captura 4-datos con dimensiones derivadas visibles/no editables y fail-closed explicado · "Otros (por clasificar)" con cola · historial en móvil · aprobar-y-asentar con backlog separado y bloqueo sin comprobante · depósitos/retiros · matar la versión degradada del gerente (un solo formulario).

## GF3 — Caja y arqueos en móvil
Corte de sucursal completo en móvil (denominaciones, autorización 2 niveles, reapertura, impresión — la lógica ya existe, es re-empaque responsive) · arqueos de vendedores en móvil con los 6 formatos · POS con IVA/re-precio/dimensiones y umbrales que bloquean · requisiciones ciclo completo con botones reparados y recepción parcial en el flujo.

## GF4 — Supervisión y cotejo
Ronda de la mañana como hub · deep-links con chip "Modo gerente · solo lectura · [sucursal]" · pantalla de Cotejo físico vs sistema (nueva) · Inventarios unificados (kardex, movimientos, traspasos, validaciones huérfanas rescatadas) · scope: matar filtros por empresa + sudo (todo por sucursal del token).

## GF5 — Talento
Asistencias por rol (adiós allowlist 717) con filtros de empresa y puesto · vista de excepciones (tramos huérfanos, checadas de prueba, sin salida) · pre-nómina semanal contra B5.

---

# PARTE 4 — PLAN BACKEND (Odoo, con Sebas)

## B1 · Fase 0 contable (URGENTE — condición de todo el P&L)
1. Flujo aprobar→asentar automático como transacción idempotente (lock, clave única reporte→póliza, período abierto, estados separados) + decisión sobre los 1,296 en borrador (retroactivo vs corte de fecha — **decisión de dirección pendiente**).
2. **Unificar Plaza Iguala**: 820 (IGU cía 35) vs 931 (IGU34 cía 34) — cuenta canónica por almacén y corrección de los `lot_stock.x_analytic_account_id` de los móviles. *El mayor riesgo de captura.*
3. Poblar Plaza en WH49-54 (cía 1) o confirmar que no se usan.
4. **Crear la fuente de UN** (campo en almacén/ubicación o en branch_config) y poblarla.
5. **Matriz del artículo versionada** (no solo categoría→CC): cuenta, impuestos, UoM, regla CC/UN, qué pide en captura; **versión con vigencia y responsable**; ausencia/ambigüedad = rechazo duro; activos destino conectados. Gobernanza: solo contabilidad crea/edita; log; la PWA solo lee y solo manda ids.
6. Flujo de depósitos/retiros con ciclo de custodia (declarado→contado→en tránsito→confirmado por banco→disputado), evidencia por transición y segregación contador/autorizador — la caja descuenta al confirmar banco.

## B2 · Derivación server-side (extiende #273)
Estampar Plaza (garantizada) + UN y CC cuando Fase 0 los habilite · resolver por activo destino (vehículo→CC logística+dimensión Vehículo; máquina→CC de su línea+UN Planta+liga a maintenance.request) · fail-closed por dimensión con mensaje accionable · "Otros" no asentable.

## B3 · POS e ingresos
Dimensiones en la venta mostrador (simetría con gastos) · re-precio server-side · IVA en el total · umbrales de autorización reales.

## B4 · Scope y permisos
Todo endpoint del rol escopado por sucursal del token (matar empresa+sudo) · gate de bajas de clientes reparado · subrutas de /admin revalidando rol · asistencias por rol con filtros company_id y job.

## B5 · Talento / pre-nómina
1. **Fase 0 de Talento (con números):** completar 25 barcodes y 8 puestos · regla de ficha canónica para los 3 duplicados (una persona checa UNA vez; el sistema atribuye) · desplegar el kiosko donde falte.
2. **Saneamiento de checadas** server-side: cierre de tramos huérfanos con motivo, jornada máxima configurable, descarte de checadas <1 min, todo auditado — el tramo anómalo jamás paga en automático.
3. **Pre-nómina semanal como PAQUETE DE REVISIÓN** (nunca nómina operable): crudos inmutables + vista saneada explicable (motivo/evidencia/quién por ajuste), incidencias con efecto como PROPUESTAS amparadas en política laboral formal escrita, corte por empresa y puesto sobre identidad canónica, la gerente valida y **RH/nómina aprueba final** en Odoo. Requiere: política laboral documentada + salario/tarifa por empleado.

---

# PARTE 5 — SECUENCIA, VERIFICACIÓN Y RIESGOS

```
Ya          Fases 1-3 FE en PR draft esperando Fase 0
Semana 1-2  AUTORIDAD PRIMERO: ScopeContext + matriz contable versionada +
            políticas de segregación/delegación (B1, B4, B5.1) con Sebas
Semana 2-3  Merge PRs draft · "Hoy" + Controles en SOLO LECTURA con frescura
            por tarjeta (primer corte)
Semana 3-4  Gastos de punta a punta con idempotencia y auditoría (GF2 vs B1/B2,
            piloto Iguala Plaza-primero)
Semana 4-5  Caja y custodia: corte móvil + depósitos con ciclo + arqueos de
            vendedores (GF3 vs B3) · cotejo con expediente (GF4)
Semana 5-6  Pre-nómina como paquete de revisión RH, en sombra 2 semanas
            (GF5 vs B5) · piloto integral con la gerente de Iguala
```

**Criterios de cierre:** un gasto de combustible de la 265 se captura en 4 datos y cae con cuenta+Plaza+CC+Vehículo correctos · un pistón del Compresor 2 aparece en el historial de mantenimiento de ESA máquina · ningún gasto nuevo termina en "Other overheads" ni en borrador eterno (captura→póliza < 48 h) · la gerente hace su ronda de la mañana en ≤ 2 minutos · valida un arqueo de vendedor desde el celular · la pre-nómina en sombra cuadra contra la nómina real 2 semanas seguidas antes de activarse.

**Riesgos:** (1) la unificación 820/931 mueve historia analítica — definir fecha de corte declarada si no se puede corregir retro; (2) el backlog de $3.11M asentado retroactivo con mala clasificación ensuciaría el P&L que se quiere estrenar — la decisión de corte es de dirección; (3) la matriz mal curada replica el caos con otra cara — la sesión contabilidad+gerentes es obligatoria antes del piloto; (4) pre-nómina que paga sin sombra previa — nunca: 2 semanas de comparación es regla dura; (5) doble captura durante la transición (formulario viejo vs nuevo) — cortar por versión.

**Decisiones abiertas para dirección:** ¿los 1,296 borradores se asientan retroactivos o corte de fecha? · ¿el gerente ve la pestaña Equipo completa o resumida? (el plan asume completa en solo lectura) · confirmación del P&L objetivo: Empresa → Plaza → UN → CC con artículos como renglones.

---

*Anexos: mockups (`docs/gerente/mockups_gerente.html`, 17 pantallas) · auditoría original del puesto · análisis dimensional de Codex · verificación en vivo del 11-ago (asistencias/fichas) · documentos hermanos: Kold Field (vendedor), Producción, Planear mañana (supervisora de ventas).*
