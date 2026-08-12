# Plan de corrección — Planear mañana, Recuperación, Prospectos y Productos (Supervisora de Ventas)

**Fecha:** 12 de agosto de 2026 · **v3** (integra veredicto Codex YELLOW del 12-ago + 2 decisiones de dirección: optimización universal y prospección por polígono)
**Origen:** revisión en vivo de la supervisora (planes por segmento vs polígono) + investigación de código + validación de gf_lead_map/gf_prospector en Odoo prod (11-ago) + revisión externa Codex (12-ago)
**Repos:** `grupofrio/colaboradores-pwa` (front) · Odoo `GrupoVeniu/GrupoFrio` gf_salesops (back)
**Regla general:** cada fix de front que dependa de un cambio de contrato se construye contra fixture golden congelado, igual que el resto del proyecto.

---

## 0. Decisiones endurecidas (post-Codex, 12-ago)

Codex dio veredicto YELLOW: diagnóstico sólido, dirección correcta, pero 4 contratos debían endurecerse antes de construir F5/F6. Dirección tomó 2 decisiones que los resuelven; las 4 quedan así:

### D1 · Optimización universal — la contingencia es una transición, no una bandera
**Decisión de dirección: TODOS los planes que salen a la calle se publican optimizados.** Sin excepción operable desde el cliente.
* Se **elimina `allow_unoptimized: true`** del contrato. Un booleano que la PWA puede mandar reinstala el problema original con otro nombre.
* La única salida cuando el optimizador falla es la transición explícita **`contingency_manual`**, y vive en el servidor: requiere permiso específico (grupo Odoo, no rol de la PWA), **razón obligatoria** en texto, registro de **actor + hora + motivo del fallo del optimizador**, y deja **marca visible persistente** en la ruta: "⚠ Publicada por contingencia — orden manual" en matriz, detalle, Torre y en la app del vendedor.
* La regla de auditoría M2 ("planes sin registro de ejecución del optimizador") cuenta cada `contingency_manual` — cero es la meta, y cada una tiene nombre y motivo.

### D2 · Prospección por polígono/subpolígono — el scope es del servidor
**Decisión de dirección: los prospectos se sacan por polígono o subpolígono del plan operativo.** La supervisora solo ve y agrega prospectos que le quedan cerca de SUS planes; jamás puede agendar prospectos de otra ciudad u otro polígono que no le toca.
* Cada endpoint de `prospects/*` **deriva la sucursal desde el token** (mismo patrón ScopeContext del plan del gerente) y resuelve en servidor los **polígonos/subpolígonos autorizados** = los de los planes operativos de su plaza. `crm.lead` no tiene campo de plaza — por eso la geografía del polígono ES el scope: un lead pertenece al scope si sus coordenadas caen dentro de un polígono autorizado.
* Búsquedas del prospectador: solo sobre las zonas cuyo centro cae en polígonos autorizados (de las 24 zonas, una supervisora de Iguala ve Iguala Centro e Iguala Norte — no GDL, no CDMX). El filtrado del cliente es cortesía visual; **la autoridad es del servidor**.
* `add_lead` valida servidor-side, todo o nada: rol · plan pertenece a su sucursal · fecha editable · **lead dentro del polígono del plan destino** · sin duplicado (dedupe `already_in_odoo`). **Fail-closed**: lead sin coordenadas o polígono no resoluble → rechazo con causa, nunca "pasa por default".
* Consecuencia de producto: el orden "valor estimado × cercanía" se calcula solo contra los planes de ELLA — prospectar donde hay kilos, dentro de su territorio.

### D3 · Máquina de estados única del plan (resuelve la contradicción F3/F5/mockup)
Una sola política, no tres:

```
draft ──optimize──▶ optimized ──publish (misma revisión)──▶ published
  ▲                                                            │
  └────────── amendment_pending ◀──enmienda (sin carga)────────┘
                    (invalida optimización → reoptimizar → republicar)

published + carga/picking/ejecución ──enmienda──▶ RECHAZO con causa humana:
  "Esta ruta ya tiene carga preparada — el prospecto va al plan de pasado mañana"
```

