# E1-B — Superficie KOLD Tower (read-only) que consume el contrato E1-A

> **Estado:** PR **DRAFT** — **NO merge, NO deploy, NO exposición a usuarios** hasta S/N posterior de Yamil.
> **Alcance:** superficie **read-only/status por rol** que consume `tower.status.<role>.json` (contrato producido por **E1-A** en `grupofrio/kold-os`). Sin writes, sin endpoints nuevos, sin n8n, sin WhatsApp, sin IA.

## Qué incluye
| Archivo | Rol |
|---|---|
| `loadTowerStatus.js` | Loader **read-only**: `fetch` de un asset estático (`/e1/tower.status.<role>.json`) + validación de forma del contrato + denylist de claves. No usa el api operativo. |
| `TowerStatusBoard.jsx` | Tablero presentacional: banner de `role_gate` + tarjetas de módulo con **badge honesto** (color = `badge_tone` del contrato) + `can_not`/residual + footer con `data_as_of`. 0 acciones. |
| `ScreenKoldTowerE1.jsx` | Pantalla que resuelve el rol de la sesión (read-only) y monta el tablero. |
| `../../../public/e1/tower.status.*.json` | **FIXTURES de preview** (copias del output de E1-A). Ver "Entrega real" abajo. |
| `tests/e1TowerStatus.test.mjs` | Test `node --test`: valida los 6 samples, gates por rol, badges honestos, rechazo de role id inseguro y de contratos inválidos. |

## ⚠️ NO montado en el router (por diseño)
`ScreenKoldTowerE1` **no** está en `src/App.jsx`. Es intencional: **montar la ruta y exponerla a usuarios es un paso separado que requiere S/N de Yamil** (evita exposición general en este draft). Este PR deja el componente listo y probado, no visible.

## Entrega real del dato (E1-C, no este PR)
Los JSON bajo `public/e1/` son **fixtures**. La entrega real del artefacto `tower.status` desde **E1-A (kold-os)** hacia esta PWA será un **paso de build/CI en E1-C** (publicar el artefacto versionado; no hand-copy). El loader ya acepta `base` configurable para apuntar a esa fuente.

## Reglas (heredadas del gate E1)
Read-only · sin writes · sin endpoints nuevos · sin n8n/WhatsApp/IA · sin deploy · **badges honestos = los del contrato E1-A (derivados del tracker), este código NO decide badges** · `/direccion`, `/comercial`, `/finanzas` gated (el gate viaja en `role_gate` del propio contrato). **No merge sin S/N.**
