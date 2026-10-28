import { useState, useEffect } from "react"
import { CartContext } from "./CartContext"

export function CartProvider({ children }){

  const [cart, setCart] = useState(() => {

    const savedCart = localStorage.getItem("cart")
    return savedCart ? JSON.parse(savedCart) : []

  })

  useEffect(() => {

    localStorage.setItem("cart", JSON.stringify(cart))

  }, [cart])

  function addToCart(product){

    setCart(prev => {

      const exist = prev.find(p => p.id === product.id)

      if(exist){

        return prev.map(p =>
          p.id === product.id
            ? { ...p, quantity: p.quantity + 1 }
            : p
        )

      }

      return [...prev, { ...product, quantity: 1 }]

    })

  }

  function updateQuantity(id, quantity){

    if(quantity <= 0){
      removeFromCart(id)
      return
    }

    setCart(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, quantity }
          : item
      )
    )

  }

  function removeFromCart(id){

    setCart(prev => prev.filter(p => p.id !== id))

  }

  function clearCart(){

    setCart([])

  }

  const cartCount = cart.reduce(
    (acc, item) => acc + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  )

  return(

    <CartContext.Provider
      value={{
        cart,
        addToCart,
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
