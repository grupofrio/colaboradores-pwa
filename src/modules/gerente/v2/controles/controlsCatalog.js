// ─── Catálogo de las 14 reglas de control (Fase 3) ──────────────────────────
// Fuente única de la metadata de presentación: clave, etiqueta, categoría y
// unidad. Espeja las claves que devuelve el backend (`/pwa-gerente/controls`).
// El backend es la autoridad del DATO (count/total/items/available); esto solo
// nombra y agrupa para el panel. Si el backend agrega/quita una regla, esta
// lista se ajusta — el panel pinta lo que llega, no lo que esta lista supone.
//
// `severity` es el color del semáforo cuando la regla TIENE hallazgos (count>0):
// no es un juicio automático de gravedad del caso, es la prominencia visual de
// la categoría. Un count 0 real siempre se pinta verde («sin hallazgos ✅»),
// y `available:false` siempre gris («sin fuente»), sin importar severity.

export const CONTROL_CATEGORIES = Object.freeze({
  gastos: 'Gastos',
  pos: 'Ventas mostrador',
  caja: 'Caja',
  requis: 'Requisiciones e inventario',
})

// Orden = orden de aparición en el panel. `unit` decide cómo se formatea el
// total: 'money' → $ ; 'count' → número ; 'rate' → % ; null → sin total.
export const CONTROL_RULES = Object.freeze([
  // ── Gastos ──
  { key: 'expense_duplicate', category: 'gastos', label: 'Duplicado sospechoso',
    desc: 'Mismo monto, mismo día y mismo capturista', unit: 'money', severity: 'warning' },
  { key: 'expense_splitting', category: 'gastos', label: 'Fraccionamiento',
    desc: 'Varios gastos que juntos superan el umbral pero individualmente lo esquivan', unit: 'money', severity: 'error' },
  { key: 'expense_no_receipt', category: 'gastos', label: 'Sin comprobante',
    desc: 'Gastos sobre el umbral aprobados sin adjunto', unit: 'money', severity: 'error' },
  { key: 'expense_backdating', category: 'gastos', label: 'Backdating',
    desc: 'Fecha del gasto muy anterior a la fecha de captura', unit: 'money', severity: 'warning' },
  { key: 'expense_looks_deposit', category: 'gastos', label: 'Parece depósito',
    desc: 'Descripción con patrón DEPÓSITO / RETIRO / TRASPASO', unit: 'money', severity: 'warning' },
  { key: 'expense_no_dimension', category: 'gastos', label: 'Sin categoría / analítica',
    desc: 'Gastos capturados sin la dimensión completa (rezago vivo)', unit: 'money', severity: 'warning' },
  // ── POS ──
  { key: 'pos_cancellations', category: 'pos', label: 'Cancelaciones',
    desc: 'Tasa de cancelación por capturista; pico sobre el promedio de la sucursal', unit: 'money', severity: 'warning' },
  { key: 'pos_underprice', category: 'pos', label: 'Venta bajo precio',
    desc: 'Líneas vendidas por debajo de la lista de precios', unit: 'money', severity: 'error' },
  { key: 'pos_off_hours', category: 'pos', label: 'Horario anómalo',
    desc: 'Ventas registradas fuera del horario del turno', unit: 'money', severity: 'warning' },
  // ── Caja ──
  { key: 'cash_recurring_diff', category: 'caja', label: 'Diferencias recurrentes',
    desc: 'Cortes con diferencia ≠ 0 por responsable; racha y acumulado', unit: 'money', severity: 'error' },
  { key: 'cash_reopens', category: 'caja', label: 'Reaperturas',
    desc: 'Turnos reabiertos: quién, cuándo, frecuencia', unit: 'count', severity: 'warning' },
  { key: 'cash_manual_adjust', category: 'caja', label: 'Ajustes manuales',
    desc: 'Ingresos/egresos de ajuste grandes o frecuentes en los cierres', unit: 'money', severity: 'warning' },
  // ── Requisiciones / inventario ──
  { key: 'requis_stuck_receipt', category: 'requis', label: 'Recepción eterna',
    desc: 'Requisiciones confirmadas con recepción parcial estancada (mercancía pagada no recibida)', unit: 'money', severity: 'error' },
  { key: 'fuel_no_route', category: 'requis', label: 'Gasolina sin ruta',
    desc: 'Gastos de combustible cuya ruta no corrió ese día', unit: 'money', severity: 'error' },
])

export const CONTROL_RULE_KEYS = CONTROL_RULES.map((r) => r.key)

/** Metadata de una regla por su clave (o null si no está en el catálogo). */
export function ruleMeta(key) {
  return CONTROL_RULES.find((r) => r.key === key) || null
}

/** Formatea el total de una regla según su unidad. `null` ⇒ «—» (sin dato). */
export function formatTotal(rule, value) {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (rule?.unit === 'money') return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (rule?.unit === 'rate') return n.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + '%'
  return n.toLocaleString('es-MX')
}

export const CONTROL_PERIODS = Object.freeze([
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
])

/** Motivos legibles del backend cuando una regla viene available:false. */
export function controlReasonText(reason) {
  return {
    source_unavailable: 'La fuente de esta regla no existe en este ambiente.',
    photo_hash_unavailable: 'No hay hash de foto para comparar comprobantes reutilizados.',
    route_source_unavailable: 'La fuente de rutas vive en el registry completo (liquidaciones).',
    shift_schedule_unavailable: 'No hay horario de turno configurado para comparar.',
    pricelist_snapshot_unavailable: 'No se guarda el precio de lista al vender para comparar a posteriori.',
    requires_full_registry: 'Requiere el módulo de logística/rutas.',
    not_wired: 'Fuente presente, pendiente de cablear.',
  }[reason] || 'Sin fuente de datos disponible.'
}
