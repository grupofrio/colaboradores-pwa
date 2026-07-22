// ticketPrinter.js — Impresión de tickets vía QZ Tray (ESC/POS directo).
//
// Por qué: el driver GDI de Windows de la POS-80 topa el ancho a 72mm y aplica
// un offset físico a la izquierda que recortaba el ticket, sin forma de
// corregirlo confiablemente desde window.print()/CSS. QZ Tray envía comandos
// ESC/POS NATIVOS directo a la impresora: ancho completo real, alineación
// exacta y corte automático de la cuchilla.
//
// El botón Imprimir usa esto si QZ Tray está disponible; si no, cae al método
// de iframe (printTicketFallback en ScreenTicket).

import qz from 'qz-tray'

// La POS-8360 imprime 48 caracteres por línea a 80mm en fuente A (ancho normal).
const LINE_WIDTH = 48

// ─── ESC/POS command bytes ─────────────────────────────────────────────────
const ESC = '\x1B'
const GS = '\x1D'
const INIT = ESC + '@'                 // reset impresora
const ALIGN_LEFT = ESC + 'a' + '\x00'
const ALIGN_CENTER = ESC + 'a' + '\x01'
const BOLD_ON = ESC + 'E' + '\x01'
const BOLD_OFF = ESC + 'E' + '\x00'
const SIZE_NORMAL = GS + '!' + '\x00'  // 1x1
const SIZE_DOUBLE = GS + '!' + '\x11'  // 2x ancho + 2x alto
const FEED_AND_CUT = GS + 'V' + '\x42' + '\x00' // feed + corte parcial

let connecting = null

/**
 * ¿Está QZ Tray corriendo y accesible? No lanza; devuelve boolean.
 */
export async function isQzAvailable() {
  try {
    if (qz.websocket.isActive()) return true
    await ensureConnection()
    return qz.websocket.isActive()
  } catch {
    return false
  }
}

async function ensureConnection() {
  if (qz.websocket.isActive()) return
  // Evita conexiones concurrentes múltiples desde clics rápidos.
  if (!connecting) {
    connecting = qz.websocket.connect({ retries: 1, delay: 1 }).finally(() => { connecting = null })
  }
  await connecting
}

// ─── Formato de líneas ──────────────────────────────────────────────────────

/** Línea con etiqueta a la izquierda y valor a la derecha, rellenando con espacios. */
function lr(left, right, width = LINE_WIDTH) {
  const l = String(left ?? '')
  const r = String(right ?? '')
  const space = Math.max(1, width - l.length - r.length)
  return l + ' '.repeat(space) + r
}

/** Divide un texto largo en varias líneas de ancho máximo (word-wrap simple). */
function wrap(text, width = LINE_WIDTH) {
  const words = String(text ?? '').split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) { cur = w; continue }
    if ((cur + ' ' + w).length <= width) cur += ' ' + w
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

const dashes = '-'.repeat(LINE_WIDTH)
const doubleLine = '='.repeat(LINE_WIDTH)

/** Recuadro centrado alrededor de un texto, con caracteres de caja ASCII. */
function boxed(text, innerWidth = 22) {
  const t = String(text ?? '')
  const pad = Math.max(0, innerWidth - t.length)
  const left = Math.floor(pad / 2)
  const right = pad - left
  const top = '+' + '-'.repeat(innerWidth + 2) + '+'
  const mid = '|' + ' '.repeat(left + 1) + t + ' '.repeat(right + 1) + '|'
  const bot = top
  return [top, mid, bot]
}

/**
 * Construye el ticket como array de comandos ESC/POS.
 * @param {object} t datos ya normalizados por ScreenTicket
 */
