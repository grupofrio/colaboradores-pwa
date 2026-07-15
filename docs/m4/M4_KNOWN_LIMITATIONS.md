# M4 — Limitaciones conocidas (frontend v1)

Backend: **GrupoVeniu/GrupoFrio PR #205** (DRAFT, head `4e195a92`) — el commit
`978994c4` que auditó Codex, ya corregido. Puntos de ajuste si el contrato
cambia: `src/lib/koldOsM4Route.js` + `m4/contract.js` + regenerar el fixture.
La pantalla no se reescribe.

## 0. La limitación que gobierna todo: qué prueba realmente la evidencia

De 37 reglas, **CERO producen incumplimiento afirmable**: 9 riesgos (supuesto
declarado, no verificado) · 5 anomalías exploratorias · 8 cumplen · 15 no
evaluables · **12,158 incidencias**. Las 3 reglas `definitive` que sobreviven
midieron 0 ⇒ cumplen.

Esto es un cambio de conclusión, no de números: la ronda anterior afirmaba 1
incumplimiento (M4-D-04, "6 líneas con cantidad ≤ 0, aritméticamente inválido").
La inspección read-only mostró que las 6 son qty=**0 exacta** (ninguna negativa),
ninguna entregada ni facturada, y **una era `display_type='line_section'`**
(un encabezado, no una línea de producto) ⇒ el número real es **5** y Odoo **no
prohíbe** qty=0. Sin constraint que lo prohíba no hay incumplimiento: la regla
bajó a `caveated`/RIESGO. **Era una afirmación de más.**

La UI y los exports muestran el desglose; el contrato lo IMPONE (exploratory ≠
incumplimiento; incumplimiento exige umbral aprobado; total = suma exacta
recomputada desde `rule_results`).

## 1. El universo de clientes se DERIVA de los pedidos (no del maestro)

`res.partner` **no es scopeable por compañía**: 438 partners tienen `company_id`
vacío (compartidos entre compañías), y **410 de los 713 que compran vivían fuera**
del universo `company_id IN scope`. Universo canónico v1 = **raíz comercial
(`commercial_partner_id = id`) con historial de pedido confirmado en el scope**.
Además **1,510 de 12,606 pedidos** apuntan a una dirección (no raíz) ⇒ todo
agrupa por `commercial_partner_id`.

**Consecuencia:** el universo NO incluye clientes sin historial de compra. Un
cliente dado de alta que nunca compró no existe para M4 v1.

## 2. Los KPIs los emite el backend, no los deriva la pantalla

`commercial_kpis()` emite **26 KPIs**, cada uno con `value` / `universe` /
`source_model` / `source_fields` / `coverage` / `caveat` / `data_as_of`. **Si la
fuente no existe, el KPI no se emite** (jamás un cero falso). La UI solo los
presenta: no calcula, no infiere, no rellena.

El contrato **rechaza** el envelope si un KPI llega sin universo/fuente, si llega
en `null`, o si aparece una clave de M3 (`visit_compliance`,
`plans_started_overdue_open`, …). La ronda anterior tenía `execution_kpis()`
leyendo métricas de RUTAS que M4 nunca produce ⇒ el objeto salía entero en
`None`; por eso hoy hay un test que lo prohíbe.

## 3. Corrida productiva por odoo-shell: NO EJECUTADA (bloqueada)

`is_production_shell_run=false` con los 3 bloqueadores declarados
(`ssh_key_not_registered` · `module_not_deployed` · `production_shell_unavailable`).
Los NÚMEROS son reales (XML-RPC read-only, ventana `[2026-01-16, 2026-07-15)`);
la corrida formal no. El banner de la UI se decide por el DATO
(`!run.is_production_shell_run`), **no** por el modo demo: datos reales entregados
por la API real seguirían mostrando el banner mientras la corrida no sea formal.

**El SQL del manifiesto nunca ha corrido.** Está modelado 1:1 sobre los dominios
ORM verificados, pero su primera ejecución real será la de Sebastián; el runbook
exige comparar conteos antes de ingerir.

