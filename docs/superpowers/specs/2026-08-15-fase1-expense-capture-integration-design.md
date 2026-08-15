# Fase 1 — Integración de captura de gastos PWA con Fase 0

## Objetivo

Entregar la captura de gastos de la PWA sobre el contrato contable canónico ya
fusionado en `grupofrio/gf:main` por Fase 0. La persona captura solamente los
hechos operativos; Odoo resuelve el alcance, artículo, cuenta, dimensiones y
contexto de pago.

La integración se realizará en dos PRs secuenciales:

1. Captura de gastos PWA (este diseño y primer PR).
2. POS: IVA, totales y umbrales server-side, sobre el PR anterior.

## Antecedentes y decisión

Ya existen implementaciones históricas:

- Backend: `grupofrio/gf` PR #8, migrado del #273.
- Frontend de gastos: `grupofrio/colaboradores-pwa` rama
  `feat/captura-gastos-unificada`, migrada del #160.
- Frontend POS: `feat/pos-iva-umbrales`, migrada del #161.

No se fusionarán esas ramas directamente. El backend histórico define
`gf.expense.category.mapping` y un servicio paralelo de dimensiones, ambos
supersedidos por `gf_expense_accounting_close`. Además está desfasado respecto
de `main`. El frontend histórico espera endpoints de categorías y preview que
no son el contrato actual, y permite rutas de evidencia que Fase 0 cerró.

La fuente de verdad financiera es exclusivamente Fase 0 en `gf:main`.

## Contrato backend que consume la PWA

### Catálogo

`GET /pwa-admin/expense-catalog` es la única fuente del selector de artículo.
La PWA envía `company_id`, `warehouse_id` y fecha; los tres se verifican por
Odoo contra el empleado autenticado y su grant. La respuesta contiene artículos
elegibles, no categorías/mapeos editables por la PWA.

La UI muestra el nombre del artículo y los requisitos que devuelve Odoo
(`requires_quantity`, `requires_asset`, `requires_evidence`, operaciones y
tipos de activo permitidos). Un catálogo vacío, respuesta inválida o rechazo no
activa una ruta legacy: bloquea la captura con un mensaje accionable.

### Captura

`POST /pwa-admin/expense-create` recibe únicamente hechos operativos:

- artículo (`product_id`), fecha, importe, descripción y cantidad cuando
  aplique;
- referencia o datos operativos permitidos;
- el identificador de recibo previamente cargado, si hay evidencia.

La PWA no envía ni deriva cuenta, impuestos, distribución analítica, sucursal,
modo de pago, empleado, compañía o almacén. La compañía y almacén que se usan
para leer el catálogo son metadatos de presentación; cualquier valor presente
en la captura final debe coincidir con el alcance derivado por Odoo.

La respuesta de Odoo es el único resultado de éxito. La interfaz sólo limpia el
formulario tras un envelope `ok` válido con el gasto creado y muestra las
dimensiones de presentación devueltas por el servidor.

### Evidencia

El comprobante se carga primero por `/pwa/evidence/upload` con
`context=expense`, inicialmente sin `linked_model` ni `linked_id`. El servidor
lo vincula de manera atómica durante `expense-create` y comprueba el par exacto
token móvil + API key. La PWA no adjunta un archivo posteriormente a un gasto,
no enlaza directamente a `hr.expense` o `hr.expense.sheet`, y no usa el fallback
de adjunto legacy.

## Diseño frontend

Crear un adaptador de dominio pequeño dentro de `src/modules/admin/` para el
catálogo, carga de evidencia y creación del gasto. No se agregará lógica de
gastos a `src/lib/api.js`, que es un punto de alta complejidad. El adaptador
normaliza sólo envelopes válidos y expone errores de contrato como errores
operativos; el formulario conserva estado y no anuncia éxito ante un rechazo.

`AdminGastosForm` pasa de “categoría + preview de dimensiones” a “artículo
elegible + requisitos devueltos por catálogo”. Puede presentar dimensiones
después de la creación, pero nunca simularlas antes ni reconstruirlas en el
cliente. Se elimina el modo legacy y el envío de campos financieros.

La selección de razón social/almacén existente se usa únicamente para pedir el
catálogo. Si no coincide con la identidad móvil o el grant, Odoo deniega la
operación y la UI conserva el borrador.

## Pruebas y aceptación

Las pruebas de Fase 1 cubrirán como mínimo:

1. El adaptador solicita el catálogo con alcance y fecha, y no acepta datos
   malformados como catálogo válido.
2. El payload de creación contiene sólo hechos operativos permitidos; no puede
   incluir analítica, pago, cuenta, compañía, almacén, empleado o sucursal.
3. La evidencia se sube sin enlace directo y se consume una sola vez en la
   creación del gasto.
4. Rechazos de catálogo, evidencia o creación no limpian el formulario ni
   muestran éxito.
5. La UI no ofrece fallback legacy cuando Fase 0 no está disponible.

Antes de solicitar revisión del PR se ejecutarán `npm test`, `npm run build` y
`git diff --check`. En CI se validará el build del frontend; la prueba
end-to-end contra Odoo se hace en staging, con un artículo/regla/grant de
piloto aprobados por Finanzas.

## Fuera de alcance de este PR

- Crear o cambiar mapas, artículos, grants, cuentas, dimensiones o flags de
  Finanzas.
- Activar el flujo en producción.
- Reintroducir los endpoints históricos `/expense-categories` o
  `/expense-dimensions`.
- POS, IVA y umbrales: serán el segundo PR de Fase 1.
- Caja/banco y su ciclo de custodia: pertenecen a la fase posterior.