export function buildEscPosTicket(t) {
  const {
    sucursal = 'Sucursal',
    dateStr = '',
    timeStr = '',
    folio = '',
    lines = [],
    fmt = (n) => String(n),
    subtotal = 0,
    total = 0,
    paymentLabel = 'Efectivo',
  } = t

  const out = []
  out.push(INIT)

  // Encabezado (el logo se antepone como imagen en printTicketViaQz)
  out.push(ALIGN_CENTER, SIZE_DOUBLE, BOLD_ON, 'GRUPO FRIO\n', BOLD_OFF, SIZE_NORMAL)
  out.push(sucursal + '\n')
  out.push('\n')
  out.push(ALIGN_LEFT)
  out.push(lr(`Fecha: ${dateStr}`, `Hora: ${timeStr}`) + '\n')
  out.push(BOLD_ON, `Folio: ${folio}\n`, BOLD_OFF)
  out.push(doubleLine + '\n')

  // Productos
  for (const l of lines) {
    const qty = l.qty || l.product_uom_qty || 0
    const price = l.price_unit || 0
    const name = l.product_name || l.name || 'Producto'
    const lineTotal = fmt(qty * price)
    const nameLines = wrap(`${qty} x ${name}`, LINE_WIDTH - 10)
    // Primera línea con el importe a la derecha; el resto solo el nombre.
    out.push(lr(nameLines[0], lineTotal) + '\n')
    for (let i = 1; i < nameLines.length; i++) out.push(nameLines[i] + '\n')
  }

  out.push(dashes + '\n')
  out.push(lr('Subtotal', fmt(subtotal)) + '\n')
  out.push(BOLD_ON, SIZE_DOUBLE, lr('TOTAL', fmt(total), LINE_WIDTH / 2) + '\n', SIZE_NORMAL, BOLD_OFF)
  out.push(ALIGN_LEFT, lr('Metodo de pago:', paymentLabel) + '\n')
  out.push(doubleLine + '\n')

  // Folio destacado dentro de un recuadro
  out.push(ALIGN_CENTER)
  out.push('TICKET\n')
  out.push(BOLD_ON)
  for (const row of boxed(folio, 20)) out.push(row + '\n')
  out.push(BOLD_OFF)
  out.push('\n')
  out.push('Presente este ticket en almacen\n')
  out.push('para recoger su producto\n')
  out.push(dashes + '\n')
  out.push(BOLD_ON, 'Gracias por su compra\n', BOLD_OFF)

  // Avance final + corte de cuchilla
  out.push('\n\n')
  out.push(FEED_AND_CUT)

  return out
}

/**
 * Imprime el ticket vía QZ Tray. Lanza si algo falla (el caller decide fallback).
 * @param {object} ticketData datos del ticket
 * @param {string} [printerName] nombre exacto de la impresora; si se omite usa la default
 */
export async function printTicketViaQz(ticketData, printerName) {
  await ensureConnection()

  const printer = printerName || (await qz.printers.getDefault())
  const config = qz.configs.create(printer, { encoding: 'CP850', copies: 1 })

  const bodyData = buildEscPosTicket(ticketData).map((cmd) => ({
    type: 'raw', format: 'command', flavor: 'plain', data: cmd,
  }))

  // Intento 1: con logo (isotipo en negro sólido) centrado arriba. Si el
  // conversor de imagen de QZ falla con este equipo, reintenta SIN logo para
  // no dejar al usuario sin ticket.
  const logoUrl = `${window.location.origin}/icons/logo-grupo-frio-ticket.svg`
  const withLogo = [
    { type: 'raw', format: 'command', flavor: 'plain', data: INIT + ALIGN_CENTER },
    { type: 'raw', format: 'image', flavor: 'file', data: logoUrl,
      options: { language: 'escpos', dotDensity: 'double' } },
    { type: 'raw', format: 'command', flavor: 'plain', data: '\n' },
    ...bodyData,
  ]

  try {
    await qz.print(config, withLogo)
  } catch {
    await qz.print(config, bodyData)
  }
}

/** Lista de impresoras (para permitir elegir cuál). No lanza. */
export async function listQzPrinters() {
  try {
    await ensureConnection()
    const printers = await qz.printers.find()
    return Array.isArray(printers) ? printers : [printers].filter(Boolean)
  } catch {
    return []
  }
}
