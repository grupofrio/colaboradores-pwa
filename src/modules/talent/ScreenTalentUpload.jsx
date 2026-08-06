// ─── ScreenTalentUpload — carga pública de documento (Talento GF) ─────────
//
// Pantalla SIN sesión: el candidato la abre desde un link de WhatsApp de un
// solo uso. No usa PrivateRoute. Layout "cámara primero" (aprobado en el
// spec 2026-08-06-talent-upload-token-route-design.md): botón grande para
// tomar foto + opción secundaria para PDF/imagen desde el celular.
//
// No reusa <PhotoCapture> — ese componente sube directo a
// /pwa/evidence/upload (endpoint autenticado de colaborador), que no aplica
// a un candidato anónimo. Sí reusa compressPhotoToBase64 (función pura, sin
// acoplarse a nada de sesión).

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { compressPhotoToBase64 } from '../ruta/vehiclePhotoCompressor'
import {
  fetchUploadStatus,
  submitUploadFile,
  mapUploadError,
  stripBase64Prefix,
} from './talentUploadApi'

export default function ScreenTalentUpload() {
  const { token } = useParams()
  const [phase, setPhase] = useState('loading') // loading | error | ready | uploading | success
  const [docInfo, setDocInfo] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typo = getTypo(typeof window !== 'undefined' ? window.innerWidth : 375)

  useEffect(() => {
    let active = true
    async function loadStatus() {
      try {
        const out = await fetchUploadStatus(token)
        if (!active) return
        if (out?.ok) {
          setDocInfo({ label: out.doc_label, code: out.doc_code })
          setPhase('ready')
        } else {
          setErrorMessage(mapUploadError(out?.error))
          setPhase('error')
        }
      } catch {
        if (!active) return
        setErrorMessage(mapUploadError('server_error'))
        setPhase('error')
      }
    }
    loadStatus()
    return () => { active = false }
  }, [token])

  async function submit(base64, filename, mimeType) {
    try {
      const out = await submitUploadFile(token, { base64, filename, mimeType })
      if (out?.ok) {
        setPhase('success')
      } else {
        setErrorMessage(mapUploadError(out?.error))
        setPhase('ready')
      }
    } catch {
      setErrorMessage(mapUploadError('server_error'))
      setPhase('ready')
    }
  }

  async function handleImageFile(file) {
    setPhase('uploading')
    try {
      const { base64, filename } = await compressPhotoToBase64(file)
      await submit(base64, filename, 'image/jpeg')
    } catch (err) {
      setErrorMessage(err?.message || mapUploadError('bad_file_type'))
      setPhase('ready')
    }
  }

  function handlePdfOrImageFile(file) {
    if (!file) return
    if (file.type === 'application/pdf') {
      setPhase('uploading')
      const reader = new FileReader()
      reader.onload = () => submit(
        stripBase64Prefix(reader.result), file.name || 'documento.pdf', 'application/pdf')
      reader.onerror = () => {
        setErrorMessage(mapUploadError('bad_file_type'))
        setPhase('ready')
      }
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('image/')) {
      handleImageFile(file)
    } else {
      setErrorMessage(mapUploadError('bad_file_type'))
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: TOKENS.colors.bg0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 20px', fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ ...typo.overline, color: TOKENS.colors.textLow, marginBottom: 18 }}>
        GRUPO FRÍO · TALENTO
      </div>

      {phase === 'loading' && (
        <p style={{ ...typo.body, color: TOKENS.colors.textMuted }}>Cargando...</p>
      )}

      {phase === 'error' && (
        <div style={{
          background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}`,
          borderRadius: TOKENS.radius.md, padding: 16, textAlign: 'center', maxWidth: 320,
        }}>
          <p style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {phase === 'success' && (
        <div style={{
          background: TOKENS.colors.successSoft, border: `1px solid ${TOKENS.colors.success}`,
          borderRadius: TOKENS.radius.md, padding: 20, textAlign: 'center', maxWidth: 320,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <p style={{ ...typo.title, color: TOKENS.colors.textSoft, margin: 0 }}>Recibido</p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 6 }}>
            RH va a validar tu documento. Ya puedes cerrar esta página.
          </p>
        </div>
      )}

      {(phase === 'ready' || phase === 'uploading') && docInfo && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{
            background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
            borderRadius: TOKENS.radius.lg, padding: 16, marginBottom: 14,
          }}>
            <div style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginBottom: 4 }}>
              Documento requerido
            </div>
            <div style={{ ...typo.title, color: TOKENS.colors.text }}>{docInfo.label}</div>
          </div>

          {errorMessage && (
            <p style={{ ...typo.caption, color: TOKENS.colors.error, marginBottom: 10 }}>
              {errorMessage}
            </p>
          )}

          <input
            ref={cameraInputRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) handleImageFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={phase === 'uploading'}
            style={{
              width: '100%', padding: '22px 16px', borderRadius: TOKENS.radius.md,
              background: 'linear-gradient(90deg,#15499B,#2B8FE0)', border: 'none',
              color: TOKENS.colors.text, fontSize: 15, fontWeight: 700, marginBottom: 10,
              opacity: phase === 'uploading' ? 0.6 : 1,
            }}
          >
            {phase === 'uploading' ? 'Subiendo...' : '📷 Tomar foto'}
          </button>

          <input
            ref={fileInputRef} type="file" accept="application/pdf,image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              handlePdfOrImageFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === 'uploading'}
            style={{
              width: '100%', padding: '14px', borderRadius: TOKENS.radius.md,
              background: 'transparent', border: `1px dashed ${TOKENS.colors.border}`,
              color: TOKENS.colors.textMuted, fontSize: 13,
            }}
          >
            o subir PDF / imagen desde el celular
          </button>

          <p style={{
            ...typo.caption, color: TOKENS.colors.textLow, textAlign: 'center', marginTop: 16,
          }}>
            Este link es de un solo uso.
          </p>
        </div>
      )}
    </div>
  )
}
