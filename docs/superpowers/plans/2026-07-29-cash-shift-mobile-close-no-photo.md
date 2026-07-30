# Mobile Cash Shift Close Without Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que Angy y cualquier gerente móvil autorizado cierre o recierre turnos POS sin usuario interno y sin fotografía, conservando nota por diferencia, autorizaciones, idempotencia e historial.

**Architecture:** Odoo seguirá resolviendo al actor exclusivamente desde el token de `hr.employee`; `closed_by_employee_id` será la identidad obligatoria y `closed_by_user_id` un dato secundario opcional que, cuando exista, deberá coincidir exactamente con el usuario del empleado. El backend dejará de exigir evidencia pero conservará el contrato opcional para clientes PWA cacheados, mientras la PWA nueva eliminará toda captura/subida de foto del cierre y mantendrá la lectura de evidencias históricas.

**Tech Stack:** Odoo 18/Python/PostgreSQL, React 19/Vite, Node test runner, unittest, Git worktrees.

---

## Estructura de archivos

### Odoo

- `gf_pwa_admin/models/gf_pos_cash_shift.py`: nulabilidad y correspondencia del usuario secundario; cierre sin evidencia obligatoria.
- `gf_pwa_admin/controllers/cash_shift_api.py`: contrato transitorio que normaliza `null`, vacío y espacios como ausencia de evidencia.
- `gf_pwa_admin/tests/test_pos_cash_shift.py`: pruebas de servicio y modelo para empleados sin usuario y nota sin foto.
- `gf_pwa_admin/tests/test_pos_cash_shift_api.py`: pruebas HTTP de Angy móvil, tokens opcionales/incorrectos y atomicidad.
- `gf_pwa_admin/__manifest__.py`: versión `18.0.2.2.1` para forzar el upgrade de esquema.
- `tests/run_pos_cash_shift_odoo.sh`: ejecuta siempre el addon del worktree actual, nunca una ruta histórica fija.
- `tests/check_pos_cash_shift_rollout.py`: verifica versión, `ir.model.fields.required=False` y columna nullable.
- `tests/test_pos_cash_shift_rollout_checker.py`: contrato del checker y sus diagnósticos.
- `tests/test_pos_cash_shift_contract.py`: contrato estático del endpoint y del modelo.
- `tests/run_pos_cash_shift_upgrade.sh`: instala `18.0.2.2.0`, crea un sentinel y ejecuta el upgrade objetivo en una BD desechable.
- `tests/seed_pos_cash_shift_upgrade.py`: crea la versión histórica sentinel con usuario interno.
- `tests/check_pos_cash_shift_upgrade.py`: confirma nulabilidad y preservación exacta después del upgrade.
- `docs/validation/2026-07-27-pos-cash-shift-rollout.md`: orden backend-first y aceptación sin foto.

### PWA

- `src/modules/admin/cashShiftCloseModel.js`: construye cierres que sólo exigen nota cuando hay diferencia.
- `src/modules/admin/api.js`: omite `evidence_token` y elimina el cliente de upload exclusivo del corte.
- `src/modules/admin/components/CashShiftCloseForm.jsx`: elimina archivo, upload, caducidad y recuperación de evidencia.
- `src/modules/admin/components/CashShiftDashboard.jsx`: deja de inyectar la subida de evidencia al formulario.
- `src/modules/admin/components/CashShiftPrintView.jsx`: conserva evidencia histórica y presenta claramente su ausencia.
- `tests/cashShiftApi.test.mjs`: payload exacto sin evidencia.
- `tests/cashShiftScreen.test.mjs`: cierre/recierre, diferencia y recuperación sin controles de foto.
- `tests/cashShiftHistory.test.mjs`: impresión combinada de versiones históricas con y sin evidencia.
- `docs/CODE_MANUAL.md` y `docs/USER_MANUAL_BY_ROLE.md`: contrato técnico y procedimiento de Angy.

## Worktrees de ejecución

- PWA existente: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings`, rama `codex/cash-shift-mobile-close-no-photo`.
- Odoo nuevo: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend`, rama `codex/cash-shift-mobile-close-no-photo-backend`, creada desde el `origin/GrupoFrio` vigente al comenzar la ejecución.

### Task 1: Preparar el backend aislado desde GrupoFrio vigente

