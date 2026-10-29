import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import CatalogResults from "../../components/CatalogResults/CatalogResults"
import { subscribeContent } from "../../services/contentService"

import "./Category.css"

function Category() {
  const { slug } = useParams()
  const [categories, setCategories] = useState([])

  useEffect(() => {
    return subscribeContent(
      "categories",
      state => {
        setCategories(state.items)
      },
      error => {
        console.error(
          "Error al cargar nombre de categoría:",
          error
        )
      }
    )
  }, [])

  const category = categories.find(
    item => item.slug === slug
  )

  const categoryTitle =
    category?.name ||
    String(slug || "").replace(/-/g, " ")

  return (
    <main className="category-page container">
      <h1 className="category-title">
        {categoryTitle}
      </h1>

      <CatalogResults
        category={slug}
        emptyMessage="No hay productos disponibles en esta categoría."
      />
    </main>
  )
}

export default Category