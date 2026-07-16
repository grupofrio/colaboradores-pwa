# M6 frontend — Lecciones de M1–M5 (gate de aprendizaje)

> Auditado contra el estado REAL: `main` = **`1460185`** (M1 Torre + M2 Planeación
> mergeados; #73 admin activity). **M3 (#71), M4 (#72) y M5 (#74) siguen DRAFT** ⇒
> **ninguno es canónico**. Nada de sus ramas se copia.

## Estado real de M1–M5

| Módulo | PR | Estado | Canónico para M6 |
|---|---|---|:---:|
| M1 Torre / backlog | — | **MERGEADO** en main | **SÍ** |
| M2 Planeación | #68 | **MERGEADO** en main (`b2b1472`) | **SÍ — es el patrón** |
| M3 Ejecución de ruta | #71 | DRAFT | NO |
| M4 Ventas/clientes | #72 | DRAFT | NO |
| M5 Inventario/flujo | #74 | DRAFT | NO |

## Tabla de lecciones

| # | Problema | Módulo | Causa | Por qué pasó tests | Corrección | Patrón canónico actual (main) | Regla M6 | Test obligatorio |
|---|---|---|---|---|---|---|---|---|
| 1 | **M3 y M4 no componen entre sí** | M3+M4 | ambos tocan los mismos archivos compartidos y cada PR se probó AISLADO | cada rama pasaba sola; el choque aparece al mergear el segundo | pendiente (ambos siguen DRAFT) | main sólo tiene M1+M2 ⇒ **integración inline** | M6 toca los archivos compartidos con el **mínimo posible** y documenta el rebase | `m6Rebase` (doc) + `m6Surface` |
| 2 | **Conflictos en App.jsx / api.js / navModel.js / registry.js / access policy** | M3+M4+M5 | 4 ramas compitiendo por 5 archivos | — | — | main: dispatch **inline** `if (module.accessPolicy === 'm2')` en 2 puntos de `navModel.js` | M6 añade **una línea por punto**, nunca refactoriza | `m6Surface` |
| 3 | **M3 filtraba después de paginar** | M3 | `response.rows.filter(...)` en el cliente | un dataset chico cabe en 1 página ⇒ no se nota | filtrar server-side | M2: **todos** los filtros viajan al backend (`filterKoldOsM2Params`) | M6 **jamás** filtra funcionalmente en el cliente; el backend filtra→cuenta→pagina | `m6Filters` (detecta `.filter(` sobre `items`) |
| 4 | **M3 confundía `status=RED` con incumplimiento** | M3 | colapsar el semáforo técnico con la conclusión | el color "parecía" bastar | separar ejes | M2 muestra veredicto con nombre | M6: **4 ejes independientes**; `status` jamás se traduce a `verdict` | `m6Contract` |
| 5 | **M4 usó arquitectura de permisos distinta a M3** | M4 | cada módulo inventó su resolver | ninguno probaba contra el otro | unificar | main: `readM2Access` + dispatch inline; **NO existe `ACCESS_POLICY_RESOLVERS`** (lo introduce M3, DRAFT) | M6 replica **exactamente** el patrón de M2. **No crea un segundo resolver** | `m6Access` |
| 6 | **M5 heredó residuos de M4**: id `ventas-clientes`, export `recurrencia`, comentarios `#205`, categorías ajenas, tests vacíos | M5 | copiar el módulo hermano sin re-identificar | ningún scan miraba manifest/registry/exports; `every()` sobre `[]` es `true` | Codex lo marcó en 2 rondas | — | M6 nace con **scan de identidad** y **cero tests vacuos** | `m6Identity` |
| 7 | **Fixtures y docs se desincronizaron** | M5 | docs escritos LITERALES | un doc no se ejecuta | derivar del fixture | — | Docs de M6 **derivados del fixture**; el generador valida el linaje | `m6Contract` (linaje) |
| 8 | **Campos inexistentes producían "—" en silencio** | M4/M5 | leer una clave que el payload no emite | `undefined` renderiza "—" | test anti-campo-fantasma | — | Toda clave que la UI lee **existe en el fixture**; hay test | `m6Contract` |
| 9 | **Capabilities falsas producían KPIs inexistentes** | M4/M5 | asumir que el backend emite algo | — | capabilities gobiernan | M2: `capability=false` ⇒ "—" + razón | M6: `capability=false` ⇒ **"—" con razón, jamás 0** | `m6Capabilities` |
| 10 | **Módulos DRAFT tomados como canónicos** | M5 | copiar de una rama sin mergear | — | — | **main es la única verdad** | M6 se construye sobre `1460185`; el rebase se documenta | `M6_REBASE_PLAN.md` |

## Lecciones específicas que M6 aplica

### El bug de M1: tarjeta visible, clic bloqueado
La **misma función** debe decidir tarjeta, nav, Más, rail y clic; el route guard
revalida. Si el frontend es más permisivo que el backend, el usuario ve la tarjeta
y recibe un 403 al entrar.

**Consecuencia dura para M6**: el backend M6 acepta **sólo el job key
`direccion_general`** (verificado en `_access_for`: `ALLOWED_TOWER_STATUS` está
declarada pero **nunca se usa**). Por eso el frontend de M6 **NO** acepta
`admin_plataforma`, aunque M2 sí lo haga — M2 puede porque su backend también lo
acepta. Aceptarlo aquí reproduciría exactamente el bug de M1.

### El titular falso de M5
M5 v1 afirmó "el flujo NO cuadra" mezclando conciliaciones abiertas con finales.
**M6 no afirma una conclusión global**: presenta señales reportadas, cobertura de
instrumentación y capacidades no disponibles. Prohibido: "todo cuadra", "no
cuadra", "faltante", "pérdida", "fraude", "dinero desaparecido" — salvo que una
regla `definitive` con umbral **aprobado** lo soporte (v1 no tiene ninguna).

### Los dos fallos silenciosos del espejo de filtros
Un parámetro **de más** cae en `rejected_params` y el backend devuelve la lista
**sin filtrar**; uno **de menos** se descarta antes de salir. Ambos son mudos ⇒
`rejected_params` se muestra en banner visible.