**Files:**
- Verify only: `/Users/sebis/Documents/odoo/GrupoFrio`
- Create worktree: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend`

- [ ] **Step 1: Confirmar que el worktree raíz no será modificado**

Run:

```bash
git -C /Users/sebis/Documents/odoo/GrupoFrio status --short
git -C /Users/sebis/Documents/odoo/GrupoFrio rev-parse origin/GrupoFrio
```

Expected: se observa `ayuda.py` u otros cambios del usuario sin alterarlos y se obtiene el SHA remoto objetivo.

- [ ] **Step 2: Crear el worktree backend desde la punta vigente**

Run:

```bash
git -C /Users/sebis/Documents/odoo/GrupoFrio worktree add -b codex/cash-shift-mobile-close-no-photo-backend /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend origin/GrupoFrio
```

Expected: nuevo worktree limpio en la rama indicada; no reutilizar el worktree antiguo basado en `835dcf02`.

- [ ] **Step 3: Confirmar la base exacta**

Run:

```bash
git -C /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend status --short
git -C /Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend log -1 --oneline
```

Expected: estado limpio y HEAD igual al `origin/GrupoFrio` observado en Step 1.

### Task 2: Hacer opcional el usuario interno sin debilitar la auditoría

**Files:**
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/models/gf_pos_cash_shift.py:603-720,1824-1836,2431-2455,2634-2638`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/controllers/cash_shift_api.py:489-496`
- Test: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/tests/test_pos_cash_shift.py`
- Test: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/tests/test_pos_cash_shift_api.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/run_pos_cash_shift_odoo.sh`

- [ ] **Step 1: Escribir pruebas rojas del modelo y servicio**

Agregar casos que creen un empleado del mismo alcance con `user_id=False` y comprueben:

```python
self.assertFalse(
    self.env["gf.pos.cash.shift.version"]._fields["closed_by_user_id"].required
)
version = cash_shift_service.create_version(self.env, self._version_vals(
    closed_by_employee_id=mobile_employee.id,
    closed_by_user_id=False,
))
self.assertEqual(version.closed_by_employee_id, mobile_employee)
self.assertFalse(version.closed_by_user_id)
```

Agregar además dos negativas: un usuario distinto al `employee.user_id` debe fallar y pasar un usuario cuando el empleado no tiene ninguno debe fallar.

- [ ] **Step 2: Escribir la prueba HTTP roja para el perfil real de Angy**

Crear un gerente autorizado con compañía/almacén/analítica correctos y sin `res.users`, autenticarlo con el helper de token existente, cerrar un turno sin diferencia y confirmar:

```python
self.assertTrue(response["ok"], response.get("message"))
version = self.env["gf.pos.cash.shift.version"].sudo().browse(
    response["data"]["version_id"]
)
self.assertEqual(version.closed_by_employee_id, mobile_manager)
self.assertFalse(version.closed_by_user_id)
self.assertEqual(response["data"]["detail"]["responsible"]["employee_id"], mobile_manager.id)
self.assertFalse(response["data"]["detail"]["responsible"]["user_id"])
self.assertEqual(response["data"]["detail"]["responsible"]["user_name"], "")
```

- [ ] **Step 3: Hacer que el runner use el worktree que lo contiene**

Sustituir la ruta fija de `--addons-path` por una raíz calculada desde el propio script:

```bash
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
```

Usar `"$repo_root"` como último elemento de `--addons-path`. Esto evita que el
runner de la rama nueva siga probando el worktree anterior
`cash-shift-closings-backend`.

- [ ] **Step 4: Ejecutar los casos y confirmar que fallan por el requisito actual**

Run:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema,/gf_pwa_admin:TestPosCashShiftAPI'
```

Expected: FAIL por `closed_by_user_id` requerido o por `El responsable del corte no tiene usuario interno asociado.`

- [ ] **Step 5: Implementar la correspondencia opcional exacta**

En el modelo:

```python
closed_by_user_id = fields.Many2one(
    "res.users",
    readonly=True,
    ondelete="restrict",
)
```

En `_service_create`, resolver opcionalmente el usuario y validar la relación:

```python
closed_by_user = _optional_service_record(
    self.env,
    "res.users",
    vals.get("closed_by_user_id"),
    "El usuario de cierre",
)
if closed_by_user != closed_by.user_id:
    raise ValidationError(
        "El usuario de cierre no corresponde al responsable del cierre."
    )
vals["closed_by_user_id"] = closed_by_user.id or False
```

