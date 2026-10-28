import { useEffect, useState, useContext } from "react"
import { Link } from "react-router-dom"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../../services/firebase"

import "./Navbar.css"
import { storeConfig } from "../../config/storeConfig"
import { FiShoppingCart } from "react-icons/fi"

import { CartContext } from "../../context/CartContext"

function Navbar(){

  const [categories, setCategories] = useState([])
  const [open, setOpen] = useState(false)

  const { cart } = useContext(CartContext)

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0)

  useEffect(() => {

    const getCategories = async () => {

      const querySnapshot = await getDocs(collection(db, "categories"))

      const cats = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setCategories(cats)
    }

    getCategories()

  }, [])

  return(

    <header className="navbar">

      <div className="container navbar-inner">

        <Link to="/" className="logo">
          {storeConfig.storeName}
        </Link>

        <nav className="nav">

          <Link to="/">Inicio</Link>

          {/* MENU CATEGORIAS */}
          <div className="dropdown">

            <button
              className="dropdown-btn"
              onClick={() => setOpen(!open)}
            >
              Categorías ▾
            </button>

            {open && (
              <div className="dropdown-menu">

                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    to={`/categoria/${cat.slug}`}
                    onClick={() => setOpen(false)}
                  >
                    {cat.name}
                  </Link>
                ))}

              </div>
            )}

          </div>

          {/* ICONO CARRITO */}
          <Link to="/cart" className="cart-icon">

            <FiShoppingCart size={22} />

            {cartCount > 0 && (
              <span className="cart-badge">
                {cartCount}
              </span>
            )}

          </Link>

        </nav>

      </div>

    </header>

  )
}

export default Navbar