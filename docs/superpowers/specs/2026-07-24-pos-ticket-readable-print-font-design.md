# Diseño: tipografía legible para el ticket POS impreso

**Fecha:** 2026-07-24
**Alcance:** ticket POS usado por la gerenta
**Estado:** aprobado en conversación

## Objetivo

Aumentar de forma mediana y consistente el tamaño de todo el texto del ticket
POS impreso para que sea fácil de distinguir, sin modificar la vista del ticket
en pantalla ni la lógica de la venta.

## Rutas de impresión

El botón **Imprimir** intenta primero QZ Tray con comandos ESC/POS y, si no está
disponible, imprime un documento HTML aislado mediante el navegador. El ajuste
debe cubrir ambas rutas:

- **QZ/ESC-POS:** usar doble altura en el texto normal, conservando el ancho
  normal de los caracteres y las 48 columnas actuales. El encabezado y el total
  mantienen su jerarquía destacada. Al conservar el ancho no se introducen
  cortes laterales ni saltos de línea innecesarios.
- **Respaldo del navegador:** aumentar aproximadamente 20% las fuentes de
  sucursal, fecha, hora, folio, productos, precios, subtotal, método de pago,
  recuadro de folio y mensajes finales. El encabezado y el total aumentan en la
  misma proporción.

## Límites

- No cambiar la vista en pantalla.
- No cambiar datos, cantidades, importes, método de pago ni cálculos.
- No cambiar el ancho físico de 72 mm, los márgenes compensados, el logo, el
  corte de cuchilla ni la estrategia de fallback.
- No aplicar el cambio por rol: el formato impreso es único y será legible para
  cualquier persona que imprima ese mismo ticket POS.

## Verificación

- Prueba de contrato ESC/POS que compruebe el modo de doble altura en los
  bloques de texto y que la línea siga trabajando con 48 columnas.
- Prueba de contrato del HTML de respaldo que compruebe los nuevos tamaños y
  preserve el ancho/márgenes del papel.
- Suite completa, lint y build.
- Inspección del diff para confirmar que solo se modifican la impresión y sus
  pruebas.
