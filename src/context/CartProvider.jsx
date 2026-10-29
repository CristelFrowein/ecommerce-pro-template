import { useEffect, useRef, useState } from "react"
import { CartContext } from "./CartContext"

import {
  getCartKey,
  getSelections,
  getStock,
  validateSelections
} from "../utils/cartUtils"

// ==============================
// RECUPERAR CARRITO GUARDADO
// ==============================

function readSavedCart() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("cart") || "[]"
    )

    if (!Array.isArray(saved)) return []

    const items = new Map()

    for (const item of saved) {
      if (!item || typeof item !== "object") continue

      const productId = item.productId || item.id
      const price = Number(item.price)
      const quantity = Number(item.quantity)

      if (
        typeof productId !== "string" ||
        !productId ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        continue
      }

      const selectedAttributes = getSelections(
        item.selectedAttributes
      )

      const cartItemId = getCartKey(
        productId,
        selectedAttributes
      )

      const existing = items.get(cartItemId)

      const nextQuantity =
        quantity + (existing?.quantity || 0)

      if (!Number.isSafeInteger(nextQuantity)) continue

      items.set(cartItemId, {
        ...item,
        id: productId,
        productId,
        cartItemId,
        price,
        quantity: nextQuantity,
        selectedAttributes
      })
    }

    return [...items.values()]
  } catch {
    return []
  }
}

// ==============================
// PROVIDER
// ==============================

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readSavedCart)
  const cartRef = useRef(cart)

  useEffect(() => {
    try {
      localStorage.setItem(
        "cart",
        JSON.stringify(cart)
      )
    } catch (error) {
      console.error(
        "No se pudo guardar el carrito:",
        error
      )
    }
  }, [cart])

  function commit(nextCart) {
    cartRef.current = nextCart
    setCart(nextCart)
  }

  // ==============================
  // AGREGAR VARIAS OPCIONES JUNTAS
  // ==============================

  function addItemsToCart(additions) {
    try {
      if (
        !Array.isArray(additions) ||
        additions.length === 0
      ) {
        throw new Error(
          "Seleccioná al menos un producto."
        )
      }

      /*
       * Trabajamos sobre una copia.
       * El carrito se actualiza una sola vez,
       * después de validar todas las opciones.
       */
      let nextCart = cartRef.current.map(
        item => ({ ...item })
      )

      const productsToValidate = new Map()

      for (const addition of additions) {
        const product = addition?.product
        const quantity = addition?.quantity

        if (
          !product ||
          typeof product.id !== "string" ||
          !product.id ||
          product.active === false
        ) {
          throw new Error(
            "Este producto no está disponible."
          )
        }

        if (
          !Number.isSafeInteger(quantity) ||
          quantity <= 0
        ) {
          throw new Error(
            "Seleccioná una cantidad válida."
          )
        }

        const stock = getStock(product)
        const price = Number(product.price)

        if (stock <= 0) {
          throw new Error(
            `"${product.name}" no tiene stock.`
          )
        }

        if (
          !Number.isFinite(price) ||
          price < 0
        ) {
          throw new Error(
            `"${product.name}" no tiene un precio válido.`
          )
        }

        const selectedAttributes =
          validateSelections(
            product,
            product.selectedAttributes
          )

        const cartItemId = getCartKey(
          product.id,
          selectedAttributes
        )

        const previousProduct =
          productsToValidate.get(product.id)

        productsToValidate.set(product.id, {
          product,
          price,
          stock: previousProduct
            ? Math.min(
                previousProduct.stock,
                stock
              )
            : stock
        })

        const existingIndex = nextCart.findIndex(
          item =>
            item.cartItemId === cartItemId
        )

        if (existingIndex >= 0) {
          const existing = nextCart[existingIndex]

          const nextQuantity =
            existing.quantity + quantity

          if (
            !Number.isSafeInteger(nextQuantity)
          ) {
            throw new Error(
              "La cantidad seleccionada no es válida."
            )
          }

          nextCart[existingIndex] = {
            ...existing,
            quantity: nextQuantity
          }
        } else {
          nextCart.push({
            ...product,
            id: product.id,
            productId: product.id,
            cartItemId,
            price,
            stock,
            image:
              product.image ||
              product.images?.[0] ||
              "",
            selectedAttributes,
            quantity
          })
        }
      }

      /*
       * Sumamos todas las variantes del mismo
       * producto, incluidas las que ya estaban
       * en el carrito.
       */
      for (const [productId, data] of productsToValidate) {
        const totalQuantity = nextCart
          .filter(
            item =>
              item.productId === productId
          )
          .reduce(
            (total, item) =>
              total + item.quantity,
            0
          )

        if (
          !Number.isSafeInteger(totalQuantity) ||
          totalQuantity > data.stock
        ) {
          throw new Error(
            `No hay suficiente stock de "${data.product.name}". ` +
            `Hay ${data.stock} unidades disponibles entre todas sus opciones, ` +
            `incluyendo las que ya tenés en el carrito.`
          )
        }
      }

      /*
       * Actualizamos los datos de todas las
       * variantes de los productos agregados.
       */
      nextCart = nextCart.map(item => {
        const latest = productsToValidate.get(
          item.productId
        )

        if (!latest) return item

        return {
          ...item,
          name: latest.product.name,
          price: latest.price,
          stock: latest.stock,
          active: true,
          image:
            latest.product.image ||
            latest.product.images?.[0] ||
            ""
        }
      })

      commit(nextCart)

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message:
          error.message ||
          "No se pudieron agregar los productos."
      }
    }
  }

  // ==============================
  // AGREGAR UN PRODUCTO
  // ==============================

  // Conserva la compatibilidad con ProductCard.
  function addToCart(product, quantity = 1) {
    return addItemsToCart([
      {
        product,
        quantity
      }
    ])
  }

  // ==============================
  // CAMBIAR CANTIDAD
  // ==============================

  function updateQuantity(
    cartItemId,
    quantity
  ) {
    const current = cartRef.current

    const item = current.find(
      product =>
        product.cartItemId === cartItemId
    )

    if (!item) {
      return {
        ok: false,
        message:
          "El producto ya no está en el carrito."
      }
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 0
    ) {
      return {
        ok: false,
        message:
          "Ingresá una cantidad válida."
      }
    }

    if (quantity === 0) {
      removeFromCart(cartItemId)

      return { ok: true }
    }

    const otherVariantsQuantity = current
      .filter(
        product =>
          product.productId === item.productId &&
          product.cartItemId !== cartItemId
      )
      .reduce(
        (total, product) =>
          total + product.quantity,
        0
      )

    const maximum = Math.max(
      0,
      getStock(item) - otherVariantsQuantity
    )

    // Permite reducir un carrito antiguo
    // aunque actualmente exceda el stock.
    if (
      quantity > maximum &&
      quantity >= item.quantity
    ) {
      return {
        ok: false,
        message:
          `No hay más stock disponible de "${item.name}".`
      }
    }

    commit(
      current.map(product =>
        product.cartItemId === cartItemId
          ? {
              ...product,
              quantity
            }
          : product
      )
    )

    return { ok: true }
  }

  // ==============================
  // QUITAR PRODUCTO
  // ==============================

  function removeFromCart(cartItemId) {
    commit(
      cartRef.current.filter(
        item =>
          item.cartItemId !== cartItemId
      )
    )
  }

  // ==============================
  // VACIAR CARRITO
  // ==============================

  function clearCart() {
    commit([])
  }

  // ==============================
  // TOTALES
  // ==============================

  const cartCount = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  )

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        addItemsToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartTotal
      }}
    >
      {children}
    </CartContext.Provider>
  )
}