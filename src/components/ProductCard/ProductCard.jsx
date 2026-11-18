import { offerInfo } from "../../utils/commerce"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FiHeart } from "react-icons/fi"
import { toast } from "react-toastify"

import { useCart } from "../../hooks/useCart"
import { useFavorites } from "../../hooks/useFavorites"

import {
  formatMoney,
  getSelectableAttributes,
  getStock
} from "../../utils/cartUtils"

import "./ProductCard.css"

function ProductImage({
  src,
  alt,
  thumbnail = false
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={
          thumbnail
            ? "toast-image-placeholder"
            : "product-image-placeholder"
        }
        role="img"
        aria-label={`Imagen no disponible de ${alt}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="3"
          />
          <circle cx="8" cy="8" r="1.5" />
          <path d="m3 16 5-5 5 5 3-3 5 5" />
        </svg>

        {!thumbnail && (
          <span>Imagen no disponible</span>
        )}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={thumbnail ? "toast-image" : undefined}
      loading={thumbnail ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

function ProductCard({ product }) {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()

  if (!product || product.active === false) return null

  const offer = offerInfo(product)
  const favorite = isFavorite(product.id)

  const stock = getStock(product)
  const isOutOfStock = stock <= 0
  const hasOptions =
    getSelectableAttributes(product).length > 0

  const image = [
    product.image,
    ...(Array.isArray(product.images)
      ? product.images
      : [])
  ].find(
    value =>
      typeof value === "string" &&
      value.trim()
  )?.trim() || ""

  function handleFavorite() {
    const result = toggleFavorite(product.id)

    if (!result.ok) {
      toast.warning(result.message)
    }
  }

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
        <ProductImage
          key={image}
          src={image}
          alt={product.name}
          thumbnail
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
      <div className="product-card-media">
        <Link
          to={`/producto/${product.id}`}
          className="product-image"
          draggable={false}
        >
          {offer.discount > 0 && (
            <span className="discount-badge">
              -{offer.discount}%
            </span>
          )}

          <ProductImage
            key={image}
            src={image}
            alt={product.name}
          />
        </Link>

        <button
          type="button"
          className={`product-favorite-btn ${
            favorite ? "is-favorite" : ""
          }`}
          aria-label={`${
            favorite
              ? "Quitar de favoritos"
              : "Agregar a favoritos"
          }: ${product.name}`}
          aria-pressed={favorite}
          title={
            favorite
              ? "Quitar de favoritos"
              : "Agregar a favoritos"
          }
          onClick={handleFavorite}
        >
          <FiHeart aria-hidden="true" />
        </button>
      </div>

      <div className="product-info">
        <h3 className="product-title">
          {product.name}
        </h3>

        <div className="product-price">
          {offer.oldPrice > 0 && (
            <span className="old-price">
              {formatMoney(offer.oldPrice)}
            </span>
          )}

          <span className="price">
            {formatMoney(offer.price)}
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