* Una publicada **sin** carga/picking/ejecución admite enmienda: pasa a `amendment_pending`, su optimización queda inválida y **no puede republicarse sin reoptimizar** ("Reoptimizar y publicar", F5).
* Una publicada **con** carga o ejecución NO se toca: el modal la muestra deshabilitada con la causa y ofrece el siguiente plan editable de esa zona.
* "Reabrir" y "re-draft" desaparecen del vocabulario: solo existe la enmienda controlada `amendment_pending`.

### D4 · Optimizar y publicar es una sola transacción versionada
* `optimize` devuelve **`plan_revision`** (hash de paradas + recursos + zona). `publish` exige esa misma revisión y ejecuta bajo **lock del plan**; si la revisión no coincide → `revision_mismatch` y el front re-optimiza.
* **Cualquier mutación** (agregar/quitar cliente, prospecto, recurso, cambio de zona) incrementa la revisión **atómicamente** → la optimización previa queda inválida en el mismo write, no después.
* Escenario que esto mata: la supervisora optimiza, alguien más agrega una parada, y se publica una secuencia calculada para otra lista.

---

## 1. Síntomas reportados (validados en producción por la supervisora)

1. Plan por **segmento** (Mercado): pide unidad/chofer/vendedor pero hay que asignarlos **varias veces** para que lo detecte y deje publicar; aparece "⛔ Envía al menos un recurso a asignar (driver_employee_id, salesperson_employee_id, vehicle_id)" con los 3 selectores llenos.
2. Plan por **polígono**: no ofrece el mismo flujo — aterriza en otra pantalla ("Preparar ruta"), no deja hacer cambios y "se va por default".
3. Duda operativa: ¿**Publicar** pasa el plan por el **optimizador** o se lo salta?
4. **Recuperación → "Agregar a mañana"**: ¿opera sobre rutas ya publicadas? ¿Re-optimiza?
5. Falta visibilidad de **productos**: qué vende el CEDIS vs qué se vendió hoy (para detectar lo que se está dejando de vender), y producto+cantidad por parada en el detalle de ruta.

## 2. Causas raíz (diagnóstico de código)

| # | Causa | Evidencia |
|---|---|---|
| C1 | La pantalla usa el **endpoint de escritura como lectura**: `refreshResourceReadiness` hace POST a `assign-resources` con solo `{plan_id}`; el server responde VALIDATION ("Envía al menos un recurso…") y la PWA falla-cerrado a `blocked`. Se dispara al abrir la ruta, al sugerir clientes y en cada add/remove → re-bloquea aunque los selectores (que leen OTRO estado, `available-resources`) estén llenos. | `PlanearMananaTab.jsx:552-563, 593, 598, 622, 641, 655, 670, 679, 687` · shim `src/lib/api.js:8453-8463` |
| C2 | El detalle es el MISMO para SO/SP/P; el polígono "no llega": (a) la fila P de `routes-week` puede venir **sin `route.id`** → sin autoapertura → vista lista; (b) `route-templates` **descarta rutas sin vendedor** (`.filter(item => item.employeeRef)`); (c) si la zona heredada no resuelve, el código cae **al primer polígono en silencio** (`normPolys[0]`) — el "se va por default"; (d) plan no-draft o con picking ⇒ solo lectura sin explicación. | `routesWeekModel.js:88-90` · `MisRutasManana.jsx:35-39` · `PlanearMananaTab.jsx:443-447, 461-466, 584-588` · `src/lib/api.js:8091-8103` · `routePlanning.js:240-243` |
| C3 | **Publicar no invoca el optimizador** desde la PWA: el payload es solo `{route_plan_id}`; cero referencias a secuencia u optimización en el flujo. El optimizador (`gf_route_optimizer_v2`, OSRM/solver externo) existe en la plataforma como capacidad piloto. Si el server tampoco lo dispara, hoy las rutas salen SIN optimizar. | `api.js:242-246` · `src/lib/api.js:8550-8602` · fixtures `planeacion/m2`, `torre/e1` |
| C4 | El modal de Recuperación ofrece **cualquier plan materializado sin filtrar por estado** (draft y publicado); el publicado falla en backend (`plan_not_editable`) y el usuario solo ve "No se pudo agregar (código)". El add es a ciegas: sin reorden, sin refresh de readiness. | `recuperacionModel.js:58-88` · `ScreenClientesRecuperacion.jsx:225-256` |
| C5 | La vista de **productos vendidos ya existe** (`products-sold` + `ProductsSection`: SKU, cantidad, importe, delta y "Del portafolio, sin vender" con cobertura) pero vive en `/kpis` **sin enlace** desde el shell V2/Más. Y las paradas **no traen líneas de producto** (solo monto y conteo de pedidos). | `api.js:60-64` · `PanelKpis.jsx:299-385` · `src/lib/api.js:9092-9120` |

