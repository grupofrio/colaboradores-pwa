# QA — Supervisor Operación de hoy

## Automatizado

- [x] pruebas enfocadas — 193/193
- [x] suite completa — 1515/1515
- [x] lint — 0 warnings
- [x] build + leak guards — M3, M4, M7 y Supervisor verdes

## Manual

- [x] móvil 390×844
- [x] desktop ≥1280 px
- [ ] flags OFF → Control Comercial legado
- [ ] flags ON → Operación de hoy
- [x] Hoy
- [x] Ayer
- [ ] error/retry
- [ ] empty
- [ ] partial
- [ ] sin posición
- [ ] multi-moneda
- [ ] links de ruta y cierre

## Evidencia

- Preview: Vite local con la pantalla real y fixture contractual; el arnés temporal
  se retiró después de la revisión.
- Sesión/rol: sin sesión autorizada; la raíz de la aplicación redirigió a `/login`.
- Sucursal: `BR-DEMO Sucursal Demo` del fixture contractual.
- Responsive: PASS en 390×844 y 1440×900, sin overflow horizontal, sin botones
  sin nombre y sin referencias a mapa, radar o tiempo real.
- Selector diario: PASS; solo un día activo, Hoy mostró `XTS 2,800.50` y Ayer
  `XTS 9,876.00`, sin mezclar ambos totales.
- Consola: sin errores ni overlay de Vite; solo advertencias de migración futura de
  React Router v7.
- Resultado automatizado: PASS local, 2026-07-24.
- Resultado manual: responsive y selector PASS con fixture. QA autenticado OFF/ON
  bloqueado hasta contar con una sesión de supervisor y los flags configurados; no
  se activaron ni se simularon flags desde este repo.