Eliminar `require_user` de `_closing_employee` y de su llamada bloqueada. En `_build_version_values` usar:

```python
"closed_by_user_id": employee.user_id.id or False,
```

No usar `request.env.user`, el usuario técnico de la API ni IDs suministrados por la PWA.

En el DTO del controlador normalizar también el nombre opcional:

```python
"user_name": (
    version.closed_by_user_id.display_name or ""
    if version else ""
),
```

- [ ] **Step 6: Ejecutar las pruebas focales**

Run:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema,/gf_pwa_admin:TestPosCashShiftAPI'
```

Expected: PASS, incluido el cierre del gerente móvil sin usuario.

- [ ] **Step 7: Añadir y comprobar recierre móvil sin usuario**

Cerrar con el gerente móvil, reabrir con razón y recerrar con el mismo token.
Comprobar dos versiones con el mismo `closed_by_employee_id`, ambos
`closed_by_user_id=False`, un solo sucesor y cadena `previous_version_id`
correcta.

- [ ] **Step 8: Commit backend de identidad**

```bash
git add gf_pwa_admin/models/gf_pos_cash_shift.py gf_pwa_admin/controllers/cash_shift_api.py gf_pwa_admin/tests/test_pos_cash_shift.py gf_pwa_admin/tests/test_pos_cash_shift_api.py tests/run_pos_cash_shift_odoo.sh
git commit -m "fix(cash): allow mobile managers to close shifts"
```

### Task 3: Permitir diferencia con nota y sin fotografía

**Files:**
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/models/gf_pos_cash_shift.py:2765-2818`
- Verify/Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/controllers/cash_shift_api.py:739-781`
- Test: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/tests/test_pos_cash_shift.py`
- Test: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/tests/test_pos_cash_shift_api.py`

- [ ] **Step 1: Cambiar la prueba roja de diferencia**

Reemplazar el caso que exige nota y evidencia por dos comportamientos separados:

```python
with self.assertRaisesRegex(ValidationError, "observación obligatoria"):
    cash_shift_service.close_shift(
        self.shift,
        employee=self.manager,
        denominations=[{"denomination": "1", "count": 1}],
        adjustments=[],
        difference_note="",
        evidence_attachment=None,
        next_opening_fund=0,
        expected_version=0,
    )

result = cash_shift_service.close_shift(
    self.shift,
    employee=self.manager,
    denominations=[{"denomination": "1", "count": 1}],
    adjustments=[],
    difference_note="Diferencia revisada",
    evidence_attachment=None,
    next_opening_fund=0,
    expected_version=0,
)
self.assertFalse(result["version"].evidence_attachment_id)
```

La negativa debe confirmar que no hay versión, sucesor ni snapshot parcial.

- [ ] **Step 2: Añadir matriz HTTP para ausencia y compatibilidad de evidencia**

Con turnos independientes, probar que omitir el campo y enviar `None`, `""` o `"   "` produce el mismo cierre correcto con nota. Mantener un caso con token histórico válido y comprobar que se consume y enlaza al adjunto.

- [ ] **Step 3: Fortalecer las negativas atómicas**

Para token alterado, expirado, consumido, de otro empleado, turno, versión o propósito, afirmar en cada rechazo:

```python
self.assertFalse(response["ok"])
self.assertFalse(self.env["gf.pos.cash.shift.version"].sudo().search([
    ("shift_id", "=", target_shift.id),
]))
self.assertFalse(target_shift.next_shift_id)
self.assertFalse(self.env["gf.pos.cash.shift.operation"].sudo().search([
    ("idempotency_key", "=", key),
]))
```

Reusar las pruebas existentes de evidencia siempre que ya cubran el vínculo exacto; no borrar los modelos ni endpoints históricos.

- [ ] **Step 4: Ejecutar y observar la prueba roja**

Run:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftClosing,/gf_pwa_admin:TestPosCashShiftAPI'
```

Expected: el caso con diferencia, nota y sin evidencia falla todavía con el mensaje de fotografía.

- [ ] **Step 5: Eliminar únicamente la obligatoriedad de evidencia**

Mantener la normalización del controlador:

```python
evidence_token=str(data.get("evidence_token") or "").strip() or None
```

En `close_shift`, conservar la resolución/consumo si existe token, pero dejar el bloque de diferencia así:

```python
if live["difference"] != 0.0 and not note:
    raise ValidationError(
        "Toda diferencia de caja requiere una observación obligatoria."
    )
```