---

## 3. PLAN FRONTEND (colaboradores-pwa)

### F1 — Readiness sin POST vacío (C1) · P0, sin backend
* Eliminar todas las llamadas a `assignRoutePlanResources(planId)` sin recursos.
* Sustituir por: (a) derivación local con `resourceReadiness(assignment)` tras add/remove/preview, y (b) cuando exista, el `GET readiness` de B1. Mientras B1 no llegue, opción puente: reenviar los IDs ya asignados como no-op idempotente.
* Unificar la fuente de verdad: los selectores y el bloque de readiness leen el MISMO estado.
* Tests: caso "asignar 3 recursos → agregar cliente → sigue publicable" (hoy se re-bloquea); actualizar `supervisorPlanearManana.test.mjs`.

### F2 — El mismo flujo para los 15 planes (C2) · P0, parcial backend (B2)
* **F2.1** Autoapertura robusta: si la fila no trae `route.id`, mostrar en el detalle un selector de ruta explícito (no aterrizar en la lista sin contexto).
* **F2.2** Eliminar el default silencioso `normPolys[0]`: si la zona heredada no resuelve → estado honesto "No pude resolver la zona de este plan — elígela" con selector, nunca armar con otra zona.
* **F2.3** `route-templates`: dejar de ocultar rutas sin vendedor — mostrarlas con chip "Sin vendedor" (asignarlo es justo parte del flujo). *(cambio en el shim `src/lib/api.js:8100-8103`)*
* **F2.4** `ensure` al entrar al detalle para que el bloque de recursos (unidad/chofer/vendedor) aparezca SIEMPRE, en los 3 tipos.
* **F2.5** Solo-lectura explicada según la máquina de estados D3: si el plan no es editable, decir el estado con palabra y ofrecer la acción válida del estado ("Enmendar" si no tiene carga; "Ver plan" si ya tiene), no esconder botones sin explicación.
* **Criterio de aceptación (separado por caso, Codex P1-6):**
  - *Editables* (draft, `amendment_pending`): con un plan SO, uno SP y uno P reales, el detalle muestra recursos + lista de clientes editable (agregar/quitar/buscar) en los tres.
  - *No editables* (published con carga/picking/sellado): los mismos tres tipos muestran el plan en lectura con el estado explicado y SIN controles de edición; intentar mutar por API responde el código del estado.

### F3 — Recuperación coherente con D3 (C4) · P1, parcial backend (B3)
* El modal muestra los planes de la zona con su **estado de la máquina D3**: editables seleccionables; publicada sin carga → "Publicada — al agregarle pasa a enmienda y se reoptimiza"; publicada con carga → deshabilitada: "Ya tiene carga preparada — elige el plan del [siguiente día editable]".
* Tras agregar: refrescar readiness del plan destino y mostrar el resultado con palabra ("Quedó en la ruta de Mercado — pendiente de reoptimizar").
* Mensajes de error por código legible (`plan_not_editable` → "Esa ruta ya está publicada y con carga"), no "(código)".

