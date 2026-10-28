import { Link } from "react-router-dom"
import { useContext } from "react"
import { CartContext } from "../../context/CartContext"
import "./ProductCard.css"

import { toast } from "react-toastify"


function ProductCard({ product }) {

  const { addToCart } =
    useContext(CartContext)


  /* ========================================
     STOCK
  ======================================== */

  const stock =
    Number(product.stock) || 0


  const isOutOfStock =
    stock <= 0


  const isLowStock =
    stock > 0 && stock <= 5


  /* ========================================
     TOAST
  ======================================== */

  const showCartToast = () => {

    toast(

      <div className="cart-toast">

        <img
          src={product.image}
          alt={product.name}
          className="toast-image"
        />


        <div className="toast-info">

          <p className="toast-title">
            {product.name} agregado 🛒
          </p>


          <Link
            to="/cart"
            className="toast-btn"
          >
            Ver carrito
          </Link>

        </div>

      </div>,

      {
        position: "bottom-right",
        autoClose: 3000
      }

    )
  }


  /* ========================================
     AGREGAR AL CARRITO
  ======================================== */

  function handleAddToCart() {

    /*
     * Seguridad adicional:
     * aunque el botón esté deshabilitado,
     * tampoco permitimos agregar mediante
     * otra llamada.
     */

    if (isOutOfStock) {
      return
    }


    addToCart(product)

    showCartToast()
  }


  /* ========================================
     RENDER
  ======================================== */

  return (

    <div className="product-card">


      {/* ========================================
          IMAGEN
      ======================================== */}

      <Link
        to={`/producto/${product.id}`}
        className="product-image"
      >

        {product.discount && (

          <span className="discount-badge">
            -{product.discount}%
          </span>

        )}


        <img
          src={product.image}
          alt={product.name}
        />

      </Link>


      {/* ========================================
          INFORMACIÓN
      ======================================== */}

      <div className="product-info">


        {/* NOMBRE */}

        <h3 className="product-title">
          {product.name}
        </h3>


        {/* ========================================
            PRECIO
        ======================================== */}

        <div className="product-price">


          {product.oldPrice && (

            <span className="old-price">
              $
              {Number(
                product.oldPrice
              ).toLocaleString("es-AR")}
            </span>

          )}


          <span className="price">
            $
            {Number(
              product.price
            ).toLocaleString("es-AR")}
          </span>


        </div>


        {/* ========================================
            STOCK
        ======================================== */}

        <div className="product-stock">


          {stock > 5 && (

            <span className="in-stock">
              ✔ En stock
            </span>

          )}


          {isLowStock && (

            <span className="low-stock">
              ⚠ Últimas unidades
            </span>

          )}


          {isOutOfStock && (

            <span className="no-stock">
              ❌ Sin stock
            </span>

          )}


        </div>


        {/* ========================================
            ACCIONES
        ======================================== */}

        <div className="product-actions">


          <button
            className="add-cart-btn"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
          >

            {isOutOfStock
              ? "Sin stock"
              : "Agregar al carrito"}

          </button>


          <Link
            to={`/producto/${product.id}`}
            className="details-btn"
          >
            Ver detalles
          </Link>


        </div>


      </div>

    </div>

  )
}


export default ProductCard