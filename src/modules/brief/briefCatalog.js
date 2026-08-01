// ─── Catálogo de briefs — FUENTE CANÓNICA de las variantes ───────────────────
// Cada brief es un documento HTML completo y autocontenido que sirve n8n. La PWA
// no los reestiliza ni los reimplementa: los embebe. Todos comparten el MISMO
// componente (BriefEmbedScreen) y el MISMO mecanismo de auth y aislamiento; lo
// único que cambia por variante es lo declarado aquí.
//
// AGREGAR UN BRIEF NUEVO (gerencia, etc.) = una entrada aquí + una entrada en
// src/modules/registry.js con el mismo `moduleId` y los mismos `viewerRoles` +
// una línea de <Route> en App.jsx. Cero componentes nuevos.
//
// `viewerRoles` está duplicado a propósito con el registry: el test de
// coherencia (tests/briefEmbed.test.mjs) exige que coincidan, así una variante
// no puede quedar visible para un rol distinto al que declara su catálogo.
//
// El PRIMERO de `viewerRoles` es el dueño del brief (a quien va dirigido);
// `direccion_general` va en todos porque dirección revisa el piloto y, desde
// 2026-08-01, también ve la entrada en la UI (antes solo tenía acceso al dato).
//
// OJO — `viewerRoles` decide SOLO si se muestra la entrada. El candado del DATO
// vive en el endpoint de n8n, que valida el X-GF-Employee-Token contra
// gf.employee.mobile.session y aplica su propia allowlist. Ampliar esta lista
// NO amplía el acceso: quien no esté en la allowlist del endpoint recibe 403 y
// la pantalla lo dice. Ver docs/brief-dia-contrato-n8n.md.

export const BRIEFS = Object.freeze([
  Object.freeze({
    id: 'ventas',
    moduleId: 'brief_dia',
    route: '/brief',
    endpoint: '/api-n8n/brief-aida',
    title: 'Mi Brief del día',
    subtitle: 'Rutas y ventas de tu sucursal',
    viewerRoles: ['supervisor_ventas', 'direccion_general'],
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
    viewerRoles: ['supervisor_produccion', 'direccion_general'],
    // Acepta ?d=YYYY-MM-DD para revisar días pasados; sin él trae "ayer".
    dateParam: 'd',
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
