# M7 Frontend — Handoff

## Qué es

Frontend completo de **KOLD OS · M7 — Rentabilidad y costos**, un observatorio
read-only en `colaboradores-pwa`. Ruta `/rentabilidad-costos`, sólo Dirección General.

## Estado (léelo antes de tocar nada)

| Hecho | Valor |
|-------|-------|
| Backend | #211 (`GrupoVeniu/GrupoFrio`) **CONGELADO**, **no desplegado** |
| API real | **NO probada** |
| Nivel económico | **L1** (ingreso observable por moneda) |
| Margen / COGS / consolidado | **NO** — bloqueados por contrato |
| Evidencia | **no formal** (`xml_rpc_read_only`) |
| Linaje | **pre-migración**, `reseal_required` |
| Escritura / n8n / financiero | **ninguno** (GET-only) |
| PR | **DRAFT** — sin Ready, sin merge, sin reviewers |

## Lo que M7 SÍ responde

- ¿Cuánto ingreso facturado hay, **por moneda**? (MXN y USD por separado, sin sumar.)
- ¿Qué pedidos confirmados no están facturados? (brecha comercial-facturación.)
- ¿Está presente el costo estándar **actual** en las líneas? (presencia, no COGS.)
- Señales de SVL, gastos contabilizados, flota/rutas, cobertura de `team_id`.
- El dictamen de 36 reglas con sus 4 ejes independientes.

## Lo que M7 NO responde (y lo dice)

Margen bruto, contribución, utilidad operativa/neta, rentabilidad por
ruta/cliente/canal/sucursal, consolidado multi-moneda, match costo-venta histórico.
Cada una aparece como capability **no disponible** con lo que le falta.

## Para llevarlo a producción (checklist, cada punto con su S/N)

1. Desplegar backend #211 y probar la API real `/pwa-kold-os/m7/*`.
2. Re-sellar el linaje al portar a `grupofrio/gf`.
3. Codex reaudita frontend+backend juntos.
4. Rebase limpio (ver [`M7_FE_REBASE_PLAN.md`](M7_FE_REBASE_PLAN.md)).
5. Smoke e2e con backend vivo + Preview Vercel.
6. S/N de Yamil con la frase literal **"merge autorizado"** (exposición + permisos).

## Mapa de archivos

Ver [`M7_FE_ARCHITECTURE.md`](M7_FE_ARCHITECTURE.md). Contrato conjunto en
[`M7_BACKEND_FRONTEND_CONTRACT_MATRIX.md`](M7_BACKEND_FRONTEND_CONTRACT_MATRIX.md).
