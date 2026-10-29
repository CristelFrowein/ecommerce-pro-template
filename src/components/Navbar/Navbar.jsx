import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState
} from "react"

import {
  Link,
  useLocation,
  useNavigate
} from "react-router-dom"

import {
  FiChevronDown,
  FiSearch,
  FiShoppingCart,
  FiX
} from "react-icons/fi"

import { storeConfig } from "../../config/storeConfig"
import { CartContext } from "../../context/CartContext"
import { subscribeContent } from "../../services/contentService"
import { getStoreName } from "../../utils/storeUtils"

import "./Navbar.css"

function NavbarSearch({
  initialValue,
  onSearch
}) {
  const [value, setValue] = useState(initialValue)

  const navigate = useNavigate()
  const inputRef = useRef(null)
  const inputId = useId()

  function handleSubmit(event) {
    event.preventDefault()

    const term = value.trim()

    if (!term) {
      inputRef.current?.focus()
      return
    }

    const params = new URLSearchParams({
      q: term
    })

    inputRef.current?.blur()
    onSearch()

    navigate(`/buscar?${params.toString()}`)
  }

  return (
    <form
      className="navbar-search"
      role="search"
      aria-label="Buscar productos"
      onSubmit={handleSubmit}
    >
      <label
        htmlFor={inputId}
        className="navbar-sr-only"
      >
        Buscar productos por nombre
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="search"
        name="q"
        placeholder="Buscar productos..."
        autoComplete="off"
        maxLength={160}
        value={value}
        onChange={event =>
          setValue(event.target.value)
        }
      />

      {value && (
        <button
          type="button"
          className="navbar-search-clear"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setValue("")
            inputRef.current?.focus()
          }}
        >
          <FiX aria-hidden="true" />
        </button>
      )}

      <button
        type="submit"
        className="navbar-search-submit"
        aria-label="Buscar"
      >
        <FiSearch aria-hidden="true" />
      </button>
    </form>
  )
}

function Navbar() {
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState(false)
  const [open, setOpen] = useState(false)

  const dropdownRef = useRef(null)
  const dropdownButtonRef = useRef(null)

  const categoriesId = useId()
  const location = useLocation()

  const { cart } = useContext(CartContext)

  const storeName = getStoreName()

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const initialSearch =
    location.pathname === "/buscar"
      ? new URLSearchParams(location.search).get("q") || ""
      : ""

  useEffect(() => {
    return subscribeContent(
      "categories",
      state => {
        setCategories(
          state.items.filter(
            category => category.slug
          )
        )

        setCategoriesError(false)
        setLoadingCategories(false)
      },
      error => {
        console.error(
          "Error al cargar categorías:",
          error
        )

        setCategoriesError(true)
        setLoadingCategories(false)
      }
    )
  }, [])

  useEffect(() => {
    if (!open) return

    function handleOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false)
        dropdownButtonRef.current?.focus()
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutside
    )

    document.addEventListener(
      "focusin",
      handleOutside
    )

    document.addEventListener(
      "keydown",
      handleKeyDown
    )

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutside
      )

      document.removeEventListener(
        "focusin",
        handleOutside
      )

      document.removeEventListener(
        "keydown",
        handleKeyDown
      )
    }
  }, [open])

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link
          to="/"
          className="logo"
          onClick={() => setOpen(false)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          {storeConfig.logo && (
            <img
              key={storeConfig.logo}
              src={storeConfig.logo}
              alt=""
              width={34}
              height={34}
              style={{
                objectFit: "contain",
                flexShrink: 0
              }}
              onError={event => {
                event.currentTarget.style.display = "none"
              }}
            />
          )}

          <span style={{ minWidth: 0 }}>
            {storeName}
          </span>
        </Link>

        <NavbarSearch
          key={`${location.pathname}${location.search}`}
          initialValue={initialSearch}
          onSearch={() => setOpen(false)}
        />

        <nav
          className="nav"
          aria-label="Navegación principal"
        >
          <Link
            to="/"
            className="navbar-link"
            onClick={() => setOpen(false)}
          >
            Inicio
          </Link>

          <div
            ref={dropdownRef}
            className="dropdown"
          >
            <button
              ref={dropdownButtonRef}
              type="button"
              className="dropdown-btn"
              aria-expanded={open}
              aria-controls={categoriesId}
              onClick={() =>
                setOpen(previous => !previous)
              }
            >
              Categorías

              <FiChevronDown
                aria-hidden="true"
                className={open ? "is-open" : ""}
              />
            </button>

            {open && (
              <div
                id={categoriesId}
                className="dropdown-menu"
              >
                {loadingCategories ? (
                  <p role="status">
                    Cargando categorías...
                  </p>
                ) : categoriesError ? (
                  <p role="status">
                    No pudimos cargar las categorías.
                    Intentá recargar la página.
                  </p>
                ) : categories.length === 0 ? (
                  <p>
                    No hay categorías disponibles.
                  </p>
                ) : (
                  categories.map(category => (
                    <Link
                      key={category.id}
                      to={`/categoria/${category.slug}`}
                      onClick={() => setOpen(false)}
                    >
                      {category.name}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <Link
            to="/cart"
            className="cart-icon"
            aria-label={`Carrito: ${cartCount} ${
              cartCount === 1
                ? "producto"
                : "productos"
            }`}
            onClick={() => setOpen(false)}
          >
            <FiShoppingCart
              size={22}
              aria-hidden="true"
            />

            {cartCount > 0 && (
              <span
                className="cart-badge"
                aria-hidden="true"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Navbar