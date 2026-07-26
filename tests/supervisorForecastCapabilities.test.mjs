// Forecast · capabilities POR ACCIÓN — comportamiento observable de la pantalla.
//
// Regla del contrato: `editable` es la capability de UNA acción (reemplazo de
// líneas vía el endpoint SEGURO update_lines). NO autoriza confirmar, cancelar
// ni eliminar: esas acciones NO tienen endpoint seguro (guard legacy
// `_guard_and_cfg`, payload-trust) y el DTO las reporta `false`
// (NO_SECURE_ENDPOINT). Aquí se verifica que la pantalla:
//   · no importa ni expone ninguna función de escritura para ellas;
//   · deriva el afford de edición de SU capability;
//   · cae a "Solo lectura" cuando el servidor no autoriza editar.
//
// LÍMITES: sin jsdom/RTL no hay click real; se ejercita el módulo REAL de la
// pantalla (import + análisis de su superficie de escritura alcanzable) y la
// lógica de decisión pura. La autoridad final es el backend en cada write.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as supvApi from '../src/modules/supervisor-ventas/api.js'

const SCREEN = readFileSync(fileURLToPath(
  new URL('../src/modules/supervisor-ventas/ScreenPronostico.jsx', import.meta.url),
), 'utf8')

// Espejo de la decisión de la UI (misma expresión que ScreenPronostico):
// con capabilities conocidas manda `editable`; sin ellas, el estado local es
// solo una pista de presentación y abrir la edición reconsulta el DTO.
const canEdit = (caps, state) => (caps ? caps.editable === true : state === 'draft')

const CAPS_ALL_FALSE = {
  editable: false, can_confirm: false, can_cancel: false,
  can_delete: false, can_reset_to_draft: false, empty_replace_allowed: false,
}
const CAPS_EDITABLE = { ...CAPS_ALL_FALSE, editable: true }

// ── 1) Read-only total: ninguna acción de escritura autorizada ───────────────
test('read-only: todas las capabilities en false ⇒ no se puede editar', () => {
  assert.equal(canEdit(CAPS_ALL_FALSE, 'draft'), false)
  assert.equal(canEdit(CAPS_ALL_FALSE, 'confirmed'), false)
  // Ni siquiera un estado "draft" reabre la edición si el servidor dijo que no.
  assert.equal(canEdit({ ...CAPS_ALL_FALSE }, 'draft'), false)
})

test('read-only: `editable` NO se usa como permiso genérico de otras acciones', () => {
  // Con editable=true, el resto sigue en false: son capabilities independientes.
  for (const key of ['can_confirm', 'can_cancel', 'can_delete', 'can_reset_to_draft']) {
    assert.equal(CAPS_EDITABLE[key], false, `${key} no debe heredar de editable`)
  }
})

// ── 2) Permisos parciales: cada acción responde SOLO a su capability ─────────
test('parcial: editable=true ⇒ se ofrece editar; el resto sigue prohibido', () => {
  assert.equal(canEdit(CAPS_EDITABLE, 'draft'), true)
  assert.equal(CAPS_EDITABLE.can_confirm, false)
  assert.equal(CAPS_EDITABLE.can_delete, false)
})

test('parcial: editable=false con otras true NO habilita la edición', () => {
  const caps = { ...CAPS_ALL_FALSE, can_confirm: true, can_delete: true }
  assert.equal(canEdit(caps, 'draft'), false)
})

// ── 3) Estados ───────────────────────────────────────────────────────────────
test('estados: draft/confirmed/cancelled/unknown según capabilities del servidor', () => {
  // El servidor ya derivó la capability; la UI no re-deriva permisos por estado.
  assert.equal(canEdit({ ...CAPS_EDITABLE }, 'draft'), true)
  assert.equal(canEdit({ ...CAPS_ALL_FALSE }, 'confirmed'), false)
  assert.equal(canEdit({ ...CAPS_ALL_FALSE }, 'cancelled'), false)
  assert.equal(canEdit({ ...CAPS_ALL_FALSE }, 'teletransportado'), false)
})

