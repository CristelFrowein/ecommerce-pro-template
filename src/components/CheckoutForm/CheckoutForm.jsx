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
    paymentMethod: "whatsapp"
  })

  const [error, setError] = useState("")
  const formRef = useRef(null)

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

    onConfirm(form)
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
      ? "Ir a Mercado Pago DEMO"
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
            <label htmlFor="checkout-address">
              Dirección (opcional)
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
              className="checkout-payment-select"
              value={form.paymentMethod}
              onChange={handleChange}
              disabled={submitting}
            >
              <option value="whatsapp">
                Coordinar por WhatsApp
              </option>

              <option value="mercadopago">
                Mercado Pago DEMO
              </option>
            </select>
          </div>

          {isMercadoPago && (
            <p className="checkout-payment-note">
              Vas a abrir el checkout de prueba de
              Mercado Pago. Usá exclusivamente sus
              cuentas y medios de pago de prueba.
            </p>
          )}

          <p>
            El pedido queda pendiente de
            confirmación y no reserva stock.
          </p>

          {error && (
            <p role="alert">{error}</p>
          )}

          <div className="checkout-actions">
            <button
              type="submit"
              className="confirm-btn"
              disabled={submitting}
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