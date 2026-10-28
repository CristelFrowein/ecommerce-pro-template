import "./Category.css"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { getProductsByCategory } from "../../services/productService"
import ProductCard from "../../components/ProductCard/ProductCard"

function Category(){

  const { slug } = useParams()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    const loadProducts = async () => {

      try{

        setLoading(true)

        const data = await getProductsByCategory(slug)

        setProducts(data)

      }catch(error){

        console.error("Error cargando productos:", error)

      }finally{

        setLoading(false)

      }

    }

    loadProducts()

  }, [slug])

  const categoryTitle =
    slug?.charAt(0).toUpperCase() + slug?.slice(1)

  return(

    <div className="category-page container">

      <h1 className="category-title">
        {categoryTitle}
      </h1>

      <div className="products-grid">

        {loading ? (

          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="product-card skeleton-card"
            ></div>
          ))

        ) : products.length > 0 ? (

          products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))

        ) : (

          <p className="no-products">
            No hay productos en esta categoría.
          </p>

        )}

      </div>

    </div>

  )

}

export default Category