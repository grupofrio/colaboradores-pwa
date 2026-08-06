// ─── talentUploadApi — helpers puros para /talent_bot/upload/:token ───────
//
// Endpoint público (sin sesión, sin X-Talent-Bot-Key) del bot de Talento GF
// (P2.8B.1). Deliberadamente NO usa lib/api.js: ese helper está pensado para
// las familias autenticadas /pwa-*/ con headers de sesión, y es un
// god-object de 6500+ líneas al que el CLAUDE.md del repo pide no seguir
// agregando funcionalidad. Esta ruta es pública y no necesita nada de eso.

const ODOO_BASE = '/odoo-api' // mismo prefijo que lib/api.js — Vercel/vite proxean /odoo-api/* -> Odoo sin prefijo /api/

const ERROR_MESSAGES = {
  not_found: 'Este link no es válido.',
  already_received: 'Ya recibimos este documento, gracias.',
  expired: 'Este link venció. Pide uno nuevo por WhatsApp.',
  bad_file_type: 'Solo fotos o PDF.',
  file_too_large: 'El archivo es muy grande. Intenta de nuevo.',
  server_error: 'Tuvimos un detalle técnico, intenta de nuevo.',
}

export function buildUploadPath(token) {
  return `${ODOO_BASE}/talent_bot/upload/${encodeURIComponent(token)}`
}

export function mapUploadError(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.server_error
}

export function stripBase64Prefix(dataUrl) {
  if (typeof dataUrl === 'string' && dataUrl.includes(',')) {
    return dataUrl.split(',', 2)[1]
  }
  return dataUrl
}

export async function fetchUploadStatus(token) {
  const res = await fetch(buildUploadPath(token))
  return res.json()
}

export async function submitUploadFile(token, { base64, filename, mimeType }) {
  const res = await fetch(buildUploadPath(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_base64: base64,
      filename,
      mime_type: mimeType,
    }),
  })
  return res.json()
}