### F4 — Productos visibles (C5) · P1, parcial backend (B4)
* **F4.1** Acceso directo a "Productos" en el shell V2 (grupo Desempeño de "Más" + chip en Hoy con "N del portafolio sin vender hoy"). La sección ya existe (`ProductsSection`) — es enlazarla, no construirla.
* **F4.2** Vista "Productos del CEDIS" con el comparativo catálogo vs vendido (hoy/semana/mes) reusando `products-sold`, y agrupación por ruta/vendedor cuando B4.2 esté.
* **F4.3** En `RutaDetalle` → paradas: mostrar producto + cantidad por parada cuando el DTO traiga `sale_lines` (B4.1); mientras no, mantener solo monto (sin inventar).
* **Denominador honesto (Codex P1-7):** "sin vender hoy" se calcula contra el **catálogo vendible del CEDIS para esa fecha** — descontando producto inactivo, sin existencia vendible, reservado, fuera de temporada o no disponible para la plaza. No contra el catálogo bruto ni el stock bruto: si no se podía surtir, no es oportunidad perdida y no se presiona al vendedor a ofrecer lo imposible. B4.2 expone `sellable_portfolio_total` con su definición.

### F5 — "Todas las rutas nacen optimizadas" (C3 + D1 + D4) · DECISIÓN TOMADA, contra B5
* El botón de publicar cambia de semántica según el estado del plan (máquina D3):
  - Plan armado (recursos + clientes) → **"Optimizar y publicar"**: `optimize` → `publish` con la **misma `plan_revision`** en una sola acción con progreso visible.
  - Plan en `amendment_pending` (recuperación o prospecto agregado) → **"Reoptimizar y publicar"**: re-secuencia con la parada nueva y re-publica.
* **Los valores de la optimización se muestran SIEMPRE** tras optimizar, en la tarjeta de readiness y en la matriz semanal: `N paradas · X km · Y h de trayecto`, con el número de revisión; si es re-optimización, el delta: "+1 parada · +3.2 km · +14 min".
* Si otro usuario mutó el plan entre optimize y publish → `revision_mismatch` → el front lo dice ("El plan cambió — reoptimizando…") y re-corre optimize. Nunca publica una secuencia calculada para otra lista.
* Si el optimizador falla: el front NO puede publicar. Muestra el fallo y la única vía es `contingency_manual` (D1) — que la PWA solo *solicita*; la autorización, razón y registro viven en el servidor. La marca "⚠ contingencia — orden manual" persiste en matriz, detalle y Torre.
* La marca "↓ bajó en secuencia" del detalle de ruta gana valor: con rutas optimizadas, desviarse de la secuencia sí significa algo.

### F6 — Prospectos por polígono, al lado de Planes (D2) · NUEVO
* **Rail del shell V2 reordenado a 7 pestañas:** `Hoy · Radar · Rutas · Planes · Prospectos · Clientes · Más` — "Planes" y "Prospectos" suben a primer nivel, juntos, porque el flujo es: saco prospectos de mi polígono → los asigno al plan → optimizo y publico. (Nota UX Codex: el rail con scroll debe señalar el desborde — degradado + flecha — y "Más" ofrece la lista completa como alternativa de navegación.)
* **Superficie "Prospectos"** con 3 sub-pestañas (absorbe la pantalla actual de Recuperación): `Prospectar` · `Por recuperar` · `Inactivos (+60d)`.
* **El filtro primario es el polígono/subpolígono del plan operativo** (D2): la supervisora elige uno de SUS polígonos (o "todos los míos") y ve solo prospectos dentro de él. No existe en la UI forma de pedir otra plaza — y aunque existiera, el servidor la rechaza.
* Acción única en las tres listas: **"Agregar a un plan de mañana…"** → SIEMPRE pasa por confirmación (Codex UX): plan destino con su estado D3, disponibilidad y efecto estimado ("entra a Mercado · quedará pendiente de reoptimizar"), nunca escritura directa desde la tarjeta — el plan mostrado pudo dejar de ser editable.
* Al asignar, mostrar a qué distancia del recorrido actual queda el prospecto ("a 400 m de la ruta Mercado") usando la geo del lead.

