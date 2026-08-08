// Mantiene el resultado de una mutación separado de la presentación para que
// cualquier rechazo semántico conserve lo que la persona ya capturó.
export async function submitOwnRequisition(form, submit) {
  try {
    await submit()
    return { ok: true }
  } catch (error) {
    return { ok: false, form, error: error?.message || 'No se pudo crear la requisición.' }
  }
}

export async function cancelOwnRequisitionWithMessage(record, cancel) {
  try {
    await cancel(record)
    return { ok: true, message: 'Requisición cancelada.' }
  } catch (error) {
    return { ok: false, error: error?.message || 'No se pudo cancelar la requisición.' }
  }
}
