import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import { useCart } from "../../hooks/useCart"

import {
  formatMoney,
  getSelectableAttributes,
  getStock
} from "../../utils/cartUtils"

import "./ProductCard.css"

function ProductCard({ product }) {
  const navigate = useNavigate()
  const { addToCart } = useCart()

  if (!product || product.active === false) return null

  const stock = getStock(product)
  const isOutOfStock = stock <= 0
  const hasOptions = getSelectableAttributes(product).length > 0
  const image = product.image || product.images?.[0] || ""

  function handleAddToCart() {
    if (isOutOfStock) return

    if (hasOptions) {
      navigate(`/producto/${product.id}`)
      return
    }

    const result = addToCart(product)

    if (!result.ok) {
      toast.warning(result.message)
      return
    }

    toast(
      <div className="cart-toast">
        <img
          src={image}
          alt={product.name}
          className="toast-image"
        />

        <div className="toast-info">
          <p className="toast-title">
            {product.name} agregado 🛒
          </p>

          <Link to="/cart" className="toast-btn">
            Ver carrito
          </Link>
        </div>
      </div>,
      { autoClose: 3000 }
    )
  }

  return (
    <div className="product-card">
      <Link
        to={`/producto/${product.id}`}
        className="product-image"
        draggable={false}
      >
        {Number(product.discount) > 0 && (
          <span className="discount-badge">
            -{product.discount}%
          </span>
        )}

        <img
          src={image}
          alt={product.name}
          loading="lazy"
          draggable={false}
        />
      </Link>

      <div className="product-info">
        <h3 className="product-title">
          {product.name}
        </h3>

        <div className="product-price">
          {Number(product.oldPrice) > 0 && (
            <span className="old-price">
              {formatMoney(product.oldPrice)}
            </span>
          )}

          <span className="price">
            {formatMoney(product.price)}
          </span>
        </div>

        <div className="product-stock">
          {stock > 5 && (
            <span className="in-stock">
              ✔ En stock
            </span>
          )}

          {stock > 0 && stock <= 5 && (
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

        <div className="product-actions">
          <button
            type="button"
            className="add-cart-btn"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
          >
            {isOutOfStock
              ? "Sin stock"
              : hasOptions
                ? "Elegir opciones"
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