- [ ] **Step 6: Ejecutar las pruebas focales y commit**

Run:

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftClosing,/gf_pwa_admin:TestPosCashShiftAPI'
git add gf_pwa_admin/models/gf_pos_cash_shift.py gf_pwa_admin/controllers/cash_shift_api.py gf_pwa_admin/tests/test_pos_cash_shift.py gf_pwa_admin/tests/test_pos_cash_shift_api.py
git commit -m "feat(cash): close shifts without photo evidence"
```

Expected: PASS; el controlador sólo se agrega al commit si realmente requiere ajuste o pruebas contractuales asociadas.

### Task 4: Versionar el esquema y endurecer el checker

**Files:**
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/gf_pwa_admin/__manifest__.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/check_pos_cash_shift_rollout.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/test_pos_cash_shift_rollout_checker.py`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/test_pos_cash_shift_contract.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/run_pos_cash_shift_upgrade.sh`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/seed_pos_cash_shift_upgrade.py`
- Create: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/tests/check_pos_cash_shift_upgrade.py`

- [ ] **Step 1: Escribir pruebas rojas del checker**

Extender el cursor falso para devolver `model`, `name`, `required` y `is_nullable`. Cubrir tres casos:

```python
self.assertEqual(healthy_errors, [])
self.assertTrue(any("required=False" in error for error in required_field_errors))
self.assertTrue(any("aceptar NULL" in error for error in not_null_column_errors))
```

El checker debe seguir haciendo exclusivamente `SELECT`.

- [ ] **Step 2: Actualizar versión y reglas del checker**

Cambiar el manifest y el pin:

```python
"version": "18.0.2.2.1"
```

```python
REQUIRED_MODULE_VERSIONS["gf_pwa_admin"] = "18.0.2.2.1"
```

Consultar `ir_model_fields.required` para `gf.pos.cash.shift.version.closed_by_user_id` y `information_schema.columns.is_nullable` para `gf_pos_cash_shift_version.closed_by_user_id`; producir errores accionables si no son `False` y `YES` respectivamente.

- [ ] **Step 3: Añadir contrato estático del modelo**

El test contractual debe comprobar que el campo no declara `required=True`, que `closed_by_employee_id` continúa requerido y que el endpoint conserva `evidence_token` entre sus campos permitidos de transición.

- [ ] **Step 4: Ejecutar pruebas puras**

Run:

```bash
python3 -m unittest tests.test_pos_cash_shift_rollout_checker tests.test_pos_cash_shift_contract
python3 -m py_compile gf_pwa_admin/models/gf_pos_cash_shift.py gf_pwa_admin/controllers/cash_shift_api.py
```

Expected: PASS.

- [ ] **Step 5: Escribir un sentinel reproducible de la versión anterior**

`seed_pos_cash_shift_upgrade.py` se ejecutará mediante `odoo-bin shell` después
de instalar el commit base `835dcf02`. Creará compañía, almacén, usuario,
empleado, turno y una versión identificables por el XML-like key constante
`gf_cash_shift_upgrade_sentinel`; guardará `version_id` y `user_id` en
`ir.config_parameter` dentro de la BD desechable. Debe comprobar que el campo
era requerido y que la versión contiene el usuario antes de terminar.

- [ ] **Step 6: Escribir el verificador post-upgrade**

`check_pos_cash_shift_upgrade.py` leerá los IDs sentinel y fallará salvo que:

```python
assert env["gf.pos.cash.shift.version"]._fields["closed_by_user_id"].required is False
assert version.exists()
assert version.closed_by_user_id.id == sentinel_user_id
env.cr.execute(
    "SELECT is_nullable FROM information_schema.columns "
    "WHERE table_schema = current_schema() "
    "AND table_name = 'gf_pos_cash_shift_version' "
    "AND column_name = 'closed_by_user_id'"
)
assert env.cr.fetchone() == ("YES",)
```

- [ ] **Step 7: Crear el runner de upgrade completamente desechable**

`run_pos_cash_shift_upgrade.sh` debe:

1. derivar `target_root` desde `BASH_SOURCE[0]`;
2. crear con `mktemp -d` un worktree detached del commit base `835dcf02`;
3. crear la BD explícita `gf_cash_shift_upgrade_test_20260729` en el PostgreSQL
   local usado por el runner existente;
4. instalar `os_api,os_customer_zones,gf_pwa_admin` con el addons path base;
5. ejecutar `seed_pos_cash_shift_upgrade.py` contra esa BD;
6. ejecutar `-u gf_pwa_admin` usando `target_root` como addons path;
7. ejecutar `check_pos_cash_shift_upgrade.py` con el código objetivo;
8. usar `trap` para eliminar sólo esa BD explícita y el worktree temporal.

No aceptar nombres de BD amplios ni usar rutas del usuario como blanco de
borrado. El runner debe imprimir los SHAs base/objetivo y terminar no-cero ante
cualquier incumplimiento.

- [ ] **Step 8: Ejecutar el upgrade repetible**

Run:

```bash
chmod +x tests/run_pos_cash_shift_upgrade.sh
tests/run_pos_cash_shift_upgrade.sh
```

Expected: instalación `18.0.2.2.0`, upgrade `18.0.2.2.1`, usuario sentinel
preservado, campo ORM opcional y columna `YES`.

- [ ] **Step 9: Commit del contrato de upgrade**

```bash
git add gf_pwa_admin/__manifest__.py tests/check_pos_cash_shift_rollout.py tests/test_pos_cash_shift_rollout_checker.py tests/test_pos_cash_shift_contract.py tests/run_pos_cash_shift_upgrade.sh tests/seed_pos_cash_shift_upgrade.py tests/check_pos_cash_shift_upgrade.py
git commit -m "chore(cash): verify nullable closer upgrade"
```

### Task 5: Eliminar evidencia del contrato de escritura PWA

**Files:**
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/cashShiftCloseModel.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/api.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftApi.test.mjs`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftScreen.test.mjs`

- [ ] **Step 1: Escribir pruebas rojas del modelo**

Actualizar `buildCashShiftCloseOperation` para no recibir `evidenceToken`. Afirmar que una diferencia exige sólo nota:

```javascript
assert.throws(
  () => buildCashShiftCloseOperation({ ...base, notes: '' }),
  /diferencia requiere nota/i,
)
const operation = buildCashShiftCloseOperation({
  ...base,
  notes: 'Diferencia revisada',
})
assert.equal(Object.hasOwn(operation.request, 'evidenceToken'), false)
```

- [ ] **Step 2: Escribir prueba roja del payload HTTP exacto**

En cierre y recierre comprobar:

```javascript
assert.equal(Object.hasOwn(calls[0].body, 'evidence_token'), false)
```

Mantener temporalmente la exportación y prueba de `uploadCashShiftEvidence` hasta
Task 6, donde se quitarán en el mismo commit que sus consumidores. El upload
genérico utilizado por gastos no se modifica.

- [ ] **Step 3: Ejecutar pruebas y confirmar el fallo**

Run:

```bash
node --test tests/cashShiftApi.test.mjs
node --test --test-name-pattern='close draft|reclose binds' tests/cashShiftScreen.test.mjs
```

Expected: FAIL porque el modelo aún exige foto y el API aún serializa `evidence_token`.

- [ ] **Step 4: Simplificar el contrato sin romper todavía sus consumidores**

Quitar el argumento/normalización de `evidenceToken` de
`buildCashShiftCloseOperation` y validar:

```javascript
if (hasCashDifference(feedback.difference) && !normalizedNotes) {
  throw new TypeError('Toda diferencia requiere nota.')
}
```

En `cashShiftClosePayload`, omitir totalmente `evidence_token`. Conservar por
ahora `cashShiftEvidenceBinding`, `readEvidenceFile` y
`uploadCashShiftEvidence` para que el formulario existente siga importando
exports válidos hasta Task 6. No tocar `/pwa/evidence/upload` en `src/lib/api.js`.

- [ ] **Step 5: Ejecutar pruebas focales y commit**

Run:

```bash
node --test tests/cashShiftApi.test.mjs
node --test --test-name-pattern='close draft|reclose binds' tests/cashShiftScreen.test.mjs
git add src/modules/admin/cashShiftCloseModel.js src/modules/admin/api.js tests/cashShiftApi.test.mjs tests/cashShiftScreen.test.mjs
git commit -m "refactor(cash): omit photo from close requests"
```

Expected: pruebas focales PASS.

### Task 6: Simplificar el formulario y su recuperación sin foto

**Files:**
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/components/CashShiftCloseForm.jsx`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/components/CashShiftDashboard.jsx`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/cashShiftCloseModel.js`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/api.js`
- Test: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftApi.test.mjs`
- Test: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftScreen.test.mjs`

- [ ] **Step 1: Reescribir las pruebas UI alrededor del nuevo contrato**

Conservar escenarios de preview, denominaciones, ajustes, diferencia, reintento incierto, versión obsoleta, cambio de sesión y recierre. En cada escenario relevante afirmar:

```javascript
assert.equal(renderer.root.findAllByProps({ name: 'evidencePhoto' }).length, 0)
assert.equal(Object.hasOwn(closeRequests[0], 'evidenceToken'), false)
```

Eliminar fixtures `evidenceResult`, callbacks `readEvidence`/`uploadEvidence` y pruebas dedicadas a MIME, tamaño, caducidad o re-subida. Para stale-version, confirmar que el borrador de denominaciones/ajustes/nota/fondo se preserva sin pedir foto nueva.

- [ ] **Step 2: Ejecutar la prueba roja UI**

Run:

```bash
node --test tests/cashShiftScreen.test.mjs
```

Expected: FAIL porque todavía existe `input[name=evidencePhoto]` y callbacks de upload.

- [ ] **Step 3: Eliminar estado y flujo de evidencia del formulario**

Quitar de `CashShiftCloseForm`:

- `EVIDENCE_MIMES`, `MAX_EVIDENCE_BYTES`, parsing de recibos y reloj de expiración;
- props `onEvidence`, `readEvidence`, `now`;
- estados `evidence`, `uploadBusy` y generación de uploads;
- handler `uploadPhoto`, invalidaciones y mensajes de fotografía;
- `<input name="evidencePhoto">` y estado “Fotografía lista”.

En el mismo paso, renombrar `cashShiftEvidenceBinding` a
`cashShiftCloseBinding`, eliminar `readEvidenceFile` de
`cashShiftCloseModel.js` y eliminar `uploadCashShiftEvidence` de `api.js`. Así
no existe ningún commit donde falte un export que todavía tenga consumidores.

El submit construirá la operación directamente con arqueo, ajustes, nota y fondo. Los guardas de sesión, mutación, operación pendiente y stale response permanecen.

- [ ] **Step 4: Desconectar lectura y upload desde el dashboard**

En `CashShiftDashboard.jsx`, eliminar juntos:

- imports `uploadCashShiftEvidence` y `readEvidenceFile`;
- props `uploadEvidence` y `readEvidence` con sus defaults;
- ambas inyecciones `onEvidence={uploadEvidence}` y
  `readEvidence={readEvidence}` hacia los formularios normal y de recierre.

Eliminar también la prueba PWA exclusiva del wrapper de upload. No modificar
capacidades de gastos ni el cierre diario Legacy.

- [ ] **Step 5: Ejecutar pruebas y commit**

Run:

```bash
node --test tests/cashShiftScreen.test.mjs tests/cashShiftApi.test.mjs
git add src/modules/admin/cashShiftCloseModel.js src/modules/admin/api.js src/modules/admin/components/CashShiftCloseForm.jsx src/modules/admin/components/CashShiftDashboard.jsx tests/cashShiftApi.test.mjs tests/cashShiftScreen.test.mjs
git commit -m "feat(cash): close shifts without photo UI"
```

Expected: PASS y ninguna referencia a `evidencePhoto` en el flujo de cortes nuevos.

### Task 7: Preservar evidencia histórica y actualizar documentación

**Files:**
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/src/modules/admin/components/CashShiftPrintView.jsx`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/tests/cashShiftHistory.test.mjs`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/docs/CODE_MANUAL.md`
- Modify: `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/cash-shift-closings/docs/USER_MANUAL_BY_ROLE.md`
- Modify: `/Users/sebis/Documents/odoo/GrupoFrio/.worktrees/cash-shift-mobile-close-no-photo-backend/docs/validation/2026-07-27-pos-cash-shift-rollout.md`

