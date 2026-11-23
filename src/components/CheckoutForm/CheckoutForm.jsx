import { paymentMode } from "../../config/storeConfig"
import { checkoutQuote } from "../../services/orderService"
import { useEffect, useRef, useState } from "react"

import {
  formatMoney,
  getSelections
} from "../../utils/cartUtils"

import "./CheckoutForm.css"
import "./CheckoutPayments.css"

function CheckoutForm({
  cart,
  total,
  submitting = false,
  onClose,
  onConfirm
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
    paymentMethod: "whatsapp", deliveryMethod: "", postalCode: "", coupon: ""
  })

  const [error, setError] = useState("")
  const formRef = useRef(null)
  const [methods, setMethods] = useState(null)
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState("")
  const { deliveryMethod, postalCode, coupon } = form
  const quoteKey = JSON.stringify([deliveryMethod, postalCode, coupon, total])
  const currentQuote = quote?.key === quoteKey ? quote.value : null

  useEffect(() => {
    const controller = new AbortController()
    checkoutQuote({}, controller.signal).then(options => {
      if (controller.signal.aborted) return
      setMethods(options)
      setForm(previous => ({ ...previous, deliveryMethod: options.pickup ? "pickup" : options.shipping ? "shipping" : "" }))
    }).catch(failure => { if (!controller.signal.aborted) setQuoteError(failure.message) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!deliveryMethod || (deliveryMethod === "shipping" && !postalCode.trim())) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      checkoutQuote({ subtotal: total, deliveryMethod, postalCode, coupon }, controller.signal).then(value => {
        if (controller.signal.aborted) return
        setQuote({ key: quoteKey, value })
        setQuoteError("")
      }).catch(failure => { if (!controller.signal.aborted) setQuoteError(failure.message) })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [coupon, deliveryMethod, postalCode, quoteKey, total])

  useEffect(() => {
    const previousFocus = document.activeElement

    formRef.current
      ?.querySelector("input")
      ?.focus()

    return () => {
      previousFocus?.focus?.()
    }
  }, [])

  function handleChange(event) {
    const { name, value } = event.target

    setForm(previous => ({
      ...previous,
      [name]: value
    }))

    setError("")
    setQuoteError("")
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (submitting) return

    if (
      !form.name.trim() ||
      !form.phone.trim()
    ) {
      setError("Completá nombre y teléfono.")
      return
    }

    if (!currentQuote || (deliveryMethod === "shipping" && !form.address.trim())) {
      setError("Revisá la entrega y completá los datos del envío.")
      return
    }

    onConfirm({ ...form, expectedTotal: currentQuote.total })
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (!submitting) onClose()
      return
    }

    if (event.key !== "Tab") return

    const focusable = [
      ...event.currentTarget.querySelectorAll(
        "input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)"
      )
    ]

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (!first) {
      event.preventDefault()
      return
    }

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault()
      last.focus()
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault()
      first.focus()
    }
  }

  const isMercadoPago =
    form.paymentMethod === "mercadopago"

  const buttonText = submitting
    ? isMercadoPago
      ? "Abriendo Mercado Pago..."
      : "Guardando..."
    : isMercadoPago
      ? (paymentMode === "test" ? "Ir a Mercado Pago DEMO" : "Ir a Mercado Pago")
      : "Confirmar por WhatsApp"

  return (
    <div
      className="checkout-modal"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="checkout-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        aria-busy={submitting}
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="checkout-title">
          Finalizar compra
        </h2>

        <div className="checkout-summary">
          {cart.map(item => (
            <div
              key={item.cartItemId}
              className="summary-item"
            >
              <img
                src={item.image}
                alt={item.name}
              />

              <div className="summary-info">
                <p className="summary-name">
                  {item.name}
                </p>

                {Object.entries(
                  getSelections(
                    item.selectedAttributes
                  )
                ).map(([name, value]) => (
                  <p
                    key={name}
                    className="summary-qty"
                  >
                    {name}: {value}
                  </p>
                ))}

                <p className="summary-qty">
                  x{item.quantity}
                </p>
              </div>

              <div className="summary-price">
                {formatMoney(
                  item.price * item.quantity
                )}
              </div>
            </div>
          ))}

          <div className="summary-total">
            Total: {formatMoney(total)}
          </div>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
        >
          <div className="input-group">
            <label htmlFor="checkout-name">
              Nombre
            </label>

            <input
              id="checkout-name"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Tu nombre"
              value={form.name}
              onChange={handleChange}
              disabled={submitting}
              maxLength={100}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="checkout-phone">
              Teléfono
            </label>

            <input
              id="checkout-phone"
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="Ej: 2231234567"
              value={form.phone}
              onChange={handleChange}
              disabled={submitting}
              maxLength={30}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="checkout-delivery">Entrega</label>
            <select id="checkout-delivery" className="checkout-select" name="deliveryMethod" value={deliveryMethod} onChange={handleChange} disabled={submitting || !methods}>
              {!methods && <option value="">Cargando opciones…</option>}
              {methods?.pickup && <option value="pickup">{methods.pickupLabel}</option>}
              {methods?.shipping && <option value="shipping">Envío a domicilio</option>}
            </select>
          </div>
          {deliveryMethod === "shipping" && <div className="input-group">
            <label htmlFor="checkout-postal">Código postal</label>
            <input id="checkout-postal" name="postalCode" autoComplete="postal-code" value={postalCode} onChange={handleChange} disabled={submitting} required />
          </div>}
          <div className="input-group">
            <label htmlFor="checkout-coupon">Cupón de descuento</label>
            <input id="checkout-coupon" name="coupon" maxLength={32} value={coupon} onChange={handleChange} disabled={submitting} />
          </div>
          {quoteError && <p role="alert">{quoteError}</p>}
          {currentQuote && (
            <dl className="checkout-quote" aria-live="polite">
              <div><dt>Entrega</dt><dd>{formatMoney(currentQuote.delivery.cost)}</dd></div>
              {currentQuote.discount > 0 && (
                <div><dt>Descuento</dt><dd>−{formatMoney(currentQuote.discount)}</dd></div>
              )}
              <div className="checkout-quote-total"><dt>Total final</dt><dd>{formatMoney(currentQuote.total)}</dd></div>
            </dl>
          )}

          <div className="input-group">
            <label htmlFor="checkout-address">
              {deliveryMethod === "shipping" ? "Dirección de envío" : "Dirección (opcional)"}
            </label>

            <input
              id="checkout-address"
              type="text"
              name="address"
              autoComplete="street-address"
              placeholder="Calle, altura, etc."
              value={form.address}
              onChange={handleChange}
              disabled={submitting}
              maxLength={250}
            />
          </div>

          <div className="input-group">
            <label htmlFor="checkout-notes">
              Notas (opcional)
            </label>

            <textarea
              id="checkout-notes"
              name="notes"
              placeholder="Ej: entregar por la tarde"
              value={form.notes}
              onChange={handleChange}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          <div className="input-group">
            <label htmlFor="checkout-payment">
              ¿Cómo querés continuar?
            </label>

            <select
              id="checkout-payment"
              name="paymentMethod"
              className="checkout-select"
              value={form.paymentMethod}
              onChange={handleChange}
              disabled={submitting}
            >
              <option value="whatsapp">
                Coordinar por WhatsApp
              </option>

              {paymentMode !== "off" && <option value="mercadopago">
                {paymentMode === "test" ? "Mercado Pago DEMO" : "Mercado Pago"}
              </option>}
            </select>
          </div>

          {isMercadoPago && paymentMode === "test" && (
            <p className="checkout-payment-note">
              Vas a abrir el checkout de prueba de
              Mercado Pago. Usá exclusivamente sus
              cuentas y medios de pago de prueba.
            </p>
          )}

          <p>
            {isMercadoPago ? "El stock se reserva mientras completás el pago." : "El comercio confirma el pedido y la disponibilidad por WhatsApp."}
          </p>

          {error && (
            <p role="alert">{error}</p>
          )}

          <div className="checkout-actions">
            <button
              type="submit"
              className="confirm-btn"
              disabled={submitting || !currentQuote}
            >
              {buttonText}
            </button>

            <button
              type="button"
              className="cancel-btn"
              disabled={submitting}
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CheckoutForm
