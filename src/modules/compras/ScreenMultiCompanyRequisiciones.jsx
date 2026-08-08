import { useEffect, useState } from 'react'
import { useSession } from '../../App.jsx'
import { TOKENS } from '../../tokens.js'
import { getMultiCompanyRequisitions, submitMultiCompanyRequisition } from './multiCompanyRequisitionApi.js'

function ScopeSelect({ scopes, value, onChange }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} style={{ width: '100%', padding: 10 }}>
    <option value="">Selecciona una empresa y Plaza</option>
    {scopes.map((scope, index) => <option key={`${scope.operating_company_id}:${scope.operating_plaza_id}`} value={index}>{scope.label}</option>)}
  </select>
}

export default function ScreenMultiCompanyRequisiciones() {
  const { runtimeCapabilities } = useSession()
  const scopes = runtimeCapabilities?.scopes || []
  const [selected, setSelected] = useState('')
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [message, setMessage] = useState('')

  const scope = selected === '' ? null : scopes[Number(selected)]
  async function load(nextScope = scope) {
    if (!nextScope) return
    try {
      const response = await getMultiCompanyRequisitions(nextScope)
      const data = response?.data || response || {}
      setItems(data.requisitions || [])
    } catch (error) { setMessage(error.message || 'No se pudieron cargar las requisiciones.') }
  }
  useEffect(() => { load() }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(event) {
    event.preventDefault()
    if (!scope) return setMessage('Selecciona un alcance autorizado.')
    try {
      await submitMultiCompanyRequisition(scope, {
        name, partner_id: Number(partnerId),
        lines: [{ product_id: Number(productId), quantity: Number(quantity) }],
      })
      setMessage('Requisición registrada.')
      setName('')
      await load()
    } catch (error) { setMessage(error.message || 'No se pudo registrar la requisición.') }
  }
  return <main style={{ minHeight: '100dvh', padding: 20, background: TOKENS.colors.bg0, color: TOKENS.colors.text }}>
    <h1>Requisiciones multiempresa</h1><p>El servidor determina almacén, ficha y autorización.</p>
    <ScopeSelect scopes={scopes} value={selected} onChange={setSelected} />
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Descripción" />
      <input required type="number" min="1" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="ID proveedor" />
      <input required type="number" min="1" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="ID producto" />
      <input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Cantidad" />
      <button type="submit">Crear requisición</button>
    </form>
    {message && <p role="status">{message}</p>}
    <h2>Requisiciones</h2><ul>{items.map((item) => <li key={item.id || item.purchase_order_id}>{item.name || `Requisición ${item.id}`}</li>)}</ul>
  </main>
}
