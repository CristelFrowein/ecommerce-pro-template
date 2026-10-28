import "./Home.css"
import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../../services/firebase"

import CategoryCard from "../../components/CategoryCard/CategoryCard"
import ProductCard from "../../components/ProductCard/ProductCard"
import Hero from "../../components/Hero/Hero"

function Home(){

  const [categories,setCategories] = useState([])
  const [products,setProducts] = useState([])
  const [offers,setOffers] = useState([])

  useEffect(()=>{

    const loadData = async () => {

      // categorías
      const catSnapshot = await getDocs(collection(db,"categories"))

      const cats = catSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setCategories(cats)

      // productos
      const prodSnapshot = await getDocs(collection(db,"products"))

      const prods = prodSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setProducts(prods.slice(0,8)) // destacados

      // ofertas
      const discounted = prods.filter(p => p.discount)
      setOffers(discounted.slice(0,4))

    }

    loadData()

  },[])

  return(

    <div className="home-page">

      {/* HERO FULL WIDTH */}
      <Hero />

      {/* CONTENIDO CENTRADO */}
      <div className="container">

        {/* CATEGORÍAS */}
        <section className="home-section">

          <h2 className="section-title">
            Categorías
          </h2>

          <div className="categories-grid">

            {categories.map(cat => (
              <CategoryCard
                key={cat.id}
                category={cat}
              />
            ))}

          </div>

        </section>

        {/* PRODUCTOS DESTACADOS */}
        <section className="home-section">

          <h2 className="section-title">
            Productos destacados
          </h2>

          <div className="products-grid">

            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}

          </div>

        </section>

        {/* OFERTAS */}
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

      </div>

    </div>

  )

}

export default Home