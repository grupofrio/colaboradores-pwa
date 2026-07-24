# M7 Frontend — Gate de linaje (pre-migración)

## Estado del linaje

El fixture y el contrato que consume el frontend provienen del backend **#211**, que
vive en `GrupoVeniu/GrupoFrio` como PR **temporal** y cuyo destino real es
`grupofrio/gf`. Por eso el linaje es **pre-migración** y NO puede afirmar igualdad de
sellos con el repo destino.

`lineageState(payload)` reporta:

- `is_production_shell_run: false` — evidencia **no formal** (`xml_rpc_read_only`).
- `pre_migration: true`.
- `reseal_required: true` — al portar a `grupofrio/gf` el sello debe **re-sellarse**.
- `mismatch: false` en v1 (el fixture es no-formal **por diseño**; sólo marcaría
  mismatch si el payload afirmara formalidad sin `evidence_sha256`).

## Referencias de linaje (backend congelado)

| Marca | Valor |
|-------|-------|
| PR backend | `GrupoFrio#211` (temporal, **no desplegado**) |
| Content commit contractual | `88c09f49f916c1596aa0f4b1ab62c5625a41c981` |
| Tip documental | `881a9c62…` |
| Auditor build | `fd34bb95a1fc5e3e58f924c9fa662a1c5a98c1e4` |
| Base | `GrupoFrio @ a1bf33acdf36949bf22c0c1609ee6359d264f77f` |
| `measurement_method` | `xml_rpc_read_only` |

## Gate previo a Ready

Este PR **no debe pasar a Ready ni mergearse** mientras:

1. el backend #211 no esté desplegado y su API real probada;
2. el linaje no se re-selle al portar a `grupofrio/gf`;
3. Codex no reaudite y Yamil no dé S/N con la frase literal "merge autorizado".

El estado pre-migración es **esperado y declarado**, no un defecto. Igual que el
`expected_pre_migration_lineage_mismatch` de M6.
