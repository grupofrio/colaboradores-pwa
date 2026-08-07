# Borrador — solicitud a Sebastián (2ª corrida M2–M6)

> **BORRADOR. NO ENVIADO.** Requiere S/N de Yamil antes de enviarse. El objetivo es
> habilitar la dimensión "qué cambió" en KOLD OS, que HOY está vacía ("primera
> medición"). **No se asume** que todos los módulos estén listos para una 2ª corrida.

## Contexto

Para mostrar "qué cambió desde la última revisión" necesitamos **dos corridas
comparables del MISMO scope** por módulo. Antes de comparar hay que verificar
compatibilidad (mismo `scope_key`, compañía/sucursal, granularidad, método de
medición, ventana, versión de contrato); comparar una corrida parcial con una completa
sería engañoso.

## Mensaje propuesto

> Hola Sebas. Para activar el comparativo "qué cambió" en KOLD OS necesito, **por
> módulo (M2, M3, M4, M5, M6)**, confirmar:
>
> 1. **Estado de despliegue real** del backend (`gf_kold_os_mX`): ¿desplegado en prod,
>    con flag encendido, con corridas ingeridas? (varios están DRAFT/no desplegados).
> 2. **Última corrida** ingerida: `run_id`, `finished_at`, `scope_key`.
> 3. **¿Es posible ejecutar una 2ª corrida** del mismo scope? ¿Cuándo?
> 4. Para la comparabilidad, de la corrida existente y la nueva:
>    - `scope_key`
>    - compañía(s) / sucursal(es)
>    - ventana (fechas o `window_days`)
>    - método de medición (`measurement_method` / odoo-shell formal vs xml_rpc)
>    - versión de contrato (`schema_version` / `kold.os.mX.api/…`)
>    - `is_production_shell_run` (formal / no formal)
> 5. **Resultado de tests runtime** (si los corriste) de cada módulo.
>
> Con eso decido qué módulos pueden mostrar comparativo y cuáles siguen en "primera
> medición". No compares corridas de scope distinto; si una es parcial, la marco como
> no comparable.

## Notas de gobernanza

- Esto **no** pide desplegar ni mergear nada: pide **información de estado**.
- La activación del comparativo en la UI es Etapa posterior (con su S/N).
- Mientras no haya 2ª corrida comparable, la UI dice: *"Primera medición disponible.
  El comparativo comenzará con la siguiente corrida compatible."*

## Estado

**Pendiente de S/N de Yamil para enviar.**
