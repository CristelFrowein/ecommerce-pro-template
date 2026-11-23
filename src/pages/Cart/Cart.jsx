import { getProduct } from "../../services/productService"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "react-toastify"

import { storeConfig } from "../../config/storeConfig"
import { useCart } from "../../hooks/useCart"

import CheckoutForm from "../../components/CheckoutForm/CheckoutForm"

import {
  startCheckout
} from "../../services/paymentService"

import {
  formatMoney,
  getSelections,
  getStock
} from "../../utils/cartUtils"

import "./Cart.css"

function Cart() {
  const {
    cart,
    removeFromCart,
    clearCart,
    cartTotal,
    updateQuantity,
    refreshProducts
  } = useCart()

  const [showCheckout, setShowCheckout] = useState(false)
  const [checkingCart, setCheckingCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  const submittingRef = useRef(false)
  const cartBusy = checkingCart || submitting

  async function openCheckout() {
    if (submittingRef.current || !cart.length) return
    submittingRef.current = true
    setCheckingCart(true)

    try {
      const ids = [...new Set(cart.map(item => item.productId))]
      const products = (await Promise.all(ids.map(getProduct))).filter(Boolean)
      const updatedCart = refreshProducts(products)
      const changed = updatedCart.length !== cart.length || updatedCart.some((item, index) =>
        item.cartItemId !== cart[index].cartItemId ||
        item.price !== cart[index].price ||
        item.quantity !== cart[index].quantity
      )

      if (changed) {
        toast.info(updatedCart.length
          ? "Actualizamos los precios o las cantidades disponibles. Revisá el carrito antes de continuar."
          : "Los productos del carrito ya no están disponibles.")
        return
      }

      setShowCheckout(true)
    } catch {
      toast.error("No pudimos verificar el carrito. Intentá nuevamente.")
    } finally {
      submittingRef.current = false
      setCheckingCart(false)
    }
  }

  function changeQuantity(item, quantity) {
    const result = updateQuantity(
      item.cartItemId,
      quantity
    )

    if (!result.ok) {
      toast.warning(result.message)
    }
  }

  async function handleConfirmOrder(formData) {
    if (
      submittingRef.current ||
      cart.length === 0
    ) {
      return
    }

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

    let redirecting = false

    try {
      const notes = formData.notes.trim()

      if (formData.paymentMethod === "whatsapp" && !/^\d{8,15}$/.test(storeConfig.whatsapp)) {
        throw new Error("El comercio todavía no configuró su número de WhatsApp.")
      }
      const result = await startCheckout({
        cart, customer, notes, paymentMethod: formData.paymentMethod,
        deliveryMethod: formData.deliveryMethod, postalCode: formData.postalCode,
        coupon: formData.coupon, expectedTotal: formData.expectedTotal
      })
      if (formData.paymentMethod === "mercadopago") {
        redirecting = true
        window.location.assign(result.redirectUrl)
        return
      }
      const { items, orderId, total, delivery, discount, trackingToken } = result
      const trackingUrl = `/pedido/${trackingToken}`

      const lines = [
        "Hola! Quiero coordinar este pedido:",
        `Pedido: ${orderId}`,
        ""
      ]

      for (const item of items) {
        lines.push(
          `• ${item.name} x${item.quantity} - ${formatMoney(
            item.price * item.quantity
          )}`
        )

        for (
          const [name, value] of Object.entries(
            item.selectedAttributes
          )
        ) {
          lines.push(`  ${name}: ${value}`)
        }
      }

      lines.push(
        "",
        `Entrega: ${delivery.label} · ${formatMoney(delivery.cost)}`,
        ...(discount ? [`Descuento: ${formatMoney(discount)}`] : []),
        `Total: ${formatMoney(total)}`,
        `Seguimiento: ${window.location.origin}${trackingUrl}`,
        "",
        `Nombre: ${customer.name}`,
        `Teléfono: ${customer.phone}`,
        `Dirección: ${customer.address || "-"}`,
        `Notas: ${notes || "-"}`
      )

      const whatsappUrl =
        `https://wa.me/${storeConfig.whatsapp}` +
        `?text=${encodeURIComponent(
          lines.join("\n")
        )}`

      setConfirmation({
        id: orderId,
        trackingUrl,
        total,
        whatsappUrl
      })

      clearCart()
      setShowCheckout(false)

      window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
      )
    } catch (error) {
      redirecting = false

      console.error(
        "Error al registrar pedido:",
        error
      )

      toast.error(
        error.message ||
          "No pudimos registrar el pedido. Intentá nuevamente."
      )
    } finally {
      if (!redirecting) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }

  return (
    <div className="cart-page container">
      <h1>Carrito</h1>

      {confirmation && <p><Link to={confirmation.trackingUrl}>Ver seguimiento del pedido</Link></p>}

      {confirmation && (
        <section
          className="cart-summary"
          role="status"
        >
          <h2>¡Pedido registrado!</h2>

          <p>
            Número de pedido: {confirmation.id}
          </p>

          <p>
            Total: {formatMoney(confirmation.total)}
          </p>

          <p>
            Si WhatsApp no se abrió, usá el
            siguiente enlace para coordinar el pedido.
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
          .filter(
            product =>
              product.productId === item.productId && (!item.variants?.length || product.cartItemId === item.cartItemId)
          )
          .reduce(
            (sum, product) =>
              sum + product.quantity,
            0
          )

        const reachedStock =
          productQuantity >= getStock(item, item.selectedAttributes)

        return (
          <div
            key={item.cartItemId}
            className="cart-item"
          >
            <img
              src={item.image}
              alt={item.name}
              className="cart-image"
            />

            <div className="cart-info">
              <h3>{item.name}</h3>

              {Object.entries(
                getSelections(
                  item.selectedAttributes
                )
              ).map(([name, value]) => (
                <p key={name}>
                  <small>
                    {name}: {value}
                  </small>
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
                disabled={cartBusy}
                onClick={() =>
                  changeQuantity(
                    item,
                    item.quantity - 1
                  )
                }
              >
                -
              </button>

              <span>{item.quantity}</span>

              <button
                type="button"
                aria-label={`Aumentar cantidad de ${item.name}`}
                disabled={
                  cartBusy || reachedStock
                }
                title={
                  reachedStock
                    ? "Stock máximo alcanzado"
                    : "Sumar unidad"
                }
                onClick={() =>
                  changeQuantity(
                    item,
                    item.quantity + 1
                  )
                }
              >
                +
              </button>
            </div>

            <div className="cart-subtotal">
              {formatMoney(
                item.price * item.quantity
              )}
            </div>

            <button
              type="button"
              className="remove-item"
              aria-label={`Quitar ${item.name} del carrito`}
              disabled={cartBusy}
              onClick={() =>
                removeFromCart(item.cartItemId)
              }
            >
              ✕
            </button>
          </div>
        )
      })}

      {cart.length > 0 && (
        <div className="cart-summary">
          <h2>
            Total: {formatMoney(cartTotal)}
          </h2>

          <button
            type="button"
            className="whatsapp-order"
            disabled={cartBusy}
            onClick={openCheckout}
          >
            {checkingCart ? "Verificando carrito…" : "Finalizar compra"}
          </button>

          <button
            type="button"
            className="clear-cart"
            disabled={cartBusy}
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
            if (!submittingRef.current) {
              setShowCheckout(false)
            }
          }}
          onConfirm={handleConfirmOrder}
        />
      )}
    </div>
  )
}

export default Cart