## 4. Definiciones comerciales NO aprobadas ⇒ exploratorias por contrato

"Dormido" (180d), "perdido" (365→180), objetivo de 2ª compra, umbrales de
descuento (50/90%), recurrente (≥2), deduplicación de identidades. Ratificarlas =
decisión de dirección comercial + cambio en el catálogo del BACKEND (fuente
única). El KPI "Reactivados" muestra "—" (sin definición aprobada ni 2ª corrida).

## 5. Qué significa "pedido confirmado" (y qué NO)

`sale.order` con `state='sale'` en el scope y la ventana. **Nunca "venta".** No
implica entregado (**M5**) · facturado / cobrado (**M6**) · margen (**M7**) · POS
· devoluciones. Las capabilities lo declaran en `false` y la UI muestra "—" con
la razón, **nunca 0**.

- **Vendedor** = SOLO `sale.order.user_id`. No evalúa `res.partner.user_id`,
  `crm.team`, vendedor de ruta, POS ni integraciones ⇒ **no es ownership
  comercial total**.
- **Canal** = `res.partner.channel_id` **ACTUAL** del cliente. El pedido no tiene
  canal propio: no hay snapshot histórico. Por eso la regla dice "actualmente sin
  canal clasificado", no "se vendió sin canal".
- M4 define segmento/motivo/oferta de recompra pero **NO ejecuta** campañas,
  opt-in ni automatización (**M8, LOCK**) — sin botones de acción.
- Señal M4→M2: solo OBSERVADA (las 2 reglas del bloque I son `not_evaluable` en
  v1: el join con el forecast de M2 no está en el contrato).

## 6. Granularidad v1 = AGREGADO

`capabilities.granularities = ["aggregate"]` y `features.branch_dimension =
false`. Sin dimensión cliente/canal/producto/sucursal en findings (cero PII por
diseño): sin drill-down a clientes. **La allowlist de `/findings` contiene solo
los filtros que el backend ejercita de verdad** — un parámetro de más caería en
`rejected_params` y la pantalla mostraría el filtro puesto con la lista sin
filtrar (mentira silenciosa); uno de menos se descartaría antes de salir y el
selector no haría nada. Hay un test que fija la allowlist contra el contrato del
backend. Paginación server-side.

## 7. PII: el contrato RECHAZA, no oculta

`scanForbiddenKeys` recorre el envelope completo: una clave sensible
(customer_name/phone/email/rfc/address/salesperson_name/…) en CUALQUIER nivel
rechaza el payload entero. Ocultar una columna no elimina el dato del browser;
por eso el rechazo es previo al render. Los duplicados viajan como **conteo de
grupos**: el RFC/teléfono jamás sale. Exports: drop de claves + credenciales en
valores → `[REDACTED]` + neutralización de fórmulas + sufijos
`_DEMO`/`_STALE`/`_NONFORMAL`.

## 8. Historial arranca en 1 corrida

Lifecycle/persistencia/corregidos/tendencias con la 2ª ingesta real. El filtro
de ciclo de vida está deshabilitado hasta entonces (no simula historial).

## 9. AbortController

`api()` canónico no acepta AbortSignal ⇒ timeout duro (30 s) + alive-flag que
descarta resultados tardíos al desmontar (patrón M1/M2). Cambiar `api()` global
está fuera del alcance de este PR.

## 10. M3 NO está en main

`#71` sigue OPEN/DRAFT. Esta rama NO copia la arquitectura de M3 sin integrar
(p. ej. su `ACCESS_POLICY_RESOLVERS`): usa el patrón inline mergeado de main
(`if accessPolicy === 'm2'` → `+ 'm4'`). **Rebase futuro**: cuando M3 mergee,
quien rebase funde los `if` de m2/m3/m4 (o adopta el registro si M3 lo trae) —
conflicto esperado en `navModel.js`/`registry.js`/`App.jsx`/`api.js`, resolución
semántica, no mecánica.