### F7 — Pendientes tipados (Codex P1-9) · P2
* Los pendientes/errores dejan de mostrar texto crudo del servidor como instrucción operativa. Cada código tipado se presenta como **qué ocurrió / por qué importa / acción disponible** ("La ruta Mercado quedó sin reoptimizar → saldría con orden viejo → Reoptimizar y publicar"). El detalle técnico (código, payload) queda plegado en "Detalle para soporte".

---

## 4. PLAN BACKEND (Odoo gf_salesops)

### Gate transversal (Codex P1-5) — aplica a TODO B1-B6
Cada endpoint nuevo o modificado deriva **sucursal y permisos desde el token** (patrón ScopeContext), valida rol + fecha + pertenencia del `plan_id`/`lead_id` al scope, y **fail-closed**: `GET readiness` de un plan ajeno responde `not_found` (no revela existencia); ninguna transición de estado (D3) es alcanzable sin el permiso de esa transición. Ningún parámetro del cliente (sucursal, plaza, polígono, bandera) es autoridad.

* **B1 · `GET route_plan/readiness`** (P0): lectura pura de la readiness del plan (recursos, clientes, estado D3, revisión, bloqueos) sin efectos. Elimina de raíz el uso del endpoint de escritura como lectura. Alternativa mínima: que `assign-resources` con solo `plan_id` responda la readiness en vez de VALIDATION.
* **B2 · `routes-week` completo para P/SP** (P0): toda fila debe traer `route.id` cuando la ruta exista, y las rutas sin vendedor no deben desaparecer del contrato de `route-templates`. Documentar en el contrato qué significa fila sin ruta.
* **B3 · Recuperación** (P1): `add_customer` valida contra la máquina D3 y rechaza con código legible + catálogo de códigos documentado. El caso "publicada sin carga" transiciona a `amendment_pending` (no existe "reopen" libre).
* **B4 · Productos** (P1): **B4.1** `route_stops` agrega `sale_lines: [{product_id, sku, name, qty, uom, amount}]` por parada. **B4.2** `products-sold` agrega `group_by=route_plan|vendedor` y `sellable_portfolio_total` = catálogo vendible del CEDIS para la fecha (definición en F4).
* **B5 · Optimización como contrato de publicar** (P0 · D1 + D4):
  - `POST route_plan/optimize {route_plan_id}` → corre `gf_route_optimizer_v2` (OSRM externo ya configurado: `gf_route_optimizer_external.base_url/enabled/token`), persiste la secuencia y devuelve `{plan_revision, stops_count, distance_km, duration_min, sequence[], optimizer_run_id}`. El `optimizer_run_id` queda en el plan — el "registro de ejecución" que la regla M2 ya exige.
  - `publish {route_plan_id, plan_revision}` bajo lock: valida optimización vigente Y revisión coincidente; si no → `optimization_required` / `revision_mismatch`.
  - **No existe `allow_unoptimized`.** La contingencia es la transición `contingency_manual` (D1): permiso de grupo servidor, razón obligatoria, actor+hora, marca persistente, contada por M2.
  - Mutaciones (`add_customer`/`add_lead`/recursos/zona) sobre published sin carga → `amendment_pending` + revisión nueva atómica (D3+D4). Sobre published con carga → rechazo con causa. La parada agregada jamás se queda "al final" en silencio.
* **B6 · Mapa de Leads y Prospectador expuestos a la PWA** (P0 del flujo nuevo — VALIDADO en Odoo prod el 11-ago):
  - **`gf_lead_map`**: campo `gf_demand_class` en crm.lead (AA/A/B/C). Estado del dato: **1,959 leads, 98% con coordenadas, 100% clasificados** (A: 1,684 · AA: 194 · B: 81). Misma taxonomía que el filtro de demanda de Planear mañana.
  - **`gf_prospector`**: 24 zonas con radio · búsquedas Google Places por zona/radio/polígono (`gf.prospect.search`) · 525 resultados con rating/horarios/teléfono y **dedupe contra Odoo** · 240 competidores · **14 reglas de consumo** que estiman kg/semana y valor por prospecto.
  - **Contrato PWA (`prospects/*`) con scope D2:** el servidor resuelve del token los polígonos/subpolígonos de la plaza; leads y resultados se filtran por **point-in-polygon en servidor**; las zonas de búsqueda visibles son solo las contenidas en polígonos autorizados. Orden por **valor estimado × cercanía a los planes propios**.
  - **`add_lead {plan_id, lead_id, plan_revision}`** (falta hoy — `add_customer` solo acepta partner): valida rol + plan de su sucursal + fecha editable + **lead dentro del polígono del plan** + sin duplicado; transiciona según D3. Fail-closed ante lead sin geo.
  - Nota vigente: `crm.lead` sin campo de plaza → el polígono es el scope (D2); no inventar campo nuevo mientras la geometría lo resuelva.

