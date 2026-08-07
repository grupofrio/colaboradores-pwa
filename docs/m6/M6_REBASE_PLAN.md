# M6 — Plan de rebase (después de que mergeen M3/M4/M5)

> **Base de M6**: `main` = `1460185` (M1 Torre + M2 Planeación mergeados).
> **M3 (#71), M4 (#72) y M5 (#74) siguen DRAFT** y compiten por los mismos 5
> archivos compartidos. M6 se construyó sobre `main` a propósito: tomar una rama
> DRAFT como canónica fue el error 10 de M5.

## Por qué este documento existe

M3 y M4 **no componen entre sí**: cada uno pasó en aislamiento y el choque
aparece al mergear el segundo. M6 es el cuarto en la fila. Este plan hace que su
rebase sea una **unión mecánica y auditable**, no una arqueología.

**Regla rectora del rebase**: comparar **semánticamente**, no textualmente.
**Jamás sobrescribir** cambios de M3/M4/M5.

## Los 4 archivos compartidos que M6 toca

### 1. `src/lib/navModel.js` — **el conflicto seguro**

| | |
|---|---|
| **Cambio de M6** | +1 import (`readM6Access`) y +1 `if` inline en **cada** dispatch (`isModuleVisibleForSession`, `getModuleEntryDecisionForSession`) |
| **Cambio esperado de M3** | introduce el mapa **`ACCESS_POLICY_RESOLVERS`** y **reemplaza** los `if` inline |
| **Cambio esperado de M4/M5** | cada uno añade su propio `if` inline (o su entrada al mapa, si rebasan sobre M3) |
| **Estrategia** | **Si #71 mergea primero**: borrar los dos `if` de M6 y añadir **una entrada** al mapa: `m6: (session) => readM6Access(session).level === 'global'`. Conservar el import. **Si M6 mergea primero**: no hacer nada; quien rebase #71 funde los `if` de m2/m6 en el mapa. |
| **Test posterior** | `m6Surface` → *"navModel: el dispatch inline sigue el patrón de main"*. **Ese test FALLARÁ tras adoptar el mapa: es la señal, no un bug.** Actualizarlo para verificar la entrada del mapa y que la línea fail-closed sigue viva. |

⚠️ **Nunca crear un segundo resolver.** Si M6 mantuviera su `if` mientras M3 usa
el mapa, habría dos autoridades decidiendo lo mismo.

### 2. `src/App.jsx`

| | |
|---|---|
| **Cambio de M6** | +1 `lazy`, +1 import (`readM6Access`), +`M6CajaRoute`, +`ScreenCajaConciliacionM6Mount`, +1 `<Route>` |
| **Cambio esperado M3/M4/M5** | exactamente lo mismo con sus nombres |
| **Estrategia** | **conflicto por adyacencia, no semántico**: los bloques son independientes. Aceptar **ambos lados** en cada hunk (lazy, imports, guards, mounts, rutas). Verificar que no queden dos `<Route>` con el mismo `path`. |
| **Test posterior** | `m6Surface` → *"App.jsx: la ruta está protegida por su propio guard"* |

⚠️ Si M3 unificara los guards en un componente genérico, **no** meter M6 ahí sin
revisar: el guard de M6 **no acepta `admin_plataforma`** y los de M2/M3 sí. Un
guard "genérico" que acepte tower_status abriría M6 a quien el backend rechaza.

### 3. `src/lib/api.js`

| | |
|---|---|
| **Cambio de M6** | +1 import (`koldOsM6Route`), +`directKoldOsM6`, +1 línea en `directHandlers` |
| **Cambio esperado M3/M4/M5** | idéntico con su namespace |
| **Estrategia** | aceptar ambos lados. El array `directHandlers` es el único punto real de conflicto: conservar **todas** las entradas. El orden no importa (cada handler devuelve `NO_DIRECT` si la ruta no es suya). |
| **Test posterior** | `m6Api` → *"api.js: el handler M6 es GET-only y PROHÍBE el fallback n8n"* |

### 4. `src/modules/registry.js`

| | |
|---|---|
| **Cambio de M6** | +1 entrada `cash-reconciliation` con `navPriority: 15` |
| **Cambio esperado M3/M4/M5** | +1 entrada cada uno |
| **Estrategia** | aceptar ambos lados. **Verificar `navPriority` duplicados** (M3=?, M4=?, M5=14, M6=15) y que **ningún id colisione** — M5 llegó a usar `ventas-clientes`, el id de M4. |
| **Test posterior** | `m6Surface` → *"identidad: NO reutiliza el id de ningún otro módulo"* + *"ningún id duplicado en el registry"* |

### 5. Access policies (`src/modules/*/m*/access.js`)

**Sin conflicto**: cada módulo tiene su archivo. El riesgo es de **coherencia**, no
de merge: si alguien "unifica" los resolvers, M6 debe conservar su regla propia
(solo `direccion_general`).

## Orden recomendado de merge

```
1. M3 (#71)  → introduce ACCESS_POLICY_RESOLVERS
2. M4 (#72)  → rebase sobre M3, adopta el mapa
3. M5 (#74)  → rebase, adopta el mapa
4. M6        → rebase, adopta el mapa (1 entrada)
```

M6 es **el más barato de rebasar**: su superficie compartida son ~56 líneas y
todo lo demás vive en archivos nuevos (`src/modules/caja-conciliacion/`,
`src/lib/koldOsM6Route.js`, `tests/m6*`, `docs/m6/`).

## Checklist post-rebase

- [ ] `npm test` verde (los tests de M6 son ~68; el total debe subir, no bajar)
- [ ] `npm run lint` 0 · `npm run build` OK · `check_public_e1` OK
- [ ] Un solo resolver de políticas (mapa **o** inline, no ambos)
- [ ] Ningún `<Route path>` duplicado
- [ ] Ningún id ni `navPriority` duplicado en el registry
- [ ] `readM6Access` **sigue** aceptando solo `direccion_general`
- [ ] El guard de M6 **sigue sin** aceptar `admin_plataforma`
- [ ] `directHandlers` conserva **todos** los handlers
- [ ] Smoke: `direccion_general` entra · otro rol expulsado · sin sesión → login
