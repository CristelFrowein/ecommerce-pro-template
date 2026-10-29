import { useEffect, useId, useState } from "react"

import {
  getProducts,
  getProductsByCategory
} from "../../services/productService"

import ProductCard from "../ProductCard/ProductCard"

import "./CatalogResults.css"

// ==============================
// BÚSQUEDA Y ORDENAMIENTO
// ==============================

const collator = new Intl.Collator("es-AR", {
  sensitivity: "base",
  numeric: true
})

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function getPrice(product) {
  const value = product.price

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return Infinity
  }

  const price = Number(value)

  return Number.isFinite(price) && price >= 0
    ? price
    : Infinity
}

function selectProducts(
  products,
  term = "",
  order = "name-asc"
) {
  const words = normalizeText(term)
    .split(" ")
    .filter(Boolean)

  return products
    .filter(product => {
      if (product.active === false) return false

      const name = normalizeText(product.name)

      return words.every(word => name.includes(word))
    })
    .sort((a, b) => {
      const nameOrder =
        collator.compare(
          String(a.name ?? ""),
          String(b.name ?? "")
        ) ||
        collator.compare(
          String(a.id ?? ""),
          String(b.id ?? "")
        )

      if (order === "name-desc") {
        return -nameOrder
      }

      if (
        order === "price-asc" ||
        order === "price-desc"
      ) {
        const priceA = getPrice(a)
        const priceB = getPrice(b)

        if (priceA !== priceB) {
          // Los precios inválidos quedan al final.
          if (priceA === Infinity) return 1
          if (priceB === Infinity) return -1

          return order === "price-asc"
            ? priceA - priceB
            : priceB - priceA
        }
      }

      return nameOrder
    })
}

// ==============================
// CONTENEDOR CON REINTENTO
// ==============================

function CatalogResults({
  category,
  searchTerm = "",
  emptyMessage = "No hay productos disponibles."
}) {
  const [reload, setReload] = useState(0)

  return (
    <CatalogContent
      key={JSON.stringify([category ?? null, reload])}
      category={category}
      searchTerm={searchTerm}
      emptyMessage={emptyMessage}
      onRetry={() =>
        setReload(previous => previous + 1)
      }
    />
  )
}

// ==============================
// CONTENIDO
// ==============================

function CatalogContent({
  category,
  searchTerm,
  emptyMessage,
  onRetry
}) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [order, setOrder] = useState("name-asc")

  const orderId = useId()

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const data = category
          ? await getProductsByCategory(category)
          : await getProducts()

        if (!cancelled) {
          setProducts(data)
        }
      } catch (loadError) {
        console.error(
          "Error al cargar catálogo:",
          loadError
        )

        if (!cancelled) {
          setError(
            "No pudimos cargar los productos. Intentá nuevamente."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [category])

  const visibleProducts = selectProducts(
    products,
    searchTerm,
    order
  )

  if (loading) {
    return (
      <section
        className="catalog-results"
        aria-label="Productos"
        aria-busy="true"
      >
        <p className="catalog-status" role="status">
          Cargando productos...
        </p>

        <div
          className="products-grid"
          aria-hidden="true"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="catalog-skeleton"
            />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className="catalog-message"
        aria-label="Productos"
      >
        <p role="alert">{error}</p>

        <button
          type="button"
          className="catalog-retry"
          onClick={onRetry}
        >
          Reintentar
        </button>
      </section>
    )
  }

  return (
    <section
      className="catalog-results"
      aria-label="Productos"
    >
      <div className="catalog-toolbar">
        <p
          className="catalog-count"
          role="status"
        >
          <strong>{visibleProducts.length}</strong>{" "}
          {visibleProducts.length === 1
            ? "producto"
            : "productos"}
        </p>

        <div className="catalog-sort">
          <label htmlFor={orderId}>
            Ordenar por
          </label>

          <select
            id={orderId}
            value={order}
            onChange={event =>
              setOrder(event.target.value)
            }
          >
            <option value="name-asc">
              Nombre: A a Z
            </option>

            <option value="name-desc">
              Nombre: Z a A
            </option>

            <option value="price-asc">
              Menor precio
            </option>

            <option value="price-desc">
              Mayor precio
            </option>
          </select>
        </div>
      </div>

      {visibleProducts.length > 0 ? (
        <div className="products-grid">
          {visibleProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-message">
          <p>{emptyMessage}</p>

          {searchTerm && (
            <p className="catalog-hint">
              Probá con menos palabras o con otro
              nombre de producto.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default CatalogResults