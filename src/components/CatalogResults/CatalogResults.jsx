import { useEffect, useId, useState } from "react"
import { getCatalogPage } from "../../services/productService"
import { offerInfo } from "../../utils/commerce"

import ProductCard from "../ProductCard/ProductCard"

import "./CatalogResults.css"

function CatalogResults({
  category,
  searchTerm = "",
  emptyMessage = "No hay productos disponibles."
}) {
  const [reload, setReload] = useState(0)
  const [order, setOrder] = useState("name-asc")

  return (
    <CatalogContent
      key={JSON.stringify([category ?? null, searchTerm, order, reload])}
      category={category}
      order={order}
      setOrder={setOrder}
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
  order,
  setOrder,
  searchTerm,
  emptyMessage,
  onRetry
}) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cursor, setCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState("")

  const orderId = useId()

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const page = await getCatalogPage({ category, search: searchTerm, order })
        if (!cancelled) {
          setProducts(page.products)
          setCursor(page.cursor)
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
  }, [category, searchTerm, order])

  async function loadMore() {
    if (loadingMore || !cursor) return
    setLoadingMore(true)
    setMoreError("")
    try {
      const page = await getCatalogPage({ category, search: searchTerm, order, cursor })
      setProducts(previous => [...previous, ...page.products.filter(product => !previous.some(item => item.id === product.id))])
      setCursor(page.cursor)
    } catch {
      setMoreError("No pudimos cargar la página siguiente.")
    } finally { setLoadingMore(false) }
  }

  const visibleProducts = order.startsWith("price") ? [...products].sort((a, b) =>
    (offerInfo(a).price - offerInfo(b).price) * (order.endsWith("asc") ? 1 : -1)) : products

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
            ? "producto cargado"
            : "productos cargados"}
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
          <p>{cursor ? "Hay más resultados para revisar." : emptyMessage}</p>

          {searchTerm && (
            <p className="catalog-hint">
              Probá con menos palabras o con otro
              nombre de producto.
            </p>
          )}
        </div>
      )}
      {moreError && <p role="alert">{moreError}</p>}
      {cursor && <button className="catalog-retry" type="button" disabled={loadingMore} onClick={loadMore}>
        {loadingMore ? "Cargando…" : "Cargar más productos"}
      </button>}
    </section>
  )
}

export default CatalogResults