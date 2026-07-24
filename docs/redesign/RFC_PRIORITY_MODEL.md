# RFC — Modelo de priorización (CONCEPTUAL, sin código, sin pesos)

> **Estado: RFC.** NO hay código productivo, NO se definen pesos definitivos. El
> objetivo es **explicar** por qué algo aparece primero, nunca producir un "score
> opaco". La prioridad debe poder narrarse en una frase.

## Principio

Una prioridad es explicable si la UI puede decir:
*"Esto aparece primero porque tiene alto impacto financiero, lleva 9 días abierto y
requiere una decisión de Dirección."* Un número solo (p. ej. `score: 87`) **no** es
explicable y queda prohibido como salida visible.

## Dimensiones (a considerar; sin pesos aún)

| Dimensión | Qué mide | Fuente típica |
|-----------|----------|----------------|
| Seguridad | riesgo a personas/activos | señal de dominio |
| Legal / cumplimiento | exposición normativa | señal de dominio |
| Integridad financiera | dinero mal registrado/no conciliado | M6/M7 |
| Continuidad operativa | ruta/producción detenida | M1/M3/M5 |
| Impacto financiero | magnitud en $ (por moneda, sin consolidar) | M1/M4/M6/M7 |
| Impacto operativo | entidades/rutas/clientes afectados | M1–M5 |
| Urgencia | ventana para actuar | derivada |
| Antigüedad | días abierto | lifecycle/edad |
| Entidades afectadas | conteo (no importes) | universo de la regla |
| Cobertura / confianza | qué tan sólida es la evidencia | classification/coverage |
| Accionabilidad | ¿se puede actuar hoy? | señal/área |
| Nivel de decisión | quién debe decidir (Dirección/gerencia/operación) | área responsable |

## Reglas de PRECEDENCIA (jerárquicas, no aditivas)

Ciertas dimensiones **superan** a un mayor monto. Orden propuesto (a validar):

1. **Seguridad** → 2. **Cumplimiento legal** → 3. **Integridad financiera** →
4. **Continuidad operativa** → luego el resto (impacto/urgencia/antigüedad/…).

Es decir: una señal de seguridad con bajo monto puede ir **antes** que una señal
financiera de alto monto. La precedencia es un **desempate cualitativo**, no un peso.

## Anti-patrones (prohibidos)

- Score numérico opaco como única explicación.
- Sumar dimensiones heterogéneas en un solo número sin narrativa.
- Consolidar montos entre monedas para "comparar impacto".
- Tratar cobertura baja como si fuera alta confianza.
- Inventar urgencia sin una ventana real.

## Decisiones abiertas (para Yamil / Etapa posterior)

1. ¿La precedencia es estricta (lexicográfica) o admite excepciones declaradas?
2. Umbrales de "alto/medio/bajo" por dimensión (quién los aprueba).
3. Cómo se explica en la UI (frase generada por reglas, no por IA en v1).
4. Cómo interactúa con la matriz señal→fuente (Etapa 1) y con `trend` (2ª corrida).

**No se implementa nada** hasta que Yamil apruebe dimensiones, precedencia y forma de
explicación.