---

## 5. Secuencia y verificación

```
Semana 1  F1 (readiness local) + F2.1-2.2 (sin backend) · B1, B2 y B5 (optimize+revision) en paralelo
Semana 2  F2.3-2.5 contra B2 · F5 "Optimizar y publicar" contra B5 · F3 contra B3 (máquina D3)
Semana 3  F6 Prospectos por polígono (rail 7 + superficie + confirmación) contra B6 · F4.1-4.2
Semana 4  F4.3 contra B4.1 · "Reoptimizar y publicar" end-to-end (recuperación y prospecto) · F7
          · regresión completa con la supervisora en vivo:
          SO/SP/P × draft/publicada/amendment × con/sin vendedor × optimizada/contingencia
```

**Plan de pruebas (ampliado por Codex P1-8):** además de los fixtures golden B1/B2/B4:
* **Scope:** consulta y `add_lead` cross-plaza (supervisora de Iguala → lead/plan de GDL) → `not_found`/rechazo; `GET readiness` de plan ajeno → `not_found`; lead sin coordenadas → fail-closed.
* **Concurrencia:** cambio de paradas entre optimize y publish → `revision_mismatch`; doble toque / reintento de publish → idempotente (misma revisión publica una vez); optimización vencida (mutación posterior) → `optimization_required`.
* **Contingencia:** `contingency_manual` sin permiso → rechazo; con permiso sin razón → rechazo; con permiso+razón → publica con marca y registro M2.
* **Estados D3:** enmienda sobre published sin carga → `amendment_pending` + revisión nueva; sobre published con picking → rechazo con causa; lead duplicado → rechazo dedupe.
* F1: secuencia que hoy re-bloquea ("asignar 3 → agregar cliente → sigue publicable"); F2.2: ningún flujo cae a `normPolys[0]` silencioso.

**Criterios de cierre:** publicar un plan por segmento asignando cada recurso UNA vez; preparar un polígono sin caer en zona equivocada ni pantalla muerta; **toda ruta publicada muestra paradas · km · tiempo + revisión + optimizer_run_id**; cero `contingency_manual` sin razón/actor; agregar prospecto o recuperación termina en "Reoptimizar y publicar" con delta visible; un prospecto fuera del polígono es invisible e in-agregable; la regla M2 deja de disparar; y la supervisora encuentra en ≤2 taps qué productos **vendibles** del CEDIS no se vendieron hoy.

---

## 6. Notas UX del veredicto (para la fase de construcción del front)

* **Portada (Hoy):** demasiados elementos simultáneos → reorganizar en 3 bloques: `Atender ahora` (pendientes tipados F7 + alertas), `Rutas en curso`, `Resumen del día`; el resto bajo "Ver detalle".
* **Rail de 7 pestañas:** conservar contexto visible, señal de desborde (degradado + flecha) en 390 px, y "Más" como menú alternativo completo.
* **Matriz semanal (720 px):** vista móvil por día o tarjetas por plan; la tabla ancha desplazable no es aceptable para una tarea diaria.
* **CTAs de escritura:** siempre confirmación con plan destino + estado + efecto (F6); nunca escritura directa desde tarjeta.
* **Prototipo → producto:** agregar estados de carga, permiso denegado, conflicto de actualización (`revision_mismatch`), optimizador lento (progreso + cancelar), sin señal y reintento; botones semánticos (`button`, no `span`); contraste AA, foco visible, blancos táctiles ≥44 px.