- [ ] **Step 1: Añadir prueba de impresión mixta**

Probar una versión antigua con evidencia y una nueva con `evidence=false`/`evidence_present=false`. Ambas deben imprimir; la primera muestra referencia/digest/archivo y la segunda muestra “Sin evidencia adjunta”. El responsable sin usuario se imprime por nombre de empleado.

- [ ] **Step 2: Ajustar textos de impresión**

Usar “Evidencia histórica del corte” cuando haya adjunto y “Sin evidencia adjunta” cuando no exista. No convertir `evidence` en campo requerido y no borrar normalización histórica.

- [ ] **Step 3: Actualizar manuales**

Documentar que:

- Angy cierra con su token de empleado aunque no tenga usuario interno;
- cualquier diferencia sigue exigiendo nota;
- no se captura fotografía en cierre/recierre;
- los adjuntos históricos siguen visibles/imprimibles;
- fotos de gastos y cierre diario Legacy quedan fuera de este cambio.

En el runbook reemplazar instrucciones de nota/evidencia por nota únicamente y establecer el orden backend `18.0.2.2.1` → checker normal → PWA.

- [ ] **Step 4: Ejecutar pruebas y commit por repositorio**

PWA:

```bash
node --test tests/cashShiftHistory.test.mjs tests/cashShiftModel.test.mjs
git add src/modules/admin/components/CashShiftPrintView.jsx tests/cashShiftHistory.test.mjs docs/CODE_MANUAL.md docs/USER_MANUAL_BY_ROLE.md
git commit -m "docs(cash): explain no-photo mobile closing"
```

