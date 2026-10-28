import "./Cart.css"
import { useCart } from "../../hooks/useCart"
import { storeConfig } from "../../config/storeConfig"

import { useState } from "react"
import CheckoutForm from "../../components/CheckoutForm/CheckoutForm"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "../../services/firebase"

function Cart() {

  const {
    cart,
    removeFromCart,
    clearCart,
    cartTotal,
    updateQuantity
  } = useCart()

  const [showCheckout, setShowCheckout] = useState(false)

  // 🔹 SE MANTIENE (por si lo querés usar después)
  function sendWhatsAppOrder() {

    if(cart.length === 0) return

    let message = "Hola! Quiero hacer este pedido:%0A%0A"

    cart.forEach(item => {
      message += `• ${item.name} x${item.quantity} - $${item.price * item.quantity}%0A`
    })

    message += `%0A*Total: $${cartTotal}*`

    const url = `https://wa.me/${storeConfig.whatsapp}?text=${message}`

    window.open(url, "_blank")
  }

  //** confirm order */

  async function handleConfirmOrder(formData) {

  if (cart.length === 0) return

  try {

    // 🧾 guardar en firebase
    await addDoc(collection(db, "orders"), {
      customer: {
        name: formData.name,
        phone: formData.phone,
        address: formData.address || ""
      },
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      total: cartTotal,
      status: "pending",
      createdAt: serverTimestamp()
    })

    // 💬 mensaje whatsapp
    let message = `Hola! Quiero hacer este pedido:%0A%0A`

    cart.forEach(item => {
      message += `• ${item.name} x${item.quantity} - $${item.price * item.quantity}%0A`
    })

    message += `%0A*Total: $${cartTotal}*%0A%0A`

    message += `• Nombre: ${formData.name}%0A`
    message += `• Teléfono: ${formData.phone}%0A`
    message += `• Dirección: ${formData.address || "-"}%0A`
    message += `• Notas: ${formData.notes || "-"}`

    const url = `https://wa.me/${storeConfig.whatsapp}?text=${message}`

    window.open(url, "_blank")

    // 🧹 limpiar carrito
    clearCart()

    setShowCheckout(false)

  } catch (error) {
    console.error("Error al guardar pedido:", error)
    alert("Hubo un error al generar el pedido")
  }
}

  return (

    <div className="cart-page container">

      <h1>Carrito</h1>

      {cart.length === 0 && (
        <p>No hay productos en el carrito</p>
      )}

      {cart.map(item => (

        <div
          key={item.id}
          className="cart-item"
        >

          <img
            src={item.image}
            alt={item.name}
            className="cart-image"
          />

          <div className="cart-info">

            <h3>{item.name}</h3>

            <p className="cart-price">
              ${item.price}
            </p>

          </div>

          <div className="cart-quantity">

            <button
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
            >
              -
            </button>

            <span>{item.quantity}</span>

            <button
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
            >
              +
            </button>

          </div>

          <div className="cart-subtotal">
            ${item.price * item.quantity}
          </div>

          <button
            className="remove-item"
            onClick={() => removeFromCart(item.id)}
          >
            ✕
          </button>

        </div>

      ))}

      {cart.length > 0 && (

        <div className="cart-summary">

          <h2>Total: ${cartTotal}</h2>

          {/* 🔥 BOTÓN NUEVO PRO */}
          <button
            className="whatsapp-order"
            onClick={() => setShowCheckout(true)}
          >
            Finalizar compra
          </button>

          <button
            className="clear-cart"
            onClick={clearCart}
          >
            Vaciar carrito
          </button>

        </div>

      )}

      {/* 🧩 MODAL CHECKOUT */}
      {showCheckout && (
        <CheckoutForm
          cart={cart}
          total={cartTotal}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleConfirmOrder}
        />
      )}

    </div>

  )

}

export default Cart