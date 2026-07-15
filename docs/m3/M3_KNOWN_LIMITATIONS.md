# M3 — Limitaciones conocidas (v3, tras Codex ronda 2 · YELLOW)

## 0. La limitación más importante: qué NO prueba este observatorio

De 39 reglas, **solo 6 producen INCUMPLIMIENTOS afirmables** (`definitive`:
umbral aprobado + supuesto verificado por modelo/constraint). Las otras 33 son:
8 riesgos con supuesto declarado · **12 anomalías exploratorias** (señalan dónde
mirar, NO prueban conclusión) · 9 no evaluables · 4 que cumplen.

El contrato lo **impone** en `/latest` **y en `/findings`**: una regla
exploratoria no puede llegar como incumplimiento, un incumplimiento exige
`approved_threshold=true`, y un hallazgo no puede contradecir a su regla.

**Totales demostrados por test** (no afirmados a mano): 4,126 definitivas +
4,012 riesgos + **7,543 anomalías** = 15,681. La invariante es
`summary.<veredicto>_count == suma exacta de sus rule_results`.

## 1. Corrida productiva por odoo-shell: NO EJECUTADA (bloqueada)

`is_production_shell_run=false`, y el envelope declara **por qué**:
`ssh_key_not_registered` · `module_not_deployed` ·
`production_shell_unavailable`. Los NÚMEROS son reales (XML-RPC read-only,
ventana acotada); **la corrida formal no**. La UI lo advierte con un banner que
se decide por el **dato** (`!run.is_production_shell_run`), no por el modo demo:
una corrida no formal ingerida en producción advertiría igual.

Ver `gf_kold_os_m3/docs/M3_EVIDENCE_STATUS.md`.

## 2. Umbrales NO aprobados (8)

Radio de check-in 300 m · duración <1 min · duración >120 min · tolerancia de
salida · adopción km 80/40 · señalización de incidentes 50/20 · coverage_min 50%
· staleness 7 días. Todas las reglas que dependen de ellos son **exploratorias**
por contrato. Ratificarlos = decisión de dirección/operaciones + cambio en el
catálogo del BACKEND (una sola fuente).

## 3. Dimensión parcial

Solo M3-A-07 tiene dimensión sucursal real. Sin dimensión ruta/parada/registro:
sin "Detalle por ruta", sin `/routes/<id>`, filtros route/plan/vehicle aceptados
pero sin efecto hasta v1.1. La UI declara la granularidad por fila (badge).

## 4. Reglas que el modelo no permite evaluar (9)

Aceptación de carga (sin campo) · secuencia/ventana · frecuencia AA/B · balance
carga/venta · **telemetría offline** (la cola vive en el CLIENTE kold-field) ·
kilos/tiempo plan-real · **refill** (`van.refill.request` sin `company_id` ⇒ no
atribuible) · **distancia plan vs real** (cobertura 4.49%). El KPI de eventos
offline muestra "—", nunca 0.

## 5. Modelos con semántica no verificada funcionalmente

- **`gf.seller.cashbox`**: 205/205 en `open`. Observación cruda; NO se afirma
  "corte pendiente". El corte formal es `gf.branch.daily.close` — 12 registros
  de UNA sucursal (#26) ⇒ exploratoria.
- **`gf.route.incident`**: sin `state` ni cierre ⇒ "abierto" ≡ "atendido".
- **`departure_time_target`**: mediana +124 min / p90 +565 min ⇒ probablemente no
  refleja la operación real (foráneas/turnos). Pendiente de validación.
- **Coordenadas de clientes**: 19% del padrón sin coordenada ⇒ la distancia de
  check-in mide geocódigo tanto como conducta.

## 6. Historial arranca en 1 corrida

Persistencia/reincidencia/corregidos/tendencias con la 2ª ingesta real.

## 7. Otros

Filtro `status` local (el backend no lo expone) · sin mapa (privacidad;
`map_view=false`) · sin filtro por operador (`employee_id` rechazado por diseño)
· `api()` no acepta AbortSignal ⇒ timeout duro + descarte al desmontar.

## 8. Rebase sobre main: RESUELTO (ya no es una limitación)

Rebasado sobre `b2b1472` (main con #67 y #68 mergeados). **5 conflictos
semánticos resueltos a mano** — `navModel.js` · `registry.js` · `ScreenHome.jsx`
· `App.jsx` · `api.js` — sin `ours`/`theirs`. La política de acceso quedó
**canónica** (`ACCESS_POLICY_RESOLVERS`) en vez de una cadena de `if` por módulo.
M1 (Tower) y M2 intactos, probados en la matriz A–G y verificados en runtime.

## 9. Deuda viva

- **Un módulo nuevo con `accessPolicy` debe darse de alta en
  `ACCESS_POLICY_RESOLVERS`**. Si se olvida, queda invisible (fail-closed) — el
  modo de fallo correcto, pero conviene saberlo.
- **La ratificación de los 8 umbrales** sigue pendiente: hasta que ocurra, 12
  reglas son anomalías por contrato y M3 no puede afirmar más.

## Riesgos

- **Deriva backend↔frontend**: mitigada con `schema_version` + capabilities + el
  fixture generado por el core real del backend + el contrato epistémico
  (la UI rechaza un envelope sin classification/verdict/universe, con totales que
  no cuadran, o con findings que contradicen a sus reglas). El propio rebase
  demostró que funciona: regenerar el fixture destapó dos desalineaciones reales
  (`finding_id` y `history.runs_count`) que el contrato cazó.
- **Lectura del demo como corrida formal**: mitigada con banner por dato,
  procedencia, `is_production_shell_run:false` y bloqueadores explícitos.
- **Que alguien lea solo los colores**: mitigada con badges de veredicto,
  desglose obligatorio y el copy "Lee los veredictos, no solo los colores".
