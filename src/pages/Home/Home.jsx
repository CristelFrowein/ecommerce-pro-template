import { useEffect, useState } from "react"

import { getProducts } from "../../services/productService"
import { subscribeContent } from "../../services/contentService"

import CategoryCard from "../../components/CategoryCard/CategoryCard"
import ProductCard from "../../components/ProductCard/ProductCard"
import Hero from "../../components/Hero/Hero"

import "./Home.css"

function Home() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [offers, setOffers] = useState([])

  const [loading, setLoading] = useState(true)
  const [productsError, setProductsError] = useState("")
  const [categoriesError, setCategoriesError] = useState("")

  useEffect(() => {
    return subscribeContent(
      "categories",
      state => {
        setCategories(
          state.items.filter(category => category.slug)
        )

        setCategoriesError("")
      },
      error => {
        console.error(
          "Error al cargar categorías:",
          error
        )

        setCategoriesError(
          "No pudimos cargar las categorías."
        )
      }
    )
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const data = await getProducts()

        if (cancelled) return

        const activeProducts = data.filter(
          product => product.active !== false
        )

        setProducts(activeProducts.slice(0, 8))

        setOffers(
          activeProducts
            .filter(
              product => Number(product.discount) > 0
            )
            .slice(0, 4)
        )
      } catch (error) {
        console.error(
          "Error al cargar productos:",
          error
        )

        if (!cancelled) {
          setProductsError(
            "No pudimos cargar los productos. Intentá nuevamente."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="home-page">
      <Hero />

      <div className="container">
        {categoriesError && (
          <p role="alert">{categoriesError}</p>
        )}

        {categories.length > 0 && (
          <section className="home-section">
            <h2 className="section-title">
              Categorías
            </h2>

            <div className="categories-grid">
              {categories.map(category => (
                <CategoryCard
                  key={category.id}
                  category={category}
                />
              ))}
            </div>
          </section>
        )}

        <section
          id="productos"
          className="home-section"
          style={{ scrollMarginTop: "180px" }}
        >
          <h2 className="section-title">
            Productos destacados
          </h2>

          {loading && (
            <p role="status">
              Cargando productos...
            </p>
          )}

          {productsError && (
            <p role="alert">{productsError}</p>
          )}

          {!loading &&
            !productsError &&
            products.length === 0 && (
              <p>
                No hay productos disponibles por el momento.
              </p>
            )}

          <div className="products-grid">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        </section>

        {offers.length > 0 && (
          <section className="home-section">
            <h2 className="section-title">
              Ofertas
            </h2>

            <div className="products-grid">
              {offers.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default Home