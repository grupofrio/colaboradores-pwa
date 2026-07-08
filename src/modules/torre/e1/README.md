# E1-B — Superficie KOLD Tower (read-only) que consume el contrato E1-A

> **Estado:** PR **DRAFT** — **NO merge, NO deploy, NO exposición a usuarios** hasta S/N posterior de Yamil.
> **Alcance:** superficie **read-only/status por rol** que consume `tower.status.<role>.json` (contrato producido por **E1-A** en `grupofrio/kold-os`). Sin writes, sin endpoints nuevos, sin n8n, sin WhatsApp, sin IA.

## Qué incluye
| Archivo | Rol |
|---|---|
| `loadTowerStatus.js` | Loader **read-only** + candados: `assertSafeBase` (solo `/e1` en prod), `validateTowerStatus`, `resolveBoardView` (gated ⇒ bloqueado). |
| `TowerStatusBoard.jsx` | Tablero **Enterprise** presentacional: header con rol + pills (Solo lectura / No ejecuta acciones), resumen por badge, tarjetas responsivas, footer con `data_as_of`. Roles gated ⇒ bloque restringido (sin módulos). |
| `ScreenKoldTowerE1.jsx` | Pantalla que resuelve el rol de la sesión (read-only) y monta el tablero. |
| `../../../public/e1/tower.status.*.json` | **Fixtures de preview.** Roles **gated van minimizados** (`modules: []`). |
| `../../../scripts/check_public_e1.mjs` | Guard: valida contrato + **invariante de minimización** de roles gated + drift opcional vs E1-A. |
| `../../../tests/e1TowerStatus.test.mjs` | `node --test`: base blindada, gated no renderiza módulos, minimización, badges honestos. |

## Correcciones Codex (v2)
1. **`base` blindado (asset estático):** en **producción** `assertSafeBase` solo acepta `"/e1"`. Override de `base` **solo en dev/test** (cuando se inyecta `fetchImpl`), y **nunca** a URL absoluta / `://` / traversal `..` / `//` / bases operativas (`/api`, `/rpc`, `/odoo`, `/n8n`, `/webhook`, `/graphql`, `/xmlrpc`, `/jsonrpc`). E1-B **no** consume API operativa.
2. **Roles gated NO renderizan módulos:** `resolveBoardView` — si `role_gate.is_gated`, devuelve `blocked:true` con `modules: []`. **Default seguro = bloqueado**; preview interno solo con `allowGatedPreview` explícito (dev/test), nunca por default. El tablero muestra un **bloque restringido** con el código del gate (`PEND-NOMINALES` / `FASE-1.5`), sin tarjetas ni residuales.
3. **Minimización de fixtures (Enterprise-safe):** los assets públicos de roles gated (`direccion_general`, `comercial`, `finanzas`) van **sin módulos** (`modules: []`). Aunque se desplegaran como estáticos, **no exponen módulos sensibles**. Doble candado: dato minimizado **+** UI bloquea.
4. **Guard de drift (`check_public_e1.mjs`):** valida la invariante de minimización siempre; y con `KOLD_OS_E1_OUT=<ruta kold-os/e1/out>` compara contra el output canónico de E1-A (no-gated = igual; gated = proyección minimizada). **Requisito bloqueante de E1-C:** el pipeline real (E1-A publica artefacto minimizado + CI corre este guard) antes de cualquier deploy — **este PR no se mergea/despliega con fixtures peligrosos**.

## ⚠️ NO montado en el router (por diseño)
`ScreenKoldTowerE1` **no** está en `src/App.jsx`. Montar la ruta / exponerla a usuarios = **paso separado con S/N**. Este PR deja el componente listo y probado, **no visible**.

## Diseño Enterprise (con lo existente, sin librerías nuevas)
Jerarquía clara (título → rol → gate → resumen → módulos); tarjetas sobrias con buen espaciado; grid responsivo (`minmax(clamp(240px,30vw,320px),1fr)`) legible en móvil/tablet/escritorio; microcopy ejecutivo; señales de confianza (`data_as_of`, "Solo lectura", "No ejecuta acciones", gate visible). **Pendiente para E1-C:** agrupación por área, i18n formal, tokens compartidos con el resto del PWA, y estados de carga/vacío pulidos.

## Reglas (heredadas del gate E1)
Read-only · sin writes · sin endpoints nuevos · sin n8n/WhatsApp/IA · sin deploy · **badges = los del contrato E1-A (derivados del tracker); este código NO decide badges** · `/direccion`, `/comercial`, `/finanzas` gated (viaja en `role_gate`). **No merge sin S/N.**
