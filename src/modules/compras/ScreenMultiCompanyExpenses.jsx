import { useEffect, useState } from 'react'
import { useSession } from '../../App.jsx'
import { TOKENS } from '../../tokens.js'
import { getMultiCompanyExpenses, submitMultiCompanyExpense } from './multiCompanyExpenseApi.js'

export default function ScreenMultiCompanyExpenses() {
  const { runtimeCapabilities } = useSession()
  const scopes = runtimeCapabilities?.scopes || []
  const [selected, setSelected] = useState('')
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const scope = selected === '' ? null : scopes[Number(selected)]
  async function load(nextScope = scope) {
    if (!nextScope) return
    try {
      const response = await getMultiCompanyExpenses(nextScope)
      const data = response?.data || response || []
      setItems(Array.isArray(data) ? data : (data.expenses || []))
    } catch (error) { setMessage(error.message || 'No se pudieron cargar los gastos.') }
  }
  useEffect(() => { load() }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(event) {
    event.preventDefault()
    if (!scope) return setMessage('Selecciona un alcance autorizado.')
    try {
      await submitMultiCompanyExpense(scope, { name, total_amount: Number(amount) })
      setMessage('Gasto registrado.')
      setName(''); setAmount(''); await load()
    } catch (error) { setMessage(error.message || 'No se pudo registrar el gasto.') }
  }
  return <main style={{ minHeight: '100dvh', padding: 20, background: TOKENS.colors.bg0, color: TOKENS.colors.text }}>
    <h1>Gastos multiempresa</h1><p>El servidor publica los alcances y conserva cualquier auditoría de aprobación.</p>
    <select value={selected} onChange={(event) => setSelected(event.target.value)} style={{ width: '100%', padding: 10 }}><option value="">Selecciona una empresa y Plaza</option>{scopes.map((entry, index) => <option key={`${entry.operating_company_id}:${entry.operating_plaza_id}`} value={index}>{entry.label}</option>)}</select>
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 16 }}><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Descripción" /><input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" /><button type="submit">Registrar gasto</button></form>
    {message && <p role="status">{message}</p>}<h2>Gastos de hoy</h2><ul>{items.map((item) => <li key={item.id}>{item.name} · {item.total_amount}</li>)}</ul>
  </main>
}
