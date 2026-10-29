import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "react-toastify"

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "firebase/firestore"

import { db } from "../../services/firebase"
import { storeConfig } from "../../config/storeConfig"
import { useCart } from "../../hooks/useCart"
import CheckoutForm from "../../components/CheckoutForm/CheckoutForm"

import {
  formatMoney,
  getSelections,
  getStock,
  groupQuantities,
  validateSelections
} from "../../utils/cartUtils"

import "./Cart.css"

function Cart() {
  const {
    cart,
    removeFromCart,
    clearCart,
    cartTotal,
    updateQuantity
  } = useCart()

  const [showCheckout, setShowCheckout] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  const submittingRef = useRef(false)

  function changeQuantity(item, quantity) {
    const result = updateQuantity(item.cartItemId, quantity)

    if (!result.ok) toast.warning(result.message)
  }

  async function handleConfirmOrder(formData) {
    if (submittingRef.current || cart.length === 0) return

    const customer = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim()
    }

    if (!customer.name || !customer.phone) {
      toast.warning("Completá nombre y teléfono.")
      return
    }

    submittingRef.current = true
    setSubmitting(true)

    try {
      const items = cart.map(item => ({
        id: item.productId,
        productId: item.productId,
        cartItemId: item.cartItemId,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        selectedAttributes: getSelections(item.selectedAttributes)
      }))

      const quantities = groupQuantities(items)
      const orderRef = doc(collection(db, "orders"))
      const notes = formData.notes.trim()

      const total = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      )

      await runTransaction(db, async transaction => {
        const currentProducts = new Map()

        // Todas las lecturas ocurren antes de guardar.
        for (const [productId, quantity] of quantities) {
          const snapshot = await transaction.get(
            doc(db, "products", productId)
          )

          if (!snapshot.exists()) {
            throw new Error(
              "Un producto ya no existe. Quitalo del carrito para continuar."
            )
          }

          const product = {
            ...snapshot.data(),
            id: snapshot.id
          }

          if (product.active === false) {
            throw new Error(
              `"${product.name}" ya no está disponible. Quitalo del carrito.`
            )
          }

          if (quantity > getStock(product)) {
            throw new Error(
              `Stock insuficiente de "${product.name}". Hay ${getStock(product)} unidades disponibles entre todas sus opciones.`
            )
          }

          currentProducts.set(productId, product)
        }

        for (const item of items) {
          const product = currentProducts.get(item.productId)
          const currentPrice = Number(product.price)

          if (
            !Number.isFinite(item.price) ||
            item.price < 0 ||
            !Number.isFinite(currentPrice) ||
            currentPrice < 0
          ) {
            throw new Error(
              `"${item.name}" no tiene un precio válido.`
            )
          }

          if (currentPrice !== item.price) {
            throw new Error(
              `El precio de "${product.name}" cambió. Quitalo del carrito y agregalo nuevamente para actualizarlo.`
            )
          }

          validateSelections(product, item.selectedAttributes)

          // El nombre se toma del producto actual.
          item.name = product.name
        }

        transaction.set(orderRef, {
          customer,
          notes,
          items,
          total,
          status: "pending",
          createdAt: serverTimestamp()
        })
      })

      const lines = [
        "Hola! Quiero coordinar este pedido:",
        `Pedido: ${orderRef.id}`,
        ""
      ]

      for (const item of items) {
        lines.push(
          `• ${item.name} x${item.quantity} - ${formatMoney(
            item.price * item.quantity
          )}`
        )

        for (const [name, value] of Object.entries(
          item.selectedAttributes
        )) {
          lines.push(`  ${name}: ${value}`)
        }
      }

      lines.push(
        "",
        `Total: ${formatMoney(total)}`,
        "",
        `Nombre: ${customer.name}`,
        `Teléfono: ${customer.phone}`,
        `Dirección: ${customer.address || "-"}`,
        `Notas: ${notes || "-"}`
      )

      const whatsappUrl =
        `https://wa.me/${storeConfig.whatsapp}` +
        `?text=${encodeURIComponent(lines.join("\n"))}`

      setConfirmation({
        id: orderRef.id,
        total,
        whatsappUrl
      })

      clearCart()
      setShowCheckout(false)

      window.open(whatsappUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      console.error("Error al registrar pedido:", error)

      toast.error(
        error.message || "No pudimos registrar el pedido. Intentá nuevamente."
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="cart-page container">
      <h1>Carrito</h1>

      {confirmation && (
        <section className="cart-summary" role="status">
          <h2>¡Pedido registrado!</h2>
          <p>Número de pedido: {confirmation.id}</p>
          <p>Total: {formatMoney(confirmation.total)}</p>
          <p>
            Si WhatsApp no se abrió, usá el siguiente enlace para
            coordinar el pedido.
          </p>

          <a
            href={confirmation.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-order"
          >
            Abrir pedido en WhatsApp
          </a>
        </section>
      )}

      {cart.length === 0 && (
        <div>
          <p>No hay productos en el carrito.</p>
          <Link to="/">Seguir comprando</Link>
        </div>
      )}

      {cart.map(item => {
        const productQuantity = cart
          .filter(product => product.productId === item.productId)
          .reduce((sum, product) => sum + product.quantity, 0)

        const reachedStock = productQuantity >= getStock(item)

        return (
          <div key={item.cartItemId} className="cart-item">
            <img
              src={item.image}
              alt={item.name}
              className="cart-image"
            />

            <div className="cart-info">
              <h3>{item.name}</h3>

              {Object.entries(
                getSelections(item.selectedAttributes)
              ).map(([name, value]) => (
                <p key={name}>
                  <small>{name}: {value}</small>
                </p>
              ))}

              <p className="cart-price">
                {formatMoney(item.price)}
              </p>
            </div>

            <div className="cart-quantity">
              <button
                type="button"
                aria-label={`Reducir cantidad de ${item.name}`}
                disabled={submitting}
                onClick={() =>
                  changeQuantity(item, item.quantity - 1)
                }
              >
                -
              </button>

              <span>{item.quantity}</span>

              <button
                type="button"
                aria-label={`Aumentar cantidad de ${item.name}`}
                disabled={submitting || reachedStock}
                title={reachedStock ? "Stock máximo alcanzado" : "Sumar unidad"}
                onClick={() =>
                  changeQuantity(item, item.quantity + 1)
                }
              >
                +
              </button>
            </div>

            <div className="cart-subtotal">
              {formatMoney(item.price * item.quantity)}
            </div>

            <button
              type="button"
              className="remove-item"
              aria-label={`Quitar ${item.name} del carrito`}
              disabled={submitting}
              onClick={() => removeFromCart(item.cartItemId)}
            >
              ✕
            </button>
          </div>
        )
      })}

      {cart.length > 0 && (
        <div className="cart-summary">
          <h2>Total: {formatMoney(cartTotal)}</h2>

          <button
            type="button"
            className="whatsapp-order"
            disabled={submitting}
            onClick={() => setShowCheckout(true)}
          >
            Finalizar compra
          </button>

          <button
            type="button"
            className="clear-cart"
            disabled={submitting}
            onClick={clearCart}
          >
            Vaciar carrito
          </button>
        </div>
      )}

      {showCheckout && (
        <CheckoutForm
          cart={cart}
          total={cartTotal}
          submitting={submitting}
          onClose={() => {
            if (!submittingRef.current) setShowCheckout(false)
          }}
          onConfirm={handleConfirmOrder}
        />
      )}
    </div>
  )
}

export default Cart