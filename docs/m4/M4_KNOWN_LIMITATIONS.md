# M4 — Limitaciones conocidas (frontend v1, backend CONGELADO bajo auditoría)

## 0. La limitación que gobierna todo: el contrato es PROVISIONAL

El backend está **CONGELADO en GrupoVeniu/GrupoFrio `978994c4`** (rama
`feat/kold-os-m4-sales-customer-observability`, **sin PR**) mientras Codex lo
audita. Este frontend consume ESE contrato tal cual; si el veredicto lo cambia,
los puntos de ajuste son `src/lib/koldOsM4Route.js` + `m4/contract.js` +
regenerar el fixture — la pantalla no se reescribe. **Nada de M4 está terminado
hasta el dictamen.**

## 1. Qué NO prueba este observatorio (contrato epistémico)

De 37 reglas, **solo 1 produce INCUMPLIMIENTO afirmable** con los datos medidos
(M4-D-04: 6 líneas de venta confirmada con cantidad ≤ 0 — aritmética dura). Las
demás: 8 riesgos (supuesto declarado, no verificado) · 6 anomalías exploratorias
· 9 cumplen · 13 no evaluables. La UI y los exports lo muestran desglosado; el
contrato lo IMPONE (exploratory ≠ incumplimiento; incumplimiento exige umbral
aprobado; total = suma exacta).

## 2. `kpis` del backend congelado tiene forma M3 (gap DECLARADO)

`execution_kpis()` del backend congelado aún lee métricas de RUTAS (M3) que no
existen en el reporte M4 ⇒ el objeto `kpis` llega con `None` en todo. **El
frontend deriva los KPIs comerciales de `metrics`** (el agregado real del
contrato: customer_master/order/order_state/order_line/crm/recurrence). Este gap
está flagueado para la corrección backend post-auditoría (reescribir
`execution_kpis` → `commercial_kpis`). El contrato exige `kpis` presente pero no
consume su contenido M3.

## 3. `auditor_build_sha` del fixture es placeholder (40 ceros)

El backend congelado generó su fixture ANTES de conocer su propio SHA de commit.
El fixture frontend lo hereda y lo declara; la provenance registra el commit
congelado real (`978994c4`). Se estampa el SHA real al descongelar (backend, no
aquí). La UI muestra el placeholder tal cual — no finge un linaje que no existe.

## 4. Corrida productiva por odoo-shell: NO EJECUTADA (bloqueada)

`is_production_shell_run=false` con los 3 bloqueadores declarados
(`ssh_key_not_registered` · `module_not_deployed` · `production_shell_unavailable`).
Los NÚMEROS son reales (XML-RPC read-only, ventana `[2026-01-16, 2026-07-15)`);
la corrida formal no. El banner de la UI se decide por el DATO
(`!run.is_production_shell_run`), no por el modo demo.

## 5. Definiciones comerciales NO aprobadas ⇒ exploratorias por contrato

"Dormido" (180d), "perdido" (365→180), objetivo de 2ª compra, umbrales de
descuento (50/90%), deduplicación de identidades. Ratificarlas = decisión de
dirección comercial + cambio en el catálogo del BACKEND (fuente única). El KPI
"Reactivados" muestra "—" (sin definición ni historial).

## 6. Fronteras respetadas (y visibles en la UI)

- **Entregados** = "—" (verdad de inventario/entrega = **M5**).
- Facturación/cobranza = **M6**; margen = **M7**.
- M4 define segmento/motivo/oferta de recompra pero **NO ejecuta** campañas,
  opt-in ni automatización (**M8, LOCK**) — sin botones de acción.
- Señal M4→M2: solo OBSERVADA (las 2 reglas del bloque I son not_evaluable v1:
  el join con el forecast de M2 no está en el contrato).

## 7. Granularidad v1 = AGREGADO

Sin dimensión cliente/canal/producto en findings (cero PII por diseño): sin
drill-down a clientes, filtros channel/segment/product existen en la allowlist
del contrato pero el agregado v1 no los ejercita. La UI ofrece solo los filtros
con efecto real (categoría/veredicto/clasificación/severidad/ciclo/entidad/área/
búsqueda). Paginación server-side.

## 8. PII: el contrato RECHAZA, no oculta

`scanForbiddenKeys` recorre el envelope completo: una clave sensible
(customer_name/phone/email/rfc/address/salesperson_name/…) en CUALQUIER nivel
rechaza el payload entero. Ocultar una columna no elimina el dato del browser;
por eso el rechazo es previo al render. Exports: drop de claves + credenciales
en valores → `[REDACTED]` + neutralización de fórmulas + sufijos
`_DEMO`/`_STALE`/`_NONFORMAL`.

## 9. Historial arranca en 1 corrida

Lifecycle/persistencia/corregidos/tendencias con la 2ª ingesta real. El filtro
de ciclo de vida está deshabilitado hasta entonces (no simula historial).

## 10. AbortController

`api()` canónico no acepta AbortSignal ⇒ timeout duro (30 s) + alive-flag que
descarta resultados tardíos al desmontar (patrón M1/M2). Cambiar `api()` global
está fuera del alcance de este PR.

## 11. M3 NO está en main

`#71` sigue OPEN/DRAFT. Esta rama NO copia la arquitectura de M3 sin integrar
(p. ej. su `ACCESS_POLICY_RESOLVERS`): usa el patrón inline mergeado de main
(`if accessPolicy === 'm2'` → `+ 'm4'`). **Rebase futuro**: cuando M3 mergee,
quien rebase funde los `if` de m2/m3/m4 (o adopta el registro si M3 lo trae) —
conflicto esperado en `navModel.js`/`registry.js`/`App.jsx`/`api.js`, resolución
semántica, no mecánica.
