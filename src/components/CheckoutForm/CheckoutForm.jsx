import "./CheckoutForm.css"
import { useState } from "react"

function CheckoutForm({ cart, total, onClose, onConfirm }) {

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    notes: ""
  })

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (!form.name || !form.phone) {
      alert("Completá nombre y teléfono")
      return
    }

    onConfirm(form)
  }

  return (

    <div
      className="checkout-modal"
      onClick={onClose}
    >

      <div
        className="checkout-box"
        onClick={(e) => e.stopPropagation()}
      >

        <h2>Finalizar compra</h2>

        {/* 🧾 RESUMEN */}
        <div className="checkout-summary">

          {cart.map(item => (
            <div key={item.id} className="summary-item">

              <img
                src={item.image}
                alt={item.name}
              />

              <div className="summary-info">
                <p className="summary-name">
                  {item.name}
                </p>

                <p className="summary-qty">
                  x{item.quantity}
                </p>
              </div>

              <div className="summary-price">
                ${item.price * item.quantity}
              </div>

            </div>
          ))}

          <div className="summary-total">
            Total: ${total}
          </div>

        </div>

        <form onSubmit={handleSubmit}>

          <div className="input-group">
            <label>Nombre</label>
            <input
              type="text"
              name="name"
              placeholder="Tu nombre"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Teléfono</label>
            <input
              type="text"
              name="phone"
              placeholder="Ej: 2231234567"
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Dirección (opcional)</label>
            <input
              type="text"
              name="address"
              placeholder="Calle, altura, etc"
              value={form.address}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Notas (opcional)</label>
            <textarea
              name="notes"
              placeholder="Ej: entregar por la tarde"
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          <div className="checkout-actions">

            <button type="submit" className="confirm-btn">
              Confirmar pedido
            </button>

            <button
              type="button"
              className="cancel-btn"
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