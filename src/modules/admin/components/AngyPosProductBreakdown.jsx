import { useEffect, useReducer, useRef, useState } from 'react'
import { getTodaySales } from '../api'
import {
  breakdownStateReducer,
  createInitialBreakdownState,
  createLatestRequestTracker,
  getMexicoDateKey,
  isSelectableSalesDate,
  loadPosProductBreakdown,
} from '../angyPosSalesBreakdown'
import './AngyPosProductBreakdown.css'

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const numberFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 3,
})

function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0)
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0)
}

function formatWeight(value) {
  return `${formatNumber(value)} kg`
}

function ProductCard({ product }) {
  return (
    <article className="angy-pos-breakdown__card">
      <div className="angy-pos-breakdown__card-header">
        <h3>{product.productName}</h3>
        <p>{product.sku || 'Sin SKU'}</p>
      </div>
      <dl className="angy-pos-breakdown__card-details">
        <div>
          <dt>Cantidad</dt>
          <dd>{formatNumber(product.quantity)}</dd>
        </div>
        <div>
          <dt>Monto total</dt>
          <dd>{formatMoney(product.amountTotal)}</dd>
        </div>
        <div>
          <dt>Peso</dt>
          <dd>
            {product.weightConfigured
              ? formatWeight(product.weightTotalKg)
              : 'Peso no configurado'}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function EmptyTotals() {
  return (
    <div className="angy-pos-breakdown__empty-totals" aria-label="Totales">
      <div>
        <span>Cantidad</span>
        <strong>0 unidades</strong>
      </div>
      <div>
        <span>Monto total</span>
        <strong>{formatMoney(0)}</strong>
      </div>
      <div>
        <span>Peso</span>
        <strong>0 kg</strong>
      </div>
    </div>
  )
}

export default function AngyPosProductBreakdown({
  warehouseId,
  companyId,
  loadSales = getTodaySales,
  todayOverride,
}) {
  const today = todayOverride && isSelectableSalesDate(todayOverride, todayOverride)
    ? todayOverride
    : getMexicoDateKey()
  const [selectedDate, setSelectedDate] = useState(today)
  const [retryKey, setRetryKey] = useState(0)
  const [state, dispatch] = useReducer(
    breakdownStateReducer,
    today,
    createInitialBreakdownState,
  )
  const requestTrackerRef = useRef(createLatestRequestTracker())

  useEffect(() => {
    const requestTracker = requestTrackerRef.current
    const requestId = requestTracker.begin()
    let active = true

    dispatch({ type: 'loading' })
    loadPosProductBreakdown({
      warehouseId,
      companyId,
      date: selectedDate,
      fetchSales: loadSales,
    })
      .then((result) => {
        if (active && requestTracker.isCurrent(requestId)) {
          dispatch({ type: 'success', result })
        }
      })
      .catch((error) => {
        if (active && requestTracker.isCurrent(requestId)) {
          dispatch({
            type: 'error',
            message: error?.message || 'No se pudo cargar el desglose POS',
          })
        }
      })

    return () => {
      active = false
    }
  }, [warehouseId, companyId, selectedDate, loadSales, retryKey])

  const products = state.result.products
  const totals = state.result.totals
  const hasProducts = products.length > 0

  function handleDateChange(event) {
    const nextDate = event.target.value
    if (isSelectableSalesDate(nextDate, today)) {
      setSelectedDate(nextDate)
    }
  }

  return (
    <section
      className="angy-pos-breakdown"
      aria-labelledby="angy-pos-breakdown-title"
    >
      <header className="angy-pos-breakdown__header">
        <div>
          <p className="angy-pos-breakdown__eyebrow">CAJA DEL DÍA</p>
          <h2 id="angy-pos-breakdown-title">Ventas POS por producto</h2>
        </div>
        <label className="angy-pos-breakdown__date" htmlFor="angy-pos-sales-date">
          <span>Fecha</span>
          <input
            id="angy-pos-sales-date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={handleDateChange}
          />
        </label>
      </header>

      {state.error ? (
        <div className="angy-pos-breakdown__message angy-pos-breakdown__message--error" role="alert">
          <p>{state.error}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      ) : state.loading ? (
        <div className="angy-pos-breakdown__message" aria-live="polite">
          Cargando desglose…
        </div>
      ) : !hasProducts ? (
        <div className="angy-pos-breakdown__empty">
          <p>No hay ventas POS para esta fecha.</p>
          <EmptyTotals />
        </div>
      ) : (
        <>
          <div className="angy-pos-breakdown__table-wrap">
            <table className="angy-pos-breakdown__table">
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Cantidad</th>
                  <th scope="col">Monto total</th>
                  <th scope="col">Peso</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={`${product.productId}-${product.sku}-${index}`}>
                    <td>{product.sku || 'Sin SKU'}</td>
                    <td>{product.productName}</td>
                    <td>{formatNumber(product.quantity)}</td>
                    <td>{formatMoney(product.amountTotal)}</td>
                    <td>
                      {product.weightConfigured
                        ? formatWeight(product.weightTotalKg)
                        : 'Peso no configurado'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan="2">Totales</th>
                  <td>{formatNumber(totals.quantity)}</td>
                  <td>{formatMoney(totals.amountTotal)}</td>
                  <td>{formatWeight(totals.weightTotalKg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="angy-pos-breakdown__cards">
            {products.map((product, index) => (
              <ProductCard
                key={`${product.productId}-${product.sku}-${index}`}
                product={product}
              />
            ))}
            <div className="angy-pos-breakdown__mobile-totals">
              <p>Totales</p>
              <dl>
                <div>
                  <dt>Cantidad</dt>
                  <dd>{formatNumber(totals.quantity)} unidades</dd>
                </div>
                <div>
                  <dt>Monto total</dt>
                  <dd>{formatMoney(totals.amountTotal)}</dd>
                </div>
                <div>
                  <dt>Peso</dt>
                  <dd>{formatWeight(totals.weightTotalKg)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </>
      )}

      {!state.loading && !state.error && totals.productsWithoutWeight > 0 && (
        <p className="angy-pos-breakdown__warning">
          {`${totals.productsWithoutWeight} producto(s) sin peso configurado no se incluyeron en el total de kilos.`}
        </p>
      )}
    </section>
  )
}