Odoo:

```bash
git add docs/validation/2026-07-27-pos-cash-shift-rollout.md
git commit -m "docs(cash): update active rollout procedure"
```

Expected: pruebas PASS y evidencia histórica intacta.

### Task 8: Verificación integral y despliegue backend-first

**Files:**
- Verify: ambos worktrees completos
- Verify production read-only: configuración/turno activo de CEDIS Iguala

- [ ] **Step 1: Ejecutar gate PWA completo**

Workdir: PWA.

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected: todas las pruebas pasan, lint/build pasan, worktree limpio.

- [ ] **Step 2: Ejecutar gate backend completo**

Workdir: Odoo.

```bash
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPosCashShiftSchema,/gf_pwa_admin:TestPosCashShiftActivation,/gf_pwa_admin:TestPosCashShiftAssignmentAPI,/gf_pwa_admin:TestPosCashShiftClosing,/gf_pwa_admin:TestPosCashShiftGuards,/gf_pwa_admin:TestPosCashShiftAPI,/gf_pwa_admin:TestPosCashShiftConcurrency'
tests/run_pos_cash_shift_odoo.sh '/gf_pwa_admin:TestPWAAdminAPI'
python3 -m unittest tests.test_pos_cash_shift_rollout_checker tests.test_pos_cash_shift_contract
python3 -m py_compile gf_pwa_admin/models/*.py gf_pwa_admin/controllers/*.py
tests/run_pos_cash_shift_upgrade.sh
git diff --check
git status --short
```

