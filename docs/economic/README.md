# Contrato económico — PWA Colaboradores

La PWA **no** es la autoridad de Empresa, Plaza, UN, CC, Canal, Línea, Plan, Vehículo, Fuente ni `analytic_distribution`.

El operador solo captura lo que el sistema no puede conocer (cantidad, producto no inferible, motivo, evidencia, lectura, cliente, conteo, incidencia, autorización).

Fuente canónica (Odoo): `grupofrio/gf` → `docs/economic/ECONOMIC_CONTRACT.md` y módulo `gf_economic_context`.

Reglas de UI:

- No agregar dropdowns de dimensiones económicas.
- Mostrador es fuente (`pwa_pos`), no canal. El canal sale del partner.
- Servicios Compartidos es UN `SCC`, nunca Plaza.
- Nómina no se captura como gasto PWA.
- Subproducción (esperado vs empacado) es KPI, no merma contable.
- Fail-closed contable no debe bloquear empacar hielo.

Este paquete solo documenta el contrato. No cambia pantallas operativas.
