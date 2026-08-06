import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildUploadPath,
  mapUploadError,
  stripBase64Prefix,
} from '../src/modules/talent/talentUploadApi.js'

test('buildUploadPath arma /odoo-api/talent_bot/upload/:token', () => {
  assert.equal(buildUploadPath('abc123'), '/odoo-api/talent_bot/upload/abc123')
})

test('buildUploadPath url-encodes caracteres especiales del token', () => {
  assert.equal(buildUploadPath('a b/c'), '/odoo-api/talent_bot/upload/a%20b%2Fc')
})

test('mapUploadError mapea cada codigo del backend a un mensaje para el candidato', () => {
  assert.equal(mapUploadError('not_found'), 'Este link no es válido.')
  assert.equal(mapUploadError('already_received'), 'Ya recibimos este documento, gracias.')
  assert.equal(mapUploadError('expired'), 'Este link venció. Pide uno nuevo por WhatsApp.')
  assert.equal(mapUploadError('bad_file_type'), 'Solo fotos o PDF.')
  assert.equal(mapUploadError('file_too_large'), 'El archivo es muy grande. Intenta de nuevo.')
})

test('mapUploadError cae a un mensaje generico para codigos desconocidos', () => {
  assert.equal(mapUploadError('server_error'), 'Tuvimos un detalle técnico, intenta de nuevo.')
  assert.equal(mapUploadError('codigo_que_no_existe'), 'Tuvimos un detalle técnico, intenta de nuevo.')
})

test('stripBase64Prefix quita el prefijo data:...;base64, cuando esta presente', () => {
  assert.equal(stripBase64Prefix('data:application/pdf;base64,JVBERi0x'), 'JVBERi0x')
})

test('stripBase64Prefix deja el valor igual si no hay prefijo', () => {
  assert.equal(stripBase64Prefix('JVBERi0x'), 'JVBERi0x')
})
