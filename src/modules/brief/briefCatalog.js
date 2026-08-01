// ─── Catálogo de briefs — FUENTE CANÓNICA de las variantes ───────────────────
// Cada brief es un documento HTML completo y autocontenido que sirve n8n. La PWA
// no los reestiliza ni los reimplementa: los embebe. Todos comparten el MISMO
// componente (BriefEmbedScreen) y el MISMO mecanismo de auth y aislamiento; lo
// único que cambia por variante es lo declarado aquí.
//
// AGREGAR UN BRIEF NUEVO (gerencia, etc.) = una entrada aquí + una entrada en
// src/modules/registry.js con el mismo `moduleId` y `roles: [role]` + una línea
// de <Route> en App.jsx. Cero componentes nuevos.
//
// `role` está duplicado a propósito con el registry: el test de coherencia
// (tests/briefDia.test.mjs) exige que coincidan, así una variante no puede
// quedar visible para un rol distinto al que declara su catálogo.
//
// OJO — `role` decide SOLO la pestaña. El candado del DATO vive en el endpoint
// de n8n, que valida el X-GF-Employee-Token contra gf.employee.mobile.session y
// aplica su propia allowlist (que incluye direccion_general para revisión, sin
// que dirección vea la pestaña). Ver docs/brief-dia-contrato-n8n.md.

export const BRIEFS = Object.freeze([
  Object.freeze({
    id: 'ventas',
    moduleId: 'brief_dia',
    route: '/brief',
    endpoint: '/api-n8n/brief-aida',
    title: 'Mi Brief del día',
    subtitle: 'Rutas y ventas de tu sucursal',
    role: 'supervisor_ventas',
    // El endpoint de ventas no acepta parámetro de fecha: siempre "ayer".
    dateParam: '',
  }),
  Object.freeze({
    id: 'produccion',
    moduleId: 'brief_produccion',
    route: '/brief-produccion',
    endpoint: '/api-n8n/brief-produccion',
    title: 'Mi Brief de planta',
    subtitle: 'Producción del día en Planta Iguala',
    role: 'supervisor_produccion',
    // Acepta ?d=YYYY-MM-DD para revisar días pasados; sin él trae "ayer".
    dateParam: 'd',
  }),
  Object.freeze({
    id: 'gerencia',
    moduleId: 'brief_gerencia',
    route: '/brief-gerencia',
    endpoint: '/api-n8n/brief-gerencia',
    title: 'Brief de gerencia',
    subtitle: 'El día de tu sucursal',
    role: 'gerente_sucursal',
    // Sin selector de día: esta variante siempre trae el default del endpoint.
    dateParam: '',
  }),
])

/** Lookup por id. Fail-closed: null si no existe (la pantalla lo trata como fallo). */
export function getBriefById(id) {
  return BRIEFS.find((brief) => brief.id === id) || null
}

/** ¿esta variante admite elegir día? */
export function briefSupportsDate(brief) {
  return Boolean(brief && typeof brief.dateParam === 'string' && brief.dateParam !== '')
}
