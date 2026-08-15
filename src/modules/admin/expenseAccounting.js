import { api, ApiError } from '../../lib/api.js'

function positiveId(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('La fecha del gasto no es válida.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new TypeError('La fecha del gasto no es válida.')
  }
  return value
}

function nonEmptyText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} es obligatorio.`)
  }
  return value.trim()
}

function positiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} debe ser mayor a cero.`)
  }
  return value
}

function optionalText(value, label) {
  if (value === undefined || value === null || value === '') return undefined
  return nonEmptyText(value, label)
}

function successfulData(response, code) {
  if (!response || response.ok === false || !response.data || typeof response.data !== 'object') {
    throw new ApiError(response?.message || 'El servidor rechazó la captura.', {
      status: 200,
      code,
    })
  }
  return response.data
}

export function buildExpenseCatalogPath({ companyId, warehouseId, date } = {}) {
  const params = new URLSearchParams({
    company_id: String(positiveId(companyId, 'La compañía')),
    warehouse_id: String(positiveId(warehouseId, 'El almacén')),
    date: dateKey(date),
  })
  return `/pwa-admin/expense-catalog?${params.toString()}`
}

export async function getExpenseCatalog(scope) {
  const data = successfulData(
    await api('GET', buildExpenseCatalogPath(scope)),
    'expense_catalog_invalid',
  )
  if (!Array.isArray(data.articles)) {
    throw new ApiError('El catálogo de gastos no es válido.', {
      status: 200,
      code: 'expense_catalog_invalid',
    })
  }
  return data.articles
}

export function buildFase0ExpensePayload({
  article,
  name,
  amount,
  quantity,
  date,
  operation,
  assetKind,
  attachmentId,
  reference,
  description,
} = {}) {
  if (!article || typeof article !== 'object') {
    throw new TypeError('Selecciona un artículo del catálogo.')
  }
  const productId = positiveId(article.product_id, 'El artículo')
  const operations = Array.isArray(article.allowed_operations) ? article.allowed_operations : []
  const assetKinds = Array.isArray(article.allowed_asset_kinds) ? article.allowed_asset_kinds : []
  const cleanOperation = optionalText(operation, 'La operación')
  const cleanAssetKind = optionalText(assetKind, 'El tipo de activo')
  if (operations.length && !operations.includes(cleanOperation)) {
    throw new TypeError('La operación no está permitida para este artículo.')
  }
  if (article.requires_asset && !cleanAssetKind) {
    throw new TypeError('El tipo de activo es obligatorio para este artículo.')
  }
  if (cleanAssetKind && !assetKinds.includes(cleanAssetKind)) {
    throw new TypeError('El tipo de activo no está permitido para este artículo.')
  }
  const payload = {
    product_id: productId,
    name: nonEmptyText(name, 'La descripción'),
    total_amount: positiveNumber(amount, 'El monto'),
    quantity: positiveNumber(quantity, 'La cantidad'),
    date: dateKey(date),
  }
  if (cleanOperation) payload.operation = cleanOperation
  if (cleanAssetKind) payload.asset_kind = cleanAssetKind
  if (attachmentId !== undefined && attachmentId !== null && attachmentId !== '') {
    payload.attachment_id = positiveId(attachmentId, 'El comprobante')
  }
  const cleanReference = optionalText(reference, 'La referencia')
  const cleanDescription = optionalText(description, 'La nota')
  if (cleanReference) payload.reference = cleanReference
  if (cleanDescription) payload.description = cleanDescription
  return payload
}

export async function uploadExpenseEvidence({ filename, base64, mime } = {}) {
  const data = successfulData(await api('POST', '/pwa/evidence/upload', {
    context: 'expense',
    filename: nonEmptyText(filename, 'El nombre del comprobante'),
    file_base64: nonEmptyText(base64, 'El comprobante'),
    mime_type: nonEmptyText(mime, 'El tipo de comprobante'),
  }), 'expense_evidence_upload_failed')
  return positiveId(data.attachment_id, 'El comprobante')
}

export async function createFase0Expense(draft) {
  const data = successfulData(
    await api('POST', '/pwa-admin/expense-create', buildFase0ExpensePayload(draft)),
    'expense_create_failed',
  )
  const expenseId = data.expense_id || data.id
  positiveId(expenseId, 'El gasto creado')
  return data
}
