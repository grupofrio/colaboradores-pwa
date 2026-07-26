# Migración coordinada a React 19

## Objetivo

Sustituir el PR #85, que deja una combinación incompatible de React 19 y React DOM 18, por un PR coordinado que mantenga toda la familia React en la misma línea 19.2.x y conserve el comportamiento actual de la PWA.

## Problema confirmado

El PR #85 actualiza únicamente `react` a 19.2.8 y `@types/react` a 19.2.17. `react-dom`, `@types/react-dom` y `react-test-renderer` permanecen en 18.3.x. Como `@types/react-dom@18.3.7` exige `@types/react@^18`, `npm ci` termina con `ERESOLVE` antes de ejecutar pruebas o build.

El PR de Dependabot no permite modificaciones del mantenedor, por lo que la corrección se publicará desde una rama nueva y el #85 se cerrará como reemplazado una vez que el PR sustituto esté abierto.

## Alcance

### Incluido

- Actualizar `react` y `react-dom` a `^19.2.8`.
- Actualizar `@types/react` a `^19.2.17` y `@types/react-dom` a `^19.2.3`.
- Actualizar `react-test-renderer` a `^19.2.8` para mantenerlo alineado con el runtime usado por la prueba de interfaz existente.
- Regenerar `package-lock.json` con npm sin `--force`, `--legacy-peer-deps` ni overrides.
- Añadir una prueba automática que exija React 19 y coherencia de versión mayor entre runtime, DOM, tipos y renderer.
- Adaptar únicamente incompatibilidades de React 19 demostradas por pruebas, lint o build.
- Publicar un PR sustituto que referencie y cierre administrativamente el #85.

### Excluido

- `eslint-plugin-react-hooks` 7 y las 138 correcciones de lint que activaría.
- ESLint 10, Vite 8 y cualquier actualización independiente de Dependabot.
- Refactors de componentes, cambios visuales o nuevas funcionalidades.
- Sustituir `react-test-renderer` por otra biblioteca. React lo marca como obsoleto, pero esa migración requiere un cambio de pruebas separado.
- Resolver las 17 vulnerabilidades ya presentes en la línea base de npm.

## Enfoque técnico

La rama parte del `main` que contiene el merge del PR #53. Primero se añade una prueba de contrato de dependencias que falla porque la línea base aún declara React 18. Después se actualizan juntos los cinco paquetes aprobados mediante npm, de modo que `package.json` y `package-lock.json` sean generados por la misma operación.

La aplicación ya monta con `createRoot` desde `react-dom/client`, por lo que no depende de la API legacy `ReactDOM.render`. La única dependencia directa de `react-test-renderer` está en `tests/angyPosProductBreakdownUi.test.mjs`. Si React 19 cambia su ejecución, el ajuste se limitará al entorno de esa prueba o al comportamiento concreto que el fallo demuestre; no se anticiparán cambios de producción.

## Contrato de prueba

La nueva prueba leerá `package.json` y `package-lock.json` y verificará:

1. Los cinco paquetes aprobados declaran versión mayor 19.
2. `react`, `react-dom` y `react-test-renderer` comparten la misma versión 19.2.x resuelta.
3. `@types/react` y `@types/react-dom` resuelven versiones mayores 19.
4. No se introducen `overrides` ni configuración npm persistida que oculte conflictos de peer dependencies.

El ciclo TDD será rojo con la línea base React 18, verde después de la actualización coordinada y seguido de la suite completa. La ausencia de flags de instalación inseguros se demostrará ejecutando `npm ci` sin `--force` ni `--legacy-peer-deps`, ya que esos flags de línea de comandos no quedan registrados en los manifiestos.

## Validación y criterios de aceptación

- `npm ci` termina correctamente con Node 24, igual que GitHub Actions.
- La prueba de coherencia de dependencias pasa.
- `npm test` termina con cero fallos, incluyendo la prueba de interfaz de Angélica.
- `npm run lint` termina con cero errores y cero advertencias.
- `npm run build` termina correctamente y pasan las cuatro guardas de artefactos productivos.
- `git diff --check` no reporta errores de formato.
- El diff queda limitado a manifiestos, lockfile, la nueva prueba y cualquier adaptación estrictamente exigida por React 19.
- El PR sustituto obtiene CI y Vercel verdes antes de considerar el trabajo fusionable.

## Riesgos y mitigaciones

- **Cambio de comportamiento en React 19:** la suite completa y el build detectarán regresiones conocidas; cualquier fallo se investigará antes de modificar código.
- **Renderer de pruebas obsoleto:** se mantiene alineado en 19.2.8 para evitar mezclar una migración de framework de pruebas con la del runtime.
- **Árbol de dependencias incompatible:** no se forzará la instalación; un nuevo `ERESOLVE` se tratará como bloqueo real.
- **Regresión difícil de detectar en producción:** el PR no se fusionará automáticamente; quedará sujeto a CI, Vercel y revisión formal.

## Publicación y rollback

Se abrirá un PR desde `codex/react19-coordinated-upgrade` hacia `main`, enlazando el #85 como reemplazado. Tras confirmar el nuevo PR y sus checks, se cerrará el #85 con un comentario que apunte al sustituto. El rollback consiste en revertir un único merge commit, restaurando las versiones React 18.3.x y su lockfile.