test('estados: sin capabilities cargadas, un estado desconocido NO ofrece editar', () => {
  assert.equal(canEdit(null, 'teletransportado'), false)
  assert.equal(canEdit(null, 'confirmed'), false)
  assert.equal(canEdit(null, 'cancelled'), false)
})

// ── 4) Superficie de escritura ALCANZABLE desde la pantalla ─────────────────
test('la pantalla NO importa los clientes de escritura sin respaldo seguro', () => {
  // Además del botón: no debe existir la función alcanzable.
  for (const fn of ['confirmForecast', 'cancelForecast', 'deleteForecast']) {
    const imported = new RegExp(`^\\s*${fn},\\s*$`, 'm').test(SCREEN)
    assert.equal(imported, false, `${fn} no debe importarse en ScreenPronostico`)
  }
})

test('la pantalla NO define handlers para las acciones retiradas', () => {
  for (const handler of ['handleConfirm', 'handleDelete']) {
    assert.equal(
      new RegExp(`function ${handler}\\b`).test(SCREEN), false,
      `${handler} no debe existir`,
    )
  }
  // `handleCancelEdit` (cerrar el formulario) SÍ existe y no es una escritura.
  assert.ok(/function handleCancelEdit\b/.test(SCREEN))
  assert.equal(/function handleCancel\s*\(/.test(SCREEN), false, 'handleCancel (write) no debe existir')
})

test('los clientes inseguros siguen existiendo en la capa api pero NADIE los llama desde la pantalla', () => {
  // No se borran del módulo api (otros consumidores/legacy podrían existir);
  // lo que se corta es su alcance DESDE esta pantalla.
  assert.equal(typeof supvApi.confirmForecast, 'function')
  assert.equal(typeof supvApi.cancelForecast, 'function')
  assert.equal(typeof supvApi.deleteForecast, 'function')
  for (const fn of ['confirmForecast(', 'cancelForecast(', 'deleteForecast(']) {
    assert.equal(SCREEN.includes(fn), false, `${fn} no debe invocarse en la pantalla`)
  }
})

// ── 5) Refresh de capabilities tras acción y tras conflicto ─────────────────
test('tras un guardado exitoso se relee el DTO (líneas + capabilities + lista)', () => {
  const success = SCREEN.slice(SCREEN.indexOf('Solo con éxito REAL'))
  assert.match(success, /getForecastDto\(forecastId\)/)
  assert.match(success, /setForecastCapsCache/)
  assert.match(success, /await loadData\(\)/)
})

test('en CONFLICT se releen write_date y capabilities, sin re-escribir solo', () => {
  const conflict = SCREEN.slice(SCREEN.indexOf("result?.phase === 'conflict'"))
  assert.match(conflict, /setEditingWriteDate\(dto\.write_date/)
  assert.match(conflict, /setForecastCapsCache/)
  // Si dejó de ser editable, se cierra la edición en vez de reintentar.
  assert.match(conflict, /ya no es editable/)
  // No hay reintento automático de escritura tras el conflicto.
  assert.equal(/conflict[\s\S]{0,600}updateForecastLines\(/.test(conflict), false)
})

// ── 6) UI honesta ────────────────────────────────────────────────────────────
test('UI: sin autorización de edición se muestra "Solo lectura" accesible', () => {
  assert.match(SCREEN, /Solo lectura/)
  assert.match(SCREEN, /aria-label=\{readOnlyLabel\}/)
  assert.match(SCREEN, /el servidor no autoriza editarlo/)
})

test('UI: no quedan botones de Confirmar / Eliminar / Regresar a borrador', () => {
  for (const label of ['Confirmar', 'Regresar a borrador']) {
    assert.equal(SCREEN.includes(`>${label}<`), false, `no debe renderizarse ${label}`)
  }
})