Expected: cero fallos/errores y worktree limpio.

- [ ] **Step 3: Revisar que los dos cambios estén sobre las bases correctas**

```bash
git log --oneline --decorate -8
git diff origin/GrupoFrio...HEAD --stat
```

En PWA:

```bash
git log --oneline --decorate -8
git diff origin/main...HEAD --stat
```

Expected: sólo el alcance aprobado; ningún archivo suelto del usuario.

- [ ] **Step 4: Publicar primero Odoo y actualizar el módulo**

Integrar/push del backend a `GrupoFrio`, esperar build verde y actualizar únicamente `gf_pwa_admin` a `18.0.2.2.1`. No crear usuario interno para Angy y no cerrar manualmente el turno.

- [ ] **Step 5: Ejecutar checker normal post-upgrade**

En producción:

```bash
odoo-bin shell -d "$PGDATABASE" < tests/check_pos_cash_shift_rollout.py
```

No establecer `GF_CASH_SHIFT_REQUIRE_INACTIVE=1` porque la configuración ya está activa.

Expected: `[OK]`, exactamente un turno abierto y `active_shift_id` apuntando a él.

- [ ] **Step 6: Publicar PWA y aceptar el caso real**

Crear PR de la rama PWA contra `main`, esperar CI y desplegar. Pedir a Angy cerrar sesión, recargar e iniciar sesión de nuevo. Confirmar:

1. Puede cerrar con arqueo y sin foto.
2. Si hay diferencia, sin nota falla y con nota pasa.
3. La versión registra `closed_by_employee_id=717` y `closed_by_user_id=NULL`.
4. El sucesor se abre una sola vez y el turno anterior queda cerrado.
5. Historial e impresión muestran a Angy y “Sin evidencia adjunta”.
6. El reintento no reutiliza la clave fallida previa y no duplica versiones